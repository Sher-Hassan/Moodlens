import './FloatingImportButton.css';

export default function FloatingImportButton({ onClick }) {
    return (
        <button className="float-import" onClick={onClick}>
            <span className="float-import__icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                        d="M7 2v8M3 6l4-4 4 4M2 12h10"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </span>
            <span>Import updated data</span>
        </button>
    );
}