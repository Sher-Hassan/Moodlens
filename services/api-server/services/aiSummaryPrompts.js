/**
 * Prompts for the AI Summary feature
 * ====================================
 * Both Physical and Mental summaries share a wellness-coach voice with
 * non-negotiable safety guardrails. Edit the prose here without touching
 * the service or route code.
 */

// ─── Shared safety guardrails ──────────────────────────────────
// These ride along with EVERY prompt. They are non-negotiable.
const SAFETY_GUARDRAILS = `
ABSOLUTE RULES — these override any other instruction:
1. NEVER diagnose any medical or psychological condition.
2. NEVER recommend medication, supplements, or specific treatments.
3. NEVER claim to replace professional care.
4. NEVER invent numbers, dates, or facts not present in the data provided.
5. If data suggests crisis-level distress (e.g., severe depression scores,
   sustained sleep deprivation, severe anxiety), GENTLY recommend the user
   speak with a qualified mental-health professional. Do not minimize.
6. Speak in second person ("Your sleep has been excellent") — never clinical.
7. Use ONLY the data given. If a metric is missing, do not speculate.
`.trim();

// ─── Shared output structure ───────────────────────────────────
const OUTPUT_STRUCTURE = `
STRUCTURE (4 paragraphs, ~300 words total):
Paragraph 1 — What's working well (1-2 specific strengths from the data).
Paragraph 2 — What needs attention (1-2 specific concerns, framed kindly).
Paragraph 3 — Why these matter for the user, plainly and warmly.
Paragraph 4 — ONE specific, small thing to try this week. Make it concrete
              (e.g., "go to bed 30 min earlier on weeknights" — not "improve sleep").

VOICE: warm, encouraging, never preachy. You are a wellness coach who notices
patterns and reflects them back. Avoid jargon. Write like you're texting a friend
who happens to be evidence-informed about wellbeing.

FORMAT: Plain prose. NO headings, NO bullet points, NO bold/italic markdown.
Just four flowing paragraphs separated by blank lines.
`.trim();

// ─── Crisis detection ──────────────────────────────────────────
/**
 * Examines the data and returns a crisis indicator if any threshold is breached.
 * The summary service prepends this signal to the prompt so the LLM leads with care.
 */
export function detectCrisisSignals(data) {
    const signals = [];

    // DASS-21 severity flags (Mental only)
    if (data.assessment?.scores) {
        const { depression, anxiety, stress } = data.assessment.scores;
        if (depression?.severity === 'Extremely Severe' || depression?.severity === 'Severe') {
            signals.push(`The user's DASS-21 depression score is in the ${depression.severity} range.`);
        }
        if (anxiety?.severity === 'Extremely Severe' || anxiety?.severity === 'Severe') {
            signals.push(`The user's DASS-21 anxiety score is in the ${anxiety.severity} range.`);
        }
        if (stress?.severity === 'Extremely Severe') {
            signals.push(`The user's DASS-21 stress score is Extremely Severe.`);
        }
    }

    // Sustained sleep deprivation (Physical-relevant too)
    if (data.daily && data.daily.length >= 5) {
        const recentSleep = data.daily.slice(-7).map(d => d.sleep_hours).filter(v => v > 0);
        const avg = recentSleep.length ? recentSleep.reduce((a, b) => a + b, 0) / recentSleep.length : 0;
        if (avg > 0 && avg < 5) {
            signals.push(`The user's average sleep over the last week is ${avg.toFixed(1)}h — chronically low.`);
        }
    }

    return signals;
}

