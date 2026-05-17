import { useMemo, useState } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import MetricToggle from '../components/MetricToggle';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { mean, median, stddev } from '../utils/statistics';

const METRICS = [
    { key: 'steps', label: 'Steps', color: COLORS.steps, soft: COLORS.stepsSoft, unit: '', low: 4000, high: 15000, format: (v) => Math.round(v).toLocaleString() },
    { key: 'sleep_hours', label: 'Sleep', color: COLORS.sleep, soft: COLORS.sleepSoft, unit: 'h', low: 7, high: 9, format: (v) => v.toFixed(1) },
    { key: 'active_energy', label: 'Energy', color: COLORS.energy, soft: COLORS.energySoft, unit: 'kcal', low: 200, high: 800, format: (v) => Math.round(v).toString() },
];

export default function DistributionAnalysis({ daily }) {
    const [metric, setMetric] = useState('steps');
    const active = METRICS.find((m) => m.key === metric);

    const { data, layout, insight, isEmpty, stats } = useMemo(() => {
        const values = daily.map((d) => d[metric]).filter((v) => v > 0);
        if (values.length < 4) return { isEmpty: true };

        const m = mean(values);
        const md = median(values);
        const sd = stddev(values);
        const inBand = values.filter((v) => v >= active.low && v <= active.high).length;
        const inBandPct = Math.round((inBand / values.length) * 100);

        const data = [
            {
                type: 'histogram',
                x: values,
                name: active.label,
                marker: {
                    color: active.color,
                    opacity: 0.65,
                    line: { color: active.color, width: 1 },
                },
                nbinsx: Math.min(12, Math.max(6, Math.floor(values.length / 3))),
                hovertemplate: `${active.label}: %{x}<br>Days: %{y}<extra></extra>`,
            },
        ];

        const layout = mergeLayout(baseLayout, {
            bargap: 0.08,
            xaxis: { title: { text: `${active.label}${active.unit ? ` (${active.unit})` : ''}` } },
            yaxis: { title: { text: 'Number of days' }, dtick: 1 },
            shapes: [
                // Healthy band (much more visible now)
                {
                    type: 'rect', xref: 'x', yref: 'paper',
                    x0: active.low, x1: active.high, y0: 0, y1: 1,
                    fillcolor: 'rgba(52, 211, 153, 0.10)',
                    line: { color: 'rgba(52, 211, 153, 0.35)', width: 1, dash: 'dot' },
                    layer: 'below',
                },
                // Mean line
                {
                    type: 'line', xref: 'x', yref: 'paper',
                    x0: m, x1: m, y0: 0, y1: 1,
                    line: { color: COLORS.state.balanced, width: 2, dash: 'dash' },
                },
            ],
            annotations: [
                {
                    x: (active.low + active.high) / 2, y: 1.08,
                    xref: 'x', yref: 'paper', showarrow: false,
                    text: `↓ Healthy band (${active.format(active.low)}–${active.format(active.high)}${active.unit})`,
                    font: { family: 'JetBrains Mono', size: 10, color: COLORS.state.excellent },
                },
                {
                    x: m, y: 0.92, xref: 'x', yref: 'paper', showarrow: false,
                    text: `your avg: ${active.format(m)}`,
                    font: { family: 'JetBrains Mono', size: 10, color: COLORS.state.balanced },
                    bgcolor: 'rgba(19,30,48,0.85)', borderpad: 4,
                },
            ],
            margin: { l: 56, r: 24, t: 48, b: 56 },
        });

        const stats = {
            mean: active.format(m),
            median: active.format(md),
            stddev: active.format(sd),
            inBandPct,
            inBand, total: values.length,
            tightness: sd / Math.max(m, 1),
        };

        const tone = inBandPct >= 70 ? 'mostly hit' : inBandPct >= 40 ? 'mixed' : 'rarely hit';
        const insight =
            `Across ${values.length} days, you ${tone} the healthy range ` +
            `(${inBand}/${values.length} = ${inBandPct}%). Your average is ${stats.mean}${active.unit}.`;

        return { data, layout, insight, isEmpty: false, stats };
    }, [daily, metric, active]);

    return (
        <ChartShell
            title="Distribution"
            subtitle={`Spread of your daily ${active.label.toLowerCase()}`}
            height={320}
            isEmpty={isEmpty}
            insight={insight}
            info={{
                what: 'A histogram showing how many days fall into each value range. Tall bars = common values, short bars = rare values.',
                how:  'Bars inside the dotted green band are healthy days. The dashed blue line is your personal average. Tight, tall histograms = consistent habits.',
                why:  'Shows you whether your typical day is in a healthy range — not just your "good days". Consistency beats peaks for long-term wellbeing.',
            }}
            controls={<MetricToggle value={metric} onChange={setMetric}
                options={METRICS.map((m) => ({ key: m.key, label: m.label, color: m.color }))} />}
        >
            <Plot data={data} layout={layout} config={baseConfig}
                  useResizeHandler style={{ width: '100%', height: '100%' }} />
        </ChartShell>
    );
}
