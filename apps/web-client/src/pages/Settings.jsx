import { useState, useEffect } from 'react';
import axios from 'axios';
import './Settings.css';

import { API_BASE_URL } from '../config/api';

export default function Settings() {
    const [tokenInfo, setTokenInfo] = useState(null);
    const [newToken, setNewToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [showInstructions, setShowInstructions] = useState(false);

    useEffect(() => {
        fetchTokenInfo();
    }, []);

    const fetchTokenInfo = async () => {
        try {
            const token = localStorage.getItem('moodlens.token');
            const res = await axios.get(`${API_BASE_URL}/api/upload-token`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTokenInfo(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const generateToken = async () => {
        try {
            const token = localStorage.getItem('moodlens.token');
            const res = await axios.post(`${API_BASE_URL}/api/upload-token`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewToken(res.data.token);
            fetchTokenInfo();
        } catch (err) {
            alert('Failed to generate token');
        }
    };

    const revokeToken = async () => {
        if (!confirm('Revoke upload token? Your Shortcut will stop working.')) return;
        try {
            const token = localStorage.getItem('moodlens.token');
            await axios.delete(`${API_BASE_URL}/api/upload-token`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTokenInfo({ hasToken: false });
            setNewToken('');
        } catch (err) {
            alert('Failed to revoke token');
        }
    };

    const copyToken = () => {
        navigator.clipboard.writeText(newToken);
        alert('Token copied to clipboard!');
    };

    if (loading) return <div className="settings-loading">Loading...</div>;

    return (
        <main className="settings-page">
            <h1>Shortcut Integration</h1>

            <section className="token-section">
                <h2>Upload Token</h2>
                <p>Generate a token to use with the MoodLens iOS/Mac Shortcut.</p>

                {tokenInfo?.hasToken ? (
                    <div className="token-status">
                        <p>✓ Active token: <code>{tokenInfo.tokenPreview}</code></p>
                        <button onClick={generateToken} className="btn-secondary">
                            Generate New Token
                        </button>
                        <button onClick={revokeToken} className="btn-danger">
                            Revoke Token
                        </button>
                    </div>
                ) : (
                    <button onClick={generateToken} className="btn-primary">
                        Generate Upload Token
                    </button>
                )}

                {newToken && (
                    <div className="new-token-display">
                        <p><strong>⚠️ Save this token now — it won't be shown again:</strong></p>
                        <code className="token-code">{newToken}</code>
                        <button onClick={copyToken} className="btn-copy">Copy Token</button>
                    </div>
                )}

                <button 
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="btn-link"
                >
                    {showInstructions ? '▼' : '▶'} How to set up the Shortcut
                </button>

                {showInstructions && (
                    <div className="instructions">
                        <h3>iOS/Mac Shortcut Setup</h3>
                        <ol>
                            <li>Generate an upload token above</li>
                            <li>Copy the token</li>
                            <li>Download the MoodLens Shortcut (link here)</li>
                            <li>When prompted, paste your upload token</li>
                            <li>Run the shortcut and select your Apple Health export.zip</li>
                        </ol>

                        <h4>Shortcut Configuration</h4>
                        <p>In the Shortcut, configure the upload action as:</p>
                        <pre>{`POST https://your-api.com/api/health/upload
Header: X-Upload-Token: YOUR_TOKEN_HERE
Body: export.zip (file)`}</pre>
                    </div>
                )}
            </section>
        </main>
    );
}