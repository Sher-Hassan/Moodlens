import { useState, useRef, useEffect } from 'react';
import './InfoTooltip.css';

/**
 * Small ⓘ icon next to chart titles. Hover/focus reveals a popover
 * explaining what the chart shows, how to read it, and why it matters.
 *
 * Props:
 *   - what:  "What this is" (1 sentence)
 *   - how:   "How to read it" (1-2 sentences)
 *   - why:   optional — "Why it matters"
 */
export default function InfoTooltip({ what, how, why }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <span
            className="info-tooltip"
            ref={wrapRef}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <button
                type="button"
                className="info-tooltip__trigger"
                aria-label="What is this chart?"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
            >
                i
            </button>
            {open && (
                <div className="info-tooltip__panel" role="tooltip">
                    {what && (
                        <p className="info-tooltip__row">
                            <span className="info-tooltip__eyebrow">WHAT</span>
                            <span className="info-tooltip__body">{what}</span>
                        </p>
                    )}
                    {how && (
                        <p className="info-tooltip__row">
                            <span className="info-tooltip__eyebrow">HOW TO READ</span>
                            <span className="info-tooltip__body">{how}</span>
                        </p>
                    )}
                    {why && (
                        <p className="info-tooltip__row">
                            <span className="info-tooltip__eyebrow">WHY</span>
                            <span className="info-tooltip__body">{why}</span>
                        </p>
                    )}
                </div>
            )}
        </span>
    );
}
