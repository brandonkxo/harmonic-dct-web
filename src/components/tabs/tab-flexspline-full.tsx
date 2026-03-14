'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { OutputPanel, StatusMessage } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace, createReferenceLine, createMarker } from '@/components/calculator/plot-view';
import { buildFullFlexspline, buildDeformedFlexspline, computeProfile } from '@/lib/equations';
import { PLOT_COLORS } from '@/lib/constants';
import type { FullGearResult, PointTuple } from '@/types';
import { Button } from '@/components/ui/button';
import { ExportDialog } from '@/components/calculator/export-dialog';

export function TabFlexsplineFull() {
  const params = useCalculatorStore((state) => state.params);
  const smooth = useCalculatorStore((state) => state.smooth);
  const filletAdd = useCalculatorStore((state) => state.filletAdd);
  const filletDed = useCalculatorStore((state) => state.filletDed);
  const setError = useCalculatorStore((state) => state.setError);

  const [result, setResult] = React.useState<FullGearResult | null>(null);
  const [deformedResult, setDeformedResult] = React.useState<FullGearResult | null>(null);
  const [showDeformed, setShowDeformed] = React.useState(false);
  const [showExport, setShowExport] = React.useState(false);
  const [showSingleTooth, setShowSingleTooth] = React.useState(false);
  const [status, setStatus] = React.useState<{ message: string; type: 'info' | 'success' | 'error' }>({
    message: 'Click Update to build flexspline gear.',
    type: 'info',
  });

  const handleUpdate = React.useCallback(() => {
    // Build undeformed
    const computed = buildFullFlexspline(params, 39, filletAdd, filletDed, smooth);

    if (computed.error) {
      setError(computed.error);
      setStatus({ message: computed.error, type: 'error' });
      setResult(null);
      setDeformedResult(null);
      return;
    }

    setResult(computed);

    // Build deformed
    const deformed = buildDeformedFlexspline(params, 39, filletAdd, filletDed, smooth);
    if (!deformed.error) {
      setDeformedResult(deformed);
    }

    setError(null);
    setStatus({
      message: `Full flexspline built: ${computed.z_f} teeth, ${computed.chain_xy.length} points`,
      type: 'success',
    });
  }, [params, smooth, filletAdd, filletDed, setError]);

  // Initial compute
  React.useEffect(() => {
    handleUpdate();
  }, []);

  // Build plot traces
  const traces = React.useMemo(() => {
    const plotTraces = [];
    const displayResult = showDeformed ? deformedResult : result;

    if (displayResult && displayResult.chain_xy.length > 0) {
      plotTraces.push(
        pointsToTrace(
          displayResult.chain_xy,
          showDeformed ? 'Deformed Flexspline' : 'Flexspline',
          showDeformed ? PLOT_COLORS.deformed : PLOT_COLORS.AB,
          { width: 1 }
        )
      );

      // Add reference circles
      const { rp, rm, ds, ha, hf } = displayResult;

      // Pitch circle
      const pitchCircle: PointTuple[] = [];
      for (let i = 0; i <= 360; i++) {
        const theta = (i * Math.PI) / 180;
        pitchCircle.push([rp * Math.sin(theta), rp * Math.cos(theta)]);
      }
      plotTraces.push(
        pointsToTrace(pitchCircle, 'Pitch Circle', PLOT_COLORS.pitch, { width: 1, dash: 'dash' })
      );

      // Addendum circle
      const r_add = rp + ha;
      const addCircle: PointTuple[] = [];
      for (let i = 0; i <= 360; i++) {
        const theta = (i * Math.PI) / 180;
        addCircle.push([r_add * Math.sin(theta), r_add * Math.cos(theta)]);
      }
      plotTraces.push(
        pointsToTrace(addCircle, 'Addendum Circle', PLOT_COLORS.addendum, { width: 1, dash: 'dot' })
      );

      // Dedendum circle
      const r_ded = rm + ds;
      const dedCircle: PointTuple[] = [];
      for (let i = 0; i <= 360; i++) {
        const theta = (i * Math.PI) / 180;
        dedCircle.push([r_ded * Math.sin(theta), r_ded * Math.cos(theta)]);
      }
      plotTraces.push(
        pointsToTrace(dedCircle, 'Dedendum Circle', PLOT_COLORS.dedendum, { width: 1, dash: 'dot' })
      );
    }

    return plotTraces;
  }, [result, deformedResult, showDeformed]);

  // Output values
  const outputValues = React.useMemo((): Record<string, string | number> => {
    if (!result) return {};
    const rb = result.rm - result.t / 2; // Inner radius
    return {
      rp: result.rp,
      rm: result.rm,
      t: result.t,
      rb: rb,
    };
  }, [result]);

  // Export points
  const exportPoints = React.useMemo(() => {
    const displayResult = showDeformed ? deformedResult : result;
    return displayResult?.chain_xy || [];
  }, [result, deformedResult, showDeformed]);

  // Single tooth traces
  const singleToothTraces = React.useMemo(() => {
    const profile = computeProfile(params);
    if (profile.error) return [];

    const { pts_AB, pts_BC, pts_CD, ds, x1_R, y1_R, x2_R, y2_R } = profile;
    const { ha, hf, m } = params;

    const y_add = ds + hf + ha;
    const y_pitch = ds + hf;
    const y_ded = ds;
    const x_min = -m * Math.PI / 4;
    const x_max = m * Math.PI / 2 + m * Math.PI / 4;

    const plotTraces = [];

    // Reference lines
    plotTraces.push(createReferenceLine(y_add, x_min, x_max, 'Addendum', PLOT_COLORS.addendum));
    plotTraces.push(createReferenceLine(y_pitch, x_min, x_max, 'Pitch', PLOT_COLORS.pitch));
    plotTraces.push(createReferenceLine(y_ded, x_min, x_max, 'Dedendum', PLOT_COLORS.dedendum));

    // Profile segments
    if (pts_AB.length > 0) {
      plotTraces.push(pointsToTrace(pts_AB, 'AB (convex)', PLOT_COLORS.AB));
    }
    if (pts_BC.length > 0) {
      plotTraces.push(pointsToTrace(pts_BC, 'BC (tangent)', PLOT_COLORS.BC));
    }
    if (pts_CD.length > 0) {
      plotTraces.push(pointsToTrace(pts_CD, 'CD (concave)', PLOT_COLORS.CD));
    }

    // Mirror profiles
    if (pts_AB.length > 0) {
      const mirrored: PointTuple[] = pts_AB.map(([x, y]) => [-x, y]);
      plotTraces.push(pointsToTrace(mirrored, '', PLOT_COLORS.mirror, { showlegend: false }));
    }
    if (pts_BC.length > 0) {
      const mirrored: PointTuple[] = pts_BC.map(([x, y]) => [-x, y]);
      plotTraces.push(pointsToTrace(mirrored, '', PLOT_COLORS.mirror, { showlegend: false }));
    }
    if (pts_CD.length > 0) {
      const mirrored: PointTuple[] = pts_CD.map(([x, y]) => [-x, y]);
      plotTraces.push(pointsToTrace(mirrored, '', PLOT_COLORS.mirror, { showlegend: false }));
    }

    // Circle centers
    plotTraces.push(createMarker(x1_R, y1_R, 'O₁', PLOT_COLORS.center));
    plotTraces.push(createMarker(x2_R, y2_R, 'O₂', PLOT_COLORS.center));

    return plotTraces;
  }, [params]);

  return (
    <div className="flex flex-col lg:flex-row gap-2 h-full min-h-0">
      {/* Left Panel */}
      <div className="w-full lg:w-72 lg:h-full flex-shrink-0 space-y-2 overflow-y-auto">
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
          <div className="panel-header">Computed Values</div>
          <div className="panel-body">
            <OutputPanel category="flexspline_full" values={outputValues} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">View Controls</div>
          <div className="panel-body">
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-2 flex-1">
                <span className={`text-xs font-medium transition-colors ${!showDeformed ? 'text-green-700' : 'text-surface-500'}`}>
                  Undeformed
                </span>
                <button
                  onClick={() => setShowDeformed(!showDeformed)}
                  disabled={!deformedResult}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${
                    showDeformed ? 'bg-red-500' : 'bg-green-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ease-in-out ${
                      showDeformed ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`text-xs font-medium transition-colors ${showDeformed ? 'text-red-600' : 'text-surface-500'}`}>
                  Deformed
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSingleTooth(true)}
                className="flex-1"
              >
                Single Tooth
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExport(true)}
            disabled={exportPoints.length === 0}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Right Panel - Plot */}
      <div className="flex-1 min-h-[300px] lg:min-h-0">
        <PlotView
          traces={traces}
          title={showDeformed ? 'Deformed Flexspline' : 'Flexspline Gear'}
          xAxisLabel="X (mm)"
          yAxisLabel="Y (mm)"
          className="h-full"
        />
      </div>

      <ExportDialog
        points={exportPoints}
        defaultFilename={showDeformed ? 'flexspline_deformed' : 'flexspline_full'}
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />

      {/* Single Tooth Dialog */}
      {showSingleTooth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-surface-100 border border-surface-400 rounded w-full max-w-2xl h-[500px] p-4 shadow-xl flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-surface-700">Single Tooth Profile</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowSingleTooth(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <PlotView
                traces={singleToothTraces}
                title="Flexspline Tooth Profile"
                xAxisLabel="X_R (mm)"
                yAxisLabel="Y_R (mm)"
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
