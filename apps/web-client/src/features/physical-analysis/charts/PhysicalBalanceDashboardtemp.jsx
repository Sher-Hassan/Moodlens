import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { balanceScore, classifyBalance } from '../analytics/scores';
import './PhysicalBalanceDashboard.css';

const recommendation = (tone) => ({
    excellent: 'Keep going. Your sleep, activity, and energy are well-matched.',
    good: 'Strong overall. A consistent sleep schedule will push you higher.',
    moderate: 'Mixed signals — try adding 1k steps and an extra 30min of sleep.',
    fatigued: 'You\'re running a deficit. Prioritize sleep for the next few days.',
}[tone]);

export default function PhysicalBalanceDashboard({ daily }) {
    const { gaugeData, gaugeLayout, lineData, lineLayout, latestScore, classification, isEmpty, insight } = useMemo(() => {
        const scored = daily.map((d) => ({
            date: d.date, ...balanceScore(d),
        }));
        if (!scored.length) return { isEmpty: true };

        const latest = scored[scored.length - 1];
        const classification = classifyBalance(latest.composite);
        const toneColor = ({
            excellent: COLORS.state.excellent,
            good: COLORS.state.good,
            moderate: COLORS.state.moderate,
            fatigued: COLORS.state.fatigued,
        })[classification.tone];

        const gaugeData = [{
            type: 'indicator', mode: 'gauge+number',
            value: latest.composite,
            number: { font: { family: 'JetBrains Mono', size: 36, color: COLORS.textBright }, suffix: '' },
            gauge: {
                axis: { range: [0, 100], tickfont: { family: 'JetBrains Mono', size: 9, color: COLORS.textMuted } },
                bar: { color: toneColor, thickness: 0.25 },
                bgcolor: 'transparent',
                borderwidth: 1, bordercolor: COLORS.axis,
                steps: [
                    { range: [0, 45],  color: 'rgba(248,113,113,0.08)' },
                    { range: [45, 65], color: 'rgba(245,200,66,0.08)' },
                    { range: [65, 80], color: 'rgba(11,239,196,0.08)' },
                    { range: [80, 100], color: 'rgba(52,211,153,0.10)' },
                ],
                threshold: { line: { color: toneColor, width: 3 }, value: latest.composite, thickness: 0.85 },
            },
        }];
        const gaugeLayout = mergeLayout(baseLayout, {
            margin: { l: 16, r: 16, t: 8, b: 8 },
        });

        const lineData = [{
            x: scored.map((s) => s.date),
            y: scored.map((s) => s.composite),
            mode: 'lines',
            line: { color: COLORS.steps, width: 2.5, shape: 'spline', smoothing: 1.1 },
            fill: 'tozeroy', fillcolor: COLORS.stepsSoft,
            hovertemplate: '<b>%{x}</b><br>Score: %{y}<extra></extra>',
        }];
        const lineLayout = mergeLayout(baseLayout, {
            xaxis: { type: 'date' },
            yaxis: { range: [0, 100], title: { text: 'Score' } },
            margin: { l: 48, r: 16, t: 8, b: 32 },
            shapes: [
                { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 80, y1: 80,
                  line: { color: COLORS.state.excellent, dash: 'dot', width: 1 } },
                { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 45, y1: 45,
                  line: { color: COLORS.state.moderate, dash: 'dot', width: 1 } },
            ],
        });

        const insight = `Composite balance: ${latest.composite}/100 · ${classification.label}.`;
        return { gaugeData, gaugeLayout, lineData, lineLayout, latestScore: latest, classification, isEmpty: false, insight };
    }, [daily]);

    return (
        <ChartShell
            title="Physical balance score"
            subtitle="Steps + sleep + energy → composite"
            span={2}
            height={360}
            isEmpty={isEmpty}
            insight={insight}
        >
            <div className="pbd-wrap">
                <div className="pbd-gauge">
                    <Plot data={gaugeData} layout={gaugeLayout} config={baseConfig}
                          useResizeHandler style={{ width: '100%', height: '100%' }} />
                    {latestScore && (
                        <p className={`pbd-label pbd-label--${classification.tone}`}>
                            {classification.label}
                        </p>
                    )}
                </div>

                <div className="pbd-side">
                    <div className="pbd-timeline">
                        <Plot data={lineData} layout={lineLayout} config={baseConfig}
                              useResizeHandler style={{ width: '100%', height: '100%' }} />
                    </div>
                    <div className="pbd-recommendation">
                        <span className="pbd-recommendation__icon">↳</span>
                        <p>{recommendation(classification?.tone)}</p>
                    </div>
                </div>
            </div>
        </ChartShell>
    );
}