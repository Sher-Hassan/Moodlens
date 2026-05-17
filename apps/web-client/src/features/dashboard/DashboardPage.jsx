import { useMemo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import useDailyHealthData from '../physical-analysis/hooks/useDailyHealthData';
import DateRangeFilter from '../physical-analysis/components/DateRangeFilter';
import Spinner from '../../components/common/Spinner';
import StepsChart from './charts/StepsChart';
import SleepChart from './charts/SleepChart';
import EnergyChart from './charts/EnergyChart';
import { mean } from '../physical-analysis/utils/statistics';
import { balanceScore, classifyBalance } from '../physical-analysis/analytics/scores';
import axios from 'axios';
import './DashboardPage.css';

import { API_BASE_URL } from '../../config/api';

/* ─────────────────────────────────────────────────────
   Config
───────────────────────────────────────────────────── */

// Physical status colors
const PHYSICAL_TONE = {
    excellent: { word: 'Energized', color: '#34D399', bg: 'rgba(52,211,153,0.07)', border: 'rgba(52,211,153,0.28)' },
    good:      { word: 'Balanced',  color: '#0BEFC4', bg: 'rgba(11,239,196,0.07)', border: 'rgba(11,239,196,0.28)' },
    moderate:  { word: 'Steady',    color: '#F5C842', bg: 'rgba(245,200,66,0.07)', border: 'rgba(245,200,66,0.28)' },
    fatigued:  { word: 'Depleted',  color: '#FB923C', bg: 'rgba(251,146,60,0.07)', border: 'rgba(251,146,60,0.28)' },
};

// Mental status colors (based on DASS-21 severity)
const MENTAL_TONE = {
    excellent: { word: 'Balanced',   color: '#34D399', bg: 'rgba(52,211,153,0.07)', border: 'rgba(52,211,153,0.28)' },
    good:      { word: 'Steady',     color: '#0BEFC4', bg: 'rgba(11,239,196,0.07)', border: 'rgba(11,239,196,0.28)' },
    moderate:  { word: 'Strained',   color: '#F5C842', bg: 'rgba(245,200,66,0.07)', border: 'rgba(245,200,66,0.28)' },
    strained:  { word: 'Struggling', color: '#FB923C', bg: 'rgba(251,146,60,0.07)', border: 'rgba(251,146,60,0.28)' },
    critical:  { word: 'Critical',   color: '#F87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.28)' },
};

/* ─────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────── */

const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

const fmtDate = () =>
    new Date().toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
    });

const fmtSteps = (n) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(Math.round(n));

const buildPhysicalDesc = (avgSteps, avgSleep, avgEnergy, tone) => {
    const sleepNote =
        avgSleep >= 7 && avgSleep <= 9
            ? `Sleep at ${avgSleep.toFixed(1)}h is solid`
            : avgSleep < 7
            ? `Sleep at ${avgSleep.toFixed(1)}h is below the 7h mark`
            : `Sleep at ${avgSleep.toFixed(1)}h is on the longer side`;

    const stepsNote =
        avgSteps >= 8000
            ? 'step count is strong'
            : avgSteps >= 5000
            ? 'steps have room to grow'
            : 'movement has been low this week';

    const closings = {
        excellent: 'Your body is running well right now.',
        good:      'A small push would make this an excellent week.',
        moderate:  'Small, consistent improvements compound quickly.',
        fatigued:  'Rest and recovery should be the priority tonight.',
    };

    return `${sleepNote}, and ${stepsNote}. ${closings[tone] ?? ''}`;
};

/**
 * Compute mental status from DASS-21 assessment.
 * Uses the "worst dimension" approach - you're only as stable as your most affected area.
 */
