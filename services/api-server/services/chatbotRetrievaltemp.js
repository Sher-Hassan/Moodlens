/**
 * chatbotRetrieval.js
 * ====================
 * Flat-file RAG. Loads embedded corpora into memory once at startup,
 * then does cosine similarity in a for-loop on every query.
 *
 * Why this is fine: we have ~25 chunks total. Cosine sim of a 768-dim vector
 * against 25 vectors takes <1ms. No vector DB needed.
 *
 * If the corpus grows past a few thousand chunks, swap to pgvector / Chroma.
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
    // Validate
    const valid = data.filter(c => Array.isArray(c.embedding) && c.embedding.length > 0);
    if (valid.length !== data.length) {
        console.warn(`⚠️  [Retrieval] ${data.length - valid.length} chunks in ${filename} have no embedding`);
    }
    console.log(`📚 [Retrieval] Loaded ${valid.length} chunks from ${filename}`);
    return valid;
}

const appDocs    = loadCorpus('appDocs_embedded.json');
const wellnessKB = loadCorpus('wellnessKB_embedded.json');

// ── Math helpers ─────────────────────────────────────

/** Standard cosine similarity between two vectors. */
function cosineSim(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot  += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-9);
}

// ── Query embedding (called fresh each time) ─────────

async function embedQuery(text) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const body = {
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',  // optimized for short queries (different from RETRIEVAL_DOCUMENT)
    };

    const res = await axios.post(`${EMBED_URL}?key=${apiKey}`, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
    });

    return res.data.embedding.values;
}

// ── Public API ───────────────────────────────────────

/**
 * Retrieve top-k chunks from a corpus, ranked by similarity to the query.
 * Returns an array of { ...chunk, score } sorted descending.
 *
 * @param {'appDocs' | 'wellnessKB' | 'both'} corpus
 * @param {string} query
 * @param {object} opts — { k = 3, minScore = 0.55 }
 */
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

    // Apply min-score floor — better to retrieve nothing than to retrieve
    // a clearly unrelated chunk that will mislead the LLM.
    const filtered = scored.filter(c => c.score >= minScore).slice(0, k);

    return filtered;
}

/**
 * Diagnostic — print top-k for a query without making network calls.
 * Useful for testing the retrieval quality manually.
 */
export function _stats() {
    return {
        appDocs:    appDocs.length,
        wellnessKB: wellnessKB.length,
        vectorDim:  appDocs[0]?.embedding?.length || wellnessKB[0]?.embedding?.length || 0,
    };
}
