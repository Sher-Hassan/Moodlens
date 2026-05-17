import crypto from 'crypto';
import User from '../models/User.js';

/**
 * POST /api/users/generate-upload-token
 * Generates a new upload token for the authenticated user
 */
export const generateUploadToken = async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Generate a secure random token (32 bytes = 64 hex characters)
        const token = crypto.randomBytes(32).toString('hex');
        
        // Store token in user document
        await User.findByIdAndUpdate(userId, { uploadToken: token });
        
        res.json({
            message: 'Upload token generated successfully',
            token: token,
            note: 'Store this token securely. It will not be shown again.'
        });
    } catch (error) {
        console.error('Generate upload token error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/users/upload-token
 * Retrieves the current upload token (masked for security)
 */
export const getUploadToken = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).select('uploadToken');
        
        if (!user.uploadToken) {
            return res.json({ 
                hasToken: false,
                message: 'No upload token generated yet' 
            });
        }
        
        // Return masked version (show first 8 and last 4 characters)
        const masked = `${user.uploadToken.slice(0, 8)}...${user.uploadToken.slice(-4)}`;
        
        res.json({
            hasToken: true,
            tokenPreview: masked,
            message: 'Use the "Generate New Token" button to get the full token'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * DELETE /api/users/upload-token
 * Revokes the current upload token
 */
export const revokeUploadToken = async (req, res) => {
    try {
        const userId = req.user._id;
        await User.findByIdAndUpdate(userId, { uploadToken: null });
        
        res.json({ message: 'Upload token revoked successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }

};
/**
 * GET /api/upload-token/ensure
 * Auto-generates upload token if user doesn't have one 
 * Returns both token and userId
 */
export const ensureUploadToken = async (req, res) => {
    try {
        const userId = req.user._id;
        let user = await User.findById(userId).select('uploadToken');
        
        // Generate token if doesn't exist
        if (!user.uploadToken) {
            const token = crypto.randomBytes(32).toString('hex');
            user = await User.findByIdAndUpdate(
                userId, 
                { uploadToken: token },
                { new: true }
            ).select('uploadToken');
        }
        
        res.json({
            userId: userId.toString(),
            token: user.uploadToken,
            message: 'Upload token ready'
        });
    } catch (error) {
        console.error('Ensure upload token error:', error);
        res.status(500).json({ error: error.message });
    }
};