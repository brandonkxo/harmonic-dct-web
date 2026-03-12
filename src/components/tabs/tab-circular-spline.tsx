'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { OutputPanel, StatusMessage } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace } from '@/components/calculator/plot-view';
import { computeConjugateProfile, smoothConjugateProfile } from '@/lib/equations';
import { PLOT_COLORS } from '@/lib/constants';
import type { PointTuple } from '@/types';
import { Button } from '@/components/ui/button';
import { ExportDialog } from '@/components/calculator/export-dialog';

export function TabCircularSpline() {
  const params = useCalculatorStore((state) => state.params);
  const smooth = useCalculatorStore((state) => state.smooth);
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

      const { m, z_c, ha, hf } = params;
      const rp_c = m * z_c / 2.0;
      setRpC(rp_c);

      // Build full circular spline by patterning the conjugate tooth
      const pitchAngle = (2 * Math.PI) / z_c;

      // Mirror flank for both sides
      const leftFlank: PointTuple[] = flank.slice().reverse().map(([x, y]): PointTuple => [-x, y]);

      // Transform local to global coordinates
      const chain: PointTuple[] = [];

      for (let i = 0; i < z_c; i++) {
        const angle = i * pitchAngle;

        // Add right flank
        for (const [x_loc, y_loc] of flank) {
          const r = rp_c + y_loc;
          const theta = x_loc / rp_c + angle;
          chain.push([r * Math.sin(theta), r * Math.cos(theta)]);
        }

        // Add tooth tip arc
        const tipPts = 10;
        const x_left = leftFlank[0][0];
        const x_right = flank[0][0];
        for (let j = 1; j < tipPts; j++) {
          const frac = j / tipPts;
          const x_loc = x_right + frac * (x_left - x_right);
          const y_loc = flank[0][1]; // addendum level
          const r = rp_c + y_loc;
          const theta = x_loc / rp_c + angle;
          chain.push([r * Math.sin(theta), r * Math.cos(theta)]);
        }

        // Add left flank
        for (const [x_loc, y_loc] of leftFlank) {
          const r = rp_c + y_loc;
          const theta = x_loc / rp_c + angle;
          chain.push([r * Math.sin(theta), r * Math.cos(theta)]);
        }

        // Dedendum arc to next tooth
        const nextAngle = ((i + 1) % z_c) * pitchAngle;
        const r_ded = rp_c - hf;
        const theta_end = leftFlank[leftFlank.length - 1][0] / rp_c + angle;
        const theta_next = flank[flank.length - 1][0] / rp_c + nextAngle;

        let thetaStart = theta_end;
        let thetaEnd = theta_next;
        if (thetaEnd < thetaStart) thetaEnd += 2 * Math.PI;

        const dedPts = 20;
        for (let j = 1; j <= dedPts; j++) {
          const frac = j / dedPts;
          const th = thetaStart + frac * (thetaEnd - thetaStart);
          chain.push([r_ded * Math.sin(th), r_ded * Math.cos(th)]);
        }
      }

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
  }, [params, smooth, setError, setComputing]);

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

      // Addendum circle (internal)
      const r_add = rp_c - ha; // Internal gear
      const addCircle: PointTuple[] = [];
      for (let i = 0; i <= 360; i++) {
        const theta = (i * Math.PI) / 180;
        addCircle.push([r_add * Math.sin(theta), r_add * Math.cos(theta)]);
      }
      plotTraces.push(
        pointsToTrace(addCircle, 'Addendum', PLOT_COLORS.addendum, { width: 1, dash: 'dot' })
      );

      // Dedendum circle
      const r_ded = rp_c + hf; // Internal gear
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
            <ParameterPanel includeSmooth onUpdate={handleUpdate} />
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
