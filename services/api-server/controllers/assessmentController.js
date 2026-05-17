import Assessment from '../models/Assessment.js';

/* ──────────────────────────────────────────────────────
   DASS-21 scoring — question groupings follow the order
   the user presented (1-7 Depression, 8-14 Anxiety,
   15-21 Stress), not the standard interleaved order.
──────────────────────────────────────────────────────── */

const GROUPS = {
    depression: [1, 2, 3, 4, 5, 6, 7],
    anxiety:    [8, 9, 10, 11, 12, 13, 14],
    stress:     [15, 16, 17, 18, 19, 20, 21],
};

const classifyDepression = (s) => {
    if (s <= 9)  return 'Normal';
    if (s <= 13) return 'Mild';
    if (s <= 20) return 'Moderate';
    if (s <= 27) return 'Severe';
    return 'Extremely Severe';
};
const classifyAnxiety = (s) => {
    if (s <= 7)  return 'Normal';
    if (s <= 9)  return 'Mild';
    if (s <= 14) return 'Moderate';
    if (s <= 19) return 'Severe';
    return 'Extremely Severe';
};
const classifyStress = (s) => {
    if (s <= 14) return 'Normal';
    if (s <= 18) return 'Mild';
    if (s <= 25) return 'Moderate';
    if (s <= 33) return 'Severe';
    return 'Extremely Severe';
};

const computeScores = (responses) => {
    const sum = (ids) => ids.reduce((acc, id) => {
        const r = responses.find((r) => r.questionId === id);
        return acc + (r?.value ?? 0);
    }, 0);

    const dRaw = sum(GROUPS.depression);
    const aRaw = sum(GROUPS.anxiety);
    const sRaw = sum(GROUPS.stress);

    return {
        depression: { raw: dRaw, scaled: dRaw * 2, severity: classifyDepression(dRaw * 2) },
        anxiety:    { raw: aRaw, scaled: aRaw * 2, severity: classifyAnxiety(aRaw * 2) },
        stress:     { raw: sRaw, scaled: sRaw * 2, severity: classifyStress(sRaw * 2) },
    };
};

/* POST /api/assessments */
export const submitAssessment = async (req, res) => {
    try {
        const userId = req.user._id;
        const { responses } = req.body;

        if (!Array.isArray(responses) || responses.length !== 21) {
            return res.status(400).json({ error: 'All 21 responses are required.' });
        }

        // Validate individual responses
        for (const r of responses) {
            if (r.questionId < 1 || r.questionId > 21) {
                return res.status(400).json({ error: `Invalid questionId: ${r.questionId}` });
            }
            if (r.value < 0 || r.value > 3 || typeof r.value !== 'number') {
                return res.status(400).json({ error: `Invalid value for Q${r.questionId}: must be 0–3.` });
            }
        }

        const scores    = computeScores(responses);
        const totalScore = scores.depression.scaled + scores.anxiety.scaled + scores.stress.scaled;

        const assessment = await Assessment.create({
            userId,
            responses,
            scores,
            totalScore,
        });

        res.status(201).json({ assessment });
    } catch (error) {
        console.error('Assessment submit error:', error);
        res.status(500).json({ error: error.message });
    }
};

/* GET /api/assessments/latest */
export const getLatestAssessment = async (req, res) => {
    try {
        const userId = req.user._id;
        const assessment = await Assessment.findOne({ userId })
            .sort({ createdAt: -1 })
            .lean();
        res.json({ assessment: assessment ?? null });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/* GET /api/assessments/history */
export const getAssessmentHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const assessments = await Assessment.find({ userId })
            .sort({ createdAt: -1 })
            .select('createdAt scores totalScore')
            .lean();
        res.json({ assessments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};