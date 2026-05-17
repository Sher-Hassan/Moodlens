import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { recoveryScore, classifyRecovery } from '../analytics/scores';
import './RecoveryScoreChart.css';

export default function RecoveryScoreChart({ daily }) {
    const { data, layout, insight, isEmpty, latest, classification } = useMemo(() => {
        const scored = daily
            .map((d) => ({ ...d, score: recoveryScore(d) }))
            .filter((d) => d.score != null);
        if (scored.length < 3) return { isEmpty: true };

        const latest = scored[scored.length - 1];
        const classification = classifyRecovery(latest.score);

        const x = scored.map((d) => d.date);
        const y = scored.map((d) => d.score);

        // Mark fatigued days (score < 40) for at-a-glance pattern
        const fatiguedIdx = scored.map((d, i) => (d.score < 40 ? i : null)).filter((v) => v !== null);
        const fX = fatiguedIdx.map((i) => x[i]);
        const fY = fatiguedIdx.map((i) => y[i]);

        const data = [
            // Threshold guide bands
            {
                x, y, mode: 'lines+markers', name: 'Recovery',
                line: { color: COLORS.sleep, width: 2.5, shape: 'spline', smoothing: 1.1 },
                marker: { size: 5, color: COLORS.sleep },
                fill: 'tozeroy', fillcolor: COLORS.sleepSoft,
                hovertemplate: '<b>%{x}</b><br>Recovery: %{y}/100<extra></extra>',
            },
            ...(fX.length ? [{
                x: fX, y: fY, mode: 'markers', name: 'Fatigued day',
                marker: { color: COLORS.state.fatigued, size: 11, symbol: 'x', line: { width: 2 } },
                hovertemplate: '<b>Fatigued · %{x}</b><br>Score: %{y}<extra></extra>',
                showlegend: false,
            }] : []),
        ];

        const layout = mergeLayout(baseLayout, {
            xaxis: { type: 'date' },
            yaxis: { title: { text: 'Recovery score' }, range: [0, 105] },
            shapes: [
                // Excellent band (80-100)
                { type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 80, y1: 100,
                  fillcolor: 'rgba(52,211,153,0.07)', line: { width: 0 } },
                // Balanced (60-80)
                { type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 60, y1: 80,
                  fillcolor: 'rgba(11,239,196,0.05)', line: { width: 0 } },
                // Recovery (40-60)
                { type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 40, y1: 60,
                  fillcolor: 'rgba(245,200,66,0.05)', line: { width: 0 } },
                // Fatigued (0-40)
                { type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 0, y1: 40,
                  fillcolor: 'rgba(248,113,113,0.06)', line: { width: 0 } },
            ],
            annotations: [
                { xref: 'paper', yref: 'y', x: 1.01, y: 90, xanchor: 'left', showarrow: false,
                  text: 'Excellent', font: { family: 'JetBrains Mono', size: 9, color: COLORS.state.excellent } },
                { xref: 'paper', yref: 'y', x: 1.01, y: 70, xanchor: 'left', showarrow: false,
                  text: 'Balanced', font: { family: 'JetBrains Mono', size: 9, color: COLORS.state.good } },
                { xref: 'paper', yref: 'y', x: 1.01, y: 50, xanchor: 'left', showarrow: false,
                  text: 'Recovery', font: { family: 'JetBrains Mono', size: 9, color: COLORS.state.moderate } },
                { xref: 'paper', yref: 'y', x: 1.01, y: 20, xanchor: 'left', showarrow: false,
                  text: 'Fatigued', font: { family: 'JetBrains Mono', size: 9, color: COLORS.state.fatigued } },
            ],
            margin: { l: 56, r: 86, t: 16, b: 44 },
        });

        const insight =
            `Latest: ${latest.score}/100 · ${classification.label}.` +
            (fatiguedIdx.length ? ` ${fatiguedIdx.length} fatigued day${fatiguedIdx.length > 1 ? 's' : ''} in this window.` : '');

        return { data, layout, insight, isEmpty: false, latest, classification };
    }, [daily]);

    return (
        <ChartShell
            title="Recovery score over time"
            subtitle="Daily recovery on a 0–100 scale"
            span={2}
            height={320}
            isEmpty={isEmpty}
            insight={insight}
            info={{
                what: 'A daily 0–100 score combining sleep quality (60 pts) and activity-load fit (40 pts).',
                how:  'Higher is better. Green band = excellent recovery, red = fatigued. Red ✕ marks days you were under-recovered.',
                why:  'Tracks whether your sleep is keeping pace with your activity load. Sustained dips into the red zone predict burnout.',
            }}
        >
            <div className="rsc-wrap">
                <div className="rsc-plot">
                    <Plot data={data} layout={layout} config={baseConfig}
                          useResizeHandler style={{ width: '100%', height: '100%' }} />
                </div>
                {latest && (
                    <aside className={`rsc-card rsc-card--${classification.tone}`}>
                        <p className="rsc-card__eyebrow">Latest score</p>
                        <p className="rsc-card__value">{latest.score}</p>
                        <p className="rsc-card__label">{classification.label}</p>
                        <p className="rsc-card__date">as of {latest.date}</p>
                    </aside>
                )}
            </div>
        </ChartShell>
    );
}
