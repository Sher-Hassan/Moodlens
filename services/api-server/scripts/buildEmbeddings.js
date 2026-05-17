/**
 * buildEmbeddings.js
 * ==================
 * Reads both corpora, computes Gemini embeddings for every chunk, and writes
 * embedded versions next to the originals. Run this once after editing
 * either corpus file.
 *
 * Usage (from services/api-server/):
 *   node scripts/buildEmbeddings.js
 *
 * Requires GEMINI_API_KEY in your .env file.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import dotenv from 'dotenv';

// ── Load env ──────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY not set in .env');
    process.exit(1);
}

// ── Config ────────────────────────────────────────────
// text-embedding-004 is Gemini's current embedding model. Free tier: 1500 req/min.
const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;

const CORPUS_DIR = path.join(__dirname, '..', 'chatbot-corpus');

const SOURCES = [
    { in: 'appDocs.json',    out: 'appDocs_embedded.json',    label: 'app docs' },
    { in: 'wellnessKB.json', out: 'wellnessKB_embedded.json', label: 'wellness KB' },
];

// ── Helpers ──────────────────────────────────────────

/**
 * Build the text we actually embed. We concatenate title + content so the
 * vector reflects both — important because users often query by title-like phrases.
 */
function embedText(chunk) {
    const parts = [chunk.title, chunk.content].filter(Boolean);
    return parts.join('\n\n');
}

async function embed(text) {
    const body = {
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',  // optimized for documents that will be searched
    };

    const res = await axios.post(`${EMBED_URL}?key=${API_KEY}`, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
    });

    const vec = res.data?.embedding?.values;
    if (!Array.isArray(vec)) {
        throw new Error('Embedding response missing values array');
    }
    return vec;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ─────────────────────────────────────────────

(async () => {
    console.log('🧠 Building embeddings with Gemini text-embedding-004\n');

    for (const src of SOURCES) {
        const inPath  = path.join(CORPUS_DIR, src.in);
        const outPath = path.join(CORPUS_DIR, src.out);

        console.log(`📖 Reading ${src.label} from ${src.in}...`);
        const raw = await fs.readFile(inPath, 'utf-8');
        const chunks = JSON.parse(raw);
        console.log(`   ${chunks.length} chunks found`);

        const embedded = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const text = embedText(chunk);
            try {
                const vector = await embed(text);
                embedded.push({ ...chunk, embedding: vector });
                process.stdout.write(`   [${i + 1}/${chunks.length}] ${chunk.id} ✓\n`);
                // Be polite — even though free tier is 1500/min, no need to hammer.
                await sleep(100);
            } catch (err) {
                console.error(`   [${i + 1}/${chunks.length}] ${chunk.id} ✗ — ${err.message}`);
                throw err;
            }
        }

        await fs.writeFile(outPath, JSON.stringify(embedded, null, 2));
        console.log(`✅ Wrote ${src.out} (${embedded.length} chunks, ${embedded[0].embedding.length}-dim vectors)\n`);
    }

    console.log('🎉 Done. Restart your API server to pick up the new corpora.\n');
})().catch(err => {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
});
