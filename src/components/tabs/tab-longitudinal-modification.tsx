'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { ParameterPanel } from '@/components/calculator/parameter-panel';
import { StatusMessage } from '@/components/calculator/output-panel';
import { PlotView, pointsToTrace, PlotTrace, createFilledCircle } from '@/components/calculator/plot-view';
import { buildFullFlexspline } from '@/lib/equations';
import { PLOT_COLORS } from '@/lib/constants';
import type { PointTuple } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible } from '@/components/ui/collapsible';
import { ExportDialog } from '@/components/calculator/export-dialog';

// Numeric input with local editing state
function NumericInput({
  value,
  onChange,
  onEnter,
  isInteger = false,
  min,
  max,
  defaultValue,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  onEnter?: () => void;
  isInteger?: boolean;
  min?: number;
  max?: number;
  defaultValue: number;
  className?: string;
}) {
  const formatValue = (v: number) => isInteger ? String(v) : v.toFixed(3);
  const [localValue, setLocalValue] = useState(formatValue(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatValue(value));
    }
  }, [value, isFocused, isInteger]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    const numValue = isInteger ? parseInt(newValue) : parseFloat(newValue);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numValue = isInteger ? parseInt(localValue) : parseFloat(localValue);
    if (!isNaN(numValue)) {
      let clampedValue = numValue;
      if (min !== undefined) clampedValue = Math.max(min, clampedValue);
      if (max !== undefined) clampedValue = Math.min(max, clampedValue);
      onChange(clampedValue);
      setLocalValue(formatValue(clampedValue));
    } else {
      onChange(defaultValue);
      setLocalValue(formatValue(defaultValue));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      onEnter?.();
    }
  };

  return (
    <Input
      type="number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={() => setIsFocused(true)}
      onKeyDown={handleKeyDown}
      step={isInteger ? 1 : 0.001}
      min={min}
      max={max}
      className={className}
    />
  );
}