const computeMentalStatus = (assessment) => {
    if (!assessment?.scores) return null;

    const { depression, anxiety, stress } = assessment.scores;
    const severities = [
        { dim: 'Depression', ...depression },
        { dim: 'Anxiety', ...anxiety },
        { dim: 'Stress', ...stress },
    ];

    // Find the highest severity level
    const severityRank = { 'Normal': 0, 'Mild': 1, 'Moderate': 2, 'Severe': 3, 'Extremely Severe': 4 };
    const worst = severities.reduce((max, curr) => 
        severityRank[curr.severity] > severityRank[max.severity] ? curr : max
    );

    // Map to tone
    let toneKey;
    if (worst.severity === 'Normal') toneKey = 'excellent';
    else if (worst.severity === 'Mild') toneKey = 'good';
    else if (worst.severity === 'Moderate') toneKey = 'moderate';
    else if (worst.severity === 'Severe') toneKey = 'strained';
    else toneKey = 'critical';

    const tone = MENTAL_TONE[toneKey];

    // Build description
    const dimensions = severities
        .filter(s => s.severity !== 'Normal')
        .map(s => `${s.dim.toLowerCase()} (${s.severity.toLowerCase()})`)
        .join(', ');

    let description;
    if (dimensions) {
        description = `Assessment shows ${dimensions}. ${
            toneKey === 'critical' || toneKey === 'strained'
                ? 'Consider reaching out to a mental health professional.'
                : toneKey === 'moderate'
                ? 'Keep an eye on these patterns over the coming weeks.'
                : 'Mild symptoms noted — worth monitoring.'
        }`;
    } else {
        description = 'All three dimensions (depression, anxiety, stress) are in the healthy range.';
    }

    return {
        tone,
        toneKey,
        description,
        scores: severities,
        takenAt: assessment.createdAt || assessment.updatedAt,
    };
};

const buildOverallLine = (physWord, mentalWord, avgSteps, avgSleep) => {
    if (!mentalWord) {
        // Mental data not available yet
        if (physWord === 'Energized' || physWord === 'Balanced')
            return `Physically you're ${physWord.toLowerCase()} — ${fmtSteps(avgSteps)} steps and ${avgSleep.toFixed(1)}h of sleep form a healthy foundation this week.`;
        return `Your physical signals are pointing toward rest. Lean into recovery and the numbers will follow.`;
    }

    // Both physical and mental available
    const physGood = physWord === 'Energized' || physWord === 'Balanced';
    const mentalGood = mentalWord === 'Balanced' || mentalWord === 'Steady';

    if (physGood && mentalGood) {
        return `Both body and mind are in good rhythm this week. You're maintaining a solid foundation.`;
    } else if (physGood && !mentalGood) {
        return `Your body is strong, but mental signals suggest some strain. Rest and self-care matter just as much as movement.`;
    } else if (!physGood && mentalGood) {
        return `Mind is stable, but your body is asking for more rest and movement. Small physical wins build momentum.`;
    } else {
        return `Both physical and mental signals suggest you need recovery time. Prioritize rest, gentle movement, and reaching out if needed.`;
    }
};

/* ─────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────── */

