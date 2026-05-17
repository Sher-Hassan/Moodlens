/**
 * chatbotRetrieval.js — with query-embedding cache
 * =================================================
 * Flat-file RAG. Loads embedded corpora at startup, does cosine similarity in-memory.
 *
 * NEW: caches query embeddings in-memory for 1 hour. Repeated/identical queries
 * skip the embedding API call. Saves ~1 call per turn when users ask similar things.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;

// ── Load corpora at module load ──────────────────────
const CORPUS_DIR = path.join(__dirname, '..', 'chatbot-corpus');

function loadCorpus(filename) {
    const fullPath = path.join(CORPUS_DIR, filename);
    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️  [Retrieval] ${filename} not found — did you run buildEmbeddings.js?`);
        return [];
    }
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    const valid = data.filter(c => Array.isArray(c.embedding) && c.embedding.length > 0);
    if (valid.length !== data.length) {
        console.warn(`⚠️  [Retrieval] ${data.length - valid.length} chunks in ${filename} have no embedding`);
    }
    console.log(`📚 [Retrieval] Loaded ${valid.length} chunks from ${filename}`);
    return valid;
}

const appDocs    = loadCorpus('appDocs_embedded.json');
const wellnessKB = loadCorpus('wellnessKB_embedded.json');

// ── Query embedding cache ────────────────────────────
// Simple Map-based LRU. Each entry: { vector, expiresAt }.
// Cache key is the normalized query (lowercased + trimmed).

const QUERY_CACHE_TTL_MS = 60 * 60 * 1000;  // 1 hour
const QUERY_CACHE_MAX = 200;                 // ~200 distinct queries kept in memory
const queryCache = new Map();

function normalizeQuery(q) {
    return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

function cacheGet(key) {
    const entry = queryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        queryCache.delete(key);
        return null;
    }
    // Touch to mark recently used (move to end of insertion order)
    queryCache.delete(key);
    queryCache.set(key, entry);
    return entry.vector;
}

function cacheSet(key, vector) {
    if (queryCache.size >= QUERY_CACHE_MAX) {
        // Evict oldest (first inserted)
        const oldestKey = queryCache.keys().next().value;
        queryCache.delete(oldestKey);
    }
    queryCache.set(key, {
        vector,
        expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
    });
}

// ── Math helpers ─────────────────────────────────────

function cosineSim(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot  += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-9);
}

// ── Query embedding (cached + retried) ───────────────

async function embedQuery(text) {
    const cacheKey = normalizeQuery(text);
    const cached = cacheGet(cacheKey);
    if (cached) {
        console.log(`💾 [Retrieval] cache HIT for query`);
        return cached;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const body = {
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
    };

    const res = await axios.post(`${EMBED_URL}?key=${apiKey}`, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
    });

    const vector = res.data.embedding.values;
    cacheSet(cacheKey, vector);
    return vector;
}

// ── Public API ───────────────────────────────────────

export async function retrieve(corpus, query, opts = {}) {
    const { k = 3, minScore = 0.55 } = opts;

    const queryVec = await embedQuery(query);

    const pool =
        corpus === 'appDocs'    ? appDocs :
        corpus === 'wellnessKB' ? wellnessKB :
        [...appDocs, ...wellnessKB];

    const scored = pool.map(chunk => ({
        ...chunk,
        score: cosineSim(queryVec, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.filter(c => c.score >= minScore).slice(0, k);
}

export function _stats() {
    return {
        appDocs:    appDocs.length,
        wellnessKB: wellnessKB.length,
        vectorDim:  appDocs[0]?.embedding?.length || wellnessKB[0]?.embedding?.length || 0,
        cacheSize:  queryCache.size,
    };
}
