import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from '../config/api';
import "./Login.css";

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const navigate = useNavigate();
  const { login } = useUser();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    console.log('\n🔵 ========================================');
    console.log('🔵 [LOGIN] Form submitted');
    console.log('🔵 [LOGIN] Timestamp:', new Date().toISOString());
    console.log('🔵 [LOGIN] Email:', form.email);
    console.log('🔵 [LOGIN] Password length:', form.password?.length || 0);
    console.log('🔵 [LOGIN] API_BASE_URL:', API_BASE_URL);
    console.log('🔵 [LOGIN] Full URL:', `${API_BASE_URL}/api/users/login`);
    console.log('🔵 [LOGIN] User Agent:', navigator.userAgent);
    console.log('🔵 [LOGIN] Current URL:', window.location.href);
    console.log('🔵 ========================================\n');

    try {
      const payload = {
        email: form.email,
        password: form.password,
      };

      console.log('📤 [LOGIN] Sending request...');
      console.log('📤 [LOGIN] Payload:', { 
        email: form.email, 
        password: '***' + form.password.slice(-2) 
      });

      const res = await axios.post(`${API_BASE_URL}/api/users/login`, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      console.log('\n✅ ========================================');
      console.log('✅ [LOGIN] Response received!');
      console.log('✅ [LOGIN] Status:', res.status);
      console.log('✅ [LOGIN] Status Text:', res.statusText);
      console.log('✅ [LOGIN] Response headers:', res.headers);
      console.log('✅ [LOGIN] Response data keys:', Object.keys(res.data || {}));
      console.log('✅ [LOGIN] Has token:', !!res.data?.token);
      console.log('✅ [LOGIN] Token (first 20 chars):', res.data?.token?.substring(0, 20) + '...');
      console.log('✅ [LOGIN] Has user:', !!res.data?.user);
      console.log('✅ [LOGIN] User data:', res.data?.user);
      console.log('✅ ========================================\n');

      if (!res.data?.token) {
        console.error('❌ [LOGIN] No token in response!');
        throw new Error('No token received from server');
      }

      if (!res.data?.user) {
        console.error('❌ [LOGIN] No user data in response!');
        throw new Error('No user data received from server');
      }

      console.log('🔄 [LOGIN] Calling login context...');
      login(res.data.user, res.data.token);
      console.log('✅ [LOGIN] Login context updated successfully');

      console.log('🔄 [LOGIN] Navigating to /dashboard...');
      navigate("/dashboard");
      console.log('✅ [LOGIN] Navigation triggered');

    } catch (err) {
      console.error('\n❌ ========================================');
      console.error('❌ [LOGIN] Error occurred!');
      console.error('❌ [LOGIN] Error type:', err.constructor.name);
      console.error('❌ [LOGIN] Error message:', err.message);
      
      if (err.response) {
        // Server responded with error status
        console.error('❌ [LOGIN] Response error details:');
        console.error('  - Status:', err.response.status);
        console.error('  - Status text:', err.response.statusText);
        console.error('  - Headers:', err.response.headers);
        console.error('  - Data:', err.response.data);
        console.error('  - Error message from server:', err.response.data?.error || err.response.data?.message);
        
        setError(err.response.data?.error || err.response.data?.message || 'Login failed');
        
      } else if (err.request) {
        // Request made but no response received
        console.error('❌ [LOGIN] No response received!');
        console.error('  - Request:', err.request);
        console.error('  - This usually means:');
        console.error('    1. Server is not running');
        console.error('    2. Network/CORS issue');
        console.error('    3. Wrong URL/IP address');
        console.error('  - Check backend console for logs');
        
        setError('Cannot reach server. Check your connection and make sure backend is running.');
        
      } else {
        // Error in request setup
        console.error('❌ [LOGIN] Request setup error!');
        console.error('  - Message:', err.message);
        console.error('  - Stack:', err.stack);
        
        setError('Failed to send login request: ' + err.message);
      }
      
      console.error('❌ [LOGIN] Full error object:', err);
      console.error('❌ ========================================\n');
      
    } finally {
      setLoading(false);
      console.log('🏁 [LOGIN] Request completed (loading set to false)');
    }
  };

  // Test connection function (optional - for debugging)
  const testConnection = async () => {
    console.log('\n🧪 ========================================');
    console.log('🧪 [TEST] Testing API connection...');
    console.log('🧪 [TEST] API_BASE_URL:', API_BASE_URL);
    console.log('🧪 [TEST] Testing URL:', `${API_BASE_URL}/api/health/status`);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/health/status`, {
        timeout: 5000
      });
      console.log('✅ [TEST] API is reachable!');
      console.log('✅ [TEST] Status:', response.status);
      console.log('✅ [TEST] Data:', response.data);
    } catch (err) {
      console.error('❌ [TEST] API not reachable!');
      console.error('❌ [TEST] Error:', err.message);
      if (err.response) {
        console.error('❌ [TEST] Response status:', err.response.status);
        console.error('❌ [TEST] Response data:', err.response.data);
      } else if (err.request) {
        console.error('❌ [TEST] No response received from server');
        console.error('❌ [TEST] Make sure:');
        console.error('  1. Backend is running');
        console.error('  2. Backend is on', API_BASE_URL);
        console.error('  3. CORS is configured for your IP');
      }
    }
    console.log('🧪 ========================================\n');
  };

  // Log component mount
  useState(() => {
    console.log('🎬 [LOGIN COMPONENT] Mounted');
    console.log('🎬 [LOGIN COMPONENT] API_BASE_URL:', API_BASE_URL);
    console.log('🎬 [LOGIN COMPONENT] Current location:', window.location.href);
  });

  return (
    <main className="auth">
      {/* ─ Left: form ─ */}
      <section className="auth__panel auth__panel--form">
        <Link to="/" className="auth__brand">
          <span className="auth__brand-mark" />
          <span className="auth__brand-word">
            MoodLens<span className="auth__brand-dot">.</span>
          </span>
        </Link>

        <div className="auth__form-wrap">
          <p className="auth__eyebrow">Welcome back</p>
          <h1 className="auth__title">
            Sign <span className="auth__title-em">in.</span>
          </h1>
          <p className="auth__sub">
            Your wearable kept reading while you were away. Let's see what it
            found.
          </p>

          {/* Optional: Add test button (remove after debugging)
          <button 
            type="button" 
            onClick={testConnection}
            style={{
              margin: '10px 0',
              padding: '8px 16px',
              background: '#444',
              color: '#fff',
              border: '1px solid #666',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🧪 Test API Connection
          </button> */}

          <form className="auth__form" onSubmit={handleSubmit} noValidate>
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="you@domain.com"
            />

            <Field
              label="Password"
              name="password"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
              suffix={
                <button
                  type="button"
                  className="auth__field-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              }
            />

            {error && (
              <div className="auth__error" role="alert">
                <span className="auth__error-dot" />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="auth__submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="auth__spinner" /> Reading signal…
                </>
              ) : (
                <>
                  Continue <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </form>

          <p className="auth__alt">
            Don't have an account?{" "}
            <Link to="/register" className="auth__alt-link">
              Begin here
            </Link>
          </p>
        </div>

        <footer className="auth__foot">
          <span>MOODLENS · 2026</span>
          <span>PRIVACY · LOCAL FIRST</span>
        </footer>
      </section>

      {/* ─ Right: visualization ─ */}
      <aside className="auth__panel auth__panel--art" aria-hidden="true">
        <div className="auth__art-aurora" />
        <div className="auth__art-grain" />

        <div className="auth__art-meta auth__art-meta--tr">
          <span className="auth__art-dot" />
          <span>READING · LIVE</span>
        </div>

        <svg
          className="auth__pulse"
          viewBox="0 0 600 300"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="pulseFade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(11,239,196,0)" />
              <stop offset="50%" stopColor="rgba(11,239,196,0.9)" />
              <stop offset="100%" stopColor="rgba(11,239,196,0)" />
            </linearGradient>
          </defs>
          <path
            className="auth__pulse-path"
            d="M0 150 L 180 150 L 200 130 L 214 180 L 226 80 L 240 220 L 256 150 L 420 150 L 440 130 L 454 180 L 466 80 L 480 220 L 496 150 L 600 150"
            fill="none"
            stroke="url(#pulseFade)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <blockquote className="auth__quote">
          <span className="auth__quote-mark" aria-hidden="true">
            &ldquo;
          </span>
          Your body has been talking. We're just learning to listen.
        </blockquote>
      </aside>
    </main>
  );
}

/* Reusable input field */
function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  suffix,
}) {
  return (
    <label className="auth__field">
      <span className="auth__field-label">
        {label}
        {required && <span className="auth__field-req">*</span>}
      </span>
      <span className="auth__field-input-wrap">
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="auth__field-input"
        />
        {suffix && <span className="auth__field-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

export default Login;