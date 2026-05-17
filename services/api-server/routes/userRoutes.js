import express from 'express';
import { protect } from '../middleware/auth.js';
import { createUser, getAllUsers } from '../controllers/userController.js';
import { loginUser } from '../controllers/loginController.js';
import { getActiveSession } from '../controllers/userController.js';
import { 
    ensureUploadToken,
    generateUploadToken, 
    getUploadToken, 
    revokeUploadToken 
} from '../controllers/uploadTokenController.js';
const router = express.Router();

router.post('/register', createUser);
router.post('/login', loginUser);
router.get('/', getAllUsers);
router.get('/active-session', protect, getActiveSession);
// Add after existing routes:
router.post('/generate-upload-token', protect, generateUploadToken);
router.get('/upload-token',           protect, getUploadToken);
router.delete('/upload-token',        protect, revokeUploadToken);

export default router;