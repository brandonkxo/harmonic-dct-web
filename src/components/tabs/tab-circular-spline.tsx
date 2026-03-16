'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { OutputPanel, StatusMessage } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace, createReferenceLine } from '@/components/calculator/plot-view';
import { computeConjugateProfile, smoothConjugateProfile, buildFullCircularSpline } from '@/lib/equations';
import { PLOT_COLORS } from '@/lib/constants';
import type { PointTuple, ConjugateResult } from '@/types';
import { Button } from '@/components/ui/button';
import { ExportDialog } from '@/components/calculator/export-dialog';

export function TabCircularSpline() {
  const params = useCalculatorStore((state) => state.params);
  const smooth = useCalculatorStore((state) => state.smooth);
  const filletAdd = useCalculatorStore((state) => state.filletAdd);
  const filletDed = useCalculatorStore((state) => state.filletDed);
  const setError = useCalculatorStore((state) => state.setError);
  const setComputing = useCalculatorStore((state) => state.setComputing);

  const [chainPoints, setChainPoints] = React.useState<PointTuple[]>([]);
  const [rp_c, setRpC] = React.useState(0);
  const [conjugateResult, setConjugateResult] = React.useState<ConjugateResult | null>(null);
  const [isComputing, setIsComputingLocal] = React.useState(false);
  const [showExport, setShowExport] = React.useState(false);
  const [showSingleTooth, setShowSingleTooth] = React.useState(false);
  const [status, setStatus] = React.useState<{ message: string; type: 'info' | 'success' | 'error' | 'computing' }>({
    message: 'Click Update to build circular spline from conjugate profile.',
    type: 'info',
  });

  const handleUpdate = React.useCallback(async () => {
    setIsComputingLocal(true);
    setComputing(true);
    setStatus({ message: 'Computing circular spline...', type: 'computing' });

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Compute conjugate profile
      const conjugate = computeConjugateProfile(params, 720, 1000);

      if (conjugate.error) {
        setError(conjugate.error);
        setStatus({ message: conjugate.error, type: 'error' });
        setChainPoints([]);
        return;
      }

      // Apply smoothing
      const smoothed = smoothConjugateProfile(conjugate, smooth, 200);
      setConjugateResult(smoothed);
      const flank = smoothed.smoothed_flank || [];

      if (flank.length === 0) {
        setStatus({ message: 'No conjugate points found', type: 'error' });
        setChainPoints([]);
        return;
      }

      const { m, z_c } = params;
      const rp_c = m * z_c / 2.0;
      setRpC(rp_c);

      // Build full circular spline using the shared function (matches Python GUI)
      const csResult = buildFullCircularSpline(params, flank, rp_c, 100, filletAdd, filletDed);

      if (csResult.error) {
        setError(csResult.error);
        setStatus({ message: csResult.error, type: 'error' });
        setChainPoints([]);
        return;
      }

      const chain = csResult.chain_xy;
      setChainPoints(chain);
      setError(null);
      setStatus({
        message: `Circular spline built: ${z_c} teeth, ${chain.length} points`,
        type: 'success',
      });
    } catch (err) {
      setError('Computation failed');
      setStatus({ message: 'Computation failed', type: 'error' });
    } finally {
      setIsComputingLocal(false);
      setComputing(false);
    }
  }, [params, smooth, filletAdd, filletDed, setError, setComputing]);

  // Initial compute on mount
  React.useEffect(() => {
    handleUpdate();
  }, []);

  // Build plot traces
  const traces = React.useMemo(() => {
    const plotTraces = [];

    if (chainPoints.length > 0) {
      plotTraces.push(
        pointsToTrace(chainPoints, 'Circular Spline', PLOT_COLORS.conjugate, { width: 1 })
      );

      // Reference circles
      const { ha, hf } = params;

      // Pitch circle
      const pitchCircle: PointTuple[] = [];
      for (let i = 0; i <= 360; i++) {
        const theta = (i * Math.PI) / 180;
        pitchCircle.push([rp_c * Math.sin(theta), rp_c * Math.cos(theta)]);
      }
      plotTraces.push(
        pointsToTrace(pitchCircle, 'Pitch Circle', PLOT_COLORS.pitch, { width: 1, dash: 'dash' })
      );

      // Addendum circle (internal gear - smaller radius)
      const r_add = rp_c - ha;
      const addCircle: PointTuple[] = [];
      for (let i = 0; i <= 360; i++) {
        const theta = (i * Math.PI) / 180;
        addCircle.push([r_add * Math.sin(theta), r_add * Math.cos(theta)]);
      }
      plotTraces.push(
        pointsToTrace(addCircle, 'Addendum', PLOT_COLORS.addendum, { width: 1, dash: 'dot' })
      );

      // Dedendum circle (internal gear - larger radius)
      const r_ded = rp_c + hf;
      const dedCircle: PointTuple[] = [];
      for (let i = 0; i <= 360; i++) {
        const theta = (i * Math.PI) / 180;
        dedCircle.push([r_ded * Math.sin(theta), r_ded * Math.cos(theta)]);
      }
      plotTraces.push(
        pointsToTrace(dedCircle, 'Dedendum', PLOT_COLORS.dedendum, { width: 1, dash: 'dot' })
      );
    }

    return plotTraces;
  }, [chainPoints, params, rp_c]);

  // Output values
  const outputValues = React.useMemo(() => {
    const t = conjugateResult?.t || 0;
    const rm_c = rp_c + t / 2; // Neutral radius for internal gear
    const rb_c = rp_c - params.ha; // Inner radius (tooth tips for internal gear)
    return {
      rp_c: rp_c,
      rm_c: rm_c,
      rb_c: rb_c,
    };
  }, [params.ha, rp_c, conjugateResult]);

  // Single tooth traces (conjugate profile)
  const singleToothTraces = React.useMemo(() => {
    if (!conjugateResult || conjugateResult.error) return [];

    const plotTraces = [];
    const { ha, hf, m } = params;

    // Reference lines
    const x_min = -m * Math.PI / 2;
    const x_max = m * Math.PI / 2;

    plotTraces.push(createReferenceLine(ha, x_min, x_max, 'Addendum', PLOT_COLORS.addendum));
    plotTraces.push(createReferenceLine(0, x_min, x_max, 'Pitch', PLOT_COLORS.pitch));
    plotTraces.push(createReferenceLine(-hf, x_min, x_max, 'Dedendum', PLOT_COLORS.dedendum));

    // Raw conjugate points (dots)
    const segColors = {
      AB: PLOT_COLORS.AB,
      BC: PLOT_COLORS.BC,
      CD: PLOT_COLORS.CD,
    };

    for (const [segKey, pts] of Object.entries(conjugateResult.seg_branches || {})) {
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
    if (conjugateResult.smoothed_flank && conjugateResult.smoothed_flank.length > 0) {
      plotTraces.push(
        pointsToTrace(conjugateResult.smoothed_flank, 'Conjugate (smoothed)', PLOT_COLORS.conjugate, { width: 2 })
      );
      // Mirror smoothed flank
      const mirrored: PointTuple[] = conjugateResult.smoothed_flank.map(([x, y]) => [-x, y]);
      plotTraces.push(
        pointsToTrace(mirrored, '', PLOT_COLORS.mirror, { width: 2, showlegend: false })
      );
    }

    return plotTraces;
  }, [conjugateResult, params]);

  return (
    <div className="flex flex-col lg:flex-row gap-2 h-full min-h-0">
      {/* Left Panel */}
      <div className="w-full lg:w-72 lg:h-full flex-shrink-0 space-y-2 overflow-y-auto">
        <div className="panel">
          <div className="panel-header">Parameters</div>
          <div className="panel-body">
            <ParameterPanel includeFillets onUpdate={handleUpdate} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Computed Values</div>
          <div className="panel-body">
            <OutputPanel category="circular_spline" values={outputValues} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">View Controls</div>
          <div className="panel-body">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSingleTooth(true)}
              disabled={!conjugateResult}
              className="w-full py-3"
            >
              Single Tooth
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExport(true)}
            disabled={chainPoints.length === 0}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Right Panel - Plot */}
      <div className="flex-1 min-h-[300px] lg:min-h-0">
        <PlotView
          traces={traces}
          title="Circular Spline"
          xAxisLabel="X (mm)"
          yAxisLabel="Y (mm)"
          className="h-full"
        />
      </div>

      <ExportDialog
        points={chainPoints}
        defaultFilename="circular_spline"
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />

      {/* Single Tooth Dialog */}
      {showSingleTooth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-surface-100 border border-surface-400 rounded w-full max-w-2xl h-[500px] p-4 shadow-xl flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-surface-700">Conjugate Tooth Profile</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowSingleTooth(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <PlotView
                traces={singleToothTraces}
                title="Circular Spline Tooth Profile"
                xAxisLabel="X_G (mm)"
                yAxisLabel="Y (mm)"
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
