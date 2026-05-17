import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import HealthRecord from '../models/HealthRecord.js';
import Assessment from '../models/Assessment.js';
import wellnessCalculator from '../services/wellnessCalculator.js';

const router = express.Router();

/**
 * Aggregate raw HealthRecord documents into daily totals.
 * (Unchanged from previous phases.)
 */
async function getDailyHealthData(userId, daysBack = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const dailyData = await HealthRecord.aggregate([
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
                steps:  { $sum: { $cond: [{ $eq: ["$_id.type", "HKQuantityTypeIdentifierStepCount"] }, "$totalValue", 0] } },
                active_energy: { $sum: { $cond: [{ $eq: ["$_id.type", "HKQuantityTypeIdentifierActiveEnergyBurned"] }, "$totalValue", 0] } },
                sleep_hours: { $sum: "$totalSleepHours" },
                heart_rate: { $avg: { $cond: [{ $eq: ["$_id.type", "HKQuantityTypeIdentifierRestingHeartRate"] }, "$totalValue", null] } },
            },
        },
        {
            $project: {
                _id: 0,
                date: "$_id",
                steps: { $round: ["$steps", 0] },
                active_energy: { $round: ["$active_energy", 1] },
                sleep_hours: { $round: ["$sleep_hours", 2] },
                heart_rate_avg: { $round: ["$heart_rate", 0] },
            },
        },
        { $sort: { date: 1 } },
    ]);

    return dailyData;
}

/**
 * GET /api/ai/mental-wellness
 *
 * Now async because the hybrid wellnessCalculator may call the Python inference service.
 */
router.get('/mental-wellness', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        console.log(`\n🧠 [AI] Computing wellness for user: ${userId}`);

        const dailyData = await getDailyHealthData(userId, 30);
        console.log(`🧠 [AI] Daily aggregates: ${dailyData.length} days`);

        const assessment = await Assessment.findOne({ userId: userId }).sort({ createdAt: -1 });
        console.log(`🧠 [AI] Assessment found: ${!!assessment}`);

        if (assessment) {
            // Pass userId through to the calculator so the ML service can use per-user models
            assessment.userId = assessment.userId || userId;
        }

        // analyze() is now async — it may HTTP-call the Python inference service
        const result = await wellnessCalculator.analyze(dailyData, assessment);

        if (result.error) {
            console.log(`⚠️ [AI] Analysis blocked: ${result.error}`);
            return res.status(200).json(result);
        }

        console.log(`✅ [AI] Source: ${result.metadata.modelSource}, Wellness: ${result.wellness.score}, Recovery: ${result.recovery.score}`);
        if (result.anomaly) {
            console.log(`✅ [AI] Anomaly: ${result.anomaly.is_anomaly ? 'YES' : 'no'}`);
        }
        if (result.cluster) {
            console.log(`✅ [AI] Cluster: ${result.cluster.archetype_label}`);
        }
        res.json(result);

    } catch (error) {
        console.error('❌ [AI] Error:', error);
        console.error('❌ [AI] Stack:', error.stack);
        res.status(500).json({
            error: 'COMPUTATION_FAILED',
            message: 'Failed to compute wellness analysis',
        });
    }
});

/**
 * GET /api/ai/inference-health
 *
 * Optional: check whether the Python ML service is reachable.
 * Useful for the frontend to show "AI active" badge.
 */
router.get('/inference-health', protect, async (req, res) => {
    try {
        const axios = (await import('axios')).default;
        const inferenceUrl = process.env.INFERENCE_URL || 'http://localhost:8000';
        const response = await axios.get(`${inferenceUrl}/health`, { timeout: 2000 });
        res.json({ available: true, info: response.data });
    } catch (err) {
        res.json({ available: false, error: err.message });
    }
});

export default router;