export function TabLongitudinalModification() {
  const params = useCalculatorStore((state) => state.params);
  const smooth = useCalculatorStore((state) => state.smooth);
  const filletAdd = useCalculatorStore((state) => state.filletAdd);
  const filletDed = useCalculatorStore((state) => state.filletDed);
  const setError = useCalculatorStore((state) => state.setError);

  // Longitudinal modification parameters
  const [l0, setL0] = React.useState(10.0);  // Total axial length (mm)
  const [li, setLi] = React.useState(5.0);   // Engagement length (mm)
  const [nSections, setNSections] = React.useState(5);

  const [sections, setSections] = React.useState<{ z: number; points: PointTuple[]; rm: number; t: number }[]>([]);
  const [showExport, setShowExport] = React.useState(false);
  const [status, setStatus] = React.useState<{ message: string; type: 'info' | 'success' | 'error' }>({
    message: 'Configure longitudinal modification parameters and click Update.',
    type: 'info',
  });

  const handleUpdate = React.useCallback(() => {
    // Build gear at multiple axial sections with varying modification
    const newSections: { z: number; points: PointTuple[]; rm: number; t: number }[] = [];

    for (let i = 0; i < nSections; i++) {
      const z = (i / (nSections - 1)) * l0;

      // Calculate modification factor based on position
      // This is a simplified parabolic modification
      let modFactor = 0;
      if (z < li) {
        // In engagement zone - no modification
        modFactor = 0;
      } else {
        // Outside engagement - parabolic increase
        const dist = z - li;
        modFactor = Math.pow(dist / (l0 - li), 2) * 0.1;
      }

      // Build gear with modified parameters
      const modParams = {
        ...params,
        // Reduce tooth height slightly based on modification factor
        ha: params.ha * (1 - modFactor * 0.5),
      };

      const result = buildFullFlexspline(modParams, 39, filletAdd, filletDed, smooth);

      if (!result.error && result.chain_xy.length > 0) {
        newSections.push({ z, points: result.chain_xy, rm: result.rm, t: result.t });
      }
    }

    if (newSections.length === 0) {
      setError('Failed to build longitudinal sections');
      setStatus({ message: 'Failed to build sections', type: 'error' });
      return;
    }

    setSections(newSections);
    setError(null);
    setStatus({
      message: `Built ${newSections.length} axial sections over ${l0.toFixed(1)} length`,
      type: 'success',
    });
  }, [params, smooth, filletAdd, filletDed, l0, li, nSections, setError]);

  // Initial compute
  React.useEffect(() => {
    handleUpdate();
  }, []);

  // Build plot traces - show multiple sections
  const traces = React.useMemo(() => {
    const plotTraces: PlotTrace[] = [];
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
      '#e35000', '#8b5cf6', '#ec4899',
    ];

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

    // Add fills first (behind outlines)
    sections.forEach((section, i) => {
      const color = colors[i % colors.length];
      const rb = section.rm - section.t / 2; // Inner radius (ID)

      if (rb > 0) {
        const idCircle = generateCircle(rb);
        const idReversed = [...idCircle].reverse();

        const fsAnnularX: (number | null)[] = [
          ...section.points.map(p => p[0]),
          null,
          ...idReversed.map(p => p[0])
        ];
        const fsAnnularY: (number | null)[] = [
          ...section.points.map(p => p[1]),
          null,
          ...idReversed.map(p => p[1])
        ];

        plotTraces.push({
          x: fsAnnularX,
          y: fsAnnularY,
          name: '',
          color: 'transparent',
          fill: 'toself' as const,
          fillcolor: hexToRgba(color, 0.12),
          mode: 'lines' as const,
          width: 0,
          showlegend: false,
        });
      }
    });

    // Add outlines on top
    sections.forEach((section, i) => {
      const color = colors[i % colors.length];
      const rb = section.rm - section.t / 2;

      plotTraces.push(
        pointsToTrace(
          section.points,
          `z = ${section.z.toFixed(1)}`,
          color,
          { width: 1.5 }
        )
      );

      // Add ID circle
      if (rb > 0) {
        plotTraces.push(
          createFilledCircle(rb, '', color, 'transparent', { showlegend: false, width: 0.5 })
        );
      }
    });

    return plotTraces;
  }, [sections]);

  // 3D view traces (simplified top-down view showing section positions)
  const sideViewTraces = React.useMemo(() => {
    const plotTraces: PlotTrace[] = [];

    // Draw simplified side view showing modification curve
    const modCurve: PointTuple[] = [];
    for (let i = 0; i <= 50; i++) {
      const z = (i / 50) * l0;
      let modFactor = 0;
      if (z >= li) {
        const dist = z - li;
        modFactor = Math.pow(dist / (l0 - li), 2) * 0.1;
      }
      modCurve.push([z, modFactor * 100]); // Scale for visibility
    }

    plotTraces.push(
      pointsToTrace(modCurve, 'Modification Profile', PLOT_COLORS.modified, { width: 2 })
    );

    // Mark engagement zone
    plotTraces.push({
      x: [0, li],
      y: [0, 0],
      name: 'Engagement Zone',
      color: PLOT_COLORS.BC,
      mode: 'lines' as const,
      width: 4,
    });

    // Mark sections
    sections.forEach((section, i) => {
      plotTraces.push({
        x: [section.z, section.z],
        y: [-5, 15],
        name: i === 0 ? 'Sections' : '',
        color: '#b1b9be',
        mode: 'lines' as const,
        width: 1,
        dash: 'dot',
        showlegend: i === 0,
      });
    });

    return plotTraces;
  }, [sections, l0, li]);

  // Export all sections as 3D points
  const exportPoints = React.useMemo(() => {
    // Flatten all section points with Z coordinate
    const points3D: PointTuple[] = [];
    sections.forEach((section) => {
      section.points.forEach(([x, y]) => {
        // For 2D export, just use the middle section
        if (Math.abs(section.z - l0 / 2) < l0 / nSections) {
          points3D.push([x, y]);
        }
      });
    });
    return points3D;
  }, [sections, l0, nSections]);

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

        <Collapsible title="Longitudinal Modification" defaultOpen>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="flex-1 text-xs text-surface-600 uppercase tracking-wide">Total Length l0</label>
              <NumericInput
                value={l0}
                onChange={setL0}
                onEnter={handleUpdate}
                min={1}
                defaultValue={10}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex-1 text-xs text-surface-600 uppercase tracking-wide">Engagement li</label>
              <NumericInput
                value={li}
                onChange={setLi}
                onEnter={handleUpdate}
                min={0}
                max={l0}
                defaultValue={5}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex-1 text-xs text-surface-600 uppercase tracking-wide">Sections</label>
              <NumericInput
                value={nSections}
                onChange={setNSections}
                onEnter={handleUpdate}
                isInteger
                min={2}
                max={20}
                defaultValue={5}
                className="w-24"
              />
            </div>
          </div>
        </Collapsible>

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

      {/* Right Panel - Plots */}
      <div className="flex-1 flex flex-col gap-2 min-h-0 pb-2">
        {/* Top: Cross-section view */}
        <div className="h-[60%] min-h-[200px]">
          <PlotView
            traces={traces}
            title="Cross-Sections at Different Axial Positions"
            xAxisLabel="X"
            yAxisLabel="Y"
            className="h-full"
          />
        </div>

        {/* Bottom: Side view showing modification */}
        <div className="h-[35%] min-h-[120px]">
          <PlotView
            traces={sideViewTraces}
            title="Longitudinal Modification Profile"
            xAxisLabel="Axial Position Z"
            yAxisLabel="Modification (%)"
            equalAspect={false}
            className="h-full"
          />
        </div>
      </div>

      <ExportDialog
        points={exportPoints}
        defaultFilename="flexspline_longitudinal"
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
}
