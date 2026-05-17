/**
 * API configuration
 * =================
 * In development:  defaults to http://localhost:3000
 * In production:   reads from VITE_API_BASE_URL (set in Vercel dashboard)
 */

export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Log once at startup so you can verify in browser console
if (typeof window !== 'undefined') {
    console.log('🌐 API_BASE_URL:', API_BASE_URL);
}
