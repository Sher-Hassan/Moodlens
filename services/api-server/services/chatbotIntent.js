/**
 * chatbotIntent.js — with keyword heuristic fast-path
 * ====================================================
 * Most messages have obvious intent ("hi", "how do I import", "improve my sleep").
 * We classify these with a regex pattern match — zero API calls.
 * Only ambiguous messages fall through to Gemini.
 *
 * Saves ~60% of intent-classification Gemini calls in normal usage.
 */

import axios from 'axios';

const MODEL = 'gemini-2.5-flash-lite';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are an intent classifier for the MoodLens health-tracking app. Given the user's message, output exactly ONE word from this list:

- app_navigation: User wants to navigate, do something in the app, or asks how to use a feature (import data, take quiz, find a setting, etc.)
- data_query: User asks about THEIR own data, scores, patterns, or wants personalized analysis (their wellness score, their sleep average, why their anxiety is high, etc.)
- wellness_qa: User asks a general wellness/mental-health question NOT about their personal data (what is anxiety, how to sleep better in general, what is CBT, etc.)
- small_talk: Greetings, thanks, who-are-you, capability questions
- out_of_scope: Anything unrelated to health, wellness, or this app (weather, jokes, coding help, etc.)

Output ONLY the intent label. No explanation, no punctuation.`;

const VALID_INTENTS = new Set([
    'app_navigation',
    'data_query',
    'wellness_qa',
    'small_talk',
    'out_of_scope',
]);

// ──────────────────────────────────────────────────────
// Fast-path: keyword heuristic
// ──────────────────────────────────────────────────────
// Returns one of VALID_INTENTS if confidence is high, or null to fall through.

const PATTERNS = {
    small_talk: [
        /^(hi|hey|hello|yo|sup|hiya)[!.?\s]*$/i,
        /^(thanks?|thank\s+you|ty|thx)[!.?\s]*$/i,
        /^(bye|goodbye|see\s+ya|cya)[!.?\s]*$/i,
        /^(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|what\s+do\s+you\s+do)\??$/i,
        /^(how\s+(are|r)\s+you|what'?s\s+up)\??$/i,
    ],
    app_navigation: [
        /\b(import|upload|export)\b.*\b(data|health|apple|file)\b/i,
        /\b(take|bring|send|navigate|go)\s+(me\s+)?(to|the)\b/i,
        /\b(how\s+(do|can)\s+i|how\s+to)\b.*\b(import|upload|set\s*up|install|find|access|retake|take|view|see|use)\b/i,
        /\b(open|show|view)\s+(the\s+)?(quiz|settings|dashboard|mental|physical|meditate)\b/i,
        /\b(shortcut|setup|set\s*up)\b/i,
    ],
    data_query: [
        /\b(my|i'?ve|i\s+have)\s+(score|sleep|step|wellness|anxiety|depression|stress|recovery)/i,
        /\b(what'?s|whats)\s+my\b/i,
        /\b(why\s+(is\s+)?my|why\s+(am\s+)?i\b)/i,
        /\b(this\s+week|last\s+week|recent|recently|today|yesterday)\b.*\b(my|i)\b/i,
        /\b(how'?m\s+i|how\s+am\s+i)\s+doing\b/i,
        /\b(what\s+do\s+you\s+think\s+about\s+(my|me))\b/i,
        /\b(my)\s+(health|data|patterns|trends|results)\b/i,
    ],
    wellness_qa: [
        /\b(how\s+(do|can|to)|what'?s\s+a\s+good\s+way)\s+(i\s+|to\s+)?(sleep|relax|reduce|manage|cope|deal)\b/i,
        /\b(what\s+is|what'?s|tell\s+me\s+about)\s+(anxiety|depression|stress|burnout|cbt|sleep\s+hygiene|meditation)\b/i,
        /\b(in\s+general|generally)\b/i,
        /\b(tips\s+for|advice\s+(on|for))\b/i,
    ],
};

function heuristicClassify(message) {
    const text = message.trim();
    if (text.length < 2) return null;

    // Very short messages → small_talk
    if (text.length < 12 && /^(hi|hey|hello|ok|yes|no|sure|thanks?)[!?.\s]*$/i.test(text)) {
        return 'small_talk';
    }

    // Check each intent's patterns
    for (const [intent, patterns] of Object.entries(PATTERNS)) {
        if (patterns.some(p => p.test(text))) {
            return intent;
        }
    }

    return null;  // Ambiguous — fall through to Gemini
}

// ──────────────────────────────────────────────────────
// Slow-path: Gemini classification
// ──────────────────────────────────────────────────────

async function geminiClassify(message) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const body = {
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nUser message: "${message}"\n\nIntent:` }] }],
        generationConfig: {
            temperature: 0,
            maxOutputTokens: 256,
            topP: 1,
            topK: 1,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
    };

    const res = await axios.post(`${URL}?key=${apiKey}`, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
    });

    const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = raw.trim().toLowerCase().replace(/[^a-z_]/g, '');

    if (VALID_INTENTS.has(cleaned)) {
        return cleaned;
    }
    console.warn(`[Intent] Gemini returned unexpected: "${raw}" — defaulting to wellness_qa`);
    return 'wellness_qa';
}

// ──────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────

export async function classifyIntent(message) {
    // 1. Try keyword heuristic (free, instant)
    const fast = heuristicClassify(message);
    if (fast) {
        console.log(`🎯 [Intent] fast-path → ${fast}`);
        return fast;
    }

    // 2. Fall back to Gemini for ambiguous cases
    try {
        const result = await geminiClassify(message);
        console.log(`🎯 [Intent] gemini → ${result}`);
        return result;
    } catch (err) {
        console.error('[Intent] Gemini classification failed:', err.message);
        // Fail open — assume wellness_qa.
        return 'wellness_qa';
    }
}
