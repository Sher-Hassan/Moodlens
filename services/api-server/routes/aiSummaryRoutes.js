/**
 * AI Summary Routes
 * =================
 * Endpoints:
 *   GET  /api/ai/summary/physical    — wellness coach summary for Physical tab
 *   GET  /api/ai/summary/mental      — wellness coach summary for Mental tab
 *   POST /api/ai/summary/invalidate  — manually bust the cache (e.g., after fresh quiz)
 *
 * Mount in your services/api-server/index.js with:
 *   import aiSummaryRoutes from './routes/aiSummaryRoutes.js';
 *   app.use('/api/ai/summary', aiSummaryRoutes);
 */

import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import { protect } from '../middleware/auth.js';
import HealthRecord from '../models/HealthRecord.js';
import Assessment from '../models/Assessment.js';
import {
    getPhysicalSummary,
    getMentalSummary,
    invalidateUserSummaries,
} from '../services/aiSummaryService.js';

const router = express.Router();

const INFERENCE_URL = process.env.INFERENCE_URL || 'http://localhost:8000';

// ─── Shared: aggregate daily health data ──────────────────────
async function getDailyHealthData(userId, daysBack = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    return await HealthRecord.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), startDate: { $gte: startDate } } },
        {
            $addFields: {
                sleepHours: {
                    $cond: [
                        { $eq: ["$type", "HKCategoryTypeIdentifierSleepAnalysis"] },
                        { $divide: [{ $subtract: ["$endDate", "$startDate"] }, 1000 * 60 * 60] },
                        0,
                    ],
                },
                dateString: { $dateToString: { format: "%Y-%m-%d", date: "$startDate" } },
            },
        },
        {
            $group: {
                _id: { date: "$dateString", type: "$type" },
                totalValue: { $sum: "$value" },
                totalSleepHours: { $sum: "$sleepHours" },
            },
        },
        {
            $group: {
                _id: "$_id.date",
                steps: { $sum: { $cond: [{ $eq: ["$_id.type", "HKQuantityTypeIdentifierStepCount"] }, "$totalValue", 0] } },
                active_energy: { $sum: { $cond: [{ $eq: ["$_id.type", "HKQuantityTypeIdentifierActiveEnergyBurned"] }, "$totalValue", 0] } },
                sleep_hours: { $sum: "$totalSleepHours" },
            },
        },
        {
            $project: {
                _id: 0,
                date: "$_id",
                steps: { $round: ["$steps", 0] },
                active_energy: { $round: ["$active_energy", 1] },
                sleep_hours: { $round: ["$sleep_hours", 2] },
            },
        },
        { $sort: { date: 1 } },
    ]);
}

// Simple composite balance computed the same way the frontend does
function computeBalance(daily) {
    if (!daily.length) return null;
    const latest = daily[daily.length - 1];
    const bandScore = (value, low, ideal, high) => {
        if (value <= 0) return 0;
        if (value >= low && value <= high) {
            const center = ideal;
            const dist = Math.abs(value - center);
            const half = Math.max(center - low, high - center);
            return Math.round(100 * (1 - dist / half));
        }
        if (value < low) return Math.max(0, Math.round((value / low) * 60));
        return Math.max(0, Math.round(60 - ((value - high) / high) * 60));
    };
    const stepScore   = bandScore(latest.steps, 4000, 9000, 16000);
    const sleepScore  = bandScore(latest.sleep_hours, 6, 7.75, 9.5);
    const energyScore = bandScore(latest.active_energy, 200, 500, 900);
    const composite   = Math.round((stepScore + sleepScore + energyScore) / 3);

    let label;
    if (composite >= 80) label = 'Excellent';
    else if (composite >= 65) label = 'Good';
    else if (composite >= 45) label = 'Moderate';
    else label = 'Needs attention';

    return { composite, classification: { label } };
}

// ─── GET /api/ai/summary/physical ─────────────────────────────
router.get('/physical', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const daily = await getDailyHealthData(userId, 30);

        if (!daily.length) {
            return res.status(200).json({
                error: 'NO_DATA',
                message: 'Upload some health data and your AI coach will write you a summary.',
            });
        }

        const summary = computeBalance(daily);

        const result = await getPhysicalSummary(userId.toString(), {
            daily,
            summary,
            recoveryAvg: null,
        });

        console.log(`✅ [AI Summary] Physical for ${userId} — cached: ${result.cached}`);
        res.json(result);
    } catch (err) {
        console.error('❌ [AI Summary] Physical failed:', err.message);
        res.status(500).json({
            error: 'SUMMARY_FAILED',
            message: 'Could not generate summary right now. Please try again.',
            detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    }
});

// ─── GET /api/ai/summary/mental ───────────────────────────────
router.get('/mental', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        const assessment = await Assessment.findOne({ userId }).sort({ createdAt: -1 });
        if (!assessment) {
            return res.status(200).json({
                error: 'NO_ASSESSMENT',
                message: 'Take the wellness quiz first and your AI coach will write you a summary.',
            });
        }

        // Pull the same AI analysis the Mental page sees
        let aiAnalysis = null;
        try {
            const token = req.headers.authorization;
            const aiRes = await axios.get(
                `${req.protocol}://${req.get('host')}/api/ai/mental-wellness`,
                { headers: { Authorization: token }, timeout: 8000 }
            );
            aiAnalysis = aiRes.data;
        } catch (e) {
            console.warn('[AI Summary] Could not fetch /api/ai/mental-wellness:', e.message);
        }

        const result = await getMentalSummary(userId.toString(), {
            assessment,
            ai: aiAnalysis,
        });

        console.log(`✅ [AI Summary] Mental for ${userId} — cached: ${result.cached}`);
        res.json(result);
    } catch (err) {
        console.error('❌ [AI Summary] Mental failed:', err.message);
        res.status(500).json({
            error: 'SUMMARY_FAILED',
            message: 'Could not generate summary right now. Please try again.',
            detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    }
});

// ─── POST /api/ai/summary/invalidate ──────────────────────────
// Call this from your quiz-submission handler so a fresh summary is generated
// next time the user views the Mental tab.
router.post('/invalidate', protect, (req, res) => {
    invalidateUserSummaries(req.user._id.toString());
    res.json({ ok: true });
});

export default router;
