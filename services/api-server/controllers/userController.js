import User from '../models/User.js';

export const createUser = async (req, res) => {
    try {
        const { name, email, password, age, gender } = req.body;

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password, // In a real app, hash this!
            profile: { age, gender }
        });

        res.status(201).json({
            message: 'User created successfully',
            userId: user._id, // This is the ID you will use for uploads
            user
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('name email _id');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/users/active-session
 * Returns the current authenticated session data
 */
export const getActiveSession = async (req, res) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];

        res.json({
            userId: req.user._id.toString(),
            token: token
        });
    } catch (error) {
        console.error('Active session error:', error);
        res.status(500).json({ error: error.message });
    }
};