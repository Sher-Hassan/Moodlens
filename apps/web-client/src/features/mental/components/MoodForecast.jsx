import { useState } from 'react';
import PlotlyComponent from 'react-plotly.js';
import InfoTooltip from './InfoTooltip';

const Plot = PlotlyComponent.default || PlotlyComponent;

const METRICS = [
    { key: 'wellness',   label: 'Wellness',   color: '#34D399', inverted: false, highIsGood: true,
      desc: 'Overall mental wellbeing' },
    { key: 'stress',     label: 'Stress',     color: '#FB923C', inverted: true,  highIsGood: false,
      desc: 'Stress intensity' },
    { key: 'anxiety',    label: 'Anxiety',    color: '#F5C842', inverted: true,  highIsGood: false,
      desc: 'Anxiety level' },
    { key: 'depression', label: 'Depression', color: '#B794F4', inverted: true,  highIsGood: false,
      desc: 'Depressive symptom load' },
];

const TREND_COLORS = {
    worsening: '#F87171',
    improving: '#34D399',
    caution:   '#F5C842',
    stable:    '#0BEFC4',
};

const TREND_ICONS = {
    worsening: '↘',
    improving: '↗',
    caution:   '!',
    stable:    '→',
};

/**
 * Classifies a change relative to model uncertainty (MAE ≈ 15).
 * Returns { magnitude, direction, color-class suffix, label }.
 *
 *   magnitude:
 *     - 'stable'      → |change| < 3 (within noise)
 *     - 'small'       → 3 ≤ |change| < 10
 *     - 'significant' → |change| ≥ 10
 *
 *   direction (relative to whether the metric is inverted):
 *     - 'good': metric moved in the healthy direction
 *     - 'bad':  metric moved in the unhealthy direction
 *     - 'stable': not meaningfully changing
 */
function classifyChange(change, isInverted) {
    const abs = Math.abs(change);
    if (abs < 3) return { magnitude: 'stable', direction: 'stable', label: 'no notable change' };

    // For inverted metrics: change > 0 (going up) = BAD; change < 0 (going down) = GOOD
    // For positive metrics: change > 0 (going up) = GOOD; change < 0 (going down) = BAD
    const isGoodDirection = isInverted ? change < 0 : change > 0;
    const direction = isGoodDirection ? 'good' : 'bad';

    if (abs >= 10) {
        return {
            magnitude: 'significant',
            direction,
            label: isGoodDirection ? 'significant improvement' : 'significant decline',
        };
    }
    return {
        magnitude: 'small',
        direction,
        label: isGoodDirection ? 'slight improvement' : 'slight decline',
    };
}

