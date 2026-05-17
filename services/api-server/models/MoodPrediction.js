const moodPredictionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    date: { type: Date, required: true },
    
    // Requirement #4 & #5: Classification
    mentalState: { 
        type: String, 
        enum: ['Stressed', 'Balanced', 'Fatigued', 'Energized'] 
    },
    
    // Requirement #6: Confidence
    confidenceScore: { type: Number, min: 0, max: 100 },
    
    // Requirement #7: SHAP Explainability
    explainability: {
        topFeatures: [{
            featureName: String, // e.g., 'Step Count'
            impactValue: Number, // SHAP value
            description: String  // e.g., 'Low step count was the biggest factor today'
        }]
    },
    
    modelMetadata: {
        algorithm: { type: String, default: 'RandomForest' },
        version: String
    }
});

export default mongoose.model('MoodPrediction', moodPredictionSchema);