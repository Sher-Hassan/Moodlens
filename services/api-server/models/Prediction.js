// services/api-server/src/models/Prediction.js
const predictionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    date: { type: Date, required: true },
    label: { 
        type: String, 
        enum: ['Energized', 'Balanced', 'Fatigued', 'Stressed'],
        required: true 
    },
    confidenceScore: Number,
    topContributors: [String], // e.g., ["low_hrv", "sleep_debt"]
    aiRecommendation: String    // Personalized advice from the ML engine
}, { timestamps: true });