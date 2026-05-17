import { useState } from 'react';
import PlotlyComponent from 'react-plotly.js';

const Plot = PlotlyComponent.default || PlotlyComponent;



const METRICS = [
    { 
        key: 'wellness', 
        label: 'Wellness', 
        colorscale: [[0, '#F87171'], [0.5, '#F5C842'], [1, '#34D399']],
        description: 'Overall mental wellness score'
    },
    { 
        key: 'stress', 
        label: 'Stress', 
        colorscale: [[0, '#34D399'], [0.5, '#F5C842'], [1, '#F87171']],
        description: 'Daily stress intensity'
    },
    { 
        key: 'sleep', 
        label: 'Sleep', 
        colorscale: [[0, '#F87171'], [0.5, '#F5C842'], [1, '#0BEFC4']],
        description: 'Sleep quality score'
    },
    { 
        key: 'activity', 
        label: 'Activity', 
        colorscale: [[0, '#F87171'], [0.5, '#F5C842'], [1, '#0BEFC4']],
        description: 'Physical activity level'
    },
];

export default function BehavioralHeatmap({ heatmap }) {
    const [selectedMetric, setSelectedMetric] = useState('wellness');

    if (!heatmap || !heatmap.weeks || heatmap.weeks.length === 0) {
        return null;
    }

    const metric = METRICS.find(m => m.key === selectedMetric);
    const zData = heatmap.data[selectedMetric];

    return (
        <div className="behavioral-heatmap">
            {/* Metric selector */}
            <div className="heatmap-tabs">
                {METRICS.map(m => (
                    <button
                        key={m.key}
                        onClick={() => setSelectedMetric(m.key)}
                        className={`heatmap-tab ${selectedMetric === m.key ? 'active' : ''}`}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            <p className="heatmap-description">{metric.description}</p>

            <Plot
                data={[{
                    z: zData,
                    x: heatmap.days,
                    y: heatmap.weeks,
                    type: 'heatmap',
                    colorscale: metric.colorscale,
                    zmin: 0,
                    zmax: 100,
                    showscale: true,
                    hovertemplate: '<b>%{y} %{x}</b><br>Value: %{z}<extra></extra>',
                    xgap: 4,
                    ygap: 4,
                    colorbar: {
                        thickness: 12,
                        len: 0.8,
                        tickfont: { 
                            color: '#9CA3AF', 
                            size: 10,
                            family: 'JetBrains Mono, monospace'
                        },
                        outlinewidth: 0,
                        ticks: 'outside',
                        ticklen: 4,
                        tickcolor: 'rgba(107, 114, 128, 0.3)',
                    },
                }]}
                layout={{
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    height: 280,
                    margin: { t: 20, b: 40, l: 60, r: 30 },
                    font: { color: '#E5E7EB', family: 'Inter, sans-serif' },
                    xaxis: {
                        side: 'top',
                        tickfont: { 
                            color: '#9CA3AF', 
                            size: 11,
                            family: 'JetBrains Mono, monospace'
                        },
                        showgrid: false,
                        showline: false,
                        ticks: '',
                    },
                    yaxis: {
                        tickfont: { 
                            color: '#9CA3AF', 
                            size: 11,
                            family: 'JetBrains Mono, monospace'
                        },
                        showgrid: false,
                        showline: false,
                        ticks: '',
                        autorange: 'reversed',
                    },
                    autosize: true,
                }}
                config={{ 
                    displayModeBar: false, 
                    responsive: true 
                }}
                style={{ width: '100%', height: '280px' }}
                useResizeHandler={true}
            />

            <div className="heatmap-legend">
                <span className="heatmap-legend__item">
                    <span className="heatmap-legend__dot" style={{ background: '#F87171' }} />
                    Low
                </span>
                <span className="heatmap-legend__item">
                    <span className="heatmap-legend__dot" style={{ background: '#F5C842' }} />
                    Medium
                </span>
                <span className="heatmap-legend__item">
                    <span className="heatmap-legend__dot" style={{ background: '#34D399' }} />
                    High
                </span>
            </div>
        </div>
    );
}