export default function AIInsights({ insights, metadata }) {
    if (!insights || insights.length === 0) return null;

    const iconMap = {
        positive: '↗',
        warning: '!',
        suggestion: '◆',
    };
    
    const colorMap = {
        positive: '#34D399',
        warning: '#FB923C',
        suggestion: '#0BEFC4',
    };

    return (
        <div className="ai-insights">
            <div className="ai-insights__header">
                <div>
                    <p className="ai-insights__eyebrow">AI Analysis</p>
                    <h3 className="ai-insights__title">Insights</h3>
                </div>
                {metadata && (
                    <span className="ai-insights__meta">
                        Based on {metadata.daysAnalyzed} days
                    </span>
                )}
            </div>
            
            <div className="ai-insights__list">
                {insights.map((insight, i) => (
                    <div 
                        key={i} 
                        className={`ai-insight ai-insight--${insight.type}`}
                        style={{ borderLeftColor: colorMap[insight.type] }}
                    >
                        <span 
                            className="ai-insight__icon"
                            style={{ 
                                color: colorMap[insight.type],
                                background: `${colorMap[insight.type]}15`
                            }}
                        >
                            {iconMap[insight.type]}
                        </span>
                        <div className="ai-insight__body">
                            <span className="ai-insight__category">{insight.category}</span>
                            <p className="ai-insight__text">{insight.text}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}