export default function MoodForecast({ moodForecast }) {
    const [selectedMetric, setSelectedMetric] = useState('wellness');

    if (!moodForecast || !moodForecast.history || !moodForecast.forecast) {
        return null;
    }

    const metric = METRICS.find(m => m.key === selectedMetric);

    const historyDates = moodForecast.history.map(d => d.date);
    const historyValues = moodForecast.history.map(d => d[selectedMetric]);

    const forecastDates = moodForecast.forecast.map(d => d.date);
    const forecastValues = moodForecast.forecast.map(d => d[selectedMetric]);
    const forecastLower = moodForecast.forecast.map(d => d.confidence[selectedMetric].lower);
    const forecastUpper = moodForecast.forecast.map(d => d.confidence[selectedMetric].upper);

    const lastHistoryDate = historyDates[historyDates.length - 1];
    const lastHistoryValue = historyValues[historyValues.length - 1];

    const connectedForecastDates = [lastHistoryDate, ...forecastDates];
    const connectedForecastValues = [lastHistoryValue, ...forecastValues];
    const connectedLower = [lastHistoryValue, ...forecastLower];
    const connectedUpper = [lastHistoryValue, ...forecastUpper];

    const todayDate = lastHistoryDate;

    const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const nextDayValue = moodForecast.nextDay[selectedMetric];
    const nextWeekValue = moodForecast.nextWeek[selectedMetric];
    const currentValue = lastHistoryValue;

    const dayChange = nextDayValue - currentValue;
    const weekChange = nextWeekValue - currentValue;

    // ── CORRECTED direction logic (was a bug in the previous version) ──
    const dayClass = classifyChange(dayChange, metric.inverted);
    const weekClass = classifyChange(weekChange, metric.inverted);

    return (
        <div className="mood-forecast">
            {/* Metric tabs + inversion indicator */}
            <div className="forecast-tabs-wrap">
                <div className="forecast-tabs">
                    {METRICS.map(m => (
                        <button
                            key={m.key}
                            onClick={() => setSelectedMetric(m.key)}
                            className={`forecast-tab ${selectedMetric === m.key ? 'active' : ''}`}
                            style={selectedMetric === m.key ? {
                                color: m.color,
                                borderColor: hexToRgba(m.color, 0.3),
                                background: hexToRgba(m.color, 0.08),
                            } : {}}
                        >
                            <span className="forecast-tab__dot" style={{ background: m.color }} />
                            {m.label}
                        </button>
                    ))}
                </div>

                <span className={`forecast-inversion-note forecast-inversion-note--${metric.inverted ? 'inverted' : 'positive'}`}>
                    {metric.inverted ? '↓ Lower is better' : '↑ Higher is better'}
                </span>
            </div>

            {/* Forecast chart */}
            <Plot
                data={[
                    {
                        x: connectedForecastDates,
                        y: connectedLower,
                        type: 'scatter',
                        mode: 'lines',
                        line: { width: 0 },
                        showlegend: false,
                        hoverinfo: 'skip',
                        name: 'Lower',
                    },
                    {
                        x: connectedForecastDates,
                        y: connectedUpper,
                        type: 'scatter',
                        mode: 'lines',
                        line: { width: 0 },
                        fill: 'tonexty',
                        fillcolor: hexToRgba(metric.color, 0.15),
                        name: 'Uncertainty band',
                        hovertemplate: '<b>Range:</b> %{y}<extra></extra>',
                    },
                    {
                        x: historyDates,
                        y: historyValues,
                        type: 'scatter',
                        mode: 'lines+markers',
                        name: 'Actual',
                        line: { color: metric.color, width: 2.5, shape: 'spline', smoothing: 0.6 },
                        marker: { color: metric.color, size: 6 },
                        hovertemplate: '<b>Actual:</b> %{y}<br>%{x}<extra></extra>',
                    },
                    {
                        x: connectedForecastDates,
                        y: connectedForecastValues,
                        type: 'scatter',
                        mode: 'lines+markers',
                        name: 'Forecast',
                        line: { color: metric.color, width: 2.5, dash: 'dash', shape: 'spline', smoothing: 0.6 },
                        marker: { color: metric.color, size: 6, symbol: 'diamond', line: { color: metric.color, width: 2 } },
                        opacity: 0.85,
                        hovertemplate: '<b>Forecast:</b> %{y}<br>%{x}<extra></extra>',
                    },
                ]}
                layout={{
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    height: 340,
                    margin: { t: 30, b: 50, l: 50, r: 30 },
                    font: { color: '#E5E7EB', family: 'Inter, sans-serif' },
                    showlegend: true,
                    legend: {
                        orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center',
                        font: { color: '#9CA3AF', size: 11, family: 'JetBrains Mono, monospace' },
                        bgcolor: 'rgba(0,0,0,0)',
                    },
                    xaxis: {
                        showgrid: false, showline: true,
                        linecolor: 'rgba(107, 114, 128, 0.2)',
                        tickfont: { color: '#6B7280', size: 10, family: 'JetBrains Mono, monospace' },
                        tickformat: '%b %d',
                    },
                    yaxis: {
                        range: [0, 100],
                        showgrid: true,
                        gridcolor: 'rgba(107, 114, 128, 0.1)',
                        showline: false,
                        zeroline: false,
                        tickfont: { color: '#6B7280', size: 10, family: 'JetBrains Mono, monospace' },
                        tickvals: [0, 25, 50, 75, 100],
                    },
                    shapes: [{
                        type: 'line', x0: todayDate, x1: todayDate, y0: 0, y1: 100, yref: 'y',
                        line: { color: 'rgba(229, 231, 235, 0.25)', width: 1, dash: 'dot' },
                    }],
                    annotations: [{
                        x: todayDate, y: 100, text: 'NOW', showarrow: false,
                        font: { color: 'rgba(229, 231, 235, 0.5)', size: 9, family: 'JetBrains Mono, monospace' },
                        yshift: 12,
                        bgcolor: 'rgba(31, 41, 55, 0.6)', bordercolor: 'rgba(107, 114, 128, 0.3)',
                        borderwidth: 1, borderpad: 3,
                    }],
                    autosize: true,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '340px' }}
                useResizeHandler={true}
            />

            {/* Prediction cards — now with corrected direction logic */}
            <div className="forecast-predictions">
                <div className="forecast-prediction">
                    <span className="forecast-prediction__label">Tomorrow</span>
                    <div className="forecast-prediction__value">
                        <span className="forecast-prediction__num" style={{ color: metric.color }}>
                            {nextDayValue}
                        </span>
                        <span className={`forecast-prediction__change forecast-prediction__change--${dayClass.direction}`}>
                            {dayChange > 0 ? '+' : ''}{dayChange}
                        </span>
                    </div>
                    <p className="forecast-prediction__interp">{dayClass.label}</p>
                </div>

                <div className="forecast-prediction">
                    <span className="forecast-prediction__label">7 days out</span>
                    <div className="forecast-prediction__value">
                        <span className="forecast-prediction__num" style={{ color: metric.color }}>
                            {nextWeekValue}
                        </span>
                        <span className={`forecast-prediction__change forecast-prediction__change--${weekClass.direction}`}>
                            {weekChange > 0 ? '+' : ''}{weekChange}
                        </span>
                    </div>
                    <p className="forecast-prediction__interp">{weekClass.label}</p>
                </div>

                <div className="forecast-prediction forecast-prediction--trend">
                    <span className="forecast-prediction__label">Overall trend</span>
                    <div className="forecast-prediction__value">
                        <span className="forecast-prediction__trend-icon"
                              style={{ color: TREND_COLORS[moodForecast.trend] }}>
                            {TREND_ICONS[moodForecast.trend]}
                        </span>
                        <span className="forecast-prediction__trend-label"
                              style={{ color: TREND_COLORS[moodForecast.trend] }}>
                            {moodForecast.trend}
                        </span>
                    </div>
                    <p className="forecast-prediction__interp">7-day outlook</p>
                </div>
            </div>

            {/* AI Insight */}
            <div className="forecast-insight"
                 style={{ borderLeftColor: TREND_COLORS[moodForecast.trend] }}>
                <span className="forecast-insight__icon"
                      style={{
                          color: TREND_COLORS[moodForecast.trend],
                          background: hexToRgba(TREND_COLORS[moodForecast.trend], 0.1),
                      }}>
                    {TREND_ICONS[moodForecast.trend]}
                </span>
                <div className="forecast-insight__body">
                    <span className="forecast-insight__category">AI Forecast</span>
                    <p className="forecast-insight__text">{moodForecast.insight}</p>
                </div>
            </div>
        </div>
    );
}
