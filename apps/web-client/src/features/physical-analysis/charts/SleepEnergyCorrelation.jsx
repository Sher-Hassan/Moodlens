import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { correlation, linearRegression, correlationLabel, percentile } from '../utils/statistics';

export default function SleepEnergyCorrelation({ daily }) {
    const { data, layout, insight, isEmpty } = useMemo(() => {
        const pairs = daily
            .filter((d) => d.sleep_hours > 0 && d.active_energy > 0)
            .map((d) => ({ x: d.sleep_hours, y: d.active_energy, date: d.date, steps: d.steps }));
        if (pairs.length < 3) return { isEmpty: true };

        const ys = pairs.map((p) => p.y);
        const xs = pairs.map((p) => p.x);
        const r = correlation(xs, ys);
        const reg = linearRegression(xs, ys);

        const q1 = percentile(ys, 25), q3 = percentile(ys, 75);
        const iqr = q3 - q1;
        const isOutlier = (y) => y < q1 - 1.5 * iqr || y > q3 + 1.5 * iqr;

        const normal = pairs.filter((p) => !isOutlier(p.y));
        const outliers = pairs.filter((p) => isOutlier(p.y));

        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        const lineX = [xMin, xMax], lineY = lineX.map(reg.predict);

        const data = [
            {
                x: normal.map((p) => p.x),
                y: normal.map((p) => p.y),
                customdata: normal.map((p) => [p.date, p.steps]),
                mode: 'markers',
                marker: { color: COLORS.sleep, size: 9, line: { color: 'rgba(255,255,255,0.15)', width: 1 } },
                hovertemplate: '<b>%{customdata[0]}</b><br>Sleep: %{x:.1f}h<br>Energy: %{y:.0f} kcal<br>Steps: %{customdata[1]:,.0f}<extra></extra>',
                name: 'Days',
            },
            {
                x: outliers.map((p) => p.x),
                y: outliers.map((p) => p.y),
                customdata: outliers.map((p) => [p.date, p.steps]),
                mode: 'markers',
                marker: { color: COLORS.state.recovery, size: 11, symbol: 'diamond',
                          line: { color: '#fff', width: 1.2 } },
                hovertemplate: '<b>Outlier · %{customdata[0]}</b><br>Sleep: %{x:.1f}h<br>Energy: %{y:.0f} kcal<extra></extra>',
                name: 'Outlier',
            },
            { x: lineX, y: lineY, mode: 'lines', line: { color: COLORS.energy, width: 2, dash: 'dash' },
              hoverinfo: 'skip', showlegend: false },
        ];

        const layout = mergeLayout(baseLayout, {
            xaxis: { title: { text: 'Sleep (hours)' } },
            yaxis: { title: { text: 'Active energy (kcal)' } },
            showlegend: true,
            legend: { orientation: 'h', y: -0.22, x: 0,
                font: { family: 'DM Sans', size: 11, color: COLORS.text } },
            annotations: [{
                xref: 'paper', yref: 'paper', x: 0.98, y: 0.96,
                xanchor: 'right', yanchor: 'top', showarrow: false,
                text: `<b>r = ${r.toFixed(2)}</b>`,
                font: { family: 'JetBrains Mono', size: 13, color: COLORS.energy },
                bgcolor: 'rgba(28,42,64,0.85)', borderpad: 6, bordercolor: COLORS.axis,
            }],
        });

        const insight = `${correlationLabel(r)} ${r >= 0 ? 'positive' : 'inverse'} link · ${outliers.length} outlier day${outliers.length === 1 ? '' : 's'}.`;
        return { data, layout, insight, isEmpty: false };
    }, [daily]);

    return (
        <ChartShell title="Sleep ↔ Active energy"
                    subtitle="Recovery vs energy expenditure"
                    height={340} isEmpty={isEmpty} insight={insight}
                    info={{
                        what: 'Each dot is one day plotted by sleep hours (x) vs calories burned (y). Diamonds are statistical outliers in your data.',
                        how:  'A downward trend = more sleep on days you burned fewer calories (resting more). Upward = high sleep AND high burn (very active people).',
                        why:  'Helps see whether your sleep adapts to your activity load, which is a sign of a healthy recovery loop.',
                    }}>
            <Plot data={data} layout={layout} config={baseConfig}
                  useResizeHandler style={{ width: '100%', height: '100%' }} />
        </ChartShell>
    );
}
