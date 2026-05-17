/**
 * Wellness Calculator Service — Hybrid (Rule-Based + ML)
 * ========================================================
 *
 * Phase 1 was pure formulas. Phase 2.5 trained real ML models in Python.
 * This module now routes between them:
 *
 *   - New user (<14 days of data) OR ML service down  →  Rule-based formulas
 *   - Established user (>=14 days)                    →  Python ML inference service
 *
 * The PUBLIC API (`analyze()`) returns the SAME response shape in both cases,
 * so the frontend never has to know which path produced the answer.
 */

import axios from 'axios';

const INFERENCE_URL = process.env.INFERENCE_URL || 'http://localhost:8000';
const INFERENCE_TIMEOUT_MS = 5000;
const WARM_START_MIN_DAYS = 14;

class WellnessCalculator {

    /* ──────────────────────────────────────────────
       Main entry point — used by /api/ai/mental-wellness route
    ────────────────────────────────────────────── */

    async analyze(healthData, assessment) {
        if (!assessment) {
            return {
                error: 'NO_ASSESSMENT',
                message: 'Complete the mental wellness quiz to unlock AI insights.',
            };
        }

        if (!healthData || healthData.length === 0) {
            return {
                error: 'NO_HEALTH_DATA',
                message: 'Upload health data to enable wellness analysis.',
            };
        }

        const features = this.engineerFeatures(healthData, assessment);
        if (!features) {
            return {
                error: 'INSUFFICIENT_DATA',
                message: 'Not enough data to compute reliable scores.',
            };
        }

        // ── Decide: warm-start (ML) or cold-start (formulas)? ──
        const usingML = features.days_of_data >= WARM_START_MIN_DAYS;
        let wellness, recovery, insights, anomaly, cluster, modelSource;

        if (usingML) {
            try {
                const mlResult = await this._callInferenceService(healthData, assessment);
                wellness = this._adaptMLWellness(mlResult.wellness);
                anomaly  = mlResult.anomaly?.available ? mlResult.anomaly : null;
                cluster  = mlResult.cluster?.available ? mlResult.cluster : null;
                insights = this._buildMLInsights(mlResult, features);
                modelSource = 'ml-personalized';
            } catch (err) {
                console.warn('🔶 [AI] Inference service unavailable, falling back to rule-based:', err.message);
                wellness = this.computeWellnessRuleBased(features);
                insights = this.generateInsights(features, wellness, null);
                anomaly = null;
                cluster = null;
                modelSource = 'rule-based-fallback';
            }
        } else {
            wellness = this.computeWellnessRuleBased(features);
            insights = this.generateInsights(features, wellness, null);
            anomaly = null;
            cluster = null;
            modelSource = 'rule-based-coldstart';
        }

        // Recovery + timelines + heatmap stay rule-based (they describe data, don't predict)
        recovery = this.computeRecovery(features);
        const burnoutTimeline = this.computeBurnoutTimeline(healthData, assessment);
        const heatmap = this.computeBehavioralHeatmap(healthData, assessment);
        const moodForecast = this.computeMoodForecast(healthData, assessment);

        return {
            wellness,
            recovery,
            insights,
            anomaly,       // NEW: from ML
            cluster,       // NEW: from ML
            burnoutTimeline,
            heatmap,
            moodForecast,
            metadata: {
                daysAnalyzed: features.days_of_data,
                windowDays: features.window_days,
                computedAt: new Date().toISOString(),
                modelSource,
                warmStartActive: usingML,
            },
        };
    }

    /* ──────────────────────────────────────────────
       ML inference service call
    ────────────────────────────────────────────── */

    async _callInferenceService(healthData, assessment) {
        const payload = {
            user_id: assessment.userId?.toString() || 'anonymous',
            dass: {
                depression_scaled: assessment.scores.depression.scaled,
                anxiety_scaled:    assessment.scores.anxiety.scaled,
                stress_scaled:     assessment.scores.stress.scaled,
            },
            daily_data: healthData.map(d => ({
                date:          (d.date instanceof Date ? d.date.toISOString().split('T')[0] : d.date),
                sleep_hours:   d.sleep_hours ?? null,
                steps:         d.steps ?? null,
                active_energy: d.active_energy ?? null,
            })),
        };

        const response = await axios.post(
            `${INFERENCE_URL}/analyze`,
            payload,
            { timeout: INFERENCE_TIMEOUT_MS }
        );

        return response.data;
    }

