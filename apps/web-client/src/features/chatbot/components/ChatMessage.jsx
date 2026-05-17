import { useNavigate } from 'react-router-dom';

/**
 * Lightweight markdown-ish renderer.
 * Supports: **bold**, *italic*, [link text](url), line breaks.
 * Strips: # headings, list markers.
 * Why not a real markdown lib? Keeps bundle small + we control exactly what renders.
 */
function renderText(text) {
    if (!text) return null;

    // Split on double-newlines for paragraphs
    const paragraphs = text.split(/\n\s*\n/);

    return paragraphs.map((para, pIdx) => {
        // Strip markdown headings/bullets that shouldn't appear
        const cleaned = para
            .replace(/^#+\s*/gm, '')
            .replace(/^\s*[-*]\s+/gm, '• ');

        // Single-newline → <br/>
        const lines = cleaned.split('\n');

        return (
            <p key={pIdx} className="cb-msg__para">
                {lines.map((line, lIdx) => (
                    <span key={lIdx}>
                        {renderInline(line)}
                        {lIdx < lines.length - 1 && <br />}
                    </span>
                ))}
            </p>
        );
    });
}

function renderInline(text) {
    if (!text) return text;
    // Pattern matches **bold**, *italic*, [text](url), in order, non-overlapping
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    const parts = text.split(pattern);

    return parts.map((part, i) => {
        if (!part) return null;

        // Bold
        const boldMatch = part.match(/^\*\*(.+)\*\*$/);
        if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;

        // Italic
        const italicMatch = part.match(/^\*(.+)\*$/);
        if (italicMatch) return <em key={i}>{italicMatch[1]}</em>;

        // Link
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
            return (
                <a
                    key={i}
                    href={linkMatch[2]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cb-msg__link"
                >
                    {linkMatch[1]}
                </a>
            );
        }

        return part;
    });
}

/**
 * Single chat message.
 * @param {object} props
 * @param {object} props.message — { id, role, text, citations?, action?, error? }
 * @param {function} props.onClose — close panel (used after navigate action)
 */
export default function ChatMessage({ message, onClose }) {
    const navigate = useNavigate();

    const isUser = message.role === 'user';
    const isError = !!message.error;

    const handleAction = () => {
        if (!message.action) return;
        if (message.action.type === 'navigate') {
            navigate(message.action.target);
            onClose?.();
        }
    };

    const actionLabel = (action) => {
        if (!action) return null;
        if (action.meta === 'open_quiz') return 'Open quiz';
        const target = action.target || '';
        if (target.includes('import'))   return 'Take me to import';
        if (target.includes('mental'))   return 'Open Mental tab';
        if (target.includes('physical')) return 'Open Physical tab';
        if (target.includes('meditate')) return 'Open Meditate';
        if (target.includes('settings')) return 'Open Settings';
        return 'Take me there';
    };

    return (
        <div className={`cb-msg ${isUser ? 'cb-msg--user' : 'cb-msg--coach'} ${isError ? 'cb-msg--error' : ''}`}>
            {!isUser && (
                <div className="cb-msg__avatar" aria-hidden="true">
                    <span className="cb-msg__avatar-mark">◉</span>
                </div>
            )}

            <div className="cb-msg__bubble">
                <div className="cb-msg__body">
                    {renderText(message.text)}
                </div>

                {/* Citations — only on coach messages */}
                {!isUser && message.citations?.length > 0 && (
                    <div className="cb-msg__citations">
                        <span className="cb-msg__citations-label">Sources</span>
                        <ul className="cb-msg__citations-list">
                            {message.citations.map((c, i) => (
                                <li key={i} className="cb-msg__citation">
                                    <a
                                        href={c.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="cb-msg__citation-link"
                                    >
                                        {c.title} <span className="cb-msg__citation-source">· {c.source}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Action button */}
                {!isUser && message.action && (
                    <button
                        type="button"
                        className="cb-msg__action"
                        onClick={handleAction}
                    >
                        {actionLabel(message.action)}
                        <span aria-hidden="true">→</span>
                    </button>
                )}
            </div>
        </div>
    );
}
