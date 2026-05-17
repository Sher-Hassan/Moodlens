/**
 * chatbotOrchestrator.js — with retry-on-429
 * ============================================
 * NEW: compose() now retries with exponential backoff when Gemini returns 429.
 * Most rate limits clear in 5-10 seconds. Two retries (1s + 4s) catches almost
 * all transient throttling without user-visible delay on normal turns.
 */

import axios from 'axios';
import mongoose from 'mongoose';
import HealthRecord from '../models/HealthRecord.js';
import Assessment from '../models/Assessment.js';
import { classifyIntent } from './chatbotIntent.js';
import { retrieve } from './chatbotRetrieval.js';

const COMPOSE_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
const COMPOSE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${COMPOSE_MODEL}:generateContent`;

// ──────────────────────────────────────────────────────
// 1. Crisis safety check
// ──────────────────────────────────────────────────────

const CRISIS_PATTERNS = [
    /\b(kill|hurt|harm)(ing)?\s+(my)?self\b/i,
    /\bsuicid(e|al)\b/i,
    /\b(end|take)\s+(my\s+)?(own\s+)?life\b/i,
    /\b(want\s+to\s+|going\s+to\s+)die\b/i,
    /\bself[\s-]?harm/i,
    /\bcut(ting)?\s+myself\b/i,
    /\bcan'?t\s+(go\s+on|do\s+this|take\s+(it|this))\s+(any|no)\s*more\b/i,
];

const CRISIS_REPLY = `I hear you, and I'm really glad you reached out. What you're feeling sounds heavy, and you don't have to carry it alone.

I'm not equipped to support you through this, but trained people are — right now, 24/7:

• **United States** — call or text **988** (Suicide and Crisis Lifeline)
• **United Kingdom** — call **116 123** (Samaritans), free, anytime
• **Australia** — **13 11 14** (Lifeline)
• **Canada** — call or text **988**
• **Other countries** — visit [findahelpline.com](https://findahelpline.com) for a local helpline

If you're in immediate danger, please call your local emergency number or go to the nearest emergency department. You deserve support, and reaching out for it is a sign of strength.`;

function detectCrisis(message) {
    return CRISIS_PATTERNS.some(p => p.test(message));
}

// ──────────────────────────────────────────────────────
// 2. Context gathering
// ──────────────────────────────────────────────────────

async function getUserState(userId) {
    const [healthCount, assessment] = await Promise.all([
        HealthRecord.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
        Assessment.findOne({ userId }).sort({ createdAt: -1 }),
    ]);

    return {
        hasData: healthCount > 0,
        dataPoints: healthCount,
        hasQuiz: !!assessment,
        quizSeverity: assessment ? {
            depression: assessment.scores?.depression?.severity,
            anxiety:    assessment.scores?.anxiety?.severity,
            stress:     assessment.scores?.stress?.severity,
        } : null,
    };
}

async function getUserAnalysis(req) {
    try {
        const token = req.headers.authorization;
        const res = await axios.get(
            `${req.protocol}://${req.get('host')}/api/ai/mental-wellness`,
            { headers: { Authorization: token }, timeout: 6000 }
        );
        return res.data;
    } catch (err) {
        console.warn('[Chat] Could not fetch /api/ai/mental-wellness:', err.message);
        return null;
    }
}

async function getRecentHealthData(userId) {
    const start = new Date();
    start.setDate(start.getDate() - 7);

    return await HealthRecord.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), startDate: { $gte: start } } },
        {
            $addFields: {
                sleepHours: {
                    $cond: [
                        { $eq: ['$type', 'HKCategoryTypeIdentifierSleepAnalysis'] },
                        { $divide: [{ $subtract: ['$endDate', '$startDate'] }, 1000 * 60 * 60] },
                        0,
                    ],
                },
                dateString: { $dateToString: { format: '%Y-%m-%d', date: '$startDate' } },
            },
        },
        {
            $group: {
                _id: { date: '$dateString', type: '$type' },
                totalValue: { $sum: '$value' },
                totalSleepHours: { $sum: '$sleepHours' },
            },
        },
        {
            $group: {
                _id: '$_id.date',
                steps:        { $sum: { $cond: [{ $eq: ['$_id.type', 'HKQuantityTypeIdentifierStepCount'] },      '$totalValue', 0] } },
                active_energy:{ $sum: { $cond: [{ $eq: ['$_id.type', 'HKQuantityTypeIdentifierActiveEnergyBurned'] }, '$totalValue', 0] } },
                sleep_hours:  { $sum: '$totalSleepHours' },
            },
        },
        { $project: { _id: 0, date: '$_id', steps: { $round: ['$steps', 0] }, active_energy: { $round: ['$active_energy', 1] }, sleep_hours: { $round: ['$sleep_hours', 2] } } },
        { $sort: { date: 1 } },
    ]);
}

