import { useEffect, useRef, useState } from 'react';

const MAX_LENGTH = 1000;

export default function ChatInput({ onSend, disabled, placeholder = "Ask your AI coach…" }) {
    const [value, setValue] = useState('');
    const textareaRef = useRef(null);

    // Auto-resize textarea up to 5 lines
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, [value]);

    const submit = () => {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setValue('');
    };

    const handleKeyDown = (e) => {
        // Enter sends, Shift+Enter inserts newline
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    };

    const handleChange = (e) => {
        const next = e.target.value;
        if (next.length <= MAX_LENGTH) setValue(next);
    };

    const canSend = value.trim().length > 0 && !disabled;
    const showCounter = value.length > MAX_LENGTH * 0.8;

    return (
        <div className="cb-input">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                disabled={disabled}
                className="cb-input__field"
                aria-label="Type your message"
            />
            <button
                type="button"
                className={`cb-input__send ${canSend ? 'cb-input__send--ready' : ''}`}
                onClick={submit}
                disabled={!canSend}
                aria-label="Send message"
            >
                <span aria-hidden="true">↑</span>
            </button>
            {showCounter && (
                <span className={`cb-input__counter ${value.length >= MAX_LENGTH ? 'cb-input__counter--max' : ''}`}>
                    {value.length} / {MAX_LENGTH}
                </span>
            )}
        </div>
    );
}
