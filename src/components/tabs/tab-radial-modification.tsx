'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { StatusMessage, ProgressBar } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace } from '@/components/calculator/plot-view';
import {
  buildDeformedFlexspline,
  buildFullFlexspline,
  buildFullCircularSpline,
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
import { ExportDialog } from '@/components/calculator/export-dialog';

type ViewMode = 'overlay' | 'debug';

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

  // View state
  const [viewMode, setViewMode] = React.useState<ViewMode>('overlay');
  const [showDeformed, setShowDeformed] = React.useState(true);
  const [isComputing, setIsComputing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  // Gear data
  const [fsPoints, setFsPoints] = React.useState<PointTuple[]>([]);
  const [csPoints, setCsPoints] = React.useState<PointTuple[]>([]);
  const [smoothedFlank, setSmoothedFlank] = React.useState<PointTuple[]>([]);
  const [rpC, setRpC] = React.useState(0);

  // Debug mode data
  const [debugFsTooth, setDebugFsTooth] = React.useState<PointTuple[]>([]);
  const [debugCsTooth, setDebugCsTooth] = React.useState<PointTuple[]>([]);
  const [debugFsAddendum, setDebugFsAddendum] = React.useState<PointTuple[]>([]);

  // Dmax state
  const [dmaxResult, setDmaxResult] = React.useState<DmaxResult | null>(null);
  const [trimmedTooth, setTrimmedTooth] = React.useState<PointTuple[]>([]);
  const [appliedDmax, setAppliedDmax] = React.useState<{ x: number; y: number } | null>(null);

  // Export
  const [showExport, setShowExport] = React.useState(false);

  const [status, setStatus] = React.useState<{ message: string; type: 'info' | 'success' | 'error' | 'computing' }>({
    message: 'Click Update to build gear overlay. Use Debug Single Tooth to inspect interference.',
    type: 'info',
  });

  // Build circular spline from smoothed flank (uses shared function matching Python GUI)
  const buildCircularSplineLocal = React.useCallback((flank: PointTuple[], rp_c: number): PointTuple[] => {
    if (flank.length === 0) return [];
    const result = buildFullCircularSpline(params, flank, rp_c, 100, 0.2, 0.2);
    return result.chain_xy;
  }, [params]);

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
    setAppliedDmax(null);

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

  // Initial compute on mount
  React.useEffect(() => {
    handleUpdate();
  }, []);

  // Handle dmax calculation
  const handleCalculateDmax = React.useCallback(() => {
    const result = calculateDmax();
    if (result) {
      setDmaxResult(result);
      const trimmed = applyTrim(debugFsTooth, result.dmax_x, result.dmax_y);
      setTrimmedTooth(trimmed);
      setStatus({
        message: `dmax_x = ${result.dmax_x.toFixed(3)} mm, dmax_y = ${result.dmax_y.toFixed(3)} mm`,
        type: 'success',
      });
    } else {
      setStatus({ message: 'Could not calculate interference', type: 'error' });
    }
  }, [calculateDmax, applyTrim, debugFsTooth]);

  // Toggle view mode
  const handleToggleDebug = React.useCallback(() => {
    if (viewMode === 'overlay') {
      setViewMode('debug');
      setStatus({ message: 'Debug mode: Click Calculate dmax to detect interference', type: 'info' });
    } else {
      setViewMode('overlay');
      setDmaxResult(null);
      setTrimmedTooth([]);
      setStatus({ message: 'Returned to overlay view', type: 'info' });
    }
  }, [viewMode]);

  // Build plot traces
  const traces = React.useMemo(() => {
    const plotTraces = [];

    if (viewMode === 'overlay') {
      // Full gear overlay view
      if (fsPoints.length > 0) {
        plotTraces.push(
          pointsToTrace(fsPoints, 'Flexspline', PLOT_COLORS.deformed, { width: 1 })
        );
      }
      if (csPoints.length > 0) {
        plotTraces.push(
          pointsToTrace(csPoints, 'Circular Spline', PLOT_COLORS.conjugate, { width: 1 })
        );
      }
    } else {
      // Debug single tooth view
      if (debugFsTooth.length > 0) {
        plotTraces.push(
          pointsToTrace(debugFsTooth, 'FS Tooth', PLOT_COLORS.deformed, { width: 2 })
        );
      }
      if (debugCsTooth.length > 0) {
        plotTraces.push(
          pointsToTrace(debugCsTooth, 'CS Tooth', PLOT_COLORS.conjugate, { width: 2 })
        );
      }
      if (trimmedTooth.length > 0) {
        plotTraces.push(
          pointsToTrace(trimmedTooth, 'Trimmed FS', PLOT_COLORS.modified, { width: 2 })
        );
      }
    }

    return plotTraces;
  }, [viewMode, fsPoints, csPoints, debugFsTooth, debugCsTooth, trimmedTooth]);

  // Export points
  const exportPoints = React.useMemo(() => {
    if (appliedDmax && fsPoints.length > 0) {
      return fsPoints;
    }
    return fsPoints;
  }, [fsPoints, appliedDmax]);

  return (
    <div className="flex flex-col lg:flex-row gap-2 h-full">
      {/* Left Panel */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-2 overflow-y-auto">
        <div className="panel">
          <div className="panel-header">Parameters</div>
          <div className="panel-body">
            <ParameterPanel
              includeFillets
              onUpdate={handleUpdate}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">View Controls</div>
          <div className="panel-body space-y-2">
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-2 flex-1">
                <span className={`text-xs font-medium transition-colors ${!showDeformed ? 'text-blue-600' : 'text-surface-500'}`}>
                  Undef
                </span>
                <button
                  onClick={() => setShowDeformed(!showDeformed)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                    showDeformed ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ease-in-out ${
                      showDeformed ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`text-xs font-medium transition-colors ${showDeformed ? 'text-red-600' : 'text-surface-500'}`}>
                  Def
                </span>
              </div>
              <Button
                variant={viewMode === 'debug' ? 'primary' : 'secondary'}
                size="sm"
                onClick={handleToggleDebug}
                className="flex-1"
              >
                {viewMode === 'debug' ? 'Full Gears' : 'Debug Tooth'}
              </Button>
            </div>

            {viewMode === 'debug' && (
              <div className="space-y-2 pt-2 border-t border-surface-400">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCalculateDmax}
                  disabled={debugFsTooth.length === 0 || debugCsTooth.length === 0}
                  className="w-full"
                >
                  Calculate dmax
                </Button>

                {dmaxResult && (
                  <div className="bg-surface-100 rounded p-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-surface-600">dmax_x:</span>
                      <span className="font-mono">{dmaxResult.dmax_x.toFixed(3)} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-600">dmax_y:</span>
                      <span className="font-mono">{dmaxResult.dmax_y.toFixed(3)} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-600">X interference pts:</span>
                      <span className="font-mono">{dmaxResult.x_interference_pts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-600">Y interference pts:</span>
                      <span className="font-mono">{dmaxResult.y_interference_pts}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
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
            Export FS
          </Button>
        </div>
      </div>

      {/* Right Panel - Plot */}
      <div className="flex-1 min-h-[300px] lg:min-h-0">
        <PlotView
          traces={traces}
          title={viewMode === 'overlay' ? 'Gear Overlay' : 'Single Tooth Debug'}
          xAxisLabel="X (mm)"
          yAxisLabel="Y (mm)"
          className="h-full"
        />
      </div>

      <ExportDialog
        points={exportPoints}
        defaultFilename="flexspline_radial_mod"
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
}
