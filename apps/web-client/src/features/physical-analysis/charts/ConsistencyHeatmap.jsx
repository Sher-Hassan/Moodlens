import { useMemo, useState } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import MetricToggle from '../components/MetricToggle';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { isoWeek } from '../utils/dates';

const METRICS = [
    { key: 'steps', label: 'Steps', color: COLORS.steps, scale: 'teal' },
    { key: 'sleep_hours', label: 'Sleep', color: COLORS.sleep, scale: 'violet' },
    { key: 'active_energy', label: 'Energy', color: COLORS.energy, scale: 'amber' },
];

const SCALES = {
    teal: [[0, 'rgba(11,239,196,0.04)'], [0.5, 'rgba(11,239,196,0.4)'], [1, '#0BEFC4']],
    violet: [[0, 'rgba(183,148,244,0.04)'], [0.5, 'rgba(183,148,244,0.4)'], [1, '#B794F4']],
    amber: [[0, 'rgba(245,200,66,0.04)'], [0.5, 'rgba(245,200,66,0.4)'], [1, '#F5C842']],
};

export default function ConsistencyHeatmap({ daily }) {
    const [metric, setMetric] = useState('steps');
    const active = METRICS.find((m) => m.key === metric);

    const { data, layout, insight, isEmpty } = useMemo(() => {
        if (daily.length < 7) return { isEmpty: true };

        const byKey = new Map();
        daily.forEach((d) => {
            const dt = new Date(d.date);
            const wk = isoWeek(d.date);
            const yr = dt.getFullYear();
            const dow = (dt.getDay() + 6) % 7;
            byKey.set(`${yr}-W${wk}|${dow}`, d);
        });

        const weeks = Array.from(new Set([...byKey.keys()].map((k) => k.split('|')[0]))).sort();
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        const z = weeks.map((wk) => days.map((_, i) => {
            const d = byKey.get(`${wk}|${i}`);
            return d ? d[metric] : null;
        }));
        const text = weeks.map((wk) => days.map((_, i) => {
            const d = byKey.get(`${wk}|${i}`);
            if (!d) return '';
            return `${d.date}<br>Steps: ${d.steps.toLocaleString()}<br>` +
                   `Sleep: ${d.sleep_hours.toFixed(1)}h<br>` +
                   `Energy: ${d.active_energy.toFixed(0)} kcal`;
        }));

        const data = [{
            type: 'heatmap',
            z, x: days, y: weeks, text, hoverinfo: 'text',
            colorscale: SCALES[active.scale],
            showscale: false,
            xgap: 4, ygap: 4,
        }];

        const dayMeans = days.map((_, i) => {
            const vals = weeks.map((wk) => byKey.get(`${wk}|${i}`)?.[metric] ?? 0).filter(Boolean);
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        });
        const topDay = days[dayMeans.indexOf(Math.max(...dayMeans))];

        const layout = mergeLayout(baseLayout, {
            xaxis: { side: 'top', tickfont: { family: 'JetBrains Mono', size: 10, color: COLORS.text } },
            yaxis: { autorange: 'reversed', tickfont: { family: 'JetBrains Mono', size: 10, color: COLORS.textMuted } },
            margin: { l: 64, r: 24, t: 32, b: 24 },
        });

        const insight = `Your strongest day is ${topDay} on ${active.label.toLowerCase()}.`;
        return { data, layout, insight, isEmpty: false };
    }, [daily, metric, active]);

    return (
        <ChartShell
            title="Consistency heatmap"
            subtitle="Weekday rhythm of your habits"
            span={2}
            height={Math.max(280, Math.min(420, daily.length * 6))}
            isEmpty={isEmpty}
            insight={insight}
            info={{
                what: 'A calendar-style grid: rows are weeks, columns are days of the week. Darker color = higher value.',
                how:  'Scan for vertical stripes — same day-of-week being consistently dark or light reveals weekly habits (e.g. "I always slack on Tuesdays").',
                why:  'Helps spot weekly rituals worth keeping and weekly slumps worth addressing — the kind of pattern that\'s invisible in a daily line chart.',
            }}
            controls={<MetricToggle value={metric} onChange={setMetric}
                options={METRICS.map((m) => ({ ...m }))} />}
        >
            <Plot data={data} layout={layout} config={baseConfig}
                  useResizeHandler style={{ width: '100%', height: '100%' }} />
        </ChartShell>
    );
}
