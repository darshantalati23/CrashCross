/// <reference types="vite/client" />
declare module 'react-plotly.js/factory' {
  import type { ComponentType } from 'react';
  import type { PlotParams } from 'react-plotly.js';
  const createPlotlyComponent: (plotly: unknown) => ComponentType<PlotParams>;
  export default createPlotlyComponent;
}
declare module 'plotly.js-cartesian-dist-min';
interface ImportMetaEnv {
  readonly VITE_EDAGENT_API_URL?: string;
}
