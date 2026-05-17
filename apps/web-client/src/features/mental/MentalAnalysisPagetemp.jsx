import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Spinner from '../../components/common/Spinner';
import DassQuiz from '../quiz/DassQuiz';
import QuizResults from '../quiz/QuizResults';
import WellnessGauge from './components/WellnessGauge';
import RecoveryRadar from './components/RecoveryRadar';
import BurnoutTimeline from './components/BurnoutTimeline';
import BehavioralHeatmap from './components/BehavioralHeatmap';
import AIInsights from './components/AIInsights';
import MoodForecast from './components/MoodForecast';

import './components/ai.css';
import './MentalAnalysisPage.css';
import { API_BASE_URL } from '../../config/api';

/**
 * State machine for the Mental tab:
 *   loading      → fetching latest assessment from the server
 *   no-quiz      → data available, no prior assessment → show prompt
 *   disclaimer   → user clicked "Take the quiz" → show disclaimer
 *   quiz         → quiz in progress
 *   submitting   → POSTing to backend
 *   results      → showing assessment scores
 *   error        → network/server error
 */
export default function MentalAnalysisPage() {
    const [phase, setPhase] = useState('loading');
    const [assessment, setAssessment] = useState(null);
    const [error, setError] = useState('');
    const [aiData, setAiData] = useState(null);
    const [aiLoading, setAiLoading] = useState(true);
    const [aiError, setAiError] = useState(null);

    // Fetch latest assessment on mount
    useEffect(() => {
        let cancelled = false;
        const fetch = async () => {
            try {
                const token = localStorage.getItem('moodlens.token');
                const res = await axios.get(`${API_BASE_URL}/api/assessments/latest`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (cancelled) return;
                if (res.data.assessment) {
                    setAssessment(res.data.assessment);
                    setPhase('results');
                } else {
                    setPhase('no-quiz');
                }
            } catch {
                if (!cancelled) setPhase('no-quiz');
            }
        };
        fetch();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const fetchAI = async () => {
            try {
                const token = localStorage.getItem('moodlens.token');
                const res = await axios.get(`${API_BASE_URL}/api/ai/mental-wellness`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // If the backend returned an error object (NO_ASSESSMENT, NO_HEALTH_DATA, etc.)
                if (res.data?.error) {
                    setAiError(res.data);
                    setAiData(null);          //  ← important: keep aiData null
                } else {
                    setAiData(res.data);
                    setAiError(null);
                }
            } catch (err) {
                console.error('❌ [AI] Fetch failed:', err);
                setAiError({ message: 'Could not load AI analysis' });
                setAiData(null);
            } finally {
                setAiLoading(false);
            }
        };

        fetchAI();
    }, []);

    const handleQuizComplete = useCallback(async (responses) => {
        setPhase('submitting');
        setError('');
        try {
            const token = localStorage.getItem('moodlens.token');
            const res = await axios.post(
                `${API_BASE_URL}/api/assessments`,
                { responses },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            setAssessment(res.data.assessment);
            setPhase('results');
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Submission failed.');
            setPhase('quiz'); // let the user try again
        }
    }, []);

    const startOver = () => {
        setAssessment(null);
        setPhase('disclaimer');
    };

    // ── Render by phase ──────────────────────────────────

    if (phase === 'loading') {
        return (
            <div className="mental-center">
                <Spinner size="lg" label="Checking your records…" />
            </div>
        );
    }

    if (phase === 'no-quiz') {
        return (
            <div className="mental-center">
                <div className="mental-prompt">
                    <span className="mental-prompt__glyph" aria-hidden="true">◉</span>
                    <p className="mental-prompt__eyebrow">Mental analysis</p>
                    <h2 className="mental-prompt__title">
                        Understand your<br />
                        <span className="mental-prompt__title-em">mental landscape.</span>
                    </h2>
                    <p className="mental-prompt__body">
                        The DASS-21 is a clinically validated 21-question check-in that
                        measures depression, anxiety, and stress. It takes about 3 minutes.
                        Your scores are stored alongside your health data and will power
                        the full mental analysis view.
                    </p>
                    <button className="mental-prompt__btn" onClick={() => setPhase('disclaimer')}>
                        Take the quiz
                        <span aria-hidden="true">→</span>
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'disclaimer') {
        return (
            <div className="mental-center">
                <div className="mental-disclaimer">
                    <p className="mental-disclaimer__eyebrow">Before you begin</p>
                    <h2 className="mental-disclaimer__title">A quick note</h2>
                    <p className="mental-disclaimer__body">
                        The DASS-21 is a self-report scale intended for informational
                        and research purposes. It is <strong>not a clinical diagnosis</strong>.
                        Answer each question based on how you felt over the <strong>past week</strong>.
                        There are no right or wrong answers.
                    </p>
                    <p className="mental-disclaimer__body">
                        If you are currently in distress or experiencing a mental health
                        crisis, please reach out to a qualified professional or emergency
                        services rather than taking this quiz.
                    </p>
                    <div className="mental-disclaimer__actions">
                        <button className="mental-disclaimer__cancel" onClick={() => setPhase('no-quiz')}>
                            Cancel
                        </button>
                        <button className="mental-disclaimer__start" onClick={() => setPhase('quiz')}>
                            I understand, let's begin
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'quiz') {
        return (
            <>
                {error && (
                    <div className="mental-error-bar" role="alert">
                        <span /> {error}
                    </div>
                )}
                <DassQuiz
                    onComplete={handleQuizComplete}
                    onCancel={() => setPhase('no-quiz')}
                />
            </>
        );
    }

    if (phase === 'submitting') {
        return (
            <div className="mental-center">
                <Spinner size="lg" label="Storing your results…" />
            </div>
        );
    }

    if (phase === 'results' && assessment) {
        return (
            <>
                <QuizResults
                    assessment={assessment}
                    onRetake={startOver}
                />

                {/* ── AI Wellness Analysis ────────────────── */}
                {aiLoading ? (
                    <div className="ai-empty">
                        <p className="ai-empty__text">Analyzing your wellness data...</p>
                    </div>
                ) : aiError ? (
                    <div className="ai-empty">
                        <h3 className="ai-empty__title">Analysis unavailable</h3>
                        <p className="ai-empty__text">{aiError.message}</p>
                    </div>
                ) : aiData ? (
                    <>
                        {/* Existing AI section (wellness + recovery + insights) */}
                        <section className="ai-section">
                            <div className="ai-card">
                                <div className="ai-card__header">
                                    <div>
                                        <p className="ai-card__eyebrow">Mental Wellness</p>
                                        <h3 className="ai-card__title">Overall Score</h3>
                                    </div>
                                    <span className="ai-card__badge">AI</span>
                                </div>
                                <WellnessGauge wellness={aiData.wellness} />
                            </div>

                            <div className="ai-card ai-card--mental">
                                <div className="ai-card__header">
                                    <div>
                                        <p className="ai-card__eyebrow">Recovery</p>
                                        <h3 className="ai-card__title">5-Axis Analysis</h3>
                                    </div>
                                    <span className="ai-card__badge">AI</span>
                                </div>
                                <RecoveryRadar recovery={aiData.recovery} />
                            </div>

                            <AIInsights
                                insights={aiData.insights}
                                metadata={aiData.metadata}
                                anomaly={aiData.anomaly}
                                cluster={aiData.cluster}
                            />
                        </section>

                        {/* Burnout timeline */}
                        {aiData.burnoutTimeline?.length > 0 && (
                            <section className="ai-section">
                                <div className="ai-card ai-card--full ai-card--burnout">
                                    <div className="ai-card__header">
                                        <div>
                                            <p className="ai-card__eyebrow">Burnout Detection</p>
                                            <h3 className="ai-card__title">Emotional Exhaustion Timeline</h3>
                                        </div>
                                        <span className="ai-card__badge">AI</span>
                                    </div>
                                    <BurnoutTimeline timeline={aiData.burnoutTimeline} />
                                </div>
                            </section>
                        )}

                        {/* Behavioral heatmap */}
                        {aiData.heatmap?.weeks?.length > 0 && (
                            <section className="ai-section">
                                <div className="ai-card ai-card--full ai-card--heatmap">
                                    <div className="ai-card__header">
                                        <div>
                                            <p className="ai-card__eyebrow">Behavioral Patterns</p>
                                            <h3 className="ai-card__title">Weekly Heatmap</h3>
                                        </div>
                                        <span className="ai-card__badge">AI</span>
                                    </div>
                                    <BehavioralHeatmap heatmap={aiData.heatmap} />
                                </div>
                            </section>
                        )}

                        {/* Mood forecast */}
                        {aiData.moodForecast && (
                            <section className="ai-section">
                                <div className="ai-card ai-card--full ai-card--forecast">
                                    <div className="ai-card__header">
                                        <div>
                                            <p className="ai-card__eyebrow">Mood Forecast</p>
                                            <h3 className="ai-card__title">Next 7 Days</h3>
                                        </div>
                                        <span className="ai-card__badge">AI</span>
                                    </div>
                                    <MoodForecast moodForecast={aiData.moodForecast} />
                                </div>
                            </section>
                        )}
                    </>
                ) : null}
            </>
        );
    }

    return null;
}