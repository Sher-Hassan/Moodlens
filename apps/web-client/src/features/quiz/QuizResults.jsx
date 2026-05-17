import { useMemo } from 'react';
import { computeFromResponses, MAXIMA, SEVERITY_COLORS, SEVERITY_MESSAGES } from './scoring';
import './QuizResults.css';

const DIMENSIONS = [
    {
        key:   'depression',
        label: 'Depression',
        icon:  '◉',
        color: '#60A5FA',
        desc:  'Reflects low mood, loss of motivation, and hopelessness.',
    },
    {
        key:   'anxiety',
        label: 'Anxiety',
        icon:  '◈',
        color: '#F5C842',
        desc:  'Reflects anxious arousal, including physical tension and fear.',
    },
    {
        key:   'stress',
        label: 'Stress',
        icon:  '◇',
        color: '#FB923C',
        desc:  'Reflects persistent arousal and difficulty relaxing.',
    },
];

const takenAt = (iso) =>
    new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric', month: 'long', year: 'numeric',
    });

export default function QuizResults({ assessment, onRetake }) {
    const scores = useMemo(() => {
        // Backend already computed scores; use them directly.
        // Fall back to client-side compute if needed.
        if (assessment.scores) return assessment.scores;
        return computeFromResponses(assessment.responses);
    }, [assessment]);

    const takenDate = assessment.createdAt
        ? takenAt(assessment.createdAt)
        : assessment.updatedAt
        ? takenAt(assessment.updatedAt)
        : 'Recently';

    return (
        <div className="qr-page">

            <header className="qr-hero">
                <p className="qr-hero__eyebrow">Assessment complete</p>
                <h1 className="qr-hero__title">
                    Your <span className="qr-hero__title-em">results</span>
                </h1>
                <p className="qr-hero__date">Taken {takenDate}</p>
            </header>

            {/* ── Three score cards ── */}
            <div className="qr-cards">
                {DIMENSIONS.map((dim) => {
                    const s     = scores[dim.key];
                    const pct   = (s.scaled / MAXIMA[dim.key]) * 100;
                    const color = SEVERITY_COLORS[s.tone ?? s.severity?.toLowerCase().replace(' ', '_')] ?? dim.color;
                    const msg   = SEVERITY_MESSAGES[s.tone ?? s.severity?.toLowerCase().replace(' ', '_')];

                    return (
                        <div
                            key={dim.key}
                            className="qr-card"
                            style={{
                                '--dim-color':  color,
                                '--dim-pct':    `${pct}%`,
                                '--dim-soft':   `${color}18`,
                            }}
                        >
                            <div className="qr-card__top">
                                <span className="qr-card__icon" aria-hidden="true">{dim.icon}</span>
                                <p className="qr-card__label">{dim.label}</p>
                            </div>

                            <div className="qr-card__score">
                                <span className="qr-card__num">{s.scaled}</span>
                                <span className="qr-card__max">/ {MAXIMA[dim.key]}</span>
                            </div>

                            {/* Severity badge */}
                            <div className="qr-card__badge" style={{ color, borderColor: color, background: 'var(--dim-soft)' }}>
                                {s.severity ?? s.label}
                            </div>

                            {/* Score bar */}
                            <div className="qr-card__bar">
                                <div className="qr-card__bar-fill" />
                            </div>

                            <p className="qr-card__desc">{dim.desc}</p>

                            {/* Interpretive message */}
                            <p className="qr-card__msg">{msg}</p>
                        </div>
                    );
                })}
            </div>

            {/* ── Disclaimer + retake ── */}
            <div className="qr-footer">

                <div className="qr-stored">
                    <span className="qr-stored__dot" aria-hidden="true" />
                    Results stored — they'll power your mental analysis when ready.
                </div>

                <button className="qr-retake" onClick={onRetake}>
                    Retake the quiz
                </button>
            </div>

        </div>
    );
}