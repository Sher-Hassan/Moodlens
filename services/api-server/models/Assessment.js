import mongoose from 'mongoose';

const SEVERITIES = ['Normal', 'Mild', 'Moderate', 'Severe', 'Extremely Severe'];

const dimensionSchema = {
    raw:      { type: Number, required: true },
    scaled:   { type: Number, required: true },   // raw × 2
    severity: { type: String, enum: SEVERITIES, required: true },
};

const assessmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    // Raw responses — 21 entries, questionId 1–21, value 0–3
    responses: [{
        questionId: { type: Number, required: true, min: 1, max: 21 },
        value:      { type: Number, required: true, min: 0, max: 3  },
    }],
    // Computed and stored at submission time
    scores: {
        depression: dimensionSchema,
        anxiety:    dimensionSchema,
        stress:     dimensionSchema,
    },
    // Top-level composite for quick queries / future ML
    totalScore: { type: Number },
    version: { type: String, default: 'DASS-21' },
}, { timestamps: true });

// Sort newest-first by default
assessmentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Assessment', assessmentSchema);