export default function DashboardPage() {
    const { user } = useUser();
    const { daily, loading, error, preset, setPreset } = useDailyHealthData('14d');
    const [mentalStatus, setMentalStatus] = useState(null);
    const [mentalLoading, setMentalLoading] = useState(true);

    // Fetch latest mental assessment
    useEffect(() => {
        const fetchAssessment = async () => {
            try {
                const token = localStorage.getItem('moodlens.token');
                const res = await axios.get(`${API_BASE_URL}/api/assessments/latest`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (res.data.assessment) {
                    setMentalStatus(computeMentalStatus(res.data.assessment));
                }
            } catch (err) {
                console.error('Failed to fetch assessment:', err);
            } finally {
                setMentalLoading(false);
            }
        };
        
        if (user) fetchAssessment();
    }, [user]);

    // Compute physical status from recent 7 days
    const physStatus = useMemo(() => {
        if (!daily.length) return null;
        const window = daily.slice(-7);
        const avgSteps  = mean(window.map((d) => d.steps));
        const avgSleep  = mean(window.map((d) => d.sleep_hours));
        const avgEnergy = mean(window.map((d) => d.active_energy));
        const { composite } = balanceScore({ steps: avgSteps, sleep_hours: avgSleep, active_energy: avgEnergy });
        const cls  = classifyBalance(composite);
        const tone = PHYSICAL_TONE[cls.tone] ?? PHYSICAL_TONE.moderate;
        return {
            tone,
            cls,
            avgSteps,
            avgSleep,
            avgEnergy,
            composite,
            description: buildPhysicalDesc(avgSteps, avgSleep, avgEnergy, cls.tone),
            overallLine: buildOverallLine(
                tone.word, 
                mentalStatus?.tone.word, 
                avgSteps, 
                avgSleep
            ),
            windowDays: window.length,
        };
    }, [daily, mentalStatus]);

    if (loading || mentalLoading) {
        return (
            <div className="db-loading">
                <Spinner size="lg" label="Pulling your signal…" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="db-loading">
                <p className="db-err-title">Couldn't load data.</p>
                <p className="db-err-sub">{error}</p>
            </div>
        );
    }

    return (
        <main className="db-page">

            {/* ── Greeting header ── */}
            <header className="db-hero">
                <div>
                    <p className="db-hero__eyebrow">{fmtDate()}</p>
                    <h1 className="db-hero__title">
                        {greeting()},{' '}
                        <span className="db-hero__name">
                            {user?.name?.split(' ')[0] ?? 'there'}
                        </span>
                    </h1>
                </div>
                <DateRangeFilter value={preset} onChange={setPreset} />
            </header>

            {/* ── Status card ── */}
            {physStatus && (
                <section className="db-status">

                    {/* Physical panel */}
                    <div
                        className="db-signal db-signal--physical"
                        style={{
                            '--sig-color':  physStatus.tone.color,
                            '--sig-bg':     physStatus.tone.bg,
                            '--sig-border': physStatus.tone.border,
                        }}
                    >
                        <p className="db-signal__eyebrow">Body signal</p>

                        <p className="db-signal__word" style={{ color: physStatus.tone.color }}>
                            {physStatus.tone.word}
                        </p>

                        <p className="db-signal__desc">{physStatus.description}</p>

                        <div className="db-signal__pills">
                            <span className="db-pill db-pill--steps">
                                <span className="db-pill__dot" />
                                {fmtSteps(physStatus.avgSteps)} steps
                            </span>
                            <span className="db-pill db-pill--sleep">
                                <span className="db-pill__dot" />
                                {physStatus.avgSleep.toFixed(1)}h sleep
                            </span>
                            <span className="db-pill db-pill--energy">
                                <span className="db-pill__dot" />
                                {Math.round(physStatus.avgEnergy)} kcal
                            </span>
                        </div>
                    </div>

                    {/* Mental panel */}
                    <div 
                        className={`db-signal db-signal--mental ${!mentalStatus ? 'db-signal--locked' : ''}`}
                        style={mentalStatus ? {
                            '--sig-color':  mentalStatus.tone.color,
                            '--sig-bg':     mentalStatus.tone.bg,
                            '--sig-border': mentalStatus.tone.border,
                        } : {}}
                    >
                        <p className="db-signal__eyebrow">Mind signal</p>

                        {mentalStatus ? (
                            <>
                                <p className="db-signal__word" style={{ color: mentalStatus.tone.color }}>
                                    {mentalStatus.tone.word}
                                </p>

                                <p className="db-signal__desc">{mentalStatus.description}</p>

                                <div className="db-signal__pills">
                                    {mentalStatus.scores.map((s) => (
                                        <span key={s.dim} className="db-pill db-pill--mental">
                                            <span className="db-pill__dot" />
                                            {s.dim}: {s.severity}
                                        </span>
                                    ))}
                                </div>

                                <Link to="/mental" className="db-signal__cta db-signal__cta--retake">
                                    Retake quiz
                                </Link>
                            </>
                        ) : (
                            <>
                                <p className="db-signal__word db-signal__word--locked">—</p>

                                <p className="db-signal__desc db-signal__desc--locked">
                                    Complete the 20-question check-in in the Mental tab to see your full picture.
                                </p>

                                <Link to="/mental" className="db-signal__cta">
                                    Take the quiz →
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Full-width synthesis line */}
                    <div className="db-status__overall">
                        <span className="db-status__overall-mark" aria-hidden="true">↳</span>
                        {physStatus.overallLine}
                    </div>

                </section>
            )}

            {/* ── Charts ── */}
            {!daily.length ? (
                <div className="db-empty-charts">
                    <p>No data in this range — try a wider window.</p>
                </div>
            ) : (
                <section className="db-charts">
                    <StepsChart  daily={daily} />
                    <SleepChart  daily={daily} />
                    <EnergyChart daily={daily} />
                </section>
            )}

        </main>
    );
}