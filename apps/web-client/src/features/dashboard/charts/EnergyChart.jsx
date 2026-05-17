import { useMemo } from 'react';
import Plot from '../../physical-analysis/Plot';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../../physical-analysis/chartTheme';
import { mean } from '../../physical-analysis/utils/statistics';
import { trendDirection } from '../../physical-analysis/analytics/movingAverages';

const ENERGY_REF = 500; // kcal reference — healthy target

export default function EnergyChart({ daily }) {
    const { chartData, layout, avg, trend, insight } = useMemo(() => {
        const valid = daily.filter((d) => d.active_energy > 0);
        if (!valid.length) return { chartData: [], layout: {}, avg: 0, trend: 'flat', insight: 'No energy data.' };

        const avg   = mean(valid.map((d) => d.active_energy));
        const trend = trendDirection(valid.map((d) => d.active_energy));
        const x = valid.map((d) => d.date);
        const y = valid.map((d) => d.active_energy);
        const yMax = Math.max(...y, ENERGY_REF) * 1.2;

        const chartData = [
            // Active energy line + fill
            {
                type: 'scatter',
                mode: 'lines',
                x, y,
                name: 'Active energy',
                line: { color: COLORS.energy, width: 2.5, shape: 'spline', smoothing: 1.1 },
                fill: 'tozeroy',
                fillcolor: COLORS.energySoft,
                hovertemplate: '<b>%{x}</b><br>%{y:.0f} kcal<extra></extra>',
            },
            // Reference line at healthy target
            {
                type: 'scatter',
                mode: 'lines',
                x: [x[0], x[x.length - 1]],
                y: [ENERGY_REF, ENERGY_REF],
                line: { color: 'rgba(245,200,66,0.5)', width: 1.5, dash: 'dot' },
                hoverinfo: 'skip',
                showlegend: false,
            },
        ];

        const layout = mergeLayout(baseLayout, {
            xaxis: { type: 'date', tickformat: '%b %d', title: '' },
            yaxis: {
                title: { text: 'kcal' },
                range: [0, yMax],
                tickfont: { family: 'JetBrains Mono', size: 10, color: COLORS.textMuted },
            },
            margin: { l: 52, r: 16, t: 8, b: 40 },
            hovermode: 'closest',
            annotations: [{
                xref: 'paper', yref: 'y',
                x: 1.01, y: ENERGY_REF,
                xanchor: 'left', yanchor: 'middle',
                showarrow: false,
                text: '500',
                font: { family: 'JetBrains Mono', size: 10, color: COLORS.energy },
            }],
        });

        const daysAbove = valid.filter((d) => d.active_energy >= ENERGY_REF).length;
        const insight =
            avg >= ENERGY_REF
                ? `Averaging ${Math.round(avg)} kcal — above the 500 kcal target. Good energy output.`
                : `Averaging ${Math.round(avg)} kcal — ${Math.round(ENERGY_REF - avg)} kcal below the 500 kcal reference. ${daysAbove} of ${valid.length} days hit the target.`;

        return { chartData, layout, avg, trend, insight };
    }, [daily]);

    const trendIcon  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
    const trendClass = `db-chart-stat__trend--${trend}`;

    return (
        <div className="db-chart-card">
            <div className="db-chart-head">
                <div>
                    <h3 className="db-chart-title">Active energy burned</h3>
                    <p className="db-chart-subtitle">Calories · dashed line = 500 kcal reference</p>
                </div>
                <div className="db-chart-stat">
                    <p className="db-chart-stat__value" style={{ color: COLORS.energy }}>
                        {Math.round(avg)}
                        <span style={{ fontSize: '0.9rem', fontFamily: 'var(--font-data)', color: 'var(--text-muted)', marginLeft: 4 }}>kcal</span>
                    </p>
                    <p className="db-chart-stat__label">avg / day</p>
                    <p className={`db-chart-stat__trend ${trendClass}`}>
                        {trendIcon} {trend === 'flat' ? 'Stable output' : trend === 'up' ? 'Increasing' : 'Decreasing'}
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