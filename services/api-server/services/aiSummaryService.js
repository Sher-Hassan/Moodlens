/**
 * AI Summary Service
 * ==================
 * Calls Gemini 2.0 Flash to generate wellness-coach summaries.
 * Caches per-user-per-type for 6 hours.
 *
 * Env vars required:
 *   GEMINI_API_KEY     — your Google AI Studio key
 *   GEMINI_MODEL       — defaults to 'gemini-2.0-flash' if unset
 */

import axios from 'axios';
import { buildPhysicalPrompt, buildMentalPrompt } from './aiSummaryPrompts.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ─── In-memory cache ────────────────────────────────────────
// Key format: `${userId}:${type}` → { content, createdAt, modelUsed }
const cache = new Map();

function cacheKey(userId, type) {
    return `${userId}:${type}`;
}

function getCached(userId, type) {
    const entry = cache.get(cacheKey(userId, type));
    if (!entry) return null;
    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
        cache.delete(cacheKey(userId, type));
        return null;
    }
    return entry;
}

function setCached(userId, type, content) {
    cache.set(cacheKey(userId, type), {
        content,
        createdAt: Date.now(),
        modelUsed: MODEL,
    });
}

/** Invalidate cache for a user (e.g., after fresh quiz submission). */
export function invalidateUserSummaries(userId) {
    cache.delete(cacheKey(userId, 'physical'));
    cache.delete(cacheKey(userId, 'mental'));
}

// ─── Gemini API call ────────────────────────────────────────
async function callGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not set in environment');
    }

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 6048,   // generous headroom for thinking + 300-word output
            stopSequences: [],
        },
        // Loose safety settings — we have our own guardrails in the prompt.
        // Gemini's safety filters can over-trigger on legitimate wellness content
        // (e.g. anything mentioning anxiety or depression).
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
    };

    let response;
    try {
        response = await axios.post(
            `${GEMINI_URL}?key=${apiKey}`,
            requestBody,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 20000,
            }
        );
        // TEMP LOG: Log the raw Gemini response
        console.log('🟢 [Gemini raw response]:', JSON.stringify(response.data));
    } catch (err) {
        console.error('🔴 [Gemini raw error]:', err.response?.status, JSON.stringify(err.response?.data));
        throw err;
    }

    const candidates = response.data?.candidates;
    if (!candidates || candidates.length === 0) {
        // Could be a safety block — surface what we got
        const promptFeedback = response.data?.promptFeedback;
        throw new Error(
            `Gemini returned no candidates. Block reason: ${promptFeedback?.blockReason ?? 'unknown'}`
        );
    }

    const content = candidates[0]?.content?.parts?.[0]?.text;
    if (!content) {
        throw new Error('Gemini response had no text content');
    }

    return content.trim();
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate or fetch from cache a Physical summary.
 * @param {string} userId
 * @param {object} data — { daily, summary, recoveryAvg }
 */
export async function getPhysicalSummary(userId, data) {
    const cached = getCached(userId, 'physical');
    if (cached) {
        return { content: cached.content, cached: true, generatedAt: new Date(cached.createdAt).toISOString() };
    }

    const prompt = buildPhysicalPrompt(data);
    const content = await callGemini(prompt);
    setCached(userId, 'physical', content);

    return { content, cached: false, generatedAt: new Date().toISOString() };
}

/**
 * Generate or fetch from cache a Mental summary.
 * @param {string} userId
 * @param {object} data — { assessment, ai }
 */
export async function getMentalSummary(userId, data) {
    const cached = getCached(userId, 'mental');
    if (cached) {
        return { content: cached.content, cached: true, generatedAt: new Date(cached.createdAt).toISOString() };
    }

    const prompt = buildMentalPrompt(data);
    const content = await callGemini(prompt);
    setCached(userId, 'mental', content);

    return { content, cached: false, generatedAt: new Date().toISOString() };
}
