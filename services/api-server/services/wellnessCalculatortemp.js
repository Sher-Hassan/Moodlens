/**
 * Wellness Calculator Service
 * 
 * Rule-based mental wellness analytics based on DASS-21 + physical metrics.
 * Designed to be replaced by ML model in the future with same interface.
 * 
 * Phase 1: Rule-based formulas (current)
 * Phase 2: Synthetic data + ML model
 * Phase 3: Real user data + continuous learning
 */

class WellnessCalculator {

    /* ──────────────────────────────────────────────
       Statistical Helpers
    ────────────────────────────────────────────── */
    
    linearTrend(values) {
        const n = values.length;
        if (n < 2) return 0;
        
        const sumX = (n * (n - 1)) / 2;
        const sumY = values.reduce((s, v) => s + v, 0);
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
       Feature Engineering
    ────────────────────────────────────────────── */

    engineerFeatures(healthData, assessment) {
        if (!healthData || healthData.length === 0) {
            return null;
        }

        // Sort by date
        const sorted = [...healthData].sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        );

        // Use last 7 days (or all available if less)
        const window = sorted.slice(-7);
        const allData = sorted;

        // Averages
        const avg = (arr, key) =>
            arr.reduce((s, x) => s + (x[key] || 0), 0) / Math.max(arr.length, 1);

        const steps_7d_avg = avg(window, 'steps');
        const sleep_7d_avg = avg(window, 'sleep_hours');
        const energy_7d_avg = avg(window, 'active_energy');

        // Standard deviation (consistency)
        const stdDev = (arr, key) => {
            const values = arr.map(d => d[key] || 0);
            const mean = values.reduce((s, v) => s + v, 0) / values.length;
            const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
            return Math.sqrt(variance);
        };

        const sleep_consistency = window.length > 1
            ? Math.max(0, 100 - (stdDev(window, 'sleep_hours') * 30))
            : 50;

        // Sleep debt (cumulative deficit from 8h target)
        const sleep_debt = window.reduce((s, d) =>
            s + Math.max(0, 8 - (d.sleep_hours || 0)), 0
        );

        // Activity load (normalized combination)
        const activity_load = (steps_7d_avg / 10000) + (energy_7d_avg / 500);

        // Recent vs older comparison (trend)
        const recentDays = sorted.slice(-3);
        const olderDays = sorted.slice(-10, -3);

        const sleep_trend = olderDays.length > 0
            ? avg(recentDays, 'sleep_hours') - avg(olderDays, 'sleep_hours')
            : 0;

        const activity_trend = olderDays.length > 0
            ? avg(recentDays, 'steps') - avg(olderDays, 'steps')
            : 0;

        return {
            // Today's snapshot
            steps_today: sorted[sorted.length - 1]?.steps || 0,
            sleep_today: sorted[sorted.length - 1]?.sleep_hours || 0,
            energy_today: sorted[sorted.length - 1]?.active_energy || 0,

            // 7-day averages
            steps_7d_avg,
            sleep_7d_avg,
            energy_7d_avg,

            // Derived metrics
            sleep_consistency,
            sleep_debt,
            activity_load,
            sleep_trend,
            activity_trend,

            // DASS-21 scores
            depression_score: assessment.scores.depression.scaled,
            anxiety_score: assessment.scores.anxiety.scaled,
            stress_score: assessment.scores.stress.scaled,
            depression_severity: assessment.scores.depression.severity,
            anxiety_severity: assessment.scores.anxiety.severity,
            stress_severity: assessment.scores.stress.severity,

            // Data quality
            days_of_data: allData.length,
            window_days: window.length,
        };
    }

    /* ──────────────────────────────────────────────
       Wellness Score (0-100)
    ────────────────────────────────────────────── */

