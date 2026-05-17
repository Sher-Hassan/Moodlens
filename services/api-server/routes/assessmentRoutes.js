import express from 'express';
import { protect } from '../middleware/auth.js';
import {
    submitAssessment,
    getLatestAssessment,
    getAssessmentHistory,
} from '../controllers/assessmentController.js';

const router = express.Router();

router.post('/',          protect, submitAssessment);
router.get('/latest',     protect, getLatestAssessment);
router.get('/history',    protect, getAssessmentHistory);

export default router;