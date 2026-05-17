import { useMemo } from 'react';
import Plot from '../Plot';
import ChartShell from '../components/ChartShell';
import { baseLayout, baseConfig, mergeLayout, COLORS } from '../chartTheme';
import { detectAnomalies } from '../analytics/scores';
import { formatDateShort } from '../utils/dates';
import './OutlierDetection.css';

const KIND_META = {
    low_sleep:    { icon: '☾', tone: 'critical', label: 'Low sleep' },
    inactive:     { icon: '↘', tone: 'stressed', label: 'Inactivity' },
    high_energy:  { icon: '⚡', tone: 'elevated', label: 'Energy spike' },
};

export default function OutlierDetection({ daily }) {
    const { data, layout, alerts, isEmpty, insight } = useMemo(() => {
        if (daily.length < 4) return { isEmpty: true };

        const data = [
            { type: 'box', y: daily.map((d) => d.steps), name: 'Steps', x0: 0,
              marker: { color: COLORS.steps, outliercolor: COLORS.state.fatigued, size: 7 },
              boxpoints: 'outliers', line: { color: COLORS.steps },
              fillcolor: COLORS.stepsSoft },
            { type: 'box', y: daily.map((d) => d.sleep_hours * 1000), name: 'Sleep (×1k)', x0: 1,
              marker: { color: COLORS.sleep, outliercolor: COLORS.state.fatigued, size: 7 },
              boxpoints: 'outliers', line: { color: COLORS.sleep },
              fillcolor: COLORS.sleepSoft,
              hovertemplate: '%{y:.0f} (sleep scaled ×1000 for view)<extra></extra>' },
            { type: 'box', y: daily.map((d) => d.active_energy), name: 'Energy', x0: 2,
              marker: { color: COLORS.energy, outliercolor: COLORS.state.fatigued, size: 7 },
              boxpoints: 'outliers', line: { color: COLORS.energy },
              fillcolor: COLORS.energySoft },
        ];

        const layout = mergeLayout(baseLayout, {
            xaxis: {
                tickmode: 'array', tickvals: [0, 1, 2],
                ticktext: ['Steps', 'Sleep ×1k', 'Energy'],
                tickfont: { family: 'DM Sans', size: 11, color: COLORS.text },
                gridcolor: 'transparent', zerolinecolor: 'transparent',
            },
            yaxis: { title: { text: 'Value' } },
            showlegend: false,
        });

        const alerts = detectAnomalies(daily);
        const insight = alerts.length === 0
            ? 'No anomalies detected in this window.'
            : `${alerts.length} day${alerts.length > 1 ? 's' : ''} flagged. Review the cards below.`;
        return { data, layout, alerts, isEmpty: false, insight };
    }, [daily]);

    return (
        <ChartShell
            title="Outlier & anomaly detection"
            subtitle="Unusual days, flagged automatically"
            span={2}
            height={280}
            isEmpty={isEmpty}
            insight={insight}
        >
            <div className="od-wrap">
                <div className="od-plot">
                    <Plot data={data} layout={layout} config={baseConfig}
                          useResizeHandler style={{ width: '100%', height: '100%' }} />
                </div>
                <div className="od-alerts">
                    {alerts && alerts.length > 0 ? alerts.slice(0, 6).map((a, i) => {
                        const meta = KIND_META[a.kind];
                        return (
                            <div key={i} className={`od-alert od-alert--${meta.tone}`}>
                                <span className="od-alert__icon">{meta.icon}</span>
                                <div className="od-alert__body">
                                    <p className="od-alert__head">{meta.label}</p>
                                    <p className="od-alert__msg">{a.msg}</p>
                                </div>
                                <span className="od-alert__date">{formatDateShort(a.date)}</span>
                            </div>
                        );
                    }) : (
                        <div className="od-alert od-alert--ok">
                            <span className="od-alert__icon">✓</span>
                            <div className="od-alert__body">
                                <p className="od-alert__head">All clear</p>
                                <p className="od-alert__msg">Nothing unusual in this window.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ChartShell>
    );
}