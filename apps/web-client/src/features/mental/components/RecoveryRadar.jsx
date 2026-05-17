import { useMemo } from 'react';
import PlotlyComponent from 'react-plotly.js';

const Plot = PlotlyComponent.default || PlotlyComponent;

/**
 * Tips for each weak axis — short, actionable advice tied to which dimension is lowest.
 */
const WEAK_AXIS_ADVICE = {
    Sleep:        'aim for 7–9h consistently for a week',
    Stress:       'try short breaks or breathing exercises during the day',
    Anxiety:      'short walks and limited caffeine can help in the next few days',
    Activity:     'add 1–2k more steps to your daily average',
    'Emotional balance': 'check in with someone you trust this week',
};

export default function RecoveryRadar({ recovery }) {
    // Find the weakest axis to call out — done BEFORE the null-check
    // (hooks must be called unconditionally per React rules)
    const weakest = useMemo(() => {
        if (!recovery?.radar) return null;
        const axes = [
            { label: 'Sleep',             value: recovery.radar.sleep },
            { label: 'Stress',            value: recovery.radar.stress },
            { label: 'Anxiety',           value: recovery.radar.anxiety },
            { label: 'Activity',          value: recovery.radar.activity },
            { label: 'Emotional balance', value: recovery.radar.emotional_balance },
        ];
        return axes.reduce((min, a) => (a.value < min.value ? a : min), axes[0]);
    }, [recovery]);

    if (!recovery) return null;

    const categories = ['Sleep', 'Stress', 'Anxiety', 'Activity', 'Emotional'];
    const values = [
        recovery.radar.sleep,
        recovery.radar.stress,
        recovery.radar.anxiety,
        recovery.radar.activity,
        recovery.radar.emotional_balance,
    ];

    return (
        <div className="recovery-radar">
            <Plot
                data={[{
                    type: 'scatterpolar',
                    r: [...values, values[0]],
                    theta: [...categories, categories[0]],
                    fill: 'toself',
                    fillcolor: 'rgba(11, 239, 196, 0.18)',
                    line: { color: '#0BEFC4', width: 2 },
                    marker: { color: '#0BEFC4', size: 8, line: { color: '#0BEFC4', width: 2 } },
                    hovertemplate: '<b>%{theta}</b><br>%{r}/100<extra></extra>',
                    name: 'Recovery',
                }]}
                layout={{
                    polar: {
                        bgcolor: 'rgba(255,255,255,0.01)',
                        radialaxis: {
                            visible: true,
                            range: [0, 100],
                            color: '#9CA3AF',
                            gridcolor: 'rgba(107, 114, 128, 0.2)',
                            linecolor: 'rgba(107, 114, 128, 0.2)',
                            tickfont: { color: '#6B7280', size: 9, family: 'JetBrains Mono, monospace' },
                            tickvals: [25, 50, 75, 100],
                            tickmode: 'array',
                        },
                        angularaxis: {
                            color: '#E5E7EB',
                            gridcolor: 'rgba(107, 114, 128, 0.25)',
                            linecolor: 'rgba(107, 114, 128, 0.25)',
                            tickfont: { color: '#E5E7EB', size: 11, family: 'Inter, sans-serif' },
                        },
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    height: 280,
                    margin: { t: 30, b: 30, l: 60, r: 60 },
                    showlegend: false,
                    autosize: true,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '280px' }}
                useResizeHandler={true}
            />

            <div className="recovery-radar__footer">
                <div className="recovery-radar__score">
                    <span className="recovery-radar__num" style={{ color: recovery.color }}>
                        {recovery.score}
                    </span>
                    <span className="recovery-radar__max">/ 100</span>
                </div>
                <p className="recovery-radar__category" style={{ color: recovery.color }}>
                    {recovery.category}
                </p>
            </div>

            {/* Weak-axis callout */}
            {weakest && weakest.value < 70 && (
                <p className="recovery-radar__weak">
                    <span className="recovery-radar__weak-tag">FOCUS HERE</span>
                    <strong>{weakest.label}</strong> at {weakest.value}/100 — {WEAK_AXIS_ADVICE[weakest.label]}.
                </p>
            )}
        </div>
    );
}
