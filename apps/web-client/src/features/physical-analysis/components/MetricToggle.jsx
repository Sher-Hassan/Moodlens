import './MetricToggle.css';

export default function MetricToggle({ value, onChange, options }) {
    return (
        <div className="pa-metric-toggle">
            {options.map((opt) => (
                <button
                    key={opt.key}
                    className={`pa-metric-toggle__btn ${value === opt.key ? 'is-active' : ''}`}
                    style={value === opt.key ? { color: opt.color, borderColor: opt.color } : undefined}
                    onClick={() => onChange(opt.key)}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}