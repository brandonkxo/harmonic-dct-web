'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { OutputPanel, StatusMessage } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace } from '@/components/calculator/plot-view';
import { buildFullFlexspline, buildDeformedFlexspline } from '@/lib/equations';
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
    return {
      z_f: result.z_f,
      rp: result.rp,
      rm: result.rm,
    };
  }, [result]);

  // Export points
  const exportPoints = React.useMemo(() => {
    const displayResult = showDeformed ? deformedResult : result;
    return displayResult?.chain_xy || [];
  }, [result, deformedResult, showDeformed]);

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
          <div className="panel-header">Computed Values</div>
          <div className="panel-body">
            <OutputPanel category="flexspline_full" values={outputValues} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
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
    </div>
  );
}
