import PlotlyComponent from 'react-plotly.js';

const Plot = PlotlyComponent.default || PlotlyComponent;



export default function BurnoutTimeline({ timeline }) {
    if (!timeline || timeline.length === 0) return null;

    const dates = timeline.map(d => d.date);
    const burnoutScores = timeline.map(d => d.burnout);
    const stressScores = timeline.map(d => d.stress);
    const sleepScores = timeline.map(d => d.sleep);

    // Current state
    const latestBurnout = burnoutScores[burnoutScores.length - 1];
    const latestRisk = timeline[timeline.length - 1].risk;

    let riskColor;
    if (latestBurnout < 31) riskColor = '#34D399';
    else if (latestBurnout < 56) riskColor = '#F5C842';
    else if (latestBurnout < 76) riskColor = '#FB923C';
    else riskColor = '#F87171';

    return (
        <div className="burnout-timeline">
            <Plot
                data={[
                    // Sleep (background line)
                    {
                        x: dates,
                        y: sleepScores,
                        type: 'scatter',
                        mode: 'lines',
                        name: 'Sleep',
                        line: { 
                            color: 'rgba(183, 148, 244, 0.5)', 
                            width: 1.5,
                            dash: 'dot'
                        },
                        hovertemplate: '<b>Sleep:</b> %{y}/100<br>%{x}<extra></extra>',
                    },
                    // Stress (background line)
                    {
                        x: dates,
                        y: stressScores,
                        type: 'scatter',
                        mode: 'lines',
                        name: 'Stress',
                        line: { 
                            color: 'rgba(251, 146, 60, 0.6)', 
                            width: 1.5,
                            dash: 'dot'
                        },
                        hovertemplate: '<b>Stress:</b> %{y}/100<br>%{x}<extra></extra>',
                    },
                    // Burnout (main line with area)
                    {
                        x: dates,
                        y: burnoutScores,
                        type: 'scatter',
                        mode: 'lines+markers',
                        name: 'Burnout',
                        line: { 
                            color: '#0BEFC4', 
                            width: 3,
                            shape: 'spline',
                            smoothing: 0.8,
                        },
                        marker: {
                            color: '#0BEFC4',
                            size: 6,
                            line: { color: '#0BEFC4', width: 2 }
                        },
                        fill: 'tozeroy',
                        fillcolor: 'rgba(11, 239, 196, 0.08)',
                        hovertemplate: '<b>Burnout:</b> %{y}/100<br>%{x}<extra></extra>',
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
                        orientation: 'h',
                        y: -0.2,
                        x: 0.5,
                        xanchor: 'center',
                        font: { 
                            color: '#9CA3AF', 
                            size: 11,
                            family: 'JetBrains Mono, monospace'
                        },
                        bgcolor: 'rgba(0,0,0,0)',
                    },
                    xaxis: {
                        showgrid: false,
                        showline: true,
                        linecolor: 'rgba(107, 114, 128, 0.2)',
                        tickfont: { 
                            color: '#6B7280', 
                            size: 10,
                            family: 'JetBrains Mono, monospace'
                        },
                        tickformat: '%b %d',
                    },
                    yaxis: {
                        range: [0, 100],
                        showgrid: true,
                        gridcolor: 'rgba(107, 114, 128, 0.1)',
                        showline: false,
                        zeroline: false,
                        tickfont: { 
                            color: '#6B7280', 
                            size: 10,
                            family: 'JetBrains Mono, monospace'
                        },
                        tickvals: [0, 25, 50, 75, 100],
                    },
                    // Risk zone bands
                    shapes: [
                        // Healthy zone
                        {
                            type: 'rect', xref: 'paper', yref: 'y',
                            x0: 0, x1: 1, y0: 0, y1: 30,
                            fillcolor: 'rgba(52, 211, 153, 0.04)',
                            line: { width: 0 },
                            layer: 'below'
                        },
                        // Mild fatigue zone
                        {
                            type: 'rect', xref: 'paper', yref: 'y',
                            x0: 0, x1: 1, y0: 30, y1: 55,
                            fillcolor: 'rgba(245, 200, 66, 0.04)',
                            line: { width: 0 },
                            layer: 'below'
                        },
                        // Burnout risk zone
                        {
                            type: 'rect', xref: 'paper', yref: 'y',
                            x0: 0, x1: 1, y0: 55, y1: 75,
                            fillcolor: 'rgba(251, 146, 60, 0.05)',
                            line: { width: 0 },
                            layer: 'below'
                        },
                        // Severe burnout zone
                        {
                            type: 'rect', xref: 'paper', yref: 'y',
                            x0: 0, x1: 1, y0: 75, y1: 100,
                            fillcolor: 'rgba(248, 113, 113, 0.06)',
                            line: { width: 0 },
                            layer: 'below'
                        },
                    ],
                    autosize: true,
                }}
                config={{ 
                    displayModeBar: false, 
                    responsive: true 
                }}
                style={{ width: '100%', height: '340px' }}
                useResizeHandler={true}
            />

            <div className="burnout-timeline__footer">
                <div className="burnout-timeline__current">
                    <span className="burnout-timeline__label">Current State</span>
                    <div className="burnout-timeline__value">
                        <span className="burnout-timeline__num" style={{ color: riskColor }}>
                            {latestBurnout}
                        </span>
                        <span className="burnout-timeline__category" style={{ color: riskColor }}>
                            {latestRisk}
                        </span>
                    </div>
                </div>

                <div className="burnout-timeline__legend">
                    <span className="burnout-zone burnout-zone--healthy">0-30 Healthy</span>
                    <span className="burnout-zone burnout-zone--mild">31-55 Mild Fatigue</span>
                    <span className="burnout-zone burnout-zone--risk">56-75 Burnout Risk</span>
                    <span className="burnout-zone burnout-zone--severe">76+ Severe</span>
                </div>
            </div>
        </div>
    );
}