import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { trendDirection } from '../analytics/movingAverages';

export default function DailyActivityTrend({ daily }) {
    const { data, layout, insight, isEmpty } = useMemo(() => {
        if (!daily.length) return { isEmpty: true };
        const x = daily.map((d) => d.date);
        const steps = daily.map((d) => d.steps);
        const energy = daily.map((d) => d.active_energy);

        // Find the absolute max/min step day for highlight markers
        const maxIdx = steps.indexOf(Math.max(...steps));
        const minIdx = steps.indexOf(Math.min(...steps.filter((v) => v > 0)));

        const traces = [
            {
                x, y: steps, name: 'Steps', mode: 'lines',
                line: { color: COLORS.steps, width: 2.5, shape: 'spline', smoothing: 1.1 },
                fill: 'tozeroy', fillcolor: COLORS.stepsSoft,
                hovertemplate: '<b>%{x}</b><br>Steps: %{y:,.0f}<extra></extra>',
            },
            {
                x, y: energy, name: 'Active energy', mode: 'lines', yaxis: 'y2',
                line: { color: COLORS.energy, width: 2, shape: 'spline', smoothing: 1.1, dash: 'solid' },
                hovertemplate: '<b>%{x}</b><br>Active energy: %{y:,.0f} kcal<extra></extra>',
            },
            // Highlight extremes
            {
                x: [x[maxIdx]], y: [steps[maxIdx]], mode: 'markers', name: 'Peak',
                marker: { color: COLORS.steps, size: 10, line: { color: '#fff', width: 1.5 } },
                hovertemplate: '<b>Peak: %{x}</b><br>%{y:,.0f} steps<extra></extra>',
                showlegend: false,
            },
            ...(minIdx >= 0 ? [{
                x: [x[minIdx]], y: [steps[minIdx]], mode: 'markers', name: 'Low',
                marker: { color: COLORS.energy, size: 9, symbol: 'diamond' },
                hovertemplate: '<b>Low: %{x}</b><br>%{y:,.0f} steps<extra></extra>',
                showlegend: false,
            }] : []),
        ];

        const layout = mergeLayout(baseLayout, {
            xaxis: { type: 'date', title: { text: '' } },
            yaxis: { title: { text: 'Steps' }, side: 'left' },
            yaxis2: {
                title: { text: 'kcal' },
                overlaying: 'y', side: 'right',
                gridcolor: 'transparent',
                tickfont: { family: 'JetBrains Mono, monospace', size: 10, color: COLORS.energy },
                titlefont: { family: 'DM Sans', size: 11, color: COLORS.energy },
            },
            hovermode: 'x unified',
            margin: { l: 56, r: 56, t: 16, b: 44 },
            showlegend: true,
            legend: {
                orientation: 'h', y: -0.18, x: 0,
                font: { family: 'DM Sans', size: 11, color: COLORS.text },
            },
        });

        const dir = trendDirection(steps);
        const dirCopy = dir === 'up' ? 'trending upward' : dir === 'down' ? 'softening' : 'holding steady';
        const insight = `Activity is ${dirCopy}. Peak: ${x[maxIdx]} (${steps[maxIdx].toLocaleString()} steps).`;

        return { data: traces, layout, insight, isEmpty: false };
    }, [daily]);

    return (
        <ChartShell
            title="Daily activity trend"
            subtitle="Steps vs active energy"
            span={2}
            height={360}
            isEmpty={isEmpty}
            insight={insight}
        >
            <Plot
                data={data}
                layout={layout}
                config={{ ...baseConfig, displayModeBar: 'hover',
                    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'] }}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
            />
        </ChartShell>
    );
}