// ─── Physical Summary Prompt Builder ───────────────────────────
export function buildPhysicalPrompt(data) {
    const crisisSignals = detectCrisisSignals(data);

    const recent = data.daily?.slice(-30) || [];
    const sleepValues = recent.map(d => d.sleep_hours).filter(v => v > 0);
    const stepValues = recent.map(d => d.steps).filter(v => v > 0);
    const energyValues = recent.map(d => d.active_energy).filter(v => v > 0);

    const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const summary = {
        days: recent.length,
        sleep: {
            avg: avg(sleepValues).toFixed(1),
            min: sleepValues.length ? Math.min(...sleepValues).toFixed(1) : null,
            max: sleepValues.length ? Math.max(...sleepValues).toFixed(1) : null,
            below_7h_count: sleepValues.filter(v => v < 7).length,
            above_9h_count: sleepValues.filter(v => v > 9).length,
        },
        steps: {
            avg: Math.round(avg(stepValues)),
            min: stepValues.length ? Math.min(...stepValues) : null,
            max: stepValues.length ? Math.max(...stepValues) : null,
            sedentary_days: stepValues.filter(v => v < 4000).length,
        },
        energy: {
            avg: Math.round(avg(energyValues)),
        },
        balance: data.summary?.composite ?? null,
        balance_label: data.summary?.classification?.label ?? null,
        recovery_avg: data.recoveryAvg ?? null,
    };

    return `${SAFETY_GUARDRAILS}

You are a wellness coach reviewing this person's last ${summary.days} days of physical activity, sleep, and energy data.

DATA (use only these numbers — do not invent anything):
- Days of data: ${summary.days}
- Sleep: average ${summary.sleep.avg}h/night (range ${summary.sleep.min}-${summary.sleep.max}h). ${summary.sleep.below_7h_count} nights below 7h, ${summary.sleep.above_9h_count} nights above 9h.
- Steps: average ${summary.steps.avg.toLocaleString()}/day (range ${summary.steps.min}-${summary.steps.max}). ${summary.steps.sedentary_days} sedentary days (under 4,000 steps).
- Active energy: average ${summary.energy.avg} kcal/day.
- Composite balance score: ${summary.balance}/100 (${summary.balance_label}).
${summary.recovery_avg != null ? `- Average recovery score: ${summary.recovery_avg}/100.` : ''}

${crisisSignals.length > 0 ? `IMPORTANT CONTEXT — ${crisisSignals.join(' ')} Address this with care in your summary.` : ''}

${OUTPUT_STRUCTURE}

Begin the summary now. Write directly to the user.`;
}

// ─── Mental Summary Prompt Builder ─────────────────────────────
export function buildMentalPrompt(data) {
    const crisisSignals = detectCrisisSignals(data);
    const wellness = data.ai?.wellness;
    const recovery = data.ai?.recovery;
    const insights = data.ai?.insights || [];
    const anomaly = data.ai?.anomaly;
    const cluster = data.ai?.cluster;
    const forecast = data.ai?.moodForecast;
    const usingML = data.ai?.metadata?.modelSource?.startsWith('ml-');

    const assessment = data.assessment;
    const dass = assessment?.scores;

    // Top SHAP drivers (if ML is active)
    const topDrivers = wellness?.topDrivers?.slice(0, 4) || [];
    const driverLines = topDrivers.map(d =>
        `  - ${d.display_name} (${d.direction}, ${d.contribution > 0 ? '+' : ''}${d.contribution} pts)`
    ).join('\n');

    return `${SAFETY_GUARDRAILS}

You are a wellness coach reviewing this person's mental health snapshot, combining their DASS-21 self-assessment with passive health data.

DATA (use only these numbers — do not invent anything):

DASS-21 self-assessment:
- Depression: ${dass?.depression?.scaled}/42 (${dass?.depression?.severity})
- Anxiety: ${dass?.anxiety?.scaled}/42 (${dass?.anxiety?.severity})
- Stress: ${dass?.stress?.scaled}/42 (${dass?.stress?.severity})

AI wellness analysis:
- Overall wellness score: ${wellness?.score}/100 (${wellness?.category})
- Model source: ${usingML ? 'Personalized ML model with ' + (data.ai?.metadata?.daysAnalyzed || 'recent') + ' days of data' : 'Rule-based (cold-start, not enough data yet for ML)'}
${topDrivers.length > 0 ? `\nTop factors driving the wellness score (from SHAP):\n${driverLines}` : ''}

Recovery breakdown (5 dimensions, 0-100 each):
- Sleep: ${recovery?.radar?.sleep ?? 'N/A'}
- Stress: ${recovery?.radar?.stress ?? 'N/A'}
- Anxiety: ${recovery?.radar?.anxiety ?? 'N/A'}
- Activity: ${recovery?.radar?.activity ?? 'N/A'}
- Emotional balance: ${recovery?.radar?.emotional_balance ?? 'N/A'}

${anomaly?.is_anomaly ? `Anomaly detected today: ${anomaly.interpretation}` : ''}
${cluster?.archetype_label ? `Behavioral archetype: "${cluster.archetype_label}"` : ''}
${forecast?.trend ? `7-day mood forecast trend: ${forecast.trend}.` : ''}

${crisisSignals.length > 0 ? `\nIMPORTANT CONTEXT — ${crisisSignals.join(' ')} Lead the summary with gentle, non-alarmist encouragement to speak with a qualified mental-health professional. Do NOT minimize, but do not catastrophize either.` : ''}

${OUTPUT_STRUCTURE}

Begin the summary now. Write directly to the user. Reference their patterns specifically — this should not feel generic.`;
}