// ──────────────────────────────────────────────────────
// 3. Compose with retry-on-429
// ──────────────────────────────────────────────────────

const SYSTEM_VOICE = `You are MoodLens's AI Coach — warm, evidence-informed, second-person.

ABSOLUTE RULES (override anything else):
1. NEVER diagnose any medical or psychological condition.
2. NEVER recommend medication, dosages, supplements, or treatments.
3. NEVER claim to replace professional care.
4. NEVER invent numbers, dates, or facts not present in the context provided.
5. Describe PATTERNS, not CAUSES. Say "your data shows higher anxiety on days with less sleep — these tend to move together" — never "your anxiety is high BECAUSE you slept poorly."
6. If the user expresses self-harm, suicidal ideation, or severe distress, gently recommend they speak with a qualified professional, and offer crisis resources.

STYLE:
- Conversational and warm. Like texting a thoughtful friend who knows wellness science.
- Concise. Most replies should be 1-3 short paragraphs. Long replies are tiring.
- No headings or bullet lists unless the user asks for steps.
- No emojis unless the user uses them first.
- Cite sources by name when you draw from the knowledge base (e.g., "According to the NHS, ...").

ACTIONS — if the user wants to navigate somewhere or do something in the app, end your reply with a single line on its own:
[ACTION: navigate=/path]   (e.g., [ACTION: navigate=/import-data], [ACTION: navigate=/mental])
or
[ACTION: open_quiz]
or
[ACTION: none]
The action line will be parsed out and shown as a clickable button. Only include an action when it's genuinely useful — for general wellness questions or data discussions, leave it as none.`;

function buildComposePrompt({ message, history, intent, context, userState, currentPage }) {
    const parts = [SYSTEM_VOICE];

    if (currentPage) {
        parts.push(`\nCURRENT PAGE: ${currentPage}`);
    }

    parts.push(`\nUSER STATE:`);
    parts.push(`- Has imported health data: ${userState.hasData ? `yes (${userState.dataPoints} records)` : 'no'}`);
    parts.push(`- Has taken DASS-21 quiz: ${userState.hasQuiz ? 'yes' : 'no'}`);
    if (userState.quizSeverity) {
        parts.push(`- Latest quiz severities: depression=${userState.quizSeverity.depression}, anxiety=${userState.quizSeverity.anxiety}, stress=${userState.quizSeverity.stress}`);
    }

    if (context.appDocs?.length) {
        parts.push(`\nRELEVANT APP DOCUMENTATION (use these to answer accurately about MoodLens features):`);
        context.appDocs.forEach((c, i) => {
            parts.push(`[App-Doc ${i + 1}] ${c.title}\n${c.content}`);
        });
    }

    if (context.wellnessKB?.length) {
        parts.push(`\nRELEVANT WELLNESS REFERENCES (cite these by source name when you use them):`);
        context.wellnessKB.forEach((c, i) => {
            parts.push(`[KB ${i + 1}] ${c.title} — source: ${c.source}\n${c.content}`);
        });
    }

    if (context.userData) {
        parts.push(`\nUSER'S RECENT DATA (use these specific numbers, do not invent):`);
        parts.push(JSON.stringify(context.userData, null, 2));
    }

    if (context.analysis) {
        const a = context.analysis;
        parts.push(`\nUSER'S CURRENT WELLNESS SNAPSHOT:`);
        parts.push(`- Wellness score: ${a.wellness?.score}/100 (${a.wellness?.category})`);
        parts.push(`- Recovery score: ${a.recovery?.score}/100 (${a.recovery?.category})`);
        if (a.wellness?.topDrivers?.length) {
            parts.push(`- Top drivers (SHAP): ${a.wellness.topDrivers.slice(0, 3).map(d => `${d.display_name} (${d.contribution > 0 ? '+' : ''}${d.contribution} pts)`).join(', ')}`);
        }
    }

    if (history?.length) {
        parts.push(`\nRECENT CONVERSATION:`);
        history.slice(-6).forEach(m => {
            parts.push(`${m.role === 'user' ? 'User' : 'Coach'}: ${m.text}`);
        });
    }

    parts.push(`\nUser's latest message: "${message}"`);
    parts.push(`\nIntent classification: ${intent}`);
    parts.push(`\nWrite your reply now. Remember the absolute rules.`);

    return parts.join('\n');
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Compose call with retry-on-429.
 * Tries 3 times total: immediate, +1s, +4s.
 * Throws if all 3 fail.
 */
async function compose(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 1500,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
    };

    const DELAYS = [0, 1000, 4000];

    let lastErr;
    for (let attempt = 0; attempt < DELAYS.length; attempt++) {
        if (DELAYS[attempt] > 0) {
            console.log(`⏳ [Compose] Retry ${attempt} after ${DELAYS[attempt]}ms`);
            await sleep(DELAYS[attempt]);
        }

        try {
            const res = await axios.post(`${COMPOSE_URL}?key=${apiKey}`, body, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 25000,
            });

            const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                const block = res.data?.promptFeedback?.blockReason;
                throw new Error(`Compose returned no text. Block reason: ${block || 'unknown'}`);
            }
            return text.trim();
        } catch (err) {
            lastErr = err;
            const status = err.response?.status;
            if (status === 429 && attempt < DELAYS.length - 1) {
                // Retry on 429
                continue;
            }
            // Anything else, or final 429 — give up
            throw err;
        }
    }
    throw lastErr;
}

