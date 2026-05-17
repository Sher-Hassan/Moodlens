/**
 * chatbotIntent.js
 * ================
 * Classifies the user's message into one of five intents. The orchestrator
 * uses the intent to decide what context to gather before composing a reply.
 *
 * Intents:
 *   - app_navigation:  "How do I import data?" / "Take me to the quiz"
 *   - data_query:      "What's my best sleep this month?" / "Why is my anxiety high?"
 *   - wellness_qa:     "How can I sleep better?" / "What is anxiety?"
 *   - small_talk:      "Hi" / "Thanks" / "Who are you?"
 *   - out_of_scope:    "What's the weather?" / "Tell me a joke"
 *
 * We use Gemini 2.5 Flash-Lite for this — it's the fastest free-tier model
 * (15 RPM, 1000/day) and the task is simple enough that we don't need 2.5 Flash.
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

/**
 * @param {string} message — the user's latest message
 * @returns {Promise<string>} one of VALID_INTENTS; defaults to 'wellness_qa' on failure
 */
export async function classifyIntent(message) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const body = {
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nUser message: "${message}"\n\nIntent:` }] }],
        generationConfig: {
            temperature: 0,         // deterministic
            maxOutputTokens: 256,   // headroom for any thinking tokens
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

    try {
        const res = await axios.post(`${URL}?key=${apiKey}`, body, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 8000,
        });

        const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = raw.trim().toLowerCase().replace(/[^a-z_]/g, '');

        if (VALID_INTENTS.has(cleaned)) {
            return cleaned;
        }

        console.warn(`[Intent] Unexpected output: "${raw}" — defaulting to wellness_qa`);
        return 'wellness_qa';
    } catch (err) {
        console.error('[Intent] Classification failed:', err.message);
        // Fail open — assume wellness_qa so user still gets a useful response.
        return 'wellness_qa';
    }
}
