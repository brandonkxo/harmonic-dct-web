'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { OutputPanel, StatusMessage } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace } from '@/components/calculator/plot-view';
import { computeConjugateProfile, smoothConjugateProfile, buildFullCircularSpline } from '@/lib/equations';
import { PLOT_COLORS } from '@/lib/constants';
import type { PointTuple } from '@/types';
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
  const [isComputing, setIsComputingLocal] = React.useState(false);
  const [showExport, setShowExport] = React.useState(false);
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
  const outputValues = React.useMemo(() => ({
    z_c: params.z_c,
    rp_c: rp_c,
  }), [params.z_c, rp_c]);

  return (
    <div className="flex flex-col lg:flex-row gap-2 h-full">
      {/* Left Panel */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-2 overflow-y-auto">
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

        <StatusMessage message={status.message} type={status.type} />

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
          title="Circular Spline (Internal Gear)"
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
    </div>
  );
}
