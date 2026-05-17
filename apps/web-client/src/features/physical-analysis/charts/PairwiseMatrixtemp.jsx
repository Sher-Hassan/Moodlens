import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { correlation } from '../utils/statistics';

export default function PairwiseMatrix({ daily }) {
    const { data, layout, insight, isEmpty } = useMemo(() => {
        const valid = daily.filter((d) => d.steps > 0 || d.sleep_hours > 0 || d.active_energy > 0);
        if (valid.length < 4) return { isEmpty: true };

        const steps = valid.map((d) => d.steps);
        const sleep = valid.map((d) => d.sleep_hours);
        const energy = valid.map((d) => d.active_energy);

        // Color by composite activity intensity (z-scored steps + energy)
        const maxSteps = Math.max(...steps, 1);
        const maxEnergy = Math.max(...energy, 1);
        const intensity = valid.map((d, i) =>
            (steps[i] / maxSteps) * 0.5 + (energy[i] / maxEnergy) * 0.5
        );

        const data = [{
            type: 'splom',
            dimensions: [
                { label: 'Steps', values: steps },
                { label: 'Sleep (h)', values: sleep },
                { label: 'Energy', values: energy },
            ],
            showupperhalf: false,
            diagonal: { visible: false },
            marker: {
                color: intensity,
                colorscale: [[0, COLORS.sleep], [0.5, COLORS.steps], [1, COLORS.energy]],
                size: 7,
                line: { color: 'rgba(255,255,255,0.08)', width: 0.5 },
                showscale: false,
            },
            text: valid.map((d) => d.date),
            hovertemplate: '<b>%{text}</b><br>%{xaxis.title.text}: %{x}<br>%{yaxis.title.text}: %{y}<extra></extra>',
        }];

        const rss = correlation(steps, sleep);
        const rse = correlation(steps, energy);
        const rls = correlation(sleep, energy);
        const strongest = [
            { name: 'steps ↔ sleep', r: rss },
            { name: 'steps ↔ energy', r: rse },
            { name: 'sleep ↔ energy', r: rls },
        ].sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];

        const baseAxis = {
            gridcolor: COLORS.grid,
            zerolinecolor: COLORS.grid,
            linecolor: COLORS.axis,
            tickfont: { family: 'JetBrains Mono', size: 9, color: COLORS.textMuted },
        };

        const layout = mergeLayout(baseLayout, {
            xaxis: { ...baseAxis }, yaxis: { ...baseAxis },
            xaxis2: { ...baseAxis }, yaxis2: { ...baseAxis },
            xaxis3: { ...baseAxis }, yaxis3: { ...baseAxis },
            margin: { l: 56, r: 24, t: 16, b: 44 },
            annotations: [{
                xref: 'paper', yref: 'paper', x: 0.98, y: 0.98,
                xanchor: 'right', yanchor: 'top', showarrow: false,
                text: `<b>strongest:</b><br>${strongest.name} · r=${strongest.r.toFixed(2)}`,
                font: { family: 'JetBrains Mono', size: 11, color: COLORS.steps },
                bgcolor: 'rgba(28,42,64,0.85)', borderpad: 6, bordercolor: COLORS.axis,
                align: 'right',
            }],
        });

        const insight = `Tightest link: ${strongest.name} at r = ${strongest.r.toFixed(2)}.`;
        return { data, layout, insight, isEmpty: false };
    }, [daily]);

    return (
        <ChartShell
            title="Pairwise relationships"
            subtitle="Every metric against every other"
            span={2}
            height={420}
            isEmpty={isEmpty}
            insight={insight}
        >
            <Plot data={data} layout={layout} config={baseConfig}
                  useResizeHandler style={{ width: '100%', height: '100%' }} />
        </ChartShell>
    );
}