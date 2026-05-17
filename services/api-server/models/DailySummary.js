const dailySummarySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    date: { type: Date, required: true, index: -1 },
    
    // Requirement #1: Sleep Computations
    sleepMetrics: {
        totalDurationHrs: Number,
        efficiencyPercentage: Number,
        sleepDebtHrs: Number,         // (Actual - Goal)
        consistencyScore: Number      // 7-day rolling standard deviation
    },
    
    // Requirement #2: Activity Computations
    activityMetrics: {
        dailyStepCount: Number,
        stepAverage7Day: Number,
        activityStreakDays: Number,   // Calculated by backend job
        activeEnergy7DayTrend: [Number] // Array of last 7 values for Sparklines
    },
    
    // Requirement #3: Recovery
    recoveryScore: { type: Number, min: 0, max: 100 }, 
    
    isProcessed: { type: Boolean, default: false }
});

export default mongoose.model('DailySummary', dailySummarySchema);