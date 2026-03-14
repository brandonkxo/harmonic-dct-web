'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { PLOT_COLORS } from '@/lib/constants';
import type { PointTuple } from '@/types';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-white rounded border border-surface-400">
      <span className="text-surface-500 text-xs uppercase tracking-wide">Loading plot...</span>
    </div>
  ),
});

export interface PlotTrace {
  x: number[];
  y: number[];
  name?: string;
  color?: string;
  mode?: 'lines' | 'markers' | 'lines+markers';
  width?: number;
  dash?: string;
  showlegend?: boolean;
}

interface PlotViewProps {
  traces: PlotTrace[];
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  equalAspect?: boolean;
  xRange?: [number, number];
  yRange?: [number, number];
  className?: string;
}

export function PlotView({
  traces,
  title,
  xAxisLabel = 'X (mm)',
  yAxisLabel = 'Y (mm)',
  equalAspect = true,
  xRange,
  yRange,
  className,
}: PlotViewProps) {
  // Convert our trace format to Plotly format
  const plotlyData = traces.map((trace) => ({
    x: trace.x,
    y: trace.y,
    name: trace.name || '',
    type: 'scatter' as const,
    mode: trace.mode || 'lines',
    line: {
      color: trace.color || PLOT_COLORS.AB,
      width: trace.width || 2,
      dash: trace.dash as Plotly.Dash | undefined,
    },
    marker: {
      color: trace.color || PLOT_COLORS.AB,
      size: 5,
    },
    showlegend: trace.showlegend !== false,
  }));

  const layout: Partial<Plotly.Layout> = {
    title: title
      ? {
          text: title,
          font: { color: '#505050', size: 12 },
        }
      : undefined,
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#fafafa',
    font: { color: '#505050', family: 'JetBrains Mono, monospace', size: 10 },
    uirevision: 'preserve',
    xaxis: {
      title: { text: xAxisLabel, font: { size: 10 } },
      gridcolor: '#b1b9be',
      zerolinecolor: '#b1b9be',
      scaleanchor: equalAspect ? 'y' : undefined,
      scaleratio: equalAspect ? 1 : undefined,
      range: xRange,
      autorange: xRange ? false : undefined,
    },
    yaxis: {
      title: { text: yAxisLabel, font: { size: 10 } },
      gridcolor: '#b1b9be',
      zerolinecolor: '#b1b9be',
      range: yRange,
      autorange: yRange ? false : undefined,
    },
    legend: {
      x: 1,
      y: 0,
      xanchor: 'right',
      yanchor: 'bottom',
      bgcolor: 'rgba(255, 255, 255, 0.9)',
      bordercolor: '#b1b9be',
      borderwidth: 1,
      font: { size: 9 },
    },
    margin: { l: 50, r: 15, t: title ? 35 : 15, b: 40 },
    hovermode: 'closest',
    dragmode: 'pan',
  };

  const config: Partial<Plotly.Config> = {
    responsive: true,
    scrollZoom: true,
    displayModeBar: false,
    displaylogo: false,
  };

  return (
    <div className={cn('plot-container', className)}>
      <Plot
        data={plotlyData}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
      />
    </div>
  );
}

// Helper to convert PointTuple arrays to trace format
export function pointsToTrace(
  points: PointTuple[],
  name: string,
  color: string,
  options: Partial<PlotTrace> = {}
): PlotTrace {
  return {
    x: points.map((p) => p[0]),
    y: points.map((p) => p[1]),
    name,
    color,
    ...options,
  };
}

// Create reference line traces
export function createReferenceLine(
  y: number,
  xMin: number,
  xMax: number,
  name: string,
  color: string
): PlotTrace {
  return {
    x: [xMin, xMax],
    y: [y, y],
    name,
    color,
    mode: 'lines',
    width: 1,
    dash: 'dash',
  };
}

// Create scatter marker trace
export function createMarker(
  x: number,
  y: number,
  name: string,
  color: string
): PlotTrace {
  return {
    x: [x],
    y: [y],
    name,
    color,
    mode: 'markers',
  };
}
