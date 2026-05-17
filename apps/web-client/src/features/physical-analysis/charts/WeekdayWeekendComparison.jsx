import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { isWeekend } from '../utils/dates';
import { mean } from '../utils/statistics';

/**
 * Compares weekday vs weekend across the three metrics. Each metric gets
 * its own y-axis (different scales) so they can all be read at once.
 * Shows the percentage delta as an annotation so the user instantly knows
 * "weekends are 18% MORE active" or similar.
 */
export default function WeekdayWeekendComparison({ daily }) {
    const { data, layout, insight, isEmpty } = useMemo(() => {
        const weekdays = daily.filter((d) => !isWeekend(d.date));
        const weekends = daily.filter((d) => isWeekend(d.date));

        if (weekdays.length < 2 || weekends.length < 2) return { isEmpty: true };

        // Compute averages per metric per group
        const metrics = [
            { key: 'steps', label: 'Steps',  unit: '', format: (v) => Math.round(v).toLocaleString() },
            { key: 'sleep_hours', label: 'Sleep', unit: 'h', format: (v) => v.toFixed(1) },
            { key: 'active_energy', label: 'Energy', unit: 'kcal', format: (v) => Math.round(v).toString() },
        ];

        const groups = metrics.map((m) => {
            const wd = mean(weekdays.map((d) => d[m.key]).filter((v) => v > 0));
            const we = mean(weekends.map((d) => d[m.key]).filter((v) => v > 0));
            const delta = wd ? ((we - wd) / wd) * 100 : 0;
            return { ...m, wd, we, delta };
        });

        // Build three subplot bar charts (1 row × 3 columns), each with its own y-scale
        const traces = [];
        const annotations = [];

        groups.forEach((g, i) => {
            const axisSuffix = i === 0 ? '' : i + 1;
            const xAxis = `x${axisSuffix}`;
            const yAxis = `y${axisSuffix}`;

            traces.push({
                type: 'bar',
                x: ['Weekday', 'Weekend'],
                y: [g.wd, g.we],
                xaxis: xAxis, yaxis: yAxis,
                marker: {
                    color: [COLORS.steps, COLORS.energy],
                    line: { color: ['rgba(11,239,196,0.5)', 'rgba(245,200,66,0.5)'], width: 1 },
                },
                text: [g.format(g.wd), g.format(g.we)],
                textposition: 'outside',
                textfont: { family: 'JetBrains Mono', size: 11, color: COLORS.textBright },
                hovertemplate: '<b>%{x}</b><br>%{y:.1f}<extra></extra>',
                showlegend: false,
                width: 0.55,
            });

            // Delta annotation
            const deltaColor = Math.abs(g.delta) < 3 ? COLORS.textMuted
                             : g.delta > 0 ? COLORS.state.good : COLORS.state.fatigued;
            const deltaArrow = Math.abs(g.delta) < 3 ? '' : g.delta > 0 ? '↑' : '↓';
            annotations.push({
                xref: `${xAxis} domain`, yref: 'paper',
                x: 0.5, y: 1.04,
                xanchor: 'center', showarrow: false,
                text: `<b>${g.label}</b><br><span style="font-size:10px;color:${deltaColor}">${deltaArrow} ${Math.abs(g.delta).toFixed(0)}%</span>`,
                font: { family: 'DM Sans', size: 12, color: COLORS.textBright },
                align: 'center',
            });
        });

        const sharedAxis = {
            gridcolor: COLORS.grid,
            zerolinecolor: COLORS.grid,
            linecolor: COLORS.axis,
            tickfont: { family: 'JetBrains Mono', size: 9, color: COLORS.textMuted },
        };

        const layout = mergeLayout(baseLayout, {
            grid: { rows: 1, columns: 3, pattern: 'independent' },
            xaxis:  { ...sharedAxis, domain: [0,    0.31], gridcolor: 'transparent' },
            yaxis:  { ...sharedAxis, domain: [0,    0.85] },
            xaxis2: { ...sharedAxis, domain: [0.35, 0.66], gridcolor: 'transparent' },
            yaxis2: { ...sharedAxis, domain: [0,    0.85] },
            xaxis3: { ...sharedAxis, domain: [0.69, 1],    gridcolor: 'transparent' },
            yaxis3: { ...sharedAxis, domain: [0,    0.85] },
            annotations,
            margin: { l: 48, r: 24, t: 56, b: 32 },
        });

        const stepDelta = groups[0].delta;
        const sleepDelta = groups[1].delta;
        const stepWord = Math.abs(stepDelta) < 3 ? 'identical' :
            stepDelta < 0 ? `${Math.abs(stepDelta).toFixed(0)}% less active` :
                            `${stepDelta.toFixed(0)}% more active`;
        const sleepWord = Math.abs(sleepDelta) < 3 ? 'identical' :
            sleepDelta > 0 ? `${sleepDelta.toFixed(0)}% more sleep` :
                             `${Math.abs(sleepDelta).toFixed(0)}% less sleep`;
        const insight =
            `On weekends you average ${stepWord} and ${sleepWord} vs weekdays. ` +
            `(${weekdays.length} weekdays, ${weekends.length} weekends.)`;

        return { data: traces, layout, insight, isEmpty: false };
    }, [daily]);

    return (
        <ChartShell
            title="Weekday vs weekend"
            subtitle="How your lifestyle shifts across the week"
            span={2}
            height={300}
            isEmpty={isEmpty}
            emptyLabel="Need at least 2 weekday and 2 weekend days."
            insight={insight}
            info={{
                what: 'Average values for each metric on weekdays vs weekends, side-by-side.',
                how:  'Compare the two bars in each group. The % arrow shows how much weekends differ from weekdays.',
                why:  'Surfaces lifestyle imbalance — e.g. heavy weekday work followed by weekend collapse, or vice versa. Big swings can signal stress patterns.',
            }}
        >
            <Plot data={data} layout={layout} config={baseConfig}
                  useResizeHandler style={{ width: '100%', height: '100%' }} />
        </ChartShell>
    );
}
