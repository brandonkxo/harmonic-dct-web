'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { OutputPanel, StatusMessage, ProgressBar } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace, createReferenceLine } from '@/components/calculator/plot-view';
import { computeConjugateProfile, smoothConjugateProfile } from '@/lib/equations';
import { PLOT_COLORS } from '@/lib/constants';
import type { ConjugateResult, PointTuple } from '@/types';
import { Button } from '@/components/ui/button';
import { ExportDialog } from '@/components/calculator/export-dialog';

export function TabConjugateTooth() {
  const params = useCalculatorStore((state) => state.params);
  const smooth = useCalculatorStore((state) => state.smooth);
  const setError = useCalculatorStore((state) => state.setError);
  const setComputing = useCalculatorStore((state) => state.setComputing);
  const setComputeProgress = useCalculatorStore((state) => state.setComputeProgress);

  const [result, setResult] = React.useState<ConjugateResult | null>(null);
  const [isComputing, setIsComputingLocal] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showExport, setShowExport] = React.useState(false);
  const [status, setStatus] = React.useState<{ message: string; type: 'info' | 'success' | 'error' | 'computing' }>({
    message: 'Click Update to compute conjugate profile. This may take a few seconds.',
    type: 'info',
  });

  const handleUpdate = React.useCallback(async () => {
    setIsComputingLocal(true);
    setComputing(true);
    setProgress(0);
    setStatus({ message: 'Computing conjugate profile...', type: 'computing' });

    // Use setTimeout to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const computed = computeConjugateProfile(
        params,
        720,
        1000,
        (p) => {
          setProgress(p);
          setComputeProgress(p);
        }
      );

      if (computed.error) {
        setError(computed.error);
        setStatus({ message: computed.error, type: 'error' });
        setResult(null);
      } else {
        // Apply smoothing
        const smoothed = smoothConjugateProfile(computed, smooth, 200);
        setResult(smoothed);
        setError(null);
        setStatus({
          message: `Conjugate profile computed: ${smoothed.n_pts} points in ${smoothed.n_branches} branches`,
          type: 'success',
        });
      }
    } catch (err) {
      setError('Computation failed');
      setStatus({ message: 'Computation failed', type: 'error' });
    } finally {
      setIsComputingLocal(false);
      setComputing(false);
      setProgress(100);
    }
  }, [params, smooth, setError, setComputing, setComputeProgress]);

  // Build plot traces
  const { traces, xRange } = React.useMemo(() => {
    if (!result || result.error) return { traces: [], xRange: undefined as [number, number] | undefined };

    const plotTraces = [];
    const { ha, hf, m } = params;

    // Reference lines
    const x_min = -m * Math.PI / 2;
    const x_max = m * Math.PI / 2;

    // Centered x range for viewport (symmetric around 0)
    const x_extent = Math.max(Math.abs(x_min), Math.abs(x_max)) * 1.1;
    const centeredXRange: [number, number] = [-x_extent, x_extent];

    plotTraces.push(createReferenceLine(ha, x_min, x_max, 'Addendum', PLOT_COLORS.addendum));
    plotTraces.push(createReferenceLine(0, x_min, x_max, 'Pitch', PLOT_COLORS.pitch));
    plotTraces.push(createReferenceLine(-hf, x_min, x_max, 'Dedendum', PLOT_COLORS.dedendum));

    // Raw conjugate points (dots)
    const segColors = {
      AB: PLOT_COLORS.AB,
      BC: PLOT_COLORS.BC,
      CD: PLOT_COLORS.CD,
    };

    for (const [segKey, pts] of Object.entries(result.seg_branches || {})) {
      if (pts.length > 0) {
        plotTraces.push({
          x: pts.map((p) => p[0]),
          y: pts.map((p) => p[1]),
          name: `${segKey} (raw)`,
          color: segColors[segKey as keyof typeof segColors] || PLOT_COLORS.conjugate,
          mode: 'markers' as const,
          showlegend: false,
        });
        // Mirror raw points
        plotTraces.push({
          x: pts.map((p) => -p[0]),
          y: pts.map((p) => p[1]),
          name: '',
          color: segColors[segKey as keyof typeof segColors] || PLOT_COLORS.conjugate,
          mode: 'markers' as const,
          showlegend: false,
        });
      }
    }

    // Smoothed flank
    if (result.smoothed_flank && result.smoothed_flank.length > 0) {
      plotTraces.push(
        pointsToTrace(result.smoothed_flank, 'Conjugate (smoothed)', PLOT_COLORS.conjugate, { width: 2 })
      );
      // Mirror smoothed flank
      const mirrored: PointTuple[] = result.smoothed_flank.map(([x, y]) => [-x, y]);
      plotTraces.push(
        pointsToTrace(mirrored, '', PLOT_COLORS.mirror, { width: 2, showlegend: false })
      );
    }

    return { traces: plotTraces, xRange: centeredXRange };
  }, [result, params]);

  // Output values
  const outputValues = React.useMemo((): Record<string, string | number> => {
    if (!result) return {};
    return {
      n_pts: result.n_pts,
      n_branches: result.n_branches,
      rp_c: result.rp_c,
    };
  }, [result]);

  // Points for export
  const exportPoints = React.useMemo(() => {
    if (!result || !result.smoothed_flank) return [];
    return result.smoothed_flank;
  }, [result]);

  return (
    <div className="flex flex-col lg:flex-row gap-2 h-full">
      {/* Left Panel */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-2 overflow-y-auto">
        <div className="panel">
          <div className="panel-header">Parameters</div>
          <div className="panel-body">
            <ParameterPanel
              includeSmooth
              onUpdate={handleUpdate}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Computed Values</div>
          <div className="panel-body">
            <OutputPanel category="conjugate_tooth" values={outputValues} />
          </div>
        </div>

        {isComputing && (
          <div className="space-y-2">
            <ProgressBar progress={progress} />
            <StatusMessage message={`Computing... ${progress}%`} type="computing" />
          </div>
        )}
        {!isComputing && <StatusMessage message={status.message} type={status.type} />}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExport(true)}
            disabled={!result || exportPoints.length === 0}
          >
            Export Curve
          </Button>
        </div>
      </div>

      {/* Right Panel - Plot */}
      <div className="flex-1 min-h-[300px] lg:min-h-0">
        <PlotView
          traces={traces}
          title="Conjugate Circular Spline Tooth Profile"
          xAxisLabel="X_G (mm)"
          yAxisLabel="Y (mm)"
          xRange={xRange}
          className="h-full"
        />
      </div>

      <ExportDialog
        points={exportPoints}
        defaultFilename="conjugate_tooth"
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
}
