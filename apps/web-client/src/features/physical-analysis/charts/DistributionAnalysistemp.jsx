import { useMemo, useState } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import MetricToggle from '../components/MetricToggle';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { mean, median } from '../utils/statistics';

const METRICS = [
    { key: 'steps', label: 'Steps', color: COLORS.steps, soft: COLORS.stepsSoft, unit: '', low: 4000, high: 15000 },
    { key: 'sleep_hours', label: 'Sleep', color: COLORS.sleep, soft: COLORS.sleepSoft, unit: 'h', low: 6, high: 9 },
    { key: 'active_energy', label: 'Energy', color: COLORS.energy, soft: COLORS.energySoft, unit: 'kcal', low: 200, high: 800 },
];

export default function DistributionAnalysis({ daily }) {
    const [metric, setMetric] = useState('steps');
    const active = METRICS.find((m) => m.key === metric);

    const { data, layout, insight, isEmpty } = useMemo(() => {
        const values = daily.map((d) => d[metric]).filter((v) => v > 0);
        if (values.length < 4) return { isEmpty: true };

        const m = mean(values), md = median(values);

        const data = [
            {
                type: 'histogram', x: values, name: active.label,
                marker: { color: active.color, opacity: 0.55, line: { color: active.color, width: 1 } },
                nbinsx: Math.min(20, Math.max(8, Math.floor(values.length / 3))),
                hovertemplate: '%{x}<br>Days: %{y}<extra></extra>',
            },
        ];

        const layout = mergeLayout(baseLayout, {
            bargap: 0.08,
            xaxis: { title: { text: `${active.label} (${active.unit})` } },
            yaxis: { title: { text: 'Days' } },
            shapes: [
                // "Healthy band" shading
                { type: 'rect', xref: 'x', yref: 'paper',
                  x0: active.low, x1: active.high, y0: 0, y1: 1,
                  fillcolor: 'rgba(52, 211, 153, 0.06)', line: { width: 0 } },
                // Mean line
                { type: 'line', xref: 'x', yref: 'paper',
                  x0: m, x1: m, y0: 0, y1: 1,
                  line: { color: COLORS.state.balanced, width: 2, dash: 'dash' } },
                // Median line
                { type: 'line', xref: 'x', yref: 'paper',
                  x0: md, x1: md, y0: 0, y1: 1,
                  line: { color: COLORS.state.excellent, width: 2, dash: 'dot' } },
            ],
            annotations: [
                { x: m, y: 1.04, xref: 'x', yref: 'paper', showarrow: false,
                  text: `mean ${m.toFixed(active.unit === 'h' ? 1 : 0)}`,
                  font: { family: 'JetBrains Mono', size: 10, color: COLORS.state.balanced } },
                { x: md, y: 0.95, xref: 'x', yref: 'paper', showarrow: false,
                  text: `median ${md.toFixed(active.unit === 'h' ? 1 : 0)}`,
                  font: { family: 'JetBrains Mono', size: 10, color: COLORS.state.excellent } },
            ],
        });

        const insight = `Average ${active.label.toLowerCase()}: ${m.toFixed(active.unit === 'h' ? 1 : 0)} ${active.unit}. ` +
            `${values.filter((v) => v >= active.low && v <= active.high).length} of ${values.length} days fall in the healthy band.`;

        return { data, layout, insight, isEmpty: false };
    }, [daily, metric, active]);

    return (
        <ChartShell
            title="Distribution"
            subtitle="How your days spread out"
            height={320}
            isEmpty={isEmpty}
            insight={insight}
            controls={<MetricToggle value={metric} onChange={setMetric}
                options={METRICS.map((m) => ({ key: m.key, label: m.label, color: m.color }))} />}
        >
            <Plot data={data} layout={layout} config={baseConfig}
                  useResizeHandler style={{ width: '100%', height: '100%' }} />
        </ChartShell>
    );
}