    /* Adapt the ML wellness response to the existing frontend shape */
    _adaptMLWellness(mlWellness) {
        return {
            score: mlWellness.score,
            category: mlWellness.category,
            color: mlWellness.color,
            description: mlWellness.description,
            // ML adds these fields
            confidence: mlWellness.confidence,
            topDrivers: mlWellness.top_drivers,
        };
    }

    /* Convert SHAP top_drivers into insight cards matching the existing UI */
    _buildMLInsights(mlResult, features) {
        const insights = [];
        const drivers = mlResult.wellness.top_drivers || [];

        for (const driver of drivers.slice(0, 4)) {
            const isPositive = driver.direction === 'positive';
            insights.push({
                type:     isPositive ? 'positive' : 'warning',
                category: 'AI',
                text:     this._formatDriverText(driver, isPositive),
                priority: isPositive ? 3 : 1,
            });
        }

        if (mlResult.anomaly?.available && mlResult.anomaly.is_anomaly) {
            insights.push({
                type:     'warning',
                category: 'Pattern',
                text:     mlResult.anomaly.interpretation,
                priority: 1,
            });
        }

        if (mlResult.cluster?.available) {
            insights.push({
                type:     'suggestion',
                category: 'Profile',
                text:     `Your pattern matches the "${mlResult.cluster.archetype_label}" archetype — recommendations are tuned for your profile.`,
                priority: 2,
            });
        }

        return insights.sort((a, b) => a.priority - b.priority).slice(0, 5);
    }

    _formatDriverText(driver, isPositive) {
        const magnitude = Math.abs(driver.contribution);
        const verb = isPositive ? 'lifting' : 'pulling down';
        const word = magnitude >= 5 ? 'strongly' : magnitude >= 2 ? '' : 'slightly';
        const value = driver.value != null ? ` (${driver.value})` : '';
        return `${driver.display_name}${value} is ${word ? word + ' ' : ''}${verb} your wellness score by ${magnitude.toFixed(1)} points.`;
    }

    /* ──────────────────────────────────────────────
       FALLBACK: Rule-Based Wellness (cold-start)
       (kept from Phase 1 for cold-start users)
    ────────────────────────────────────────────── */

    computeWellnessRuleBased(features) {
        const depression_health = 1 - Math.min(features.depression_score / 28, 1);
        const anxiety_health    = 1 - Math.min(features.anxiety_score / 20, 1);
        const stress_health     = 1 - Math.min(features.stress_score / 34, 1);

        const mental_health = (
            depression_health * 0.35 +
            anxiety_health * 0.30 +
            stress_health * 0.35
        );

        const sleep_score = features.sleep_7d_avg >= 7 && features.sleep_7d_avg <= 9
            ? 1.0
            : Math.max(0, 1 - Math.abs(features.sleep_7d_avg - 8) / 4);
        const activity_score = Math.min(features.steps_7d_avg / 8000, 1);
        const consistency_score = features.sleep_consistency / 100;

        const physical_health = (
            sleep_score * 0.50 + activity_score * 0.30 + consistency_score * 0.20
        );

        const raw_score = (mental_health * 0.60 + physical_health * 0.40) * 100;
        const score = Math.round(Math.max(0, Math.min(100, raw_score)));

        let category, color, description;
        if (score >= 80) {
            category = 'Excellent';  color = '#34D399';
            description = 'Your mental and physical wellbeing are in strong alignment.';
        } else if (score >= 60) {
            category = 'Good';       color = '#0BEFC4';
            description = "You're maintaining solid wellness with room for refinement.";
        } else if (score >= 40) {
            category = 'Moderate Risk'; color = '#F5C842';
            description = 'Some signals suggest your wellbeing needs attention.';
        } else if (score >= 20) {
            category = 'High Risk'; color = '#FB923C';
            description = 'Multiple indicators suggest you may benefit from support.';
        } else {
            category = 'Critical Risk'; color = '#F87171';
            description = 'Please consider reaching out to a mental health professional.';
        }

        return { score, category, color, description, confidence: 'low', topDrivers: null };
    }

    /* ──────────────────────────────────────────────
       Statistical Helpers (kept from Phase 1)
    ────────────────────────────────────────────── */

