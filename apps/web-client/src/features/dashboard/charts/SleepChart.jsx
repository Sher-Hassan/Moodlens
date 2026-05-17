import { useMemo } from 'react';
import Plot from '../../physical-analysis/Plot';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../../physical-analysis/chartTheme';
import { mean } from '../../physical-analysis/utils/statistics';
import { trendDirection } from '../../physical-analysis/analytics/movingAverages';

const SLEEP_LOW  = 7.0;   // healthy band floor
const SLEEP_HIGH = 9.0;   // healthy band ceiling
const SLEEP_GOAL = 7.5;   // sweet-spot reference

export default function SleepChart({ daily }) {
    const { chartData, layout, avg, trend, insight } = useMemo(() => {
        const valid = daily.filter((d) => d.sleep_hours > 0);
        if (!valid.length) return { chartData: [], layout: {}, avg: 0, trend: 'flat', insight: 'No sleep data.' };

        const avg   = mean(valid.map((d) => d.sleep_hours));
        const trend = trendDirection(valid.map((d) => d.sleep_hours));
        const x = valid.map((d) => d.date);
        const y = valid.map((d) => d.sleep_hours);
        const yMax = Math.max(...y, SLEEP_HIGH) * 1.2;

        const chartData = [
            // Healthy-range band (green background rect as a filled scatter)
            {
                type: 'scatter',
                x: [...x, ...x.slice().reverse()],
                y: [...Array(x.length).fill(SLEEP_HIGH), ...Array(x.length).fill(SLEEP_LOW)],
                fill: 'toself',
                fillcolor: 'rgba(52,211,153,0.07)',
                line: { width: 0 },
                name: '7–9h range',
                hoverinfo: 'skip',
                showlegend: false,
            },
            // Sleep line + area fill
            {
                type: 'scatter',
                mode: 'lines',
                x, y,
                name: 'Sleep',
                line: { color: COLORS.sleep, width: 2.5, shape: 'spline', smoothing: 1.1 },
                fill: 'tozeroy',
                fillcolor: COLORS.sleepSoft,
                hovertemplate: '<b>%{x}</b><br>%{y:.1f}h of sleep<extra></extra>',
            },
            // Sleep goal / sweet-spot line
            {
                type: 'scatter',
                mode: 'lines',
                x: [x[0], x[x.length - 1]],
                y: [SLEEP_GOAL, SLEEP_GOAL],
                line: { color: COLORS.sleep, width: 1.2, dash: 'dot' },
                hoverinfo: 'skip',
                showlegend: false,
            },
        ];

        const layout = mergeLayout(baseLayout, {
            xaxis: { type: 'date', tickformat: '%b %d', title: '' },
            yaxis: {
                title: { text: 'Hours' },
                range: [0, yMax],
                ticksuffix: 'h',
                tickfont: { family: 'JetBrains Mono', size: 10, color: COLORS.textMuted },
            },
            margin: { l: 52, r: 16, t: 8, b: 40 },
            hovermode: 'closest',
        });

        const goodNights = valid.filter((d) => d.sleep_hours >= SLEEP_LOW && d.sleep_hours <= SLEEP_HIGH).length;
        const insight =
            goodNights === valid.length
                ? 'Sleep was in the healthy 7–9h band every night in this window.'
                : `${goodNights} of ${valid.length} nights landed in the healthy 7–9h band.`;

        return { chartData, layout, avg, trend, insight };
    }, [daily]);

    const trendIcon  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
    const trendClass = `db-chart-stat__trend--${trend}`;

    return (
        <div className="db-chart-card">
            <div className="db-chart-head">
                <div>
                    <h3 className="db-chart-title">Sleep duration</h3>
                    <p className="db-chart-subtitle">Hours per night · green band = healthy range</p>
                </div>
                <div className="db-chart-stat">
                    <p className="db-chart-stat__value" style={{ color: COLORS.sleep }}>
                        {avg.toFixed(1)}h
                    </p>
                    <p className="db-chart-stat__label">avg / night</p>
                    <p className={`db-chart-stat__trend ${trendClass}`}>
                        {trendIcon} {trend === 'flat' ? 'Consistent' : trend === 'up' ? 'Improving' : 'Declining'}
                    </p>
                </div>
            </div>

            <div className="db-chart-body">
                {chartData.length ? (
                    <Plot
                        data={chartData}
                        layout={layout}
                        config={{ ...baseConfig, displayModeBar: false }}
                        useResizeHandler
                        style={{ width: '100%', height: '100%' }}
                    />
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No data
                    </div>
                )}
            </div>

            {insight && (
                <p className="db-chart-insight">
                    <span className="db-chart-insight__mark" aria-hidden="true">↳</span>
                    {insight}
                </p>
            )}
        </div>
    );
}