import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import HealthRecord from '../models/HealthRecord.js';
import Assessment from '../models/Assessment.js';
import wellnessCalculator from '../services/wellnessCalculator.js';

const router = express.Router();

/**
 * Aggregate raw HealthRecord documents into daily totals
 */
async function getDailyHealthData(userId, daysBack = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const dailyData = await HealthRecord.aggregate([
        // Filter by user and date range
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                startDate: { $gte: startDate }
            }
        },
        // Calculate sleep duration in hours for sleep records
        {
            $addFields: {
                sleepHours: {
                    $cond: [
                        { $eq: ["$type", "HKCategoryTypeIdentifierSleepAnalysis"] },
                        { 
                            $divide: [
                                { $subtract: ["$endDate", "$startDate"] }, 
                                1000 * 60 * 60  // ms → hours
                            ] 
                        },
                        0
                    ]
                },
                dateString: {
                    $dateToString: { format: "%Y-%m-%d", date: "$startDate" }
                }
            }
        },
        // Group by date and type
        {
            $group: {
                _id: {
                    date: "$dateString",
                    type: "$type"
                },
                totalValue: { $sum: "$value" },
                totalSleepHours: { $sum: "$sleepHours" }
            }
        },
        // Pivot: collapse types into one document per day
        {
            $group: {
                _id: "$_id.date",
                steps: {
                    $sum: {
                        $cond: [
                            { $eq: ["$_id.type", "HKQuantityTypeIdentifierStepCount"] },
                            "$totalValue",
                            0
                        ]
                    }
                },
                active_energy: {
                    $sum: {
                        $cond: [
                            { $eq: ["$_id.type", "HKQuantityTypeIdentifierActiveEnergyBurned"] },
                            "$totalValue",
                            0
                        ]
                    }
                },
                sleep_hours: {
                    $sum: "$totalSleepHours"
                },
                heart_rate: {
                    $avg: {
                        $cond: [
                            { $eq: ["$_id.type", "HKQuantityTypeIdentifierRestingHeartRate"] },
                            "$totalValue",
                            null
                        ]
                    }
                }
            }
        },
        // Format final output
        {
            $project: {
                _id: 0,
                date: "$_id",
                steps: { $round: ["$steps", 0] },
                active_energy: { $round: ["$active_energy", 1] },
                sleep_hours: { $round: ["$sleep_hours", 2] },
                heart_rate_avg: { $round: ["$heart_rate", 0] }
            }
        },
        // Sort by date ascending
        { $sort: { date: 1 } }
    ]);

    return dailyData;
}

/**
 * GET /api/ai/mental-wellness
 */
router.get('/mental-wellness', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        console.log(`\n🧠 [AI] Computing wellness for user: ${userId}`);

        // Aggregate raw records into daily data
        const dailyData = await getDailyHealthData(userId, 30);
        console.log(`🧠 [AI] Daily aggregates: ${dailyData.length} days`);
        
        if (dailyData.length > 0) {
            console.log(`🧠 [AI] Sample day:`, dailyData[dailyData.length - 1]);
        }

        // Get latest assessment
        const assessment = await Assessment.findOne({ userId: userId })
            .sort({ createdAt: -1 });

        console.log(`🧠 [AI] Assessment found: ${!!assessment}`);
        if (assessment) {
            console.log(`🧠 [AI] DASS scores - D:${assessment.scores.depression.scaled}, A:${assessment.scores.anxiety.scaled}, S:${assessment.scores.stress.scaled}`);
        }

        // Run analysis
        const result = wellnessCalculator.analyze(dailyData, assessment);

        if (result.error) {
            console.log(`⚠️ [AI] ${result.error}: ${result.message}`);
            return res.status(200).json(result);
        }

        console.log(`✅ [AI] Wellness: ${result.wellness.score}, Recovery: ${result.recovery.score}`);
        res.json(result);

    } catch (error) {
        console.error('❌ [AI] Error:', error);
        console.error('❌ [AI] Stack:', error.stack);
        res.status(500).json({ 
            error: 'COMPUTATION_FAILED',
            message: 'Failed to compute wellness analysis' 
        });
    }
});

/**
 * Debug endpoint - check raw data
 */
router.get('/debug', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        
        const totalRecords = await HealthRecord.countDocuments({ userId });
        
        const byType = await HealthRecord.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: "$type", count: { $sum: 1 } } }
        ]);
        
        const dateRange = await HealthRecord.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { 
                $group: { 
                    _id: null, 
                    earliest: { $min: "$startDate" },
                    latest: { $max: "$startDate" }
                } 
            }
        ]);

        const dailyData = await getDailyHealthData(userId, 30);
        
        res.json({
            userId: userId.toString(),
            totalRecords,
            recordsByType: byType,
            dateRange: dateRange[0] || null,
            daysAggregated: dailyData.length,
            sampleDays: dailyData.slice(-5), // Last 5 days
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;