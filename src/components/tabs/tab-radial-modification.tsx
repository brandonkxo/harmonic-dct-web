'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { StatusMessage, ProgressBar } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace, createFilledCircle } from '@/components/calculator/plot-view';
import {
  buildDeformedFlexspline,
  buildFullFlexspline,
  buildFullCircularSpline,
  buildDmaxFullFlexspline,
  buildDmaxDeformedFlexspline,
  computeConjugateProfile,
  smoothConjugateProfile,
  computeProfile,
  eq14Rho,
  eq21Mu,
  eq23Phi1,
  eq27Psi,
  eq29Transform,
} from '@/lib/equations';
import { PLOT_COLORS } from '@/lib/constants';
import type { PointTuple, GearParams, ProfileResult } from '@/types';
import { Button } from '@/components/ui/button';
import { SegmentedToggle } from '@/components/ui/toggle';
import { ExportDialog } from '@/components/calculator/export-dialog';

interface DmaxResult {
  dmax_x: number;
  dmax_y: number;
  x_interference_pts: number;
  y_interference_pts: number;
}

export function TabRadialModification() {
  const params = useCalculatorStore((state) => state.params);
  const smooth = useCalculatorStore((state) => state.smooth);
  const filletAdd = useCalculatorStore((state) => state.filletAdd);
  const filletDed = useCalculatorStore((state) => state.filletDed);
  const setError = useCalculatorStore((state) => state.setError);

  // Radial modification state from store (persisted across tab switches)
  const radialMod = useCalculatorStore((state) => state.radialMod);
  const setRadialMod = useCalculatorStore((state) => state.setRadialMod);
  const clearRadialMod = useCalculatorStore((state) => state.clearRadialMod);
  const { hasModifiedGeometry, modifiedFsPoints, appliedDmax, modifiedParams } = radialMod;

  // View state (local - no need to persist)
  const [showDeformed, setShowDeformed] = React.useState(false);
  const [showOverlapConfirm, setShowOverlapConfirm] = React.useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<(() => void) | null>(null);
  const [isApplyingFix, setIsApplyingFix] = React.useState(false);
  const [isComputing, setIsComputing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  // Gear data
  const [fsPoints, setFsPoints] = React.useState<PointTuple[]>([]);
  const [csPoints, setCsPoints] = React.useState<PointTuple[]>([]);
  const [smoothedFlank, setSmoothedFlank] = React.useState<PointTuple[]>([]);
  const [rpC, setRpC] = React.useState(0);
  const [fsRm, setFsRm] = React.useState(0);
  const [fsT, setFsT] = React.useState(0);

  // Debug mode data
  const [debugFsTooth, setDebugFsTooth] = React.useState<PointTuple[]>([]);
  const [debugCsTooth, setDebugCsTooth] = React.useState<PointTuple[]>([]);
  const [debugFsAddendum, setDebugFsAddendum] = React.useState<PointTuple[]>([]);

  // Dmax state (local - temporary calculation results)
  const [dmaxResult, setDmaxResult] = React.useState<DmaxResult | null>(null);
  const [trimmedTooth, setTrimmedTooth] = React.useState<PointTuple[]>([]);

  // Export
  const [showExport, setShowExport] = React.useState(false);

  const [status, setStatus] = React.useState<{ message: string; type: 'info' | 'success' | 'error' | 'computing' }>({
    message: 'Click Update to build gear overlay. Use Debug Single Tooth to inspect interference.',
    type: 'info',
  });

  // Build circular spline from smoothed flank (uses shared function matching Python GUI)
  const buildCircularSplineLocal = React.useCallback((flank: PointTuple[], rp_c: number): PointTuple[] => {
    if (flank.length === 0) return [];
    const result = buildFullCircularSpline(params, flank, rp_c, 100, filletAdd, filletDed);
    return result.chain_xy;
  }, [params, filletAdd, filletDed]);

  // Build single tooth for debug mode (at phi=0)
  const buildDebugTooth = React.useCallback((params: GearParams, profile: ProfileResult): {
    fsTooth: PointTuple[];
    fsAddendum: PointTuple[];
  } => {
    const { w0 } = params;
    const { rm, pts_AB, pts_BC, pts_CD } = profile;

    // Combine flank points (no fillets for debug)
    const rightFlank: PointTuple[] = [...pts_AB, ...pts_BC, ...pts_CD];
    const leftFlank: PointTuple[] = rightFlank.slice().reverse().map(([x, y]): PointTuple => [-x, y]);
    const localTooth = [...leftFlank, ...rightFlank];

    // Transform to deformed coordinates at phi=0
    const phi = 0;
    const rho = eq14Rho(phi, rm, w0);
    const mu = eq21Mu(phi, w0, rm);
    const phi1 = eq23Phi1(phi, w0, rm);
    const gamma = phi1;
    const psi = eq27Psi(mu, gamma);

    const fsTooth: PointTuple[] = localTooth.map(([xr, yr]) => eq29Transform(xr, yr, psi, rho, gamma));
    const fsAddendum: PointTuple[] = pts_AB.map(([xr, yr]) => eq29Transform(xr, yr, psi, rho, gamma));

    return { fsTooth, fsAddendum };
  }, []);

  // Build CS tooth for debug mode
  const buildDebugCsTooth = React.useCallback((flank: PointTuple[], rp_c: number): PointTuple[] => {
    if (flank.length === 0) return [];

    // rightFlank goes add→ded, leftFlank goes ded→add
    const rightFlank = [...flank].reverse();
    const leftFlank: PointTuple[] = flank.map(([x, y]): PointTuple => [-x, y]);
    const localTooth = [...leftFlank, ...rightFlank];

    // Transform to global coordinates at theta=0
    return localTooth.map(([x_loc, y_loc]): PointTuple => {
      const r = rp_c + y_loc;
      const theta = x_loc / rp_c;
      return [r * Math.sin(theta), r * Math.cos(theta)];
    });
  }, []);

  // Calculate dmax interference
  const calculateDmax = React.useCallback((): DmaxResult | null => {
    if (debugFsTooth.length === 0 || debugCsTooth.length === 0) return null;

    let dmax_x = 0;
    let dmax_y = 0;
    let x_interference_pts = 0;
    let y_interference_pts = 0;

    // Helper: interpolate X at given Y on flank
    const interpolateXAtY = (points: PointTuple[], targetY: number, side: 'left' | 'right'): number | null => {
      for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        if ((y1 <= targetY && targetY <= y2) || (y2 <= targetY && targetY <= y1)) {
          if (Math.abs(y2 - y1) < 1e-9) continue;
          const t = (targetY - y1) / (y2 - y1);
          const x = x1 + t * (x2 - x1);
          if (side === 'left' && x < 0) return x;
          if (side === 'right' && x > 0) return x;
          return x;
        }
      }
      return null;
    };

    // Helper: interpolate Y at given X on addendum
    const interpolateYAtX = (points: PointTuple[], targetX: number): number | null => {
      for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        if ((x1 <= targetX && targetX <= x2) || (x2 <= targetX && targetX <= x1)) {
          if (Math.abs(x2 - x1) < 1e-9) continue;
          const t = (targetX - x1) / (x2 - x1);
          return y1 + t * (y2 - y1);
        }
      }
      return null;
    };

    // Sort FS tooth by Y for interpolation
    const fsLeft = debugFsTooth.filter(p => p[0] < 0).sort((a, b) => a[1] - b[1]);
    const fsRight = debugFsTooth.filter(p => p[0] > 0).sort((a, b) => a[1] - b[1]);

    // Check X interference (CS penetrates FS sides)
    for (const [csX, csY] of debugCsTooth) {
      const fsLeftX = interpolateXAtY(fsLeft, csY, 'left');
      const fsRightX = interpolateXAtY(fsRight, csY, 'right');

      if (fsLeftX !== null && fsRightX !== null) {
        if (csX > fsLeftX && csX < 0) {
          const penetration = csX - fsLeftX;
          if (penetration > dmax_x) dmax_x = penetration;
          x_interference_pts++;
        }
        if (csX < fsRightX && csX > 0) {
          const penetration = fsRightX - csX;
          if (penetration > dmax_x) dmax_x = penetration;
          x_interference_pts++;
        }
      }
    }

    // Check Y interference (CS penetrates FS addendum)
    if (debugFsAddendum.length > 0) {
      const fsAddSorted = [...debugFsAddendum].sort((a, b) => a[0] - b[0]);
      const xMin = fsAddSorted[0][0];
      const xMax = fsAddSorted[fsAddSorted.length - 1][0];

      for (const [csX, csY] of debugCsTooth) {
        if (csX >= xMin && csX <= xMax) {
          const fsY = interpolateYAtX(fsAddSorted, csX);
          if (fsY !== null && csY > fsY) {
            const penetration = csY - fsY;
            if (penetration > dmax_y) dmax_y = penetration;
            y_interference_pts++;
          }
        }
      }
    }

    return { dmax_x, dmax_y, x_interference_pts, y_interference_pts };
  }, [debugFsTooth, debugCsTooth, debugFsAddendum]);

  // Apply trim to tooth
  const applyTrim = React.useCallback((tooth: PointTuple[], dmax_x: number, dmax_y: number): PointTuple[] => {
    if (tooth.length === 0) return [];

    // Apply X trim (shift sides inward)
    let trimmed: PointTuple[] = tooth.map(([x, y]): PointTuple => {
      if (x > 0) return [x - dmax_x, y];
      if (x < 0) return [x + dmax_x, y];
      return [x, y];
    });

    // Apply Y trim (lower addendum)
    if (dmax_y > 0) {
      const maxY = Math.max(...trimmed.map(p => p[1]));
      const newMaxY = maxY - dmax_y;
      trimmed = trimmed.filter(([, y]) => y <= newMaxY + 0.001);
    }

    return trimmed;
  }, []);

  // Main update function
  const handleUpdate = React.useCallback(async () => {
    setIsComputing(true);
    setProgress(0);
    setStatus({ message: 'Building gear profiles...', type: 'computing' });
    setDmaxResult(null);
    setTrimmedTooth([]);

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Build flexspline
      setProgress(10);
      const fs = showDeformed
        ? buildDeformedFlexspline(params, 39, filletAdd, filletDed, smooth)
        : buildFullFlexspline(params, 39, filletAdd, filletDed, smooth);

      if (fs.error) {
        setError(fs.error);
        setStatus({ message: fs.error, type: 'error' });
        return;
      }
      setFsPoints(fs.chain_xy);
      setFsRm(fs.rm);
      setFsT(fs.t);

      // Compute conjugate profile
      setProgress(30);
      setStatus({ message: 'Computing conjugate profile...', type: 'computing' });
      const conjugate = computeConjugateProfile(params, 720, 1000, (p) => setProgress(30 + p * 0.5));

      if (conjugate.error) {
        setError(conjugate.error);
        setStatus({ message: conjugate.error, type: 'error' });
        return;
      }

      // Smooth conjugate
      setProgress(85);
      const smoothed = smoothConjugateProfile(conjugate, smooth, 200);
      const flank = smoothed.smoothed_flank || [];
      setSmoothedFlank(flank);

      const { m, z_c } = params;
      const rp_c = m * z_c / 2.0;
      setRpC(rp_c);

      // Build circular spline
      setProgress(90);
      const cs = buildCircularSplineLocal(flank, rp_c);
      setCsPoints(cs);

      // Build debug teeth
      const profile = computeProfile(params);
      if (!profile.error) {
        const { fsTooth, fsAddendum } = buildDebugTooth(params, profile);
        setDebugFsTooth(fsTooth);
        setDebugFsAddendum(fsAddendum);
        setDebugCsTooth(buildDebugCsTooth(flank, rp_c));
      }

      setProgress(100);
      setError(null);
      setStatus({
        message: `Overlay built: FS ${params.z_f} teeth, CS ${z_c} teeth`,
        type: 'success',
      });
    } catch (err) {
      setError('Computation failed');
      setStatus({ message: 'Computation failed', type: 'error' });
    } finally {
      setIsComputing(false);
    }
  }, [params, smooth, filletAdd, filletDed, showDeformed, buildCircularSplineLocal, buildDebugTooth, buildDebugCsTooth, setError]);

  // Initial compute on mount and when showDeformed changes
  React.useEffect(() => {
    handleUpdate();
  }, [showDeformed]);

  // Handle applying overlap fix
  const handleApplyOverlapFix = React.useCallback(async () => {
    setShowOverlapConfirm(false);
    setIsApplyingFix(true);

    // Simulate processing time for UX
    await new Promise(resolve => setTimeout(resolve, 1500));

    const result = calculateDmax();
    if (result) {
      setDmaxResult(result);

      // Store dmax values for rebuilding on toggle
      const dmaxX = result.dmax_x;
      const dmaxY = result.dmax_y;

      // Build flexspline with dmax applied at the profile level (matching Python implementation)
      const modifiedFs = showDeformed
        ? buildDmaxDeformedFlexspline(params, dmaxX, dmaxY, 39, filletAdd, filletDed, smooth)
        : buildDmaxFullFlexspline(params, dmaxX, dmaxY, 39, filletAdd, filletDed, smooth);

      if (!modifiedFs.error && modifiedFs.chain_xy.length > 0) {
        setRadialMod({
          modifiedFsPoints: modifiedFs.chain_xy,
          modifiedParams: params,
          appliedDmax: { x: dmaxX, y: dmaxY },
          hasModifiedGeometry: true,
        });
        setStatus({
          message: `Overlap fix applied: dmax_x=${dmaxX.toFixed(4)}mm, dmax_y=${dmaxY.toFixed(4)}mm`,
          type: 'success',
        });
      } else {
        setStatus({ message: 'Failed to apply overlap fix', type: 'error' });
      }
    } else {
      setStatus({ message: 'Could not calculate interference', type: 'error' });
    }

    setIsApplyingFix(false);
  }, [calculateDmax, params, showDeformed, filletAdd, filletDed, smooth, setRadialMod]);

  // Check for unsaved changes before destructive actions
  const checkUnsavedChanges = React.useCallback((action: () => void) => {
    if (hasModifiedGeometry) {
      setPendingAction(() => action);
      setShowUnsavedWarning(true);
    } else {
      action();
    }
  }, [hasModifiedGeometry]);

  // Confirm discard changes
  const handleDiscardChanges = React.useCallback(() => {
    clearRadialMod();
    setDmaxResult(null);
    setShowUnsavedWarning(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction, clearRadialMod]);

  // Wrapped update handler that checks for unsaved changes
  const handleUpdateWithWarning = React.useCallback(() => {
    checkUnsavedChanges(handleUpdate);
  }, [checkUnsavedChanges, handleUpdate]);

  // Handle deformed toggle - rebuild modified geometry if we have it
  const handleToggleDeformed = React.useCallback((newShowDeformed: boolean) => {
    setShowDeformed(newShowDeformed);

    // If we have modified geometry with applied dmax, rebuild with new deformation state
    if (modifiedParams && appliedDmax) {
      const modifiedFs = newShowDeformed
        ? buildDmaxDeformedFlexspline(modifiedParams, appliedDmax.x, appliedDmax.y, 39, filletAdd, filletDed, smooth)
        : buildDmaxFullFlexspline(modifiedParams, appliedDmax.x, appliedDmax.y, 39, filletAdd, filletDed, smooth);

      if (!modifiedFs.error && modifiedFs.chain_xy.length > 0) {
        setRadialMod({ modifiedFsPoints: modifiedFs.chain_xy });
      }
    }
  }, [showDeformed, modifiedParams, appliedDmax, filletAdd, filletDed, smooth, setRadialMod]);

  // Build plot traces (always overlay view)
  const traces = React.useMemo(() => {
    const plotTraces = [];

    // Get colors based on modified state
    const fsColor = hasModifiedGeometry ? PLOT_COLORS.modified : PLOT_COLORS.deformed;
    const csColor = PLOT_COLORS.conjugate;

    // Calculate radii for ID/OD circles
    const fsRb = fsRm - fsT / 2; // Flexspline inner radius (ID)
    const csOdRadius = rpC + 4; // Circular spline outer diameter (pitch + 4mm)

    // Helper to convert hex to rgba
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Helper to generate circle points
    const generateCircle = (radius: number, numPoints: number = 361): PointTuple[] => {
      const points: PointTuple[] = [];
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i * Math.PI * 2) / numPoints;
        points.push([radius * Math.sin(theta), radius * Math.cos(theta)]);
      }
      return points;
    };

    // Show modified flexspline if available, otherwise show original
    const displayFsPoints = hasModifiedGeometry && modifiedFsPoints.length > 0
      ? modifiedFsPoints
      : fsPoints;

    // Create annular fill for Circular Spline (between OD and teeth)
    // Trace OD circle, then trace CS teeth in reverse to create ring
    if (csPoints.length > 0 && rpC > 0) {
      const odCircle = generateCircle(csOdRadius);
      const csReversed = [...csPoints].reverse();

      // Combine: OD circle -> null break -> CS teeth reversed -> back to start
      // The null creates a gap so no connecting line is drawn
      const csAnnularX: (number | null)[] = [
        ...odCircle.map(p => p[0]),
        null,
        ...csReversed.map(p => p[0])
      ];
      const csAnnularY: (number | null)[] = [
        ...odCircle.map(p => p[1]),
        null,
        ...csReversed.map(p => p[1])
      ];

      plotTraces.push({
        x: csAnnularX,
        y: csAnnularY,
        name: 'CS Body',
        color: 'transparent',
        fill: 'toself' as const,
        fillcolor: hexToRgba(csColor, 0.18),
        mode: 'lines' as const,
        width: 0,
        showlegend: false,
      });
    }

    // Create annular fill for Flexspline (between teeth and ID)
    // Trace FS teeth, then trace ID circle in reverse to create ring
    if (displayFsPoints.length > 0 && fsRb > 0) {
      const idCircle = generateCircle(fsRb);
      const idReversed = [...idCircle].reverse();

      // Combine: FS teeth -> null break -> ID circle reversed -> back to start
      const fsAnnularX: (number | null)[] = [
        ...displayFsPoints.map(p => p[0]),
        null,
        ...idReversed.map(p => p[0])
      ];
      const fsAnnularY: (number | null)[] = [
        ...displayFsPoints.map(p => p[1]),
        null,
        ...idReversed.map(p => p[1])
      ];

      plotTraces.push({
        x: fsAnnularX,
        y: fsAnnularY,
        name: 'FS Body',
        color: 'transparent',
        fill: 'toself' as const,
        fillcolor: hexToRgba(fsColor, 0.15),
        mode: 'lines' as const,
        width: 0,
        showlegend: false,
      });
    }

    // Add the gear teeth outlines on top
    if (displayFsPoints.length > 0) {
      plotTraces.push(
        pointsToTrace(
          displayFsPoints,
          hasModifiedGeometry ? 'Modified Flexspline' : 'Flexspline',
          fsColor,
          { width: 1.5 }
        )
      );
    }
    if (csPoints.length > 0) {
      plotTraces.push(
        pointsToTrace(csPoints, 'Circular Spline', csColor, { width: 1.5 })
      );
    }

    // Add ID/OD boundary lines
    if (fsRb > 0) {
      plotTraces.push(
        createFilledCircle(fsRb, 'FS ID', fsColor, 'transparent', { showlegend: false, width: 1 })
      );
    }
    if (rpC > 0) {
      plotTraces.push(
        createFilledCircle(csOdRadius, 'CS OD', csColor, 'transparent', { showlegend: false, width: 1 })
      );
    }

    return plotTraces;
  }, [fsPoints, csPoints, hasModifiedGeometry, modifiedFsPoints, fsRm, fsT, rpC]);

  // Export points
  const exportPoints = React.useMemo(() => {
    if (hasModifiedGeometry && modifiedFsPoints.length > 0) {
      return modifiedFsPoints;
    }
    return fsPoints;
  }, [fsPoints, hasModifiedGeometry, modifiedFsPoints]);

  return (
    <div className="flex flex-col lg:flex-row gap-2 h-full min-h-0">
      {/* Left Panel */}
      <div className="w-full lg:w-72 lg:h-full flex-shrink-0 space-y-2 overflow-y-auto">
        <div className="panel">
          <div className="panel-header">Parameters</div>
          <div className="panel-body">
            <ParameterPanel
              includeFillets
              onUpdate={handleUpdateWithWarning}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">View Controls</div>
          <div className="panel-body">
            <div className="flex gap-2 items-center">
              <SegmentedToggle
                value={showDeformed}
                onChange={handleToggleDeformed}
                leftLabel="Undeformed"
                rightLabel="Deformed"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowOverlapConfirm(true)}
                className={`flex-1 transition-all ${
                  hasModifiedGeometry
                    ? 'bg-green-500 hover:bg-green-600 text-white shadow-[0_0_12px_rgba(34,197,94,0.5)]'
                    : ''
                }`}
                disabled={debugFsTooth.length === 0 || debugCsTooth.length === 0}
              >
                {hasModifiedGeometry ? 'Overlap Fix Active' : 'Overlap Fix'}
              </Button>
            </div>
          </div>
        </div>

        {isComputing && (
          <div className="space-y-2">
            <ProgressBar progress={progress} />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExport(true)}
            disabled={exportPoints.length === 0}
          >
            {hasModifiedGeometry ? 'Export Overlap Modified FS' : 'Export FS'}
          </Button>
        </div>
      </div>

      {/* Right Panel - Plot */}
      <div className="flex-1 min-h-[300px] lg:min-h-0 relative">
        <PlotView
          traces={traces}
          title={hasModifiedGeometry ? "Modified Gear Overlay" : "Gear Overlay"}
          xAxisLabel="X (mm)"
          yAxisLabel="Y (mm)"
          className="h-full"
        />

        {/* Loading overlay during fix application */}
        {isApplyingFix && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-sm font-medium text-surface-700">Subtracting overlap values...</p>
            </div>
          </div>
        )}
      </div>

      <ExportDialog
        points={exportPoints}
        defaultFilename={hasModifiedGeometry ? "flexspline_modified" : "flexspline_radial_mod"}
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />

      {/* Overlap Fix Confirmation Dialog */}
      {showOverlapConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-surface-100 border border-surface-400 rounded w-full max-w-md p-4 shadow-xl">
            <h2 className="text-sm font-medium uppercase tracking-wide text-surface-700 mb-3">Overlap Fix</h2>
            <p className="text-sm text-surface-600 mb-4">
              There is a modification process available for flexspline and circular spline overlap.
              This will calculate interference values and adjust your flexspline geometry to reduce
              the risk of gear locking.
            </p>
            <p className="text-sm text-surface-700 font-medium mb-4">Would you like to run it?</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowOverlapConfirm(false)}>
                No
              </Button>
              <Button variant="primary" size="sm" onClick={handleApplyOverlapFix}>
                Yes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Warning Dialog */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-surface-100 border border-surface-400 rounded w-full max-w-md p-4 shadow-xl">
            <h2 className="text-sm font-medium uppercase tracking-wide text-red-600 mb-3">Unsaved Changes</h2>
            <p className="text-sm text-surface-600 mb-4">
              You have modified flexspline geometry that will be lost if you continue.
              We recommend exporting your changes first to save them.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowUnsavedWarning(false)}>
                Cancel
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setShowUnsavedWarning(false); setShowExport(true); }}>
                Export First
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDiscardChanges}
                className="bg-red-500 hover:bg-red-600"
              >
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