    computeWellness(features) {
        // Mental health component (60% weight)
        // DASS-21 max scores: Depression=42, Anxiety=42, Stress=42
        // Normalize to 0-1 where 0 = severe, 1 = none
        const depression_health = 1 - Math.min(features.depression_score / 28, 1);
        const anxiety_health = 1 - Math.min(features.anxiety_score / 20, 1);
        const stress_health = 1 - Math.min(features.stress_score / 34, 1);

        const mental_health = (
            depression_health * 0.35 +
            anxiety_health * 0.30 +
            stress_health * 0.35
        );

        // Physical health component (40% weight)
        // Sleep quality: 7-9h is optimal
        const sleep_score = features.sleep_7d_avg >= 7 && features.sleep_7d_avg <= 9
            ? 1.0
            : Math.max(0, 1 - Math.abs(features.sleep_7d_avg - 8) / 4);

        // Activity quality: 8000+ steps is optimal
        const activity_score = Math.min(features.steps_7d_avg / 8000, 1);

        // Consistency bonus
        const consistency_score = features.sleep_consistency / 100;

        const physical_health = (
            sleep_score * 0.50 +
            activity_score * 0.30 +
            consistency_score * 0.20
        );

        // Combine (weighted)
        const raw_score = (mental_health * 0.60 + physical_health * 0.40) * 100;
        const score = Math.round(Math.max(0, Math.min(100, raw_score)));

        // Categorize
        let category, color, description;
        if (score >= 80) {
            category = 'Excellent';
            color = '#34D399';
            description = 'Your mental and physical wellbeing are in strong alignment.';
        } else if (score >= 60) {
            category = 'Good';
            color = '#0BEFC4';
            description = 'You\'re maintaining solid wellness with room for refinement.';
        } else if (score >= 40) {
            category = 'Moderate Risk';
            color = '#F5C842';
            description = 'Some signals suggest your wellbeing needs attention.';
        } else if (score >= 20) {
            category = 'High Risk';
            color = '#FB923C';
            description = 'Multiple indicators suggest you may benefit from support.';
        } else {
            category = 'Critical Risk';
            color = '#F87171';
            description = 'Please consider reaching out to a mental health professional.';
        }

        return {
            score,
            category,
            color,
            description,
            breakdown: {
                mental_health: Math.round(mental_health * 100),
                physical_health: Math.round(physical_health * 100),
                sleep_contribution: Math.round(sleep_score * 100),
                activity_contribution: Math.round(activity_score * 100),
            },
        };
    }

    /* ──────────────────────────────────────────────
       Recovery Analysis
    ────────────────────────────────────────────── */

    computeRecovery(features) {
        // Five recovery axes (each 0-100)

        // 1. Sleep - 8h is ideal
        const sleep = features.sleep_7d_avg >= 7
            ? Math.min(100, (features.sleep_7d_avg / 8) * 100)
            : Math.max(0, (features.sleep_7d_avg / 8) * 100);

        // 2. Stress - inverted (lower DASS = better recovery)
        const stress = Math.max(0, 100 - (features.stress_score * 2.5));

        // 3. Anxiety - inverted
        const anxiety = Math.max(0, 100 - (features.anxiety_score * 2.5));

        // 4. Activity - healthy range is 6000-12000 steps
        let activity;
        if (features.steps_7d_avg < 5000) {
            activity = (features.steps_7d_avg / 5000) * 70; // Penalty for too little
        } else if (features.steps_7d_avg > 15000) {
            activity = 70; // Penalty for too much (overtraining)
        } else {
            activity = Math.min(100, 70 + ((features.steps_7d_avg - 5000) / 7000) * 30);
        }

        // 5. Emotional Balance - depression inverted
        const emotional_balance = Math.max(0, 100 - (features.depression_score * 2.5));

        // Overall recovery score (weighted average)
        const overall = Math.round(
            sleep * 0.30 +
            stress * 0.20 +
            anxiety * 0.20 +
            activity * 0.15 +
            emotional_balance * 0.15
        );

        // Categorize
        let category, color;
        if (overall >= 80) {
            category = 'Fully Recovered';
            color = '#34D399';
        } else if (overall >= 60) {
            category = 'Stable';
            color = '#0BEFC4';
        } else if (overall >= 40) {
            category = 'Recovery Needed';
            color = '#F5C842';
        } else {
            category = 'Recovery Deficit';
            color = '#FB923C';
        }

        return {
            score: overall,
            category,
            color,
            radar: {
                sleep: Math.round(sleep),
                stress: Math.round(stress),
                anxiety: Math.round(anxiety),
                activity: Math.round(activity),
                emotional_balance: Math.round(emotional_balance),
            },
        };
    }

    /* ──────────────────────────────────────────────
       AI-Style Insights (Rule-Based)
    ────────────────────────────────────────────── */

