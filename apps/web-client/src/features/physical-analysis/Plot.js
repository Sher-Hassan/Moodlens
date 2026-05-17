/**
 * Plotly is loaded once here via the factory pattern.
 *
 * Both `react-plotly.js/factory` and `plotly.js-dist-min` ship as CommonJS.
 * Vite's interop occasionally exposes them as `{ default: fn }` instead of
 * unwrapping. We normalize both before calling the factory.
 */
import createPlotlyComponentImport from 'react-plotly.js/factory';
import PlotlyImport from 'plotly.js-dist-min';

const createPlotlyComponent =
    typeof createPlotlyComponentImport === 'function'
        ? createPlotlyComponentImport
        : createPlotlyComponentImport.default;

const Plotly = PlotlyImport.default || PlotlyImport;

const Plot = createPlotlyComponent(Plotly);
export default Plot;