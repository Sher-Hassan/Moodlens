import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useUser } from './UserContext';
import { API_BASE_URL } from '../config/api';
const HealthDataContext = createContext();

export const useHealthData = () => {
    const ctx = useContext(HealthDataContext);
    if (!ctx) throw new Error('useHealthData must be used within HealthDataProvider');
    return ctx;
};

export function HealthDataProvider({ children }) {
    const { user, logout } = useUser();
    const [status, setStatus] = useState('idle');
    const [data, setData] = useState(null);
    const hasCheckedOnce = useRef(false);

    const checkStatus = useCallback(async (silent = false) => {
        if (!user) {
            setStatus('idle');
            return;
        }

        if (!silent) setStatus('checking');

        try {
            const token = localStorage.getItem('moodlens.token');
            
            if (!token) {
                console.warn('No token found');
                logout();
                return;
            }

            const res = await axios.get(`${API_BASE_URL}/api/health/status`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            hasCheckedOnce.current = true;

            if (res.data.hasData) {
                setStatus('loaded');
                setData(res.data);
            } else {
                setStatus('no-data');
                setData(null);
            }
        } catch (error) {
            if (error.response?.status === 401) {
                console.error('Authentication failed. Token expired.');
                logout();
                return;
            }

            console.error('Health status check failed:', error);
            setStatus('error');
        }
    }, [user, logout]);

    useEffect(() => {
        if (user && !hasCheckedOnce.current) {
            checkStatus();
        }
    }, [user, checkStatus]);

    const refresh = useCallback(() => {
        return checkStatus(false);
    }, [checkStatus]);

    return (
        <HealthDataContext.Provider value={{ status, data, refresh }}>
            {children}
        </HealthDataContext.Provider>
    );
}