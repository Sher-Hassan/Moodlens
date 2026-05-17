import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { detectAnomalies } from '../analytics/scores';
import { mean, stddev } from '../utils/statistics';
import { formatDateShort } from '../utils/dates';
import './OutlierDetection.css';

const KIND_META = {
    low_sleep:    { icon: '☾', tone: 'critical', label: 'Low sleep' },
    inactive:     { icon: '↘', tone: 'stressed', label: 'Inactivity' },
    high_energy:  { icon: '⚡', tone: 'elevated', label: 'Energy spike' },
};

/**
 * Reads each day's metrics as z-scores from the user's own mean.
 * |z| > 2 = anomalous. Single, comparable scale across all three metrics.
 */
export default function OutlierDetection({ daily }) {
    const { data, layout, alerts, isEmpty, insight } = useMemo(() => {
        if (daily.length < 5) return { isEmpty: true };

        // Filter to days that have at least one metric
        const valid = daily.filter((d) => d.steps > 0 || d.sleep_hours > 0 || d.active_energy > 0);
        if (valid.length < 5) return { isEmpty: true };

        // Compute z-score per metric
        const metrics = [
            { key: 'steps', label: 'Steps', color: COLORS.steps },
            { key: 'sleep_hours', label: 'Sleep', color: COLORS.sleep },
            { key: 'active_energy', label: 'Energy', color: COLORS.energy },
        ];

        const traces = [];
        metrics.forEach((m) => {
            const vals = valid.map((d) => d[m.key]).filter((v) => v > 0);
            const mu = mean(vals);
            const sd = stddev(vals);
            if (sd <= 0) return;

            const zs = valid.map((d) => ({
                date: d.date,
                z: (d[m.key] - mu) / sd,
                raw: d[m.key],
            }));

            traces.push({
                type: 'scatter',
                mode: 'markers',
                name: m.label,
                x: zs.map((p) => p.date),
                y: zs.map((p) => p.z),
                marker: {
                    color: zs.map((p) => Math.abs(p.z) > 2 ? COLORS.state.fatigued : m.color),
                    size: zs.map((p) => Math.abs(p.z) > 2 ? 12 : 8),
                    symbol: zs.map((p) => Math.abs(p.z) > 2 ? 'diamond' : 'circle'),
                    line: { color: 'rgba(255,255,255,0.2)', width: 1 },
                },
                customdata: zs.map((p) => [m.label, p.raw.toFixed(m.key === 'sleep_hours' ? 1 : 0)]),
                hovertemplate: '<b>%{x}</b><br>%{customdata[0]}: %{customdata[1]}<br>z-score: %{y:.2f}<extra></extra>',
            });
        });

        const layout = mergeLayout(baseLayout, {
            xaxis: { type: 'date' },
            yaxis: {
                title: { text: 'Z-score (vs your average)' },
                range: [-4, 4],
                zeroline: true,
                zerolinecolor: COLORS.axis,
                zerolinewidth: 2,
            },
            shapes: [
                // Normal range: -2 to +2 z-scores
                { type: 'rect', xref: 'paper', yref: 'y',
                  x0: 0, x1: 1, y0: -2, y1: 2,
                  fillcolor: 'rgba(52,211,153,0.06)', line: { width: 0 }, layer: 'below' },
                // Anomaly thresholds
                { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 2, y1: 2,
                  line: { color: COLORS.state.fatigued, dash: 'dot', width: 1 } },
                { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: -2, y1: -2,
                  line: { color: COLORS.state.fatigued, dash: 'dot', width: 1 } },
            ],
            annotations: [
                { xref: 'paper', yref: 'y', x: 1.005, y: 2.2, xanchor: 'left', showarrow: false,
                  text: 'unusual ↑', font: { family: 'JetBrains Mono', size: 9, color: COLORS.state.fatigued } },
                { xref: 'paper', yref: 'y', x: 1.005, y: -2.4, xanchor: 'left', showarrow: false,
                  text: 'unusual ↓', font: { family: 'JetBrains Mono', size: 9, color: COLORS.state.fatigued } },
            ],
            showlegend: true,
            legend: {
                orientation: 'h', y: -0.20, x: 0,
                font: { family: 'DM Sans', size: 11, color: COLORS.text },
            },
            margin: { l: 56, r: 70, t: 16, b: 56 },
        });

        const alerts = detectAnomalies(valid);
        const insight = alerts.length === 0
            ? `No days fall outside ±2 standard deviations of your norms across ${valid.length} days.`
            : `${alerts.length} day${alerts.length > 1 ? 's' : ''} flagged as unusual — see cards on the right.`;

        return { data: traces, layout, alerts, isEmpty: false, insight };
    }, [daily]);

    return (
        <ChartShell
            title="Outlier & anomaly detection"
            subtitle="Days that drift from your personal norm"
            span={2}
            height={320}
            isEmpty={isEmpty}
            insight={insight}
            info={{
                what: 'Each dot is one day, plotted as a z-score (how many standard deviations away from YOUR personal average).',
                how:  'Green band = typical for you. Red diamonds outside the band = unusual days. The cards on the right explain what kind of unusual.',
                why:  'Different from "absolute" anomaly thresholds (e.g. "less than 5h sleep is bad"). This catches what\'s unusual FOR YOU specifically — a 6h night is normal for some people, alarming for others.',
            }}
        >
            <div className="od-wrap">
                <div className="od-plot">
                    <Plot data={data} layout={layout} config={baseConfig}
                          useResizeHandler style={{ width: '100%', height: '100%' }} />
                </div>
                <div className="od-alerts">
                    {alerts && alerts.length > 0 ? alerts.slice(0, 6).map((a, i) => {
                        const meta = KIND_META[a.kind];
                        return (
                            <div key={i} className={`od-alert od-alert--${meta.tone}`}>
                                <span className="od-alert__icon">{meta.icon}</span>
                                <div className="od-alert__body">
                                    <p className="od-alert__head">{meta.label}</p>
                                    <p className="od-alert__msg">{a.msg}</p>
                                </div>
                                <span className="od-alert__date">{formatDateShort(a.date)}</span>
                            </div>
                        );
                    }) : (
                        <div className="od-alert od-alert--ok">
                            <span className="od-alert__icon">✓</span>
                            <div className="od-alert__body">
                                <p className="od-alert__head">All clear</p>
                                <p className="od-alert__msg">Nothing unusual in this window.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ChartShell>
    );
}