// ──────────────────────────────────────────────────────
// 4. Action extraction
// ──────────────────────────────────────────────────────

function extractAction(text) {
    const m = text.match(/\[ACTION:\s*([^\]]+)\]/i);
    if (!m) return { reply: text, action: null };

    const raw = m[1].trim();
    const reply = text.replace(m[0], '').trim();

    if (raw.toLowerCase() === 'none') return { reply, action: null };

    if (raw.toLowerCase().startsWith('navigate=')) {
        return { reply, action: { type: 'navigate', target: raw.slice('navigate='.length).trim() } };
    }
    if (raw.toLowerCase() === 'open_quiz') {
        return { reply, action: { type: 'navigate', target: '/mental', meta: 'open_quiz' } };
    }
    return { reply, action: null };
}

// ──────────────────────────────────────────────────────
// 5. Main entrypoint
// ──────────────────────────────────────────────────────

export async function runChat({ userId, message, history = [], currentPage = null, req }) {
    if (detectCrisis(message)) {
        return {
            reply: CRISIS_REPLY,
            citations: [],
            action: null,
            intent: 'crisis',
            debug: { crisis: true },
        };
    }

    const intent = await classifyIntent(message);

    const userState = await getUserState(userId);
    const context = {};

    if (intent === 'app_navigation' || intent === 'small_talk') {
        context.appDocs = await retrieve('appDocs', message, { k: 3, minScore: 0.55 });
    } else if (intent === 'wellness_qa') {
        context.wellnessKB = await retrieve('wellnessKB', message, { k: 3, minScore: 0.55 });
        context.appDocs    = await retrieve('appDocs',    message, { k: 1, minScore: 0.6 });
    } else if (intent === 'data_query') {
        context.userData = await getRecentHealthData(userId);
        context.analysis = await getUserAnalysis(req);
        context.appDocs  = await retrieve('appDocs', message, { k: 2, minScore: 0.55 });
    } else {
        context.appDocs = await retrieve('appDocs', 'what can MoodLens do', { k: 2, minScore: 0.5 });
    }

    const prompt = buildComposePrompt({ message, history, intent, context, userState, currentPage });
    const rawReply = await compose(prompt);

    const { reply, action } = extractAction(rawReply);

    const citations = (context.wellnessKB || []).map(c => ({
        title: c.title,
        source: c.source,
        url: c.source_url,
    }));

    return {
        reply,
        citations,
        action,
        intent,
        debug: {
            appDocsRetrieved:    (context.appDocs    || []).map(c => ({ id: c.id, score: +c.score.toFixed(3) })),
            wellnessKBRetrieved: (context.wellnessKB || []).map(c => ({ id: c.id, score: +c.score.toFixed(3) })),
            hasUserData:         !!context.userData,
            hasAnalysis:         !!context.analysis,
        },
    };
}
