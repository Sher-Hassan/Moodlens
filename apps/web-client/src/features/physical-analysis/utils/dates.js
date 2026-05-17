export const toISODate = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toISOString().slice(0, 10);
};

export const subDays = (d, n) => {
    const dt = new Date(d);
    dt.setDate(dt.getDate() - n);
    return dt;
};

/** Returns {from, to} ISO strings for a preset window relative to today. */
export const rangeForPreset = (preset) => {
    const today = new Date();
    const presets = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
    };
    const n = presets[preset] ?? 30;
    return { from: toISODate(subDays(today, n - 1)), to: toISODate(today) };
};

export const formatDateShort = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const isWeekend = (iso) => {
    const day = new Date(iso).getDay();
    return day === 0 || day === 6;
};

export const dayLabel = (iso) =>
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(iso).getDay()];

/** ISO week number — used by the consistency heatmap. */
export const isoWeek = (iso) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
};