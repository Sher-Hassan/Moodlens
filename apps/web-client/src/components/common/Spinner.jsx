import './Spinner.css';

export default function Spinner({ size = 'md', label }) {
    return (
        <div className={`ml-spinner ml-spinner--${size}`} role="status" aria-live="polite">
            <span className="ml-spinner__ring" aria-hidden="true" />
            {label && <span className="ml-spinner__label">{label}</span>}
            <span className="ml-spinner__sr">{label || 'Loading'}</span>
        </div>
    );
}