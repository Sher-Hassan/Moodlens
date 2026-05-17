import { useMemo } from 'react';
import Spinner from '../../components/common/Spinner';
import DateRangeFilter from './components/DateRangeFilter';
import useDailyHealthData from './hooks/useDailyHealthData';

import DailyActivityTrend from './charts/DailyActivityTrend';
import RecoveryScoreChart from './charts/RecoveryScoreChart';
import PhysicalBalanceDashboard from './charts/PhysicalBalanceDashboard';
import ConsistencyHeatmap from './charts/ConsistencyHeatmap';
import SleepStepsCorrelation from './charts/SleepStepsCorrelation';
import SleepEnergyCorrelation from './charts/SleepEnergyCorrelation';
import DistributionAnalysis from './charts/DistributionAnalysis';
import PairwiseMatrix from './charts/PairwiseMatrix';
import WeekdayWeekendComparison from './charts/WeekdayWeekendComparison';
import OutlierDetection from './charts/OutlierDetection';
import AnalysisGuide from './components/AnalysisGuide';

import { balanceScore, classifyBalance } from './analytics/scores';
import { mean } from './utils/statistics';

import './PhysicalAnalysisPage.css';

export default function PhysicalAnalysisPage() {
    const { daily, loading, error, preset, setPreset } = useDailyHealthData('30d');

    // Top-of-page summary stats
    const summary = useMemo(() => {
        if (!daily.length) return null;
        const latest = daily[daily.length - 1];
        const composite = balanceScore(latest).composite;
        const cls = classifyBalance(composite);
        return {
            avgSteps: Math.round(mean(daily.map((d) => d.steps))),
            avgSleep: mean(daily.map((d) => d.sleep_hours)),
            avgEnergy: Math.round(mean(daily.map((d) => d.active_energy))),
            days: daily.length,
            composite,
            classification: cls,
        };
    }, [daily]);

    if (loading) {
        return (
            <div className="pa-loading">
                <Spinner size="lg" label="Reading your signal…" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="pa-error">
                <p className="pa-error__title">Couldn't load your data.</p>
                <p className="pa-error__sub">{error}</p>
            </div>
        );
    }

    return (
        <main className="pa-page">
            {/* ─ Hero / header ─ Always stays mounted now */}
            <header className="pa-hero">
                <div>
                    <p className="pa-hero__eyebrow">Physical analysis</p>
                    <h1 className="pa-hero__title">
                        Your body, <span className="pa-hero__title-em">read aloud</span>
                    </h1>
                    <p className="pa-hero__sub">
                        Ten interactive views of your sleep, motion, and energy — synthesized into one clear picture.
                    </p>
                </div>
                <DateRangeFilter value={preset} onChange={setPreset} />
            </header>

            <AnalysisGuide />
            
            {/* ─ Conditional Content Block ─ */}
            {!daily.length ? (
                <div className="pa-loading" style={{ minHeight: '35vh', marginTop: 'var(--space-8)' }}>
                    <p className="pa-error__title">No daily data in this window.</p>
                    <p className="pa-error__sub">Try a wider date range.</p>
                </div>
            ) : (
                <>
                    {/* ─ Quick stats strip ─ */}
                    {summary && (
                        <section className="pa-stats">
                            <Stat label="Avg steps" value={summary.avgSteps.toLocaleString()} accent="steps" />
                            <Stat label="Avg sleep" value={`${summary.avgSleep.toFixed(1)}h`} accent="sleep" />
                            <Stat label="Avg energy" value={`${summary.avgEnergy} kcal`} accent="energy" />
                            <Stat label="Days in window" value={summary.days} accent="muted" />
                            <Stat
                                label="Balance"
                                value={`${summary.composite}/100`}
                                sub={summary.classification.label}
                                accent={summary.classification.tone}
                            />
                        </section>
                    )}

                    {/* ─ Chart grid ─ */}
                    <section className="pa-grid">
                        <PhysicalBalanceDashboard daily={daily} />
                        <DailyActivityTrend daily={daily} />
                        <RecoveryScoreChart daily={daily} />
                        <ConsistencyHeatmap daily={daily} />
                        <SleepStepsCorrelation daily={daily} />
                        <SleepEnergyCorrelation daily={daily} />
                        <DistributionAnalysis daily={daily} />
                        <PairwiseMatrix daily={daily} />
                        <WeekdayWeekendComparison daily={daily} />
                        <OutlierDetection daily={daily} />
                    </section>

                    {/* ─ Overall verdict ─ */}
                    {summary && (
                        <section className={`pa-verdict pa-verdict--${summary.classification.tone}`}>
                            <p className="pa-verdict__eyebrow">Overall status</p>
                            <h2 className="pa-verdict__title">{summary.classification.label}</h2>
                            <p className="pa-verdict__sub">{verdictCopy(summary)}</p>
                        </section>
                    )}
                </>
            )}
        </main>
    );
}

function Stat({ label, value, sub, accent }) {
    return (
        <div className={`pa-stat pa-stat--${accent}`}>
            <p className="pa-stat__label">{label}</p>
            <p className="pa-stat__value">{value}</p>
            {sub && <p className="pa-stat__sub">{sub}</p>}
        </div>
    );
}

function verdictCopy({ avgSteps, avgSleep, avgEnergy, classification }) {
    if (classification.tone === 'excellent')
        return `You're averaging ${avgSteps.toLocaleString()} steps and ${avgSleep.toFixed(1)}h of sleep — strong, balanced numbers. Keep the rhythm.`;
    if (classification.tone === 'good')
        return `Solid baseline. A more consistent sleep schedule would unlock more recovery on your active days.`;
    if (classification.tone === 'moderate')
        return `Mixed picture. Your steps and energy don't quite match your sleep — try adding 30 minutes earlier in bed.`;
    return `Your sleep and load are out of sync. Prioritize 7–8h tonight and ease back on intensity for a couple of days.`;
}