import express from 'express';
import multer from 'multer';
import path from 'path';
import { protectUpload } from '../middleware/auth.js';
import { handleUpload } from '../controllers/uploadController.js';
import { getDataStatus, getDailyData } from '../controllers/healthController.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/xml-files/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.xml', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only .xml and .zip files are allowed'), false);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 500 * 1024 * 1024 },
});

router.get('/status', protectUpload, getDataStatus);
router.get('/daily', protectUpload, getDailyData);
router.post('/upload', protectUpload, upload.single('file'), handleUpload);

export default router;