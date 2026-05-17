import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch user and attach to request
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ error: 'User no longer exists' });
            }

            next();
        } catch (error) {
            return res.status(401).json({ error: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'Not authorized, no token' });
    }
};


/**
 * Middleware that accepts EITHER:
 * - JWT Bearer token (Authorization header)
 * - Upload token (X-Upload-Token header) + optional userId validation
 */
export const protectUpload = async (req, res, next) => {
    try {
        let token, isUploadToken = false;

        // Check for upload token first (X-Upload-Token header)
        const uploadTokenHeader = req.headers['x-upload-token'];
        if (uploadTokenHeader) {
            token = uploadTokenHeader;
            isUploadToken = true;
        }

        // Or check query parameter (?uploadToken=xxx)
        if (!token && req.query.uploadToken) {
            token = req.query.uploadToken;
            isUploadToken = true;
        }

        // Fall back to JWT Bearer token
        if (!token && req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
            isUploadToken = false;
        }

        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        if (isUploadToken) {
            // Validate upload token
            const user = await User.findOne({ uploadToken: token }).select('-password');
            if (!user) {
                return res.status(401).json({ error: 'Invalid upload token' });
            }

            // EXTRA VALIDATION: If userId is provided, verify it matches
            const providedUserId = req.headers['x-user-id'] || req.body.userId || req.query.userId;
            if (providedUserId && providedUserId !== user._id.toString()) {
                return res.status(403).json({ error: 'Token does not belong to this user' });
            }

            req.user = user;
        } else {
            // Validate JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password'); // Fixed from decoded.userId
            if (!req.user) {
                return res.status(401).json({ error: 'User not found' });
            }
        }

        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};