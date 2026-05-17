import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { rangeForPreset } from '../utils/dates';

import { API_BASE_URL } from '../../../config/api';

/**
 * Fetches /api/health/daily for the active preset.
 * Returns { daily, loading, error, range, setPreset, preset }.
 */
export default function useDailyHealthData(initialPreset = '30d') {
    const [preset, setPreset] = useState(initialPreset);
    const [daily, setDaily] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const range = useMemo(() => rangeForPreset(preset), [preset]);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('moodlens.token');
                const res = await axios.get(`${API_BASE_URL}/api/health/daily`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: range,
                });
                if (!cancelled) setDaily(res.data.daily ?? []);
            } catch (e) {
                if (!cancelled) setError(e.message || 'Failed to load data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchData();
        return () => { cancelled = true; };
    }, [range.from, range.to]);

    return { daily, loading, error, range, preset, setPreset };
}