import express from 'express';
import { protect } from '../middleware/auth.js';
import { ensureUploadToken, generateUploadToken, getUploadToken, revokeUploadToken } from '../controllers/uploadTokenController.js';


const router = express.Router();

router.get('/ensure', protect, ensureUploadToken);  // NEW
router.post('/',      protect, generateUploadToken);
router.get('/',       protect, getUploadToken);
router.delete('/',    protect, revokeUploadToken);

export default router;