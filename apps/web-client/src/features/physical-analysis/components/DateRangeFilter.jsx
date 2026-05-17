import './DateRangeFilter.css';

const OPTIONS = [
    { key: '7d', label: 'Last 7 days' },
    { key: '30d', label: 'Last 30 days' },
    { key: '90d', label: 'Last 90 days' },
];

export default function DateRangeFilter({ value, onChange }) {
    return (
        <div className="pa-range" role="tablist" aria-label="Date range">
            {OPTIONS.map((opt) => (
                <button
                    key={opt.key}
                    role="tab"
                    aria-selected={value === opt.key}
                    className={`pa-range__btn ${value === opt.key ? 'is-active' : ''}`}
                    onClick={() => onChange(opt.key)}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}