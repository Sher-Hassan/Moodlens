import mongoose from 'mongoose';

const healthRecordSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    type: { 
        type: String, 
        required: true,
        enum: [
            'HKCategoryTypeIdentifierSleepAnalysis',
            'HKQuantityTypeIdentifierStepCount',
            'HKQuantityTypeIdentifierActiveEnergyBurned',
            'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
            'HKQuantityTypeIdentifierRestingHeartRate'
        ]
    },
    value: { type: Number, required: true },
    unit: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    durationMins: { type: Number }
});

// CRITICAL: Create a unique compound index
// This prevents the same user from having the same metric start at the same time twice
healthRecordSchema.index({ userId: 1, type: 1, startDate: 1 }, { unique: true });

export default mongoose.model('HealthRecord', healthRecordSchema);