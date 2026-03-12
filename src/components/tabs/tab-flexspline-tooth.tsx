'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { OutputPanel, StatusMessage } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace, createReferenceLine, createMarker } from '@/components/calculator/plot-view';
import { computeProfile } from '@/lib/equations';
import { PLOT_COLORS } from '@/lib/constants';
import { toDegrees } from '@/lib/utils';
import type { ProfileResult, PointTuple } from '@/types';

export function TabFlexsplineTooth() {
  const params = useCalculatorStore((state) => state.params);
  const setError = useCalculatorStore((state) => state.setError);

  const [result, setResult] = React.useState<ProfileResult | null>(null);
  const [status, setStatus] = React.useState<{ message: string; type: 'info' | 'success' | 'error' }>({
    message: 'Click Update to compute tooth profile.',
    type: 'info',
  });

  const handleUpdate = React.useCallback(() => {
    const computed = computeProfile(params);

    if (computed.error) {
      setError(computed.error);
      setStatus({ message: computed.error, type: 'error' });
      setResult(null);
      return;
    }

    setResult(computed);
    setError(null);
    const totalPoints = computed.pts_AB.length + computed.pts_BC.length + computed.pts_CD.length;
    setStatus({ message: `Profile computed: ${totalPoints} points`, type: 'success' });
  }, [params, setError]);

  // Initial compute
  React.useEffect(() => {
    handleUpdate();
  }, []);

  // Build plot traces
  const traces = React.useMemo(() => {
    if (!result) return [];

    const { pts_AB, pts_BC, pts_CD, ds, x1_R, y1_R, x2_R, y2_R } = result;
    const { ha, hf, m } = params;

    // Y positions for reference lines
    const y_add = ds + hf + ha;
    const y_pitch = ds + hf;
    const y_ded = ds;

    // X range
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
    plotTraces.push(createMarker(x1_R, y1_R, 'O\u2081', PLOT_COLORS.center));
    plotTraces.push(createMarker(x2_R, y2_R, 'O\u2082', PLOT_COLORS.center));

    return plotTraces;
  }, [result, params]);

  // Output values
  const outputValues = React.useMemo(() => {
    if (!result) return {};
    return {
      s: result.s,
      t: result.t,
      ds: result.ds,
      alpha: toDegrees(result.alpha),
      delta: toDegrees(result.delta),
      l1: result.l1,
      l2: result.l2,
      l3: result.l3,
      h1: result.h1,
      rp: result.rp,
    };
  }, [result]);

  return (
    <div className="flex flex-col lg:flex-row gap-2 h-full">
      {/* Left Panel - Parameters & Outputs */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-2 overflow-y-auto">
        <div className="panel">
          <div className="panel-header">Parameters</div>
          <div className="panel-body">
            <ParameterPanel onUpdate={handleUpdate} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Computed Values</div>
          <div className="panel-body">
            <OutputPanel category="flexspline_tooth" values={outputValues} />
          </div>
        </div>

        <StatusMessage message={status.message} type={status.type} />
      </div>

      {/* Right Panel - Plot */}
      <div className="flex-1 min-h-[300px] lg:min-h-0">
        <PlotView
          traces={traces}
          title="Flexspline Tooth Profile"
          xAxisLabel="X_R (mm)"
          yAxisLabel="Y_R (mm)"
          className="h-full"
        />
      </div>
    </div>
  );
}
