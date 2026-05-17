/**
 * chatbotRoutes.js
 * =================
 * POST /api/chat — main chat endpoint
 * GET  /api/chat/welcome — first-visit welcome state
 *
 * Mount with: app.use('/api/chat', chatbotRoutes);
 */

import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import HealthRecord from '../models/HealthRecord.js';
import Assessment from '../models/Assessment.js';
import { runChat } from '../services/chatbotOrchestrator.js';

const router = express.Router();

// ── Rate limiting (per-user, in-memory, sliding window) ──
const RATE_WINDOW_MS = 60 * 60 * 1000;  // 1 hour
const RATE_LIMIT = 20;                  // messages per window

const rateBuckets = new Map(); // userId → array of timestamps

function checkRateLimit(userId) {
    const now = Date.now();
    const bucket = (rateBuckets.get(userId) || []).filter(t => now - t < RATE_WINDOW_MS);
    if (bucket.length >= RATE_LIMIT) {
        const oldest = Math.min(...bucket);
        const resetIn = Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000 / 60);
        return { allowed: false, resetInMinutes: resetIn };
    }
    bucket.push(now);
    rateBuckets.set(userId, bucket);
    return { allowed: true, remaining: RATE_LIMIT - bucket.length };
}

// ──────────────────────────────────────────────────────
// POST /api/chat
// Body: { message, history?, currentPage? }
// ──────────────────────────────────────────────────────

router.post('/', protect, async (req, res) => {
    const userId = req.user._id.toString();
    const { message, history = [], currentPage = null } = req.body;

    // Validation
    if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Message is required.' });
    }
    if (message.length > 1000) {
        return res.status(400).json({ error: 'MESSAGE_TOO_LONG', message: 'Please keep messages under 1000 characters.' });
    }
    if (!Array.isArray(history)) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'History must be an array.' });
    }

    // Rate limit
    const rate = checkRateLimit(userId);
    if (!rate.allowed) {
        return res.status(429).json({
            error: 'RATE_LIMITED',
            message: `You've reached the limit of ${RATE_LIMIT} messages per hour. Please try again in ${rate.resetInMinutes} minute(s).`,
        });
    }

    // Run the chat
    try {
        const result = await runChat({
            userId,
            message: message.trim(),
            history: history.slice(-10),  // keep recent only — orchestrator also slices
            currentPage,
            req,
        });

        console.log(`💬 [Chat] user=${userId.slice(-6)} intent=${result.intent} action=${result.action?.type || 'none'}`);

        res.json({
            reply: result.reply,
            citations: result.citations,
            action: result.action,
            intent: result.intent,
            rateLimitRemaining: rate.remaining,
            // Only expose debug info in dev
            ...(process.env.NODE_ENV !== 'production' ? { debug: result.debug } : {}),
        });
    } catch (err) {
        const status = err.response?.status;
        const isRateLimit = status === 429;
        const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');

        console.error(`❌ [Chat] Failed (${status || 'no-status'}):`, err.message);
        if (err.response?.data) {
            console.error('   Response body:', JSON.stringify(err.response.data).slice(0, 500));
        }

        let userMessage;
        if (isRateLimit) {
            userMessage = "I'm getting a lot of requests right now — please wait about a minute and try again.";
        } else if (isTimeout) {
            userMessage = "That took longer than expected. Could you try once more?";
        } else {
            userMessage = "I had trouble responding just now. Please try again in a moment.";
        }

        res.status(isRateLimit ? 429 : 500).json({
            error: isRateLimit ? 'UPSTREAM_RATE_LIMITED' : 'CHAT_FAILED',
            message: userMessage,
            ...(process.env.NODE_ENV !== 'production' ? { detail: err.message } : {}),
        });
    }
});

// ──────────────────────────────────────────────────────
// GET /api/chat/welcome
// Returns the first-visit greeting + onboarding-aware suggestions.
// Frontend calls this once per session to decide whether to show the welcome bubble.
// ──────────────────────────────────────────────────────

router.get('/welcome', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const [healthCount, assessment] = await Promise.all([
            HealthRecord.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
            Assessment.findOne({ userId }).sort({ createdAt: -1 }),
        ]);

        const hasData = healthCount > 0;
        const hasQuiz = !!assessment;

        let greeting, suggestions;

        if (!hasData && !hasQuiz) {
            greeting = "Hey! I'm your AI Coach. Quick question to get you started — have you imported your health data yet?";
            suggestions = [
                { label: "How do I import data?", message: "How do I import my Apple Health data?" },
                { label: "Take me to the quiz", message: "I'd like to take the DASS-21 quiz" },
            ];
        } else if (hasData && !hasQuiz) {
            greeting = "Welcome back! Your health data is in — to unlock the Mental tab and AI insights, take the 3-minute DASS-21 quiz when you're ready.";
            suggestions = [
                { label: "What's the DASS-21?", message: "What does the DASS-21 quiz measure?" },
                { label: "Take me to the quiz", message: "I'd like to take the DASS-21 quiz" },
            ];
        } else if (!hasData && hasQuiz) {
            greeting = "Welcome! You've taken the quiz — now let's get your health data flowing so the AI can give you personalized insights.";
            suggestions = [
                { label: "How do I import data?", message: "How do I import my Apple Health data?" },
                { label: "What do my scores mean?", message: "What do my DASS-21 scores mean?" },
            ];
        } else {
            greeting = "Hey! I'm your AI Coach. Ask me anything about your data, the app, or general wellness.";
            suggestions = [
                { label: "What's driving my score?", message: "What's driving my wellness score this week?" },
                { label: "How can I sleep better?", message: "How can I improve my sleep?" },
            ];
        }

        res.json({ greeting, suggestions, userState: { hasData, hasQuiz } });
    } catch (err) {
        console.error('[Chat welcome] Failed:', err.message);
        res.status(500).json({ error: 'WELCOME_FAILED' });
    }
});

export default router;
