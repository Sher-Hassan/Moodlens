import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { correlation, linearRegression, correlationLabel } from '../utils/statistics';

/**
 * Replaces the splom with three explicit scatter panels:
 *   1) Steps  vs Sleep   (does sleep relate to activity?)
 *   2) Steps  vs Energy  (do steps predict calorie burn?)
 *   3) Sleep  vs Energy  (does sleep relate to energy expenditure?)
 *
 * Each cell has:
 *   - All days as dots
 *   - A regression trend line
 *   - The Pearson r badge with strength label
 */
export default function PairwiseMatrix({ daily }) {
    const { data, layout, insight, isEmpty } = useMemo(() => {
        const valid = daily.filter((d) =>
            d.steps > 0 && d.sleep_hours > 0 && d.active_energy > 0
        );
        if (valid.length < 4) return { isEmpty: true };

        const steps  = valid.map((d) => d.steps);
        const sleep  = valid.map((d) => d.sleep_hours);
        const energy = valid.map((d) => d.active_energy);
        const dates  = valid.map((d) => d.date);

        // Three pairs to plot
        const pairs = [
            { x: steps,  y: sleep,  xName: 'Steps',      yName: 'Sleep (h)', color: COLORS.steps, axisX: 'x',  axisY: 'y'  },
            { x: steps,  y: energy, xName: 'Steps',      yName: 'Energy',    color: COLORS.energy, axisX: 'x2', axisY: 'y2' },
            { x: sleep,  y: energy, xName: 'Sleep (h)',  yName: 'Energy',    color: COLORS.sleep,  axisX: 'x3', axisY: 'y3' },
        ];

        const traces = [];
        const annotations = [];

        pairs.forEach((p, idx) => {
            const r   = correlation(p.x, p.y);
            const reg = linearRegression(p.x, p.y);
            const xMin = Math.min(...p.x);
            const xMax = Math.max(...p.x);

            // Scatter
            traces.push({
                x: p.x, y: p.y,
                mode: 'markers',
                xaxis: p.axisX, yaxis: p.axisY,
                marker: {
                    color: p.color,
                    size: 8,
                    opacity: 0.7,
                    line: { color: 'rgba(255,255,255,0.1)', width: 0.5 },
                },
                text: dates,
                hovertemplate: `<b>%{text}</b><br>${p.xName}: %{x}<br>${p.yName}: %{y:.1f}<extra></extra>`,
                showlegend: false,
            });

            // Trend line
            traces.push({
                x: [xMin, xMax],
                y: [reg.predict(xMin), reg.predict(xMax)],
                mode: 'lines',
                xaxis: p.axisX, yaxis: p.axisY,
                line: { color: p.color, width: 2, dash: 'dash' },
                opacity: 0.55,
                hoverinfo: 'skip',
                showlegend: false,
            });

            // Per-panel correlation badge
            annotations.push({
                xref: `${p.axisX} domain`, yref: `${p.axisY} domain`,
                x: 0.95, y: 0.95,
                xanchor: 'right', yanchor: 'top',
                showarrow: false,
                text: `<b>r = ${r.toFixed(2)}</b><br>${correlationLabel(r)}`,
                font: { family: 'JetBrains Mono', size: 10, color: p.color },
                bgcolor: 'rgba(19,30,48,0.85)',
                bordercolor: COLORS.axis,
                borderpad: 5,
                align: 'right',
            });
        });

        // Subplot grid: 1 row, 3 columns, independent axes
        const axisStyle = {
            gridcolor: COLORS.grid,
            zerolinecolor: COLORS.grid,
            linecolor: COLORS.axis,
            tickfont: { family: 'JetBrains Mono', size: 9, color: COLORS.textMuted },
            titlefont: { family: 'DM Sans', size: 10, color: COLORS.text },
        };

        const layout = mergeLayout(baseLayout, {
            grid: { rows: 1, columns: 3, pattern: 'independent' },
            xaxis:  { ...axisStyle, title: { text: 'Steps' },     domain: [0,    0.31], anchor: 'y'  },
            yaxis:  { ...axisStyle, title: { text: 'Sleep (h)' }, domain: [0,    1],    anchor: 'x'  },
            xaxis2: { ...axisStyle, title: { text: 'Steps' },     domain: [0.35, 0.66], anchor: 'y2' },
            yaxis2: { ...axisStyle, title: { text: 'Energy (kcal)' }, domain: [0, 1],   anchor: 'x2' },
            xaxis3: { ...axisStyle, title: { text: 'Sleep (h)' }, domain: [0.69, 1],    anchor: 'y3' },
            yaxis3: { ...axisStyle, title: { text: 'Energy (kcal)' }, domain: [0, 1],   anchor: 'x3' },
            margin: { l: 56, r: 24, t: 16, b: 52 },
            annotations,
        });

        // Find strongest relationship for insight
        const rs = pairs.map((p) => ({ name: `${p.xName} ↔ ${p.yName}`, r: correlation(p.x, p.y) }));
        const strongest = rs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
        const dirWord = strongest.r >= 0 ? 'positively' : 'inversely';
        const insight =
            `Across ${valid.length} days, "${strongest.name}" is the tightest link ` +
            `(${dirWord} related, r=${strongest.r.toFixed(2)}). ` +
            `Steeper dashed lines = stronger relationship.`;

        return { data: traces, layout, insight, isEmpty: false };
    }, [daily]);

    return (
        <ChartShell
            title="Pairwise relationships"
            subtitle="How your three metrics move together"
            span={2}
            height={360}
            isEmpty={isEmpty}
            insight={insight}
            info={{
                what: 'Three scatter plots, one for each pair of metrics. The dashed line is the best-fit trend through your data.',
                how:  'Look at the dashed line slope and the "r" value. r close to ±1 = strong relationship; near 0 = no relationship. Positive slope = both go up together.',
                why:  'Lets you see whether more sleep actually leads to more activity, or whether activity drains your energy — for YOUR body, not population averages.',
            }}
        >
            <Plot data={data} layout={layout} config={baseConfig}
                  useResizeHandler style={{ width: '100%', height: '100%' }} />
        </ChartShell>
    );
}
