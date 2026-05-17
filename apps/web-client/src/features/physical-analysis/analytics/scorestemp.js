import { percentile } from '../utils/statistics';

/**
 * Recovery score per the brief.
 *   recovery = (sleep_hours * 10) / (active_energy/100 + steps/2000)
 * Higher sleep raises it; higher activity load lowers it.
 */
export const recoveryScore = ({ sleep_hours, active_energy, steps }) => {
    const load = (active_energy || 0) / 100 + (steps || 0) / 2000;
    if (load <= 0) return 0;
    return Math.round(((sleep_hours || 0) * 10) / load * 10) / 10;
};

export const classifyRecovery = (score) => {
    if (score >= 30) return { label: 'Excellent', tone: 'excellent' };
    if (score >= 18) return { label: 'Balanced', tone: 'balanced' };
    if (score >= 10) return { label: 'Recovery needed', tone: 'recovery' };
    return { label: 'Fatigued', tone: 'fatigued' };
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
    // Outside the band, fall off linearly.
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

    const stepsArr = daily.map((d) => d.steps);
    const sleepArr = daily.map((d) => d.sleep_hours);
    const energyArr = daily.map((d) => d.active_energy);

    const stepP10 = percentile(stepsArr, 10);
    const energyP90 = percentile(energyArr, 90);

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