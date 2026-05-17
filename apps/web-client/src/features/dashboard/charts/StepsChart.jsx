import { useMemo } from 'react';
import Plot from '../../physical-analysis/Plot';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../../physical-analysis/chartTheme';
import { mean } from '../../physical-analysis/utils/statistics';
import { trendDirection } from '../../physical-analysis/analytics/movingAverages';
import { formatDateShort } from '../../physical-analysis/utils/dates';

const STEP_GOAL = 10000; // default until user goals endpoint is added

const fmtSteps = (n) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(Math.round(n));

export default function StepsChart({ daily }) {
    const { chartData, layout, avg, trend, insight } = useMemo(() => {
        const valid = daily.filter((d) => d.steps > 0);
        if (!valid.length) return { chartData: [], layout: {}, avg: 0, trend: 'flat', insight: 'No step data.' };

        const avg   = mean(valid.map((d) => d.steps));
        const trend = trendDirection(valid.map((d) => d.steps));

        const barColor = valid.map((d) =>
            d.steps >= STEP_GOAL
                ? COLORS.steps         // on-goal days: full teal
                : 'rgba(11,239,196,0.45)' // below-goal: softer
        );

        const chartData = [
            // Daily bars
            {
                type: 'bar',
                x: valid.map((d) => d.date),
                y: valid.map((d) => d.steps),
                name: 'Steps',
                marker: { color: barColor, line: { width: 0 } },
                hovertemplate: '<b>%{x}</b><br>%{y:,.0f} steps<extra></extra>',
            },
            // Goal reference line
            {
                type: 'scatter',
                mode: 'lines',
                x: [valid[0].date, valid[valid.length - 1].date],
                y: [STEP_GOAL, STEP_GOAL],
                name: 'Goal',
                line: { color: COLORS.energy, width: 1.5, dash: 'dot' },
                hoverinfo: 'skip',
                showlegend: false,
            },
        ];

        const layout = mergeLayout(baseLayout, {
            bargap: 0.35,
            xaxis: { type: 'date', tickformat: '%b %d', title: '' },
            yaxis: { title: { text: 'Steps' },
                     tickformat: ',.0f',
                     range: [0, Math.max(...valid.map((d) => d.steps), STEP_GOAL) * 1.15] },
            margin: { l: 56, r: 16, t: 8, b: 40 },
            hovermode: 'closest',
            annotations: [{
                xref: 'paper', yref: 'y',
                x: 1.01, y: STEP_GOAL,
                xanchor: 'left', yanchor: 'middle',
                showarrow: false,
                text: 'Goal',
                font: { family: 'JetBrains Mono', size: 10, color: COLORS.energy },
            }],
        });

        const daysAbove = valid.filter((d) => d.steps >= STEP_GOAL).length;
        const insight =
            daysAbove === valid.length
                ? `You hit your step goal every day in this window.`
                : `${daysAbove} of ${valid.length} days hit the ${fmtSteps(STEP_GOAL)}-step goal.`;

        return { chartData, layout, avg, trend, insight };
    }, [daily]);

    const trendIcon  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
    const trendClass = `db-chart-stat__trend--${trend}`;

    return (
        <div className="db-chart-card">
            <div className="db-chart-head">
                <div>
                    <h3 className="db-chart-title">Daily steps</h3>
                    <p className="db-chart-subtitle">Step count · full history in this range</p>
                </div>
                <div className="db-chart-stat">
                    <p className="db-chart-stat__value">{fmtSteps(avg)}</p>
                    <p className="db-chart-stat__label">avg / day</p>
                    <p className={`db-chart-stat__trend ${trendClass}`}>
                        {trendIcon} {trend === 'flat' ? 'Holding steady' : trend === 'up' ? 'Trending up' : 'Trending down'}
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