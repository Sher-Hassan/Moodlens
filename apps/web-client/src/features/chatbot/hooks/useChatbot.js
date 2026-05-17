/**
 * useChatbot.js — with cold-start UX
 * ====================================
 * NEW: detects when a request is taking >5s (likely a Render free-tier cold start)
 * and shows an informative message instead of just spinning dots.
 *
 * Drop-in replacement for the previous useChatbot.js.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../../config/api';

const SESSION_KEY = 'moodlens.chat.session';
const WELCOME_KEY = 'moodlens.chat.welcomeShown';
const MAX_HISTORY = 20;
const COLD_START_THRESHOLD_MS = 5000;

function loadSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveSession(messages) {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch { /* ignore */ }
}

export function useChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState(() => loadSession());
    const [isThinking, setIsThinking] = useState(false);
    const [thinkingHint, setThinkingHint] = useState(null); // 'cold-start' | null
    const [error, setError] = useState(null);
    const [welcome, setWelcome] = useState(null);
    const [welcomeDismissed, setWelcomeDismissed] = useState(
        () => sessionStorage.getItem(WELCOME_KEY) === 'true'
    );

    const location = useLocation();
    const currentPage = location.pathname;
    const abortRef = useRef(null);
    const coldStartTimerRef = useRef(null);

    useEffect(() => {
        if (welcomeDismissed) return;
        let cancelled = false;
        (async () => {
            try {
                const token = localStorage.getItem('moodlens.token');
                if (!token) return;
                const res = await axios.get(`${API_BASE_URL}/api/chat/welcome`, {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 30000, // generous — first request may wake the server
                });
                if (!cancelled) setWelcome(res.data);
            } catch { /* silent */ }
        })();
        return () => { cancelled = true; };
    }, [welcomeDismissed]);

    useEffect(() => { saveSession(messages); }, [messages]);

    const sendMessage = useCallback(async (text) => {
        const trimmed = text?.trim();
        if (!trimmed || isThinking) return;

        setError(null);
        setThinkingHint(null);

        const userMsg = { id: `u-${Date.now()}`, role: 'user', text: trimmed, ts: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        // Cold-start hint: if no reply within 5s, show "first request can take a bit"
        coldStartTimerRef.current = setTimeout(() => {
            setThinkingHint('cold-start');
        }, COLD_START_THRESHOLD_MS);

        const history = messages
            .filter(m => !m.error)
            .map(m => ({ role: m.role === 'coach' ? 'assistant' : 'user', text: m.text }));

        try {
            const token = localStorage.getItem('moodlens.token');
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();

            const res = await axios.post(
                `${API_BASE_URL}/api/chat`,
                { message: trimmed, history, currentPage },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 60000, // bumped to 60s to handle cold starts gracefully
                    signal: abortRef.current.signal,
                }
            );

            const coachMsg = {
                id: `c-${Date.now()}`,
                role: 'coach',
                text: res.data.reply,
                citations: res.data.citations || [],
                action: res.data.action || null,
                intent: res.data.intent,
                ts: Date.now(),
            };
            setMessages(prev => [...prev, coachMsg]);
        } catch (err) {
            if (err.name === 'CanceledError') return;
            const errMessage =
                err.response?.data?.message ||
                err.message ||
                'Something went wrong. Please try again.';

            setMessages(prev => [...prev, {
                id: `e-${Date.now()}`, role: 'coach', text: errMessage, error: true, ts: Date.now(),
            }]);
            setError(errMessage);
        } finally {
            clearTimeout(coldStartTimerRef.current);
            setIsThinking(false);
            setThinkingHint(null);
        }
    }, [messages, isThinking, currentPage]);

    const dismissWelcome = useCallback(() => {
        setWelcomeDismissed(true);
        sessionStorage.setItem(WELCOME_KEY, 'true');
    }, []);

    const resetConversation = useCallback(() => {
        setMessages([]);
        setError(null);
        sessionStorage.removeItem(SESSION_KEY);
    }, []);

    const toggleOpen = useCallback(() => {
        setIsOpen(v => !v);
        if (!isOpen) dismissWelcome();
    }, [isOpen, dismissWelcome]);

    return {
        isOpen, toggleOpen, setIsOpen,
        messages, isThinking, thinkingHint, error,
        welcome: welcomeDismissed ? null : welcome,
        dismissWelcome, sendMessage, resetConversation,
    };
}
