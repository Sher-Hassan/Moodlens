/**
 * CORS configuration for production deployment.
 *
 * Drop this snippet into your services/api-server/index.js, replacing your
 * existing CORS setup (if any). It allows both local dev and your deployed
 * Vercel frontend.
 *
 * USAGE:
 *   import cors from 'cors';
 *   // ... after express() app creation, BEFORE any routes:
 *   app.use(cors(corsOptions));
 *
 * Set ALLOWED_ORIGINS in your Render dashboard as comma-separated list:
 *   ALLOWED_ORIGINS=https://moodlens.vercel.app,https://moodlens-git-main-xxx.vercel.app
 *
 * Include your "main" Vercel URL AND any preview URLs you care about.
 * Vercel generates a preview URL per Git push; you can wildcard with a regex below.
 */

const DEFAULT_ALLOWED = [
    'http://localhost:5173',     // Vite dev
    'http://localhost:3000',     // CRA dev (just in case)
    'http://192.168.18.44:5173', // your local network IP (matches your earlier logs)
    'http://192.168.100.92:5173',
];

const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const ALLOWED_ORIGINS = [...DEFAULT_ALLOWED, ...fromEnv];

// Allow any *.vercel.app subdomain so preview deploys work without manual updates
const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

export const corsOptions = {
    origin: (origin, callback) => {
        // Same-origin or curl/Postman (no origin header)
        if (!origin) return callback(null, true);

        if (ALLOWED_ORIGINS.includes(origin) || VERCEL_PREVIEW_RE.test(origin)) {
            console.log(`✅ [CORS] Origin allowed: ${origin}`);
            return callback(null, true);
        }

        console.warn(`❌ [CORS] Origin BLOCKED: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
