// Type definitions for react-plotly.js
declare module 'react-plotly.js' {
  import * as Plotly from 'plotly.js';
  import * as React from 'react';

  interface PlotParams {
    data: Plotly.Data[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
    frames?: Plotly.Frame[];
    onInitialized?: (
      figure: Readonly<{
        data: Plotly.Data[];
        layout: Partial<Plotly.Layout>;
        frames: Plotly.Frame[] | null;
      }>,
      graphDiv: HTMLElement
    ) => void;
    onUpdate?: (
      figure: Readonly<{
        data: Plotly.Data[];
        layout: Partial<Plotly.Layout>;
        frames: Plotly.Frame[] | null;
      }>,
      graphDiv: HTMLElement
    ) => void;
    onPurge?: (figure: Readonly<{
      data: Plotly.Data[];
      layout: Partial<Plotly.Layout>;
      frames: Plotly.Frame[] | null;
    }>, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    useResizeHandler?: boolean;
    style?: React.CSSProperties;
    className?: string;
    divId?: string;
  }

  const Plot: React.ComponentType<PlotParams>;
  export default Plot;
}
