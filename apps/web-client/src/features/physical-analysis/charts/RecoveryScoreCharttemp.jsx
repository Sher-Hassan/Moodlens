import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { recoveryScore, classifyRecovery } from '../analytics/scores';
import './RecoveryScoreChart.css';

export default function RecoveryScoreChart({ daily }) {
    const { data, layout, insight, isEmpty, latest, classification } = useMemo(() => {
        const scored = daily.map((d) => ({ ...d, score: recoveryScore(d) }))
                            .filter((d) => Number.isFinite(d.score) && d.score > 0);
        if (scored.length < 3) return { isEmpty: true };

        const latest = scored[scored.length - 1];
        const classification = classifyRecovery(latest.score);

        const x = scored.map((d) => d.date);
        const y = scored.map((d) => d.score);

        // Mark burnout periods — score < 10
        const burnouts = scored
            .map((d, i) => (d.score < 10 ? i : null))
            .filter((v) => v !== null);
        const burnX = burnouts.map((i) => x[i]);
        const burnY = burnouts.map((i) => y[i]);

        const data = [
            {
                x, y, mode: 'lines', name: 'Score',
                line: { color: COLORS.sleep, width: 2.5, shape: 'spline', smoothing: 1.1 },
                fill: 'tozeroy', fillcolor: COLORS.sleepSoft,
                hovertemplate: '<b>%{x}</b><br>Recovery: %{y:.1f}<extra></extra>',
            },
            ...(burnX.length ? [{
                x: burnX, y: burnY, mode: 'markers', name: 'Burnout',
                marker: { color: COLORS.state.fatigued, size: 9, symbol: 'x' },
                hovertemplate: '<b>Burnout day</b><br>%{x}<br>Score: %{y:.1f}<extra></extra>',
                showlegend: false,
            }] : []),
        ];

        const layout = mergeLayout(baseLayout, {
            xaxis: { type: 'date' },
            yaxis: { title: { text: 'Recovery score' } },
            shapes: [
                { type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 30, y1: 100,
                  fillcolor: 'rgba(52,211,153,0.05)', line: { width: 0 } },
                { type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 18, y1: 30,
                  fillcolor: 'rgba(96,165,250,0.04)', line: { width: 0 } },
                { type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 0, y1: 10,
                  fillcolor: 'rgba(248,113,113,0.05)', line: { width: 0 } },
            ],
        });

        const insight = `Latest: ${latest.score.toFixed(1)} · ${classification.label}.` +
            (burnouts.length ? ` ${burnouts.length} burnout day${burnouts.length > 1 ? 's' : ''} in range.` : '');

        return { data, layout, insight, isEmpty: false, latest, classification };
    }, [daily]);

    return (
        <ChartShell
            title="Recovery score over time"
            subtitle="(sleep × 10) ÷ (activity load)"
            span={2}
            height={300}
            isEmpty={isEmpty}
            insight={insight}
        >
            <div className="rsc-wrap">
                <div className="rsc-plot">
                    <Plot data={data} layout={layout} config={baseConfig}
                          useResizeHandler style={{ width: '100%', height: '100%' }} />
                </div>
                {latest && (
                    <aside className={`rsc-card rsc-card--${classification.tone}`}>
                        <p className="rsc-card__eyebrow">Latest score</p>
                        <p className="rsc-card__value">{latest.score.toFixed(1)}</p>
                        <p className="rsc-card__label">{classification.label}</p>
                        <p className="rsc-card__date">as of {latest.date}</p>
                    </aside>
                )}
            </div>
        </ChartShell>
    );
}