import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { isWeekend } from '../utils/dates';
import { mean } from '../utils/statistics';

export default function WeekdayWeekendComparison({ daily }) {
    const { data, layout, insight, isEmpty } = useMemo(() => {
        const weekdays = daily.filter((d) => !isWeekend(d.date));
        const weekends = daily.filter((d) => isWeekend(d.date));
        if (!weekdays.length || !weekends.length) return { isEmpty: true };

        const buildPair = (metric, x0) => ([
            { type: 'violin', y: weekdays.map((d) => d[metric]), name: 'Weekday',
              x0, side: 'negative', line: { color: COLORS.steps },
              fillcolor: 'rgba(11,239,196,0.15)', meanline: { visible: true },
              points: false, showlegend: x0 === 0,
              hovertemplate: 'Weekday %{y}<extra></extra>',
            },
            { type: 'violin', y: weekends.map((d) => d[metric]), name: 'Weekend',
              x0, side: 'positive', line: { color: COLORS.energy },
              fillcolor: 'rgba(245,200,66,0.15)', meanline: { visible: true },
              points: false, showlegend: x0 === 0,
              hovertemplate: 'Weekend %{y}<extra></extra>',
            },
        ]);

        const data = [
            ...buildPair('steps', 0),
            ...buildPair('sleep_hours', 1),
            ...buildPair('active_energy', 2),
        ];

        const layout = mergeLayout(baseLayout, {
            xaxis: {
                tickmode: 'array', tickvals: [0, 1, 2],
                ticktext: ['Steps', 'Sleep (h)', 'Energy (kcal)'],
                tickfont: { family: 'DM Sans', size: 12, color: COLORS.text },
                gridcolor: 'transparent', zerolinecolor: 'transparent',
            },
            yaxis: { title: { text: 'Value' } },
            violingap: 0.4, violingroupgap: 0.1,
            showlegend: true,
            legend: { orientation: 'h', y: -0.18, x: 0,
                font: { family: 'DM Sans', size: 11, color: COLORS.text } },
        });

        const wdSteps = mean(weekdays.map((d) => d.steps));
        const weSteps = mean(weekends.map((d) => d.steps));
        const stepDelta = wdSteps ? ((weSteps - wdSteps) / wdSteps) * 100 : 0;
        const direction = stepDelta < 0 ? 'drop' : 'rise';
        const insight = `Weekends ${direction} steps by ${Math.abs(stepDelta).toFixed(0)}% vs weekdays.`;
        return { data, layout, insight, isEmpty: false };
    }, [daily]);

    return (
        <ChartShell
            title="Weekday vs weekend"
            subtitle="Lifestyle rhythm across the week"
            span={2}
            height={360}
            isEmpty={isEmpty}
            insight={insight}
        >
            <Plot data={data} layout={layout} config={baseConfig}
                  useResizeHandler style={{ width: '100%', height: '100%' }} />
        </ChartShell>
    );
}