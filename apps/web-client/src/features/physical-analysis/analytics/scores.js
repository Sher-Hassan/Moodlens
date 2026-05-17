import { percentile } from '../utils/statistics';

/**
 * Recovery Score (0–100)
 * =======================
 * Rewards adequate sleep relative to activity load, on a clean 0-100 scale.
 *
 * Composition (max points shown):
 *   Sleep component         max 60   — optimal 7-9h, penalty for deviation
 *   Activity-fit component  max 40   — moderate activity in healthy range
 *
 * Typical day (7.5h sleep, 7500 steps, 400 kcal) → ≈ 92 ("Excellent")
 * Bad day    (4h sleep,   2000 steps, 150 kcal) → ≈ 25 ("Fatigued")
 */
export const recoveryScore = ({ sleep_hours, active_energy, steps }) => {
    const sleep   = sleep_hours || 0;
    const energy  = active_energy || 0;
    const stepCnt = steps || 0;

    // Need at least some data to score
    if (sleep === 0 && energy === 0 && stepCnt === 0) return null;

    // ── Sleep component (max 60) ──────────────────────────────
    // Optimal 7-9h. Linear decay outside.
    let sleepScore;
    if (sleep >= 7 && sleep <= 9)      sleepScore = 60;
    else if (sleep >= 6 && sleep <= 10) sleepScore = 60 - Math.abs(sleep - 8) * 8;
    else if (sleep >= 4 && sleep <= 11) sleepScore = 30 - Math.abs(sleep - 8) * 4;
    else                                sleepScore = Math.max(0, 20 - Math.abs(sleep - 8) * 3);

    // ── Activity-fit component (max 40) ───────────────────────
    // Rewards moderate steps (6k-12k) and moderate energy (300-700 kcal).
    // Penalizes both extremes (very inactive OR overtrained).
    let stepScore;
    if (stepCnt >= 6000  && stepCnt <= 12000) stepScore = 25;
    else if (stepCnt >= 4000  && stepCnt <= 15000) stepScore = 18;
    else if (stepCnt >= 2000  && stepCnt <= 20000) stepScore = 10;
    else if (stepCnt > 0)                          stepScore = 5;
    else                                           stepScore = 0;

    let energyScore;
    if (energy >= 300 && energy <= 700)   energyScore = 15;
    else if (energy >= 200 && energy <= 900) energyScore = 10;
    else if (energy >= 100 && energy <= 1200) energyScore = 5;
    else if (energy > 0)                     energyScore = 2;
    else                                     energyScore = 0;

    const total = sleepScore + stepScore + energyScore;
    return Math.round(Math.max(0, Math.min(100, total)));
};

/** Maps a 0-100 recovery score to a category + tone. */
export const classifyRecovery = (score) => {
    if (score == null)  return { label: 'No data', tone: 'fatigued' };
    if (score >= 80)    return { label: 'Excellent', tone: 'excellent' };
    if (score >= 60)    return { label: 'Balanced', tone: 'balanced' };
    if (score >= 40)    return { label: 'Recovery needed', tone: 'recovery' };
    return                       { label: 'Fatigued', tone: 'fatigued' };
};

/**
 * Composite Physical Balance Score (0–100).
 * Each metric is scored against a target band, then averaged.
 */
const bandScore = (value, low, ideal, high) => {
    if (value <= 0) return 0;
    if (value >= low && value <= high) {
        const center = ideal;
        const dist = Math.abs(value - center);
        const half = Math.max(center - low, high - center);
        return Math.round(100 * (1 - dist / half));
    }
    if (value < low) return Math.max(0, Math.round((value / low) * 60));
    return Math.max(0, Math.round(60 - ((value - high) / high) * 60));
};

export const balanceScore = ({ steps, sleep_hours, active_energy }) => {
    const stepScore = bandScore(steps, 4000, 9000, 16000);
    const sleepScore = bandScore(sleep_hours, 6, 7.75, 9.5);
    const energyScore = bandScore(active_energy, 200, 500, 900);
    const composite = Math.round((stepScore + sleepScore + energyScore) / 3);
    return { composite, stepScore, sleepScore, energyScore };
};

export const classifyBalance = (score) => {
    if (score >= 80) return { label: 'Excellent', tone: 'excellent' };
    if (score >= 65) return { label: 'Good', tone: 'good' };
    if (score >= 45) return { label: 'Moderate', tone: 'moderate' };
    return { label: 'Needs attention', tone: 'fatigued' };
};

/**
 * Anomaly detector. Flags rows that fall outside healthy thresholds OR
 * sit more than 2 standard deviations from the user's own mean.
 */
export const detectAnomalies = (daily) => {
    if (!daily.length) return [];
    const flags = [];

    const stepsArr = daily.map((d) => d.steps).filter((v) => v > 0);
    const energyArr = daily.map((d) => d.active_energy).filter((v) => v > 0);

    const stepP10 = stepsArr.length ? percentile(stepsArr, 10) : 0;
    const energyP90 = energyArr.length ? percentile(energyArr, 90) : 0;

    daily.forEach((d) => {
        if (d.sleep_hours > 0 && d.sleep_hours < 5) {
            flags.push({ date: d.date, kind: 'low_sleep',
                msg: `Only ${d.sleep_hours.toFixed(1)}h of sleep` });
        }
        if (d.steps > 0 && d.steps < Math.max(2000, stepP10)) {
            flags.push({ date: d.date, kind: 'inactive',
                msg: `Sedentary day — ${Math.round(d.steps)} steps` });
        }
        if (d.active_energy > energyP90 * 1.2 && d.active_energy > 700) {
            flags.push({ date: d.date, kind: 'high_energy',
                msg: `Heavy burn — ${Math.round(d.active_energy)} kcal` });
        }
    });

    return flags;
};
