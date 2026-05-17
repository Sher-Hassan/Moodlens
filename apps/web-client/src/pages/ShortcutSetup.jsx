import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Spinner from '../components/common/Spinner';
import './ShortcutSetup.css';

import { API_BASE_URL } from '../config/api';
const SHORTCUT_URL = 'https://www.icloud.com/shortcuts/8f42c0f1dd1f43f4a2d11825b9274c8c';

export default function ShortcutSetup() {
    const [userId, setUserId] = useState('');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [copiedItem, setCopiedItem] = useState(''); // 'userId', 'token', or 'both'
    const navigate = useNavigate();

    useEffect(() => {
        fetchCredentials();
    }, []);

    const fetchCredentials = async () => {
        try {
            const jwt = localStorage.getItem('moodlens.token');
            if (!jwt) {
                navigate('/login');
                return;
            }

            const res = await axios.get(`${API_BASE_URL}/api/upload-token/ensure`, {
                headers: { Authorization: `Bearer ${jwt}` }
            });
            
            setUserId(res.data.userId);
            setToken(res.data.token);
        } catch (err) {
            console.error('Failed to get credentials:', err);
            alert('Failed to prepare shortcut. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const copyAndOpen = async () => {
        try {
            // Copy BOTH userId and token to clipboard (formatted for easy pasting)
            const credentials = `User ID: ${userId}\nToken: ${token}`;
            await navigator.clipboard.writeText(credentials);
            setCopiedItem('both');
            
            // Small delay so user sees "Copied" feedback
            setTimeout(() => {
                window.open(SHORTCUT_URL, '_blank');
            }, 400);
            
            setTimeout(() => setCopiedItem(''), 2000);
        } catch (err) {
            alert('Failed to copy. Please copy the values manually.');
        }
    };

    const copyValue = async (value, type) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedItem(type);
            setTimeout(() => setCopiedItem(''), 2000);
        } catch (err) {
            alert('Failed to copy.');
        }
    };

    if (loading) {
        return (
            <div className="shortcut-setup-loading">
                <Spinner size="lg" label="Preparing your shortcut..." />
            </div>
        );
    }

    return (
        <main className="shortcut-setup">
            <div className="shortcut-setup__container">
                
                <header className="shortcut-setup__header">
                    <span className="shortcut-setup__icon" aria-hidden="true">⚡</span>
                    <h1 className="shortcut-setup__title">
                        Set up <span className="shortcut-setup__title-em">MoodLens Shortcut</span>
                    </h1>
                    <p className="shortcut-setup__sub">
                        Two quick steps: copy your credentials, add the shortcut.
                    </p>
                </header>

                {/* Step 1: Credentials */}
                <section className="shortcut-setup__step">
                    <div className="shortcut-setup__step-header">
                        <span className="shortcut-setup__step-num">1</span>
                        <h2 className="shortcut-setup__step-title">Your credentials</h2>
                    </div>
                    
                    {/* User ID */}
                    <div className="shortcut-setup__field">
                        <label className="shortcut-setup__label">User ID</label>
                        <div className="shortcut-setup__token-box">
                            <code className="shortcut-setup__token">{userId}</code>
                            <button 
                                className="shortcut-setup__copy-btn"
                                onClick={() => copyValue(userId, 'userId')}
                            >
                                {copiedItem === 'userId' ? '✓ Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>

                    {/* Upload Token */}
                    <div className="shortcut-setup__field">
                        <label className="shortcut-setup__label">Upload Token</label>
                        <div className="shortcut-setup__token-box">
                            <code className="shortcut-setup__token">{token}</code>
                            <button 
                                className="shortcut-setup__copy-btn"
                                onClick={() => copyValue(token, 'token')}
                            >
                                {copiedItem === 'token' ? '✓ Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>

                    <p className="shortcut-setup__note">
                        You'll paste both when the Shortcut prompts you. Keep them safe — they authenticate your uploads.
                    </p>
                </section>

                {/* Step 2: Install */}
                <section className="shortcut-setup__step">
                    <div className="shortcut-setup__step-header">
                        <span className="shortcut-setup__step-num">2</span>
                        <h2 className="shortcut-setup__step-title">Add the shortcut</h2>
                    </div>

                    <button 
                        className="shortcut-setup__install-btn"
                        onClick={copyAndOpen}
                    >
                        <span className="shortcut-setup__install-icon">📲</span>
                        Copy Credentials & Add Shortcut
                    </button>

                    <p className="shortcut-setup__note">
                        {copiedItem === 'both' && '✓ '}
                        This will copy both values and open the shortcut installation.
                        Paste each when prompted.
                    </p>
                </section>

                {/* How it works */}
                <details className="shortcut-setup__details">
                    <summary>How does this work?</summary>
                    <ol className="shortcut-setup__explainer">
                        <li>Your User ID identifies your account</li>
                        <li>The upload token authenticates your shortcut uploads</li>
                        <li>When you run the shortcut, it sends your health data with both values</li>
                        <li>Our server verifies the credentials and saves your data</li>
                        <li>You can revoke the token anytime in Settings</li>
                    </ol>
                </details>

                <button 
                    className="shortcut-setup__back"
                    onClick={() => navigate(-1)}
                >
                    ← Back
                </button>

            </div>
        </main>
    );
}