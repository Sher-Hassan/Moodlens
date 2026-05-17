import PlotlyComponent from 'react-plotly.js';

const Plot = PlotlyComponent.default || PlotlyComponent;

export default function WellnessGauge({ wellness }) {
    if (!wellness) return null;

    return (
        <div className="wellness-gauge">
            <Plot
                data={[{
                    type: 'indicator',
                    mode: 'gauge+number',
                    value: wellness.score,
                    number: {
                        font: { 
                            size: 56, 
                            color: wellness.color, 
                            family: 'JetBrains Mono, monospace' 
                        },
                        suffix: '',
                    },
                    gauge: {
                        axis: { 
                            range: [0, 100], 
                            tickcolor: 'rgba(229, 231, 235, 0.3)',
                            tickfont: { 
                                color: '#9CA3AF', 
                                size: 10, 
                                family: 'JetBrains Mono, monospace' 
                            },
                            tickwidth: 1,
                            ticklen: 4,
                            tickmode: 'array',
                            tickvals: [0, 20, 40, 60, 80, 100],
                        },
                        bar: { 
                            color: wellness.color, 
                            thickness: 0.25,
                            line: { color: wellness.color, width: 1 }
                        },
                        bgcolor: 'rgba(255,255,255,0.02)',
                        borderwidth: 0,
                        bordercolor: 'transparent',
                        steps: [
                            { range: [0, 20], color: 'rgba(248, 113, 113, 0.15)' },
                            { range: [20, 40], color: 'rgba(251, 146, 60, 0.15)' },
                            { range: [40, 60], color: 'rgba(245, 200, 66, 0.15)' },
                            { range: [60, 80], color: 'rgba(11, 239, 196, 0.15)' },
                            { range: [80, 100], color: 'rgba(52, 211, 153, 0.18)' },
                        ],
                        threshold: {
                            line: { color: wellness.color, width: 3 },
                            thickness: 0.75,
                            value: wellness.score
                        }
                    }
                }]}
                layout={{
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    height: 260,
                    margin: { t: 30, b: 10, l: 30, r: 30 },
                    font: { color: '#E5E7EB', family: 'Inter, sans-serif' },
                    autosize: true,
                }}
                config={{ 
                    displayModeBar: false, 
                    responsive: true,
                    staticPlot: false
                }}
                style={{ width: '100%', height: '260px' }}
                useResizeHandler={true}
            />
            
            <div className="wellness-gauge__footer">
                <p className="wellness-gauge__category" style={{ color: wellness.color }}>
                    {wellness.category}
                </p>
                <p className="wellness-gauge__description">{wellness.description}</p>
            </div>
        </div>
    );
}  