    generateInsights(features, wellness, recovery) {
        const insights = [];

        // SLEEP INSIGHTS
        if (features.sleep_7d_avg < 6) {
            insights.push({
                type: 'warning',
                category: 'Sleep',
                text: `Your sleep average is only ${features.sleep_7d_avg.toFixed(1)}h. Chronic sleep deprivation directly affects mental wellbeing.`,
                priority: 1,
            });
        } else if (features.sleep_7d_avg >= 7 && features.sleep_7d_avg <= 9) {
            insights.push({
                type: 'positive',
                category: 'Sleep',
                text: `Your sleep is solid at ${features.sleep_7d_avg.toFixed(1)}h average — this is a strong foundation for recovery.`,
                priority: 3,
            });
        }

        if (features.sleep_consistency < 50 && features.window_days >= 4) {
            insights.push({
                type: 'suggestion',
                category: 'Sleep',
                text: 'Your sleep timing varies significantly. Consistent bed/wake times can improve recovery quality.',
                priority: 2,
            });
        }

        // COMBINED PATTERNS
        if (features.stress_score > 18 && features.sleep_7d_avg < 7) {
            insights.push({
                type: 'warning',
                category: 'Pattern',
                text: 'High stress combined with reduced sleep is a burnout-risk pattern. Prioritize rest this week.',
                priority: 1,
            });
        }

        if (features.anxiety_score > 14 && features.steps_7d_avg < 4000) {
            insights.push({
                type: 'suggestion',
                category: 'Pattern',
                text: 'Research shows light daily movement (even 20-min walks) can reduce anxiety symptoms.',
                priority: 2,
            });
        }

        // ACTIVITY INSIGHTS
        if (features.steps_7d_avg < 4000) {
            insights.push({
                type: 'suggestion',
                category: 'Activity',
                text: `Your movement is low at ${Math.round(features.steps_7d_avg)} steps/day. Aim for short, frequent walks.`,
                priority: 2,
            });
        } else if (features.steps_7d_avg >= 8000) {
            insights.push({
                type: 'positive',
                category: 'Activity',
                text: `Excellent activity level at ${Math.round(features.steps_7d_avg)} steps/day average.`,
                priority: 3,
            });
        }

        // TREND INSIGHTS
        if (features.sleep_trend < -0.5) {
            insights.push({
                type: 'warning',
                category: 'Trend',
                text: `Your sleep has declined ${Math.abs(features.sleep_trend).toFixed(1)}h recently. Watch for cumulative fatigue.`,
                priority: 2,
            });
        } else if (features.sleep_trend > 0.5) {
            insights.push({
                type: 'positive',
                category: 'Trend',
                text: `Your sleep is improving — up ${features.sleep_trend.toFixed(1)}h on recent nights. Keep it going.`,
                priority: 3,
            });
        }

        if (features.activity_trend > 1000) {
            insights.push({
                type: 'positive',
                category: 'Trend',
                text: 'Your activity is trending upward. Movement compounds mental wellness.',
                priority: 3,
            });
        }

        // DASS-21 INSIGHTS
        if (features.depression_severity !== 'Normal' && features.depression_severity !== 'Mild') {
            insights.push({
                type: 'warning',
                category: 'Mental',
                text: `Your depression indicators are in the ${features.depression_severity.toLowerCase()} range. Consider talking with a professional.`,
                priority: 1,
            });
        }

        if (features.stress_severity === 'Severe' || features.stress_severity === 'Extremely Severe') {
            insights.push({
                type: 'warning',
                category: 'Mental',
                text: 'Stress levels are significantly elevated. Identify your top 2 stressors and reduce exposure.',
                priority: 1,
            });
        }

        // OVERALL WELLNESS
        if (wellness.score >= 80) {
            insights.push({
                type: 'positive',
                category: 'Overall',
                text: 'Your wellness markers are aligned. The habits you have are working — keep the rhythm.',
                priority: 3,
            });
        } else if (wellness.score < 40) {
            insights.push({
                type: 'warning',
                category: 'Overall',
                text: 'Multiple wellness indicators are flagged. Consider professional support and prioritize basics: sleep, food, movement.',
                priority: 1,
            });
        }

        // Sort by priority (1 = highest) and return top 5
        return insights
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 5);
    }

    /* ──────────────────────────────────────────────
       Burnout Detection Timeline
    ────────────────────────────────────────────── */
    
    computeBurnoutTimeline(healthData, assessment) {
        if (!healthData || healthData.length === 0) return [];

        const sorted = [...healthData].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        // DASS baseline (static contribution)
        const stressBaseline = assessment.scores.stress.scaled * 0.5;
        const anxietyBaseline = assessment.scores.anxiety.scaled * 0.3;
        const dassContribution = (stressBaseline + anxietyBaseline) * 1.2;

        return sorted.map((day, idx) => {
            // Daily physical contributions
            const sleepDeficit = Math.max(0, 7 - (day.sleep_hours || 0));
            const sleepPenalty = sleepDeficit * 5;

            const activityLoad = ((day.steps || 0) / 10000) + ((day.active_energy || 0) / 500);
            const activityPenalty = Math.max(0, activityLoad - 1.5) * 15;

            // Combine
            const burnoutScore = Math.max(0, Math.min(100,
                dassContribution + sleepPenalty + activityPenalty
            ));

            // Daily stress proxy (DASS + sleep modifier)
            const stressProxy = Math.max(0, Math.min(100,
                assessment.scores.stress.scaled * 2.4 + sleepDeficit * 6
            ));

            // Sleep score (inverted for display: more sleep = higher score)
            const sleepScore = Math.min(100, ((day.sleep_hours || 0) / 8) * 100);

            // Risk category
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

    /* ──────────────────────────────────────────────
       Behavioral Heatmap
    ────────────────────────────────────────────── */
    
    computeBehavioralHeatmap(healthData, assessment) {
        if (!healthData || healthData.length === 0) {
            return { weeks: [], days: [], data: {} };
        }

        const sorted = [...healthData].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        
        // Build a map: dateString → metrics
        const dayMap = {};
        sorted.forEach(day => {
            dayMap[day.date] = day;
        });

        // Determine range (start from earliest Monday)
        const firstDate = new Date(sorted[0].date);
        const lastDate = new Date(sorted[sorted.length - 1].date);

        // Adjust to Monday of first week
        const firstDayOfWeek = firstDate.getDay(); // 0=Sun, 1=Mon
        const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        const startDate = new Date(firstDate);
        startDate.setDate(startDate.getDate() - daysToMonday);

        const weeks = [];
        const wellnessGrid = [];
        const stressGrid = [];
        const sleepGrid = [];
        const activityGrid = [];

        let currentDate = new Date(startDate);
        let weekIndex = 0;

        while (currentDate <= lastDate) {
            const weekRow = { wellness: [], stress: [], sleep: [], activity: [] };
            
            for (let d = 0; d < 7; d++) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const dayData = dayMap[dateStr];

                if (dayData) {
                    // Compute daily wellness score
                    const sleep = dayData.sleep_hours || 0;
                    const steps = dayData.steps || 0;
                    
                    const sleepScore = sleep >= 7 && sleep <= 9 ? 100 : Math.max(0, 100 - Math.abs(sleep - 8) * 15);
                    const activityScore = Math.min(100, (steps / 10000) * 100);
                    
                    const mentalLoad = (
                        assessment.scores.depression.scaled * 0.35 +
                        assessment.scores.anxiety.scaled * 0.30 +
                        assessment.scores.stress.scaled * 0.35
                    );
                    const mentalScore = Math.max(0, 100 - (mentalLoad / 42) * 100);

                    const wellness = Math.round(
                        mentalScore * 0.5 + sleepScore * 0.3 + activityScore * 0.2
                    );

                    // Daily stress (DASS + sleep deficit modifier)
                    const sleepDeficit = Math.max(0, 7 - sleep);
                    const stress = Math.min(100, Math.round(
                        (assessment.scores.stress.scaled / 42) * 100 + sleepDeficit * 5
                    ));

                    weekRow.wellness.push(wellness);
                    weekRow.stress.push(stress);
                    weekRow.sleep.push(Math.round(sleepScore));
                    weekRow.activity.push(Math.round(activityScore));
                } else {
                    // No data this day
                    weekRow.wellness.push(null);
                    weekRow.stress.push(null);
                    weekRow.sleep.push(null);
                    weekRow.activity.push(null);
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }

            weeks.push(`W${weekIndex + 1}`);
            wellnessGrid.push(weekRow.wellness);
            stressGrid.push(weekRow.stress);
            sleepGrid.push(weekRow.sleep);
            activityGrid.push(weekRow.activity);

            weekIndex++;
            if (weekIndex > 12) break; // Safety
        }

        return {
            weeks,
            days: dayLabels,
            data: {
                wellness: wellnessGrid,
                stress: stressGrid,
                sleep: sleepGrid,
                activity: activityGrid,
            },
        };
    }

    /* ──────────────────────────────────────────────
       AI Mood Forecast (Rule-Based with Trend Analysis)
    ────────────────────────────────────────────── */
    
    computeMoodForecast(healthData, assessment) {
        if (!healthData || healthData.length < 3) return null;

        const sorted = [...healthData].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        // Use last 14 days for forecast basis
        const recent = sorted.slice(-14);
        const history = sorted.slice(-14); // For chart display
        
        // ── FEATURE ENGINEERING ──────────────────────
        
        // 1. Linear trends
        const sleepTrend = this.linearTrend(recent.map(d => d.sleep_hours || 0));
        const activityTrend = this.linearTrend(recent.map(d => (d.steps || 0) / 1000));
        const energyTrend = this.linearTrend(recent.map(d => (d.active_energy || 0) / 100));
        
        // 2. Variability (volatility = instability)
        const sleepVolatility = this.standardDev(recent.map(d => d.sleep_hours || 0));
        const activityVolatility = this.standardDev(recent.map(d => (d.steps || 0) / 1000));
        
        // 3. Sleep debt accumulation
        const sleepDebt = recent.reduce((s, d) => s + Math.max(0, 8 - (d.sleep_hours || 0)), 0);
        const avgDailyDebt = sleepDebt / recent.length;
        
        // 4. Recovery ratio (sleep / stress burden)
        const avgSleep = recent.reduce((s, d) => s + (d.sleep_hours || 0), 0) / recent.length;
        const avgActivity = recent.reduce((s, d) => s + ((d.steps || 0) / 10000), 0) / recent.length;
        const recoveryRatio = avgSleep / Math.max(1, avgActivity * 4);
        
        // ── BASELINE FROM DASS-21 ────────────────────
        
        const baselineDepression = assessment.scores.depression.scaled; // 0-42
        const baselineAnxiety = assessment.scores.anxiety.scaled;
        const baselineStress = assessment.scores.stress.scaled;
        
        // Convert to 0-100 scale (DASS scaled max is ~42)
        const currentDepression = (baselineDepression / 42) * 100;
        const currentAnxiety = (baselineAnxiety / 42) * 100;
        const currentStress = (baselineStress / 42) * 100;
        const currentWellness = Math.max(0, 100 - 
            (currentDepression * 0.35 + currentAnxiety * 0.30 + currentStress * 0.35)
        );
        
        // ── BUILD HISTORICAL DAILY ESTIMATES ─────────
        // (Approximate what daily DASS would have been based on sleep/activity)
        
        const historyData = history.map(day => {
            const sleepDef = Math.max(0, 7.5 - (day.sleep_hours || 0));
            const activityLow = Math.max(0, 1 - ((day.steps || 0) / 8000));
            
            // Each day's variation around baseline
            const dailyStress = Math.min(100, Math.max(0,
                currentStress + sleepDef * 4 - (activityLow < 0 ? -2 : 0)
            ));
            const dailyAnxiety = Math.min(100, Math.max(0,
                currentAnxiety + sleepDef * 3.5
            ));
            const dailyDepression = Math.min(100, Math.max(0,
                currentDepression + sleepDef * 2.5 + activityLow * 5
            ));
            const dailyWellness = Math.max(0, Math.min(100,
                100 - (dailyDepression * 0.35 + dailyAnxiety * 0.30 + dailyStress * 0.35)
            ));
            
            return {
                date: day.date,
                stress: Math.round(dailyStress),
                anxiety: Math.round(dailyAnxiety),
                depression: Math.round(dailyDepression),
                wellness: Math.round(dailyWellness),
            };
        });
        
        // ── GENERATE 7-DAY FORECAST ──────────────────
        
        const forecast = [];
        const lastDate = new Date(sorted[sorted.length - 1].date);
        
        for (let i = 1; i <= 7; i++) {
            const futureDate = new Date(lastDate);
            futureDate.setDate(futureDate.getDate() + i);
            
            // Decay factor: trends weaken further out
            const decay = Math.pow(0.92, i - 1);
            
            // Compound impacts from trends
            const sleepImpact = -sleepTrend * 3 * i * decay; // declining sleep → worsening mood
            const activityImpact = activityTrend * 2 * i * decay; // increasing activity → improving mood
            const debtImpact = avgDailyDebt * 2.5 * decay;
            const volatilityImpact = sleepVolatility * 1.5 * decay;
            
            // Forecasted scores (0-100)
            const stressForecast = Math.max(0, Math.min(100,
                currentStress + sleepImpact * 1.2 - activityImpact * 0.8 + debtImpact + volatilityImpact * 1.5
            ));
            
            const anxietyForecast = Math.max(0, Math.min(100,
                currentAnxiety + sleepImpact + volatilityImpact * 2 + debtImpact * 0.8
            ));
            
            const depressionForecast = Math.max(0, Math.min(100,
                currentDepression + sleepImpact * 0.9 - activityImpact * 1.2 + debtImpact * 0.6
            ));
            
            const wellnessForecast = Math.max(0, Math.min(100,
                100 - (depressionForecast * 0.35 + anxietyForecast * 0.30 + stressForecast * 0.35)
            ));
            
            // Confidence interval grows with time and volatility
            const baseUncertainty = Math.max(3, sleepVolatility * 4 + activityVolatility * 0.5);
            const uncertainty = baseUncertainty * (1 + i * 0.18);
            
            forecast.push({
                date: futureDate.toISOString().split('T')[0],
                day: i,
                stress: Math.round(stressForecast),
                anxiety: Math.round(anxietyForecast),
                depression: Math.round(depressionForecast),
                wellness: Math.round(wellnessForecast),
                confidence: {
                    stress: {
                        lower: Math.max(0, Math.round(stressForecast - uncertainty)),
                        upper: Math.min(100, Math.round(stressForecast + uncertainty)),
                    },
                    anxiety: {
                        lower: Math.max(0, Math.round(anxietyForecast - uncertainty)),
                        upper: Math.min(100, Math.round(anxietyForecast + uncertainty)),
                    },
                    depression: {
                        lower: Math.max(0, Math.round(depressionForecast - uncertainty)),
                        upper: Math.min(100, Math.round(depressionForecast + uncertainty)),
                    },
                    wellness: {
                        lower: Math.max(0, Math.round(wellnessForecast - uncertainty * 1.3)),
                        upper: Math.min(100, Math.round(wellnessForecast + uncertainty * 1.3)),
                    },
                },
            });
        }
        
        // ── GENERATE FORECAST INSIGHT ────────────────
        
        let trendLabel, insight;
        const stressChange = forecast[6].stress - historyData[historyData.length - 1].stress;
        const wellnessChange = forecast[6].wellness - historyData[historyData.length - 1].wellness;
        
        if (sleepTrend < -0.2 && stressChange > 5) {
            trendLabel = 'worsening';
            const pct = Math.round((stressChange / Math.max(historyData[historyData.length - 1].stress, 1)) * 100);
            insight = `If current sleep patterns continue, stress may increase by ${pct}% within 7 days.`;
        } else if (sleepTrend > 0.2 && wellnessChange > 3) {
            trendLabel = 'improving';
            const pct = Math.round((wellnessChange / Math.max(historyData[historyData.length - 1].wellness, 1)) * 100);
            insight = `Improving sleep trends suggest mental wellness could rise ${pct}% over the next week.`;
        } else if (avgDailyDebt > 1.5) {
            trendLabel = 'caution';
            insight = `Accumulated sleep debt (${sleepDebt.toFixed(1)}h) may impact emotional stability in coming days.`;
        } else {
            trendLabel = 'stable';
            insight = 'Current patterns suggest your emotional state will remain relatively stable over the next 7 days.';
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
                recoveryRatio: Number(recoveryRatio.toFixed(2)),
            },
        };
    }

    /* ──────────────────────────────────────────────
       Main Entry Point
    ────────────────────────────────────────────── */

    analyze(healthData, assessment) {
        if (!assessment) {
            return { 
                error: 'NO_ASSESSMENT',
                message: 'Complete the mental wellness quiz to unlock AI insights.' 
            };
        }

        if (!healthData || healthData.length === 0) {
            return { 
                error: 'NO_HEALTH_DATA',
                message: 'Upload health data to enable wellness analysis.' 
            };
        }

        const features = this.engineerFeatures(healthData, assessment);
        if (!features) {
            return { 
                error: 'INSUFFICIENT_DATA',
                message: 'Not enough data to compute reliable scores.' 
            };
        }

        const wellness = this.computeWellness(features);
        const recovery = this.computeRecovery(features);
        const insights = this.generateInsights(features, wellness, recovery);
        const burnoutTimeline = this.computeBurnoutTimeline(healthData, assessment);
        const heatmap = this.computeBehavioralHeatmap(healthData, assessment);
        const moodForecast = this.computeMoodForecast(healthData, assessment); // NEW

        return {
            wellness,
            recovery,
            insights,
            burnoutTimeline,
            heatmap,
            moodForecast, // NEW
            metadata: {
                daysAnalyzed: features.days_of_data,
                windowDays: features.window_days,
                computedAt: new Date().toISOString(),
                version: '1.0-rule-based',
            },
        };
    }
}

// Export singleton instance
export default new WellnessCalculator();