    linearTrend(values) {
        const n = values.length;
        if (n < 2) return 0;
        const sumX  = (n * (n - 1)) / 2;
        const sumY  = values.reduce((s, v) => s + v, 0);
        const sumXY = values.reduce((s, v, i) => s + v * i, 0);
        const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return isNaN(slope) ? 0 : slope;
    }

    standardDev(values) {
        const n = values.length;
        if (n === 0) return 0;
        const mean = values.reduce((s, v) => s + v, 0) / n;
        const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
        return Math.sqrt(variance);
    }

    /* ──────────────────────────────────────────────
       Feature engineering, recovery, insights, burnout, heatmap, mood forecast
       — All unchanged from Phase 1.
       Copied below verbatim; if you have local changes, keep them.
    ────────────────────────────────────────────── */

    engineerFeatures(healthData, assessment) {
        if (!healthData || healthData.length === 0) return null;

        const sorted = [...healthData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const window = sorted.slice(-7);

        const avg = (arr, key) => arr.reduce((s, x) => s + (x[key] || 0), 0) / Math.max(arr.length, 1);

        const steps_7d_avg  = avg(window, 'steps');
        const sleep_7d_avg  = avg(window, 'sleep_hours');
        const energy_7d_avg = avg(window, 'active_energy');

        const stdDev = (arr, key) => {
            const values = arr.map(d => d[key] || 0);
            const mean = values.reduce((s, v) => s + v, 0) / values.length;
            const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
            return Math.sqrt(variance);
        };

        const sleep_consistency = window.length > 1
            ? Math.max(0, 100 - (stdDev(window, 'sleep_hours') * 30))
            : 50;

        const sleep_debt = window.reduce((s, d) => s + Math.max(0, 8 - (d.sleep_hours || 0)), 0);
        const activity_load = (steps_7d_avg / 10000) + (energy_7d_avg / 500);

        const recentDays = sorted.slice(-3);
        const olderDays  = sorted.slice(-10, -3);
        const sleep_trend = olderDays.length > 0 ? avg(recentDays, 'sleep_hours') - avg(olderDays, 'sleep_hours') : 0;
        const activity_trend = olderDays.length > 0 ? avg(recentDays, 'steps') - avg(olderDays, 'steps') : 0;

        return {
            steps_today: sorted[sorted.length - 1]?.steps || 0,
            sleep_today: sorted[sorted.length - 1]?.sleep_hours || 0,
            energy_today: sorted[sorted.length - 1]?.active_energy || 0,
            steps_7d_avg, sleep_7d_avg, energy_7d_avg,
            sleep_consistency, sleep_debt, activity_load, sleep_trend, activity_trend,
            depression_score: assessment.scores.depression.scaled,
            anxiety_score:    assessment.scores.anxiety.scaled,
            stress_score:     assessment.scores.stress.scaled,
            depression_severity: assessment.scores.depression.severity,
            anxiety_severity:    assessment.scores.anxiety.severity,
            stress_severity:     assessment.scores.stress.severity,
            days_of_data: sorted.length,
            window_days: window.length,
        };
    }

    computeRecovery(features) {
        const sleep = features.sleep_7d_avg >= 7
            ? Math.min(100, (features.sleep_7d_avg / 8) * 100)
            : Math.max(0, (features.sleep_7d_avg / 8) * 100);
        const stress = Math.max(0, 100 - (features.stress_score * 2.5));
        const anxiety = Math.max(0, 100 - (features.anxiety_score * 2.5));
        let activity;
        if (features.steps_7d_avg < 5000) activity = (features.steps_7d_avg / 5000) * 70;
        else if (features.steps_7d_avg > 15000) activity = 70;
        else activity = Math.min(100, 70 + ((features.steps_7d_avg - 5000) / 7000) * 30);
        const emotional_balance = Math.max(0, 100 - (features.depression_score * 2.5));

        const overall = Math.round(
            sleep * 0.30 + stress * 0.20 + anxiety * 0.20 + activity * 0.15 + emotional_balance * 0.15
        );

        let category, color;
        if (overall >= 80)      { category = 'Fully Recovered';  color = '#34D399'; }
        else if (overall >= 60) { category = 'Stable';           color = '#0BEFC4'; }
        else if (overall >= 40) { category = 'Recovery Needed';  color = '#F5C842'; }
        else                    { category = 'Recovery Deficit'; color = '#FB923C'; }

        return {
            score: overall, category, color,
            radar: {
                sleep: Math.round(sleep),
                stress: Math.round(stress),
                anxiety: Math.round(anxiety),
                activity: Math.round(activity),
                emotional_balance: Math.round(emotional_balance),
            },
        };
    }

    /* Used as a fallback when ML is unavailable */
    generateInsights(features, wellness, _recovery) {
        const insights = [];
        if (features.sleep_7d_avg < 6) {
            insights.push({ type: 'warning', category: 'Sleep',
                text: `Your sleep average is only ${features.sleep_7d_avg.toFixed(1)}h. Chronic sleep deprivation directly affects mental wellbeing.`,
                priority: 1 });
        } else if (features.sleep_7d_avg >= 7 && features.sleep_7d_avg <= 9) {
            insights.push({ type: 'positive', category: 'Sleep',
                text: `Your sleep is solid at ${features.sleep_7d_avg.toFixed(1)}h average — this is a strong foundation.`,
                priority: 3 });
        }
        if (features.stress_score > 18 && features.sleep_7d_avg < 7) {
            insights.push({ type: 'warning', category: 'Pattern',
                text: 'High stress combined with reduced sleep is a burnout-risk pattern. Prioritize rest this week.',
                priority: 1 });
        }
        if (features.steps_7d_avg < 4000) {
            insights.push({ type: 'suggestion', category: 'Activity',
                text: `Your movement is low at ${Math.round(features.steps_7d_avg)} steps/day. Aim for short, frequent walks.`,
                priority: 2 });
        } else if (features.steps_7d_avg >= 8000) {
            insights.push({ type: 'positive', category: 'Activity',
                text: `Excellent activity level at ${Math.round(features.steps_7d_avg)} steps/day average.`,
                priority: 3 });
        }
        if (wellness.score >= 80) {
            insights.push({ type: 'positive', category: 'Overall',
                text: 'Your wellness markers are aligned. The habits you have are working.',
                priority: 3 });
        } else if (wellness.score < 40) {
            insights.push({ type: 'warning', category: 'Overall',
                text: 'Multiple wellness indicators are flagged. Consider professional support and prioritize basics: sleep, food, movement.',
                priority: 1 });
        }
        return insights.sort((a, b) => a.priority - b.priority).slice(0, 5);
    }

    // The burnout timeline, heatmap, and mood forecast methods from your existing file
    // stay UNCHANGED. They are descriptive (not predictive) so they don't need ML.
    // If you've already got them in your codebase from earlier phases, keep them as-is.

    computeBurnoutTimeline(healthData, assessment) {
        if (!healthData || healthData.length === 0) return [];
        const sorted = [...healthData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const stressBaseline = assessment.scores.stress.scaled * 0.5;
        const anxietyBaseline = assessment.scores.anxiety.scaled * 0.3;
        const dassContribution = (stressBaseline + anxietyBaseline) * 1.2;

        return sorted.map((day) => {
            const sleepDeficit = Math.max(0, 7 - (day.sleep_hours || 0));
            const sleepPenalty = sleepDeficit * 5;
            const activityLoad = ((day.steps || 0) / 10000) + ((day.active_energy || 0) / 500);
            const activityPenalty = Math.max(0, activityLoad - 1.5) * 15;
            const burnoutScore = Math.max(0, Math.min(100, dassContribution + sleepPenalty + activityPenalty));
            const stressProxy = Math.max(0, Math.min(100, assessment.scores.stress.scaled * 2.4 + sleepDeficit * 6));
            const sleepScore = Math.min(100, ((day.sleep_hours || 0) / 8) * 100);

            let risk;
            if (burnoutScore < 31) risk = 'Healthy';
            else if (burnoutScore < 56) risk = 'Mild Fatigue';
            else if (burnoutScore < 76) risk = 'Burnout Risk';
            else risk = 'Severe Burnout';

            return {
                date: day.date,
                burnout: Math.round(burnoutScore),
                stress: Math.round(stressProxy),
                sleep: Math.round(sleepScore),
                risk,
            };
        });
    }

    computeBehavioralHeatmap(healthData, assessment) {
        if (!healthData || healthData.length === 0) return { weeks: [], days: [], data: {} };
        const sorted = [...healthData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dayMap = {};
        sorted.forEach(d => { dayMap[d.date] = d; });

        const firstDate = new Date(sorted[0].date);
        const lastDate = new Date(sorted[sorted.length - 1].date);
        const firstDayOfWeek = firstDate.getDay();
        const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        const startDate = new Date(firstDate);
        startDate.setDate(startDate.getDate() - daysToMonday);

        const weeks = [], wellnessGrid = [], stressGrid = [], sleepGrid = [], activityGrid = [];
        let currentDate = new Date(startDate);
        let weekIndex = 0;

        while (currentDate <= lastDate) {
            const weekRow = { wellness: [], stress: [], sleep: [], activity: [] };
            for (let d = 0; d < 7; d++) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const dayData = dayMap[dateStr];
                if (dayData) {
                    const sleep = dayData.sleep_hours || 0;
                    const steps = dayData.steps || 0;
                    const sleepScore = sleep >= 7 && sleep <= 9 ? 100 : Math.max(0, 100 - Math.abs(sleep - 8) * 15);
                    const activityScore = Math.min(100, (steps / 10000) * 100);
                    const mentalLoad = (assessment.scores.depression.scaled * 0.35
                                      + assessment.scores.anxiety.scaled * 0.30
                                      + assessment.scores.stress.scaled * 0.35);
                    const mentalScore = Math.max(0, 100 - (mentalLoad / 42) * 100);
                    const wellness = Math.round(mentalScore * 0.5 + sleepScore * 0.3 + activityScore * 0.2);
                    const sleepDeficit = Math.max(0, 7 - sleep);
                    const stress = Math.min(100, Math.round((assessment.scores.stress.scaled / 42) * 100 + sleepDeficit * 5));
                    weekRow.wellness.push(wellness);
                    weekRow.stress.push(stress);
                    weekRow.sleep.push(Math.round(sleepScore));
                    weekRow.activity.push(Math.round(activityScore));
                } else {
                    weekRow.wellness.push(null); weekRow.stress.push(null);
                    weekRow.sleep.push(null); weekRow.activity.push(null);
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            weeks.push(`W${weekIndex + 1}`);
            wellnessGrid.push(weekRow.wellness);
            stressGrid.push(weekRow.stress);
            sleepGrid.push(weekRow.sleep);
            activityGrid.push(weekRow.activity);
            weekIndex++;
            if (weekIndex > 12) break;
        }

        return {
            weeks, days: dayLabels,
            data: { wellness: wellnessGrid, stress: stressGrid, sleep: sleepGrid, activity: activityGrid },
        };
    }

    computeMoodForecast(healthData, assessment) {
        if (!healthData || healthData.length < 3) return null;
        const sorted = [...healthData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const recent = sorted.slice(-14);

        const sleepTrend = this.linearTrend(recent.map(d => d.sleep_hours || 0));
        const activityTrend = this.linearTrend(recent.map(d => (d.steps || 0) / 1000));
        const sleepVolatility = this.standardDev(recent.map(d => d.sleep_hours || 0));
        const activityVolatility = this.standardDev(recent.map(d => (d.steps || 0) / 1000));
        const sleepDebt = recent.reduce((s, d) => s + Math.max(0, 8 - (d.sleep_hours || 0)), 0);
        const avgDailyDebt = sleepDebt / recent.length;
        const avgSleep = recent.reduce((s, d) => s + (d.sleep_hours || 0), 0) / recent.length;
        const avgActivity = recent.reduce((s, d) => s + ((d.steps || 0) / 10000), 0) / recent.length;

        const baselineDepression = assessment.scores.depression.scaled;
        const baselineAnxiety = assessment.scores.anxiety.scaled;
        const baselineStress = assessment.scores.stress.scaled;
        const currentDepression = (baselineDepression / 42) * 100;
        const currentAnxiety = (baselineAnxiety / 42) * 100;
        const currentStress = (baselineStress / 42) * 100;

        const historyData = recent.map(day => {
            const sleepDef = Math.max(0, 7.5 - (day.sleep_hours || 0));
            const activityLow = Math.max(0, 1 - ((day.steps || 0) / 8000));
            const dailyStress = Math.min(100, Math.max(0, currentStress + sleepDef * 4));
            const dailyAnxiety = Math.min(100, Math.max(0, currentAnxiety + sleepDef * 3.5));
            const dailyDepression = Math.min(100, Math.max(0, currentDepression + sleepDef * 2.5 + activityLow * 5));
            const dailyWellness = Math.max(0, Math.min(100,
                100 - (dailyDepression * 0.35 + dailyAnxiety * 0.30 + dailyStress * 0.35)
            ));
            return {
                date: day.date,
                stress: Math.round(dailyStress), anxiety: Math.round(dailyAnxiety),
                depression: Math.round(dailyDepression), wellness: Math.round(dailyWellness),
            };
        });

        const forecast = [];
        const lastDate = new Date(sorted[sorted.length - 1].date);
        for (let i = 1; i <= 7; i++) {
            const futureDate = new Date(lastDate);
            futureDate.setDate(futureDate.getDate() + i);
            const decay = Math.pow(0.92, i - 1);
            const sleepImpact = -sleepTrend * 3 * i * decay;
            const activityImpact = activityTrend * 2 * i * decay;
            const debtImpact = avgDailyDebt * 2.5 * decay;
            const volatilityImpact = sleepVolatility * 1.5 * decay;

            const stressForecast = Math.max(0, Math.min(100, currentStress + sleepImpact * 1.2 - activityImpact * 0.8 + debtImpact + volatilityImpact * 1.5));
            const anxietyForecast = Math.max(0, Math.min(100, currentAnxiety + sleepImpact + volatilityImpact * 2 + debtImpact * 0.8));
            const depressionForecast = Math.max(0, Math.min(100, currentDepression + sleepImpact * 0.9 - activityImpact * 1.2 + debtImpact * 0.6));
            const wellnessForecast = Math.max(0, Math.min(100, 100 - (depressionForecast * 0.35 + anxietyForecast * 0.30 + stressForecast * 0.35)));

            const baseUncertainty = Math.max(3, sleepVolatility * 4 + activityVolatility * 0.5);
            const uncertainty = baseUncertainty * (1 + i * 0.18);

            forecast.push({
                date: futureDate.toISOString().split('T')[0], day: i,
                stress: Math.round(stressForecast),
                anxiety: Math.round(anxietyForecast),
                depression: Math.round(depressionForecast),
                wellness: Math.round(wellnessForecast),
                confidence: {
                    stress:     { lower: Math.max(0, Math.round(stressForecast - uncertainty)),     upper: Math.min(100, Math.round(stressForecast + uncertainty)) },
                    anxiety:    { lower: Math.max(0, Math.round(anxietyForecast - uncertainty)),    upper: Math.min(100, Math.round(anxietyForecast + uncertainty)) },
                    depression: { lower: Math.max(0, Math.round(depressionForecast - uncertainty)), upper: Math.min(100, Math.round(depressionForecast + uncertainty)) },
                    wellness:   { lower: Math.max(0, Math.round(wellnessForecast - uncertainty * 1.3)), upper: Math.min(100, Math.round(wellnessForecast + uncertainty * 1.3)) },
                },
            });
        }

        let trendLabel, insight;
        const stressChange = forecast[6].stress - historyData[historyData.length - 1].stress;
        const wellnessChange = forecast[6].wellness - historyData[historyData.length - 1].wellness;
        if (sleepTrend < -0.2 && stressChange > 5) {
            trendLabel = 'worsening';
            insight = `If current sleep patterns continue, stress may increase notably within 7 days.`;
        } else if (sleepTrend > 0.2 && wellnessChange > 3) {
            trendLabel = 'improving';
            insight = `Improving sleep trends suggest mental wellness could rise over the next week.`;
        } else if (avgDailyDebt > 1.5) {
            trendLabel = 'caution';
            insight = `Accumulated sleep debt (${sleepDebt.toFixed(1)}h) may impact emotional stability.`;
        } else {
            trendLabel = 'stable';
            insight = 'Current patterns suggest your emotional state will remain relatively stable.';
        }

        return {
            history: historyData,
            forecast,
            trend: trendLabel,
            insight,
            nextDay: forecast[0],
            nextWeek: forecast[6],
            features: {
                sleepTrend: Number(sleepTrend.toFixed(2)),
                activityTrend: Number(activityTrend.toFixed(2)),
                sleepDebt: Number(sleepDebt.toFixed(1)),
                volatility: Number(sleepVolatility.toFixed(2)),
            },
        };
    }
}

export default new WellnessCalculator();
