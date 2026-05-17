/** Centered rolling mean for trend smoothing. NaN at edges replaced with raw value. */
export const movingAverage = (arr, window = 7) => {
    if (!arr.length) return [];
    const half = Math.floor(window / 2);
    return arr.map((_, i) => {
        const lo = Math.max(0, i - half);
        const hi = Math.min(arr.length, i + half + 1);
        const slice = arr.slice(lo, hi);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
};

/** Returns 'up' | 'down' | 'flat' based on first-vs-last halves of the series. */
export const trendDirection = (arr, threshold = 0.05) => {
    if (arr.length < 4) return 'flat';
    const half = Math.floor(arr.length / 2);
    const first = arr.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const second = arr.slice(half).reduce((a, b) => a + b, 0) / (arr.length - half);
    if (!first) return 'flat';
    const delta = (second - first) / first;
    if (delta > threshold) return 'up';
    if (delta < -threshold) return 'down';
    return 'flat';
};