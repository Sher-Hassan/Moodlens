export const mean = (arr) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

export const median = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const stddev = (arr) => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
};

export const percentile = (arr, p) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const idx = (p / 100) * (s.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? s[lo] : s[lo] + (idx - lo) * (s[hi] - s[lo]);
};

/** Pearson correlation. Returns 0 for degenerate inputs. */
export const correlation = (xs, ys) => {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return 0;
    const mx = mean(xs), my = mean(ys);
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx, dy = ys[i] - my;
        num += dx * dy;
        dx2 += dx * dx;
        dy2 += dy * dy;
    }
    const denom = Math.sqrt(dx2 * dy2);
    return denom ? num / denom : 0;
};

/** Simple OLS regression. Returns {slope, intercept, predict(x)}. */
export const linearRegression = (xs, ys) => {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return { slope: 0, intercept: 0, predict: () => 0 };
    const mx = mean(xs), my = mean(ys);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        den += (xs[i] - mx) ** 2;
    }
    const slope = den ? num / den : 0;
    const intercept = my - slope * mx;
    return { slope, intercept, predict: (x) => slope * x + intercept };
};

export const correlationLabel = (r) => {
    const abs = Math.abs(r);
    if (abs < 0.1) return 'negligible';
    if (abs < 0.3) return 'weak';
    if (abs < 0.5) return 'moderate';
    if (abs < 0.7) return 'strong';
    return 'very strong';
};