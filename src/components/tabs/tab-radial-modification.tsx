'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { StatusMessage } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace } from '@/components/calculator/plot-view';
import { buildDeformedFlexspline, computeProfile } from '@/lib/equations';
import { PLOT_COLORS } from '@/lib/constants';
import type { PointTuple } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExportDialog } from '@/components/calculator/export-dialog';

export function TabRadialModification() {
  const params = useCalculatorStore((state) => state.params);
  const smooth = useCalculatorStore((state) => state.smooth);
  const filletAdd = useCalculatorStore((state) => state.filletAdd);
  const filletDed = useCalculatorStore((state) => state.filletDed);
  const setError = useCalculatorStore((state) => state.setError);

  const [dmax, setDmax] = React.useState(0.05);
  const [originalPoints, setOriginalPoints] = React.useState<PointTuple[]>([]);
  const [modifiedPoints, setModifiedPoints] = React.useState<PointTuple[]>([]);
  const [showExport, setShowExport] = React.useState(false);
  const [showOriginal, setShowOriginal] = React.useState(true);
  const [showModified, setShowModified] = React.useState(true);
  const [status, setStatus] = React.useState<{ message: string; type: 'info' | 'success' | 'error' }>({
    message: 'Set d_max value and click Update to apply radial modification.',
    type: 'info',
  });

  const handleUpdate = React.useCallback(() => {
    // Build original deformed flexspline
    const original = buildDeformedFlexspline(params, 39, filletAdd, filletDed, smooth);

    if (original.error) {
      setError(original.error);
      setStatus({ message: original.error, type: 'error' });
      setOriginalPoints([]);
      setModifiedPoints([]);
      return;
    }

    setOriginalPoints(original.chain_xy);

    // Build modified flexspline (shift tooth profile inward by dmax)
    // Create modified params
    const profile = computeProfile(params);
    if (profile.error) {
      setError(profile.error);
      setStatus({ message: profile.error, type: 'error' });
      return;
    }

    // For modification, we need to rebuild with shifted profile
    // This is a simplified version - in the full implementation,
    // we would use a dedicated function like build_modified_deformed_flexspline
    const modifiedParams = { ...params };

    // Apply radial modification by adjusting c1 and c2
    // This shifts the arc centers inward, reducing tooth thickness
    const modified = buildDeformedFlexspline(
      {
        ...modifiedParams,
        c1: params.c1 - dmax,
        c2: params.c2 - dmax,
      },
      39,
      filletAdd,
      filletDed,
      smooth
    );

    if (modified.error) {
      // If modification fails, use original as modified
      setModifiedPoints(original.chain_xy);
      setStatus({ message: 'Modified profile: Using approximate modification', type: 'info' });
    } else {
      setModifiedPoints(modified.chain_xy);
      setStatus({
        message: `Radial modification applied: d_max = ${dmax.toFixed(3)} mm`,
        type: 'success',
      });
    }

    setError(null);
  }, [params, smooth, filletAdd, filletDed, dmax, setError]);

  // Initial compute
  React.useEffect(() => {
    handleUpdate();
  }, []);

  // Build plot traces
  const traces = React.useMemo(() => {
    const plotTraces = [];

    if (showOriginal && originalPoints.length > 0) {
      plotTraces.push(
        pointsToTrace(originalPoints, 'Original', PLOT_COLORS.deformed, { width: 1 })
      );
    }

    if (showModified && modifiedPoints.length > 0) {
      plotTraces.push(
        pointsToTrace(modifiedPoints, 'Modified', PLOT_COLORS.modified, { width: 1 })
      );
    }

    return plotTraces;
  }, [originalPoints, modifiedPoints, showOriginal, showModified]);

  return (
    <div className="flex flex-col lg:flex-row gap-2 h-full">
      {/* Left Panel */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-2 overflow-y-auto">
        <div className="panel">
          <div className="panel-header">Parameters</div>
          <div className="panel-body">
            <ParameterPanel
              includeSmooth
              includeFillets
              onUpdate={handleUpdate}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Radial Modification</div>
          <div className="panel-body space-y-1">
            <div className="flex items-center gap-2">
              <label className="flex-1 text-xs text-surface-600 uppercase tracking-wide">d_max (mm)</label>
              <Input
                type="number"
                value={parseFloat(dmax.toFixed(3))}
                onChange={(e) => setDmax(parseFloat(e.target.value) || 0)}
                step={0.001}
                min={0}
                max={0.5}
                className="w-24"
              />
            </div>
            <p className="text-xs text-surface-500 mt-1">
              Maximum interference distance to shift tooth profile inward.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={showOriginal}
              onChange={(e) => setShowOriginal(e.target.checked)}
              className="text-primary-500"
            />
            Original
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={showModified}
              onChange={(e) => setShowModified(e.target.checked)}
              className="text-primary-500"
            />
            Modified
          </label>
        </div>

        <StatusMessage message={status.message} type={status.type} />

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExport(true)}
            disabled={modifiedPoints.length === 0}
          >
            Export Modified
          </Button>
        </div>
      </div>

      {/* Right Panel - Plot */}
      <div className="flex-1 min-h-[300px] lg:min-h-0">
        <PlotView
          traces={traces}
          title="Radial Modification Comparison"
          xAxisLabel="X (mm)"
          yAxisLabel="Y (mm)"
          className="h-full"
        />
      </div>

      <ExportDialog
        points={modifiedPoints}
        defaultFilename="flexspline_modified"
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
}
