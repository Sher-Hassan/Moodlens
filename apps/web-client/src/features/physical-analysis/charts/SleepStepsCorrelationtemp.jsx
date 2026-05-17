import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { correlation, linearRegression, correlationLabel } from '../utils/statistics';
import { isWeekend } from '../utils/dates';

/**
 * Pairs each night's sleep with the NEXT day's steps to test the
 * "good sleep → active day" hypothesis.
 */
export default function SleepStepsCorrelation({ daily }) {
    const { data, layout, insight, isEmpty } = useMemo(() => {
        if (daily.length < 3) return { isEmpty: true };

        // Build (sleep_today, steps_tomorrow) pairs
        const pairs = [];
        for (let i = 0; i < daily.length - 1; i++) {
            const sleep = daily[i].sleep_hours;
            const steps = daily[i + 1].steps;
            if (sleep > 0 && steps > 0) {
                pairs.push({ x: sleep, y: steps, date: daily[i + 1].date,
                             energy: daily[i + 1].active_energy,
                             weekend: isWeekend(daily[i + 1].date) });
            }
        }
        if (pairs.length < 3) return { isEmpty: true };

        const xs = pairs.map((p) => p.x);
        const ys = pairs.map((p) => p.y);
        const r = correlation(xs, ys);
        const reg = linearRegression(xs, ys);

        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        const lineX = [xMin, xMax];
        const lineY = lineX.map(reg.predict);

        const weekdays = pairs.filter((p) => !p.weekend);
        const weekends = pairs.filter((p) => p.weekend);

        const buildTrace = (subset, name, color) => ({
            x: subset.map((p) => p.x),
            y: subset.map((p) => p.y),
            customdata: subset.map((p) => [p.date, p.energy]),
            mode: 'markers',
            name,
            marker: { color, size: 9, line: { color: 'rgba(255,255,255,0.15)', width: 1 } },
            hovertemplate:
                '<b>%{customdata[0]}</b><br>' +
                'Sleep prior night: %{x:.1f}h<br>' +
                'Steps: %{y:,.0f}<br>' +
                'Active energy: %{customdata[1]:.0f} kcal<extra></extra>',
        });

        const data = [
            buildTrace(weekdays, 'Weekday', COLORS.steps),
            buildTrace(weekends, 'Weekend', COLORS.energy),
            {
                x: lineX, y: lineY, mode: 'lines', name: 'Trend',
                line: { color: COLORS.sleep, width: 2, dash: 'dash' },
                hoverinfo: 'skip', showlegend: false,
            },
        ];

        const layout = mergeLayout(baseLayout, {
            xaxis: { title: { text: 'Sleep prior night (hours)' } },
            yaxis: { title: { text: 'Steps next day' } },
            showlegend: true,
            legend: { orientation: 'h', y: -0.22, x: 0,
                font: { family: 'DM Sans', size: 11, color: COLORS.text } },
            annotations: [{
                xref: 'paper', yref: 'paper', x: 0.98, y: 0.96,
                xanchor: 'right', yanchor: 'top', showarrow: false,
                text: `<b>r = ${r.toFixed(2)}</b>`,
                font: { family: 'JetBrains Mono', size: 13, color: COLORS.sleep },
                bgcolor: 'rgba(28,42,64,0.85)', borderpad: 6, bordercolor: COLORS.axis,
            }],
        });

        const direction = r >= 0 ? 'more sleep correlates with more steps' :
                                   'more sleep correlates with fewer steps';
        const insight = `${correlationLabel(r)} relationship — ${direction}.`;

        return { data, layout, insight, isEmpty: false };
    }, [daily]);

    return (
        <ChartShell
            title="Sleep → next-day steps"
            subtitle="Recovery's effect on activity"
            height={340}
            isEmpty={isEmpty}
            insight={insight}
        >
            <Plot data={data} layout={layout} config={baseConfig}
                  useResizeHandler style={{ width: '100%', height: '100%' }} />
        </ChartShell>
    );
}