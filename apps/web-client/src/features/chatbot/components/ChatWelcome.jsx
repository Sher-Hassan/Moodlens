/**
 * Welcome bubble — shows above the floating button on first visit per session.
 * Tappable suggestions; each kicks off a real chat message.
 */
export default function ChatWelcome({ welcome, onSuggestionClick, onDismiss, onExpand }) {
    if (!welcome) return null;

    return (
        <div className="cb-welcome" role="dialog" aria-label="AI Coach welcome">
            <button
                type="button"
                className="cb-welcome__close"
                onClick={onDismiss}
                aria-label="Dismiss welcome"
            >
                ×
            </button>

            <div className="cb-welcome__head">
                <span className="cb-welcome__avatar" aria-hidden="true">◉</span>
                <span className="cb-welcome__role">AI Coach</span>
            </div>

            <p className="cb-welcome__msg" onClick={onExpand}>
                {welcome.greeting}
            </p>

            <div className="cb-welcome__suggestions">
                {welcome.suggestions?.map((s, i) => (
                    <button
                        key={i}
                        type="button"
                        className="cb-welcome__chip"
                        onClick={() => onSuggestionClick(s.message)}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <div className="cb-welcome__tail" aria-hidden="true" />
        </div>
    );
}
