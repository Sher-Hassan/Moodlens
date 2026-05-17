/**
 * Single source of truth for chart appearance. Every chart imports from here.
 * Keeps the 10 plots feeling like one coherent dashboard.
 */

export const COLORS = {
    steps: '#0BEFC4',       // teal — signal / activity
    stepsSoft: 'rgba(11, 239, 196, 0.18)',
    sleep: '#B794F4',       // violet — mind / recovery
    sleepSoft: 'rgba(183, 148, 244, 0.18)',
    energy: '#F5C842',      // amber — energy expenditure
    energySoft: 'rgba(245, 200, 66, 0.18)',
    grid: 'rgba(36, 48, 68, 0.45)',
    axis: '#243044',
    text: '#8FA3BF',
    textMuted: '#4D6480',
    textBright: '#EDF2F8',
    surface: '#131E30',
    surfaceDeep: '#0C1525',
    state: {
        excellent: '#34D399',
        good: '#0BEFC4',
        balanced: '#60A5FA',
        moderate: '#F5C842',
        recovery: '#FB923C',
        fatigued: '#F87171',
    },
};

export const FONTS = {
    ui: 'DM Sans, system-ui, sans-serif',
    mono: 'JetBrains Mono, ui-monospace, monospace',
};

/**
 * Base layout merged into every plot. Charts override what they need.
 */
export const baseLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: FONTS.ui, size: 12, color: COLORS.text },
    margin: { l: 56, r: 24, t: 16, b: 44 },
    showlegend: false,
    hoverlabel: {
        bgcolor: '#1C2A40',
        bordercolor: COLORS.axis,
        font: { family: FONTS.ui, color: COLORS.textBright, size: 12 },
    },
    xaxis: {
        gridcolor: COLORS.grid,
        zerolinecolor: COLORS.grid,
        linecolor: COLORS.axis,
        tickfont: { family: FONTS.mono, size: 10, color: COLORS.textMuted },
        titlefont: { family: FONTS.ui, size: 11, color: COLORS.text },
    },
    yaxis: {
        gridcolor: COLORS.grid,
        zerolinecolor: COLORS.grid,
        linecolor: COLORS.axis,
        tickfont: { family: FONTS.mono, size: 10, color: COLORS.textMuted },
        titlefont: { family: FONTS.ui, size: 11, color: COLORS.text },
    },
};

export const baseConfig = {
    responsive: true,
    displaylogo: false,
    displayModeBar: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d', 'toggleSpikelines'],
};

/** Deep-merge two layout objects (shallow for top-level keys, override children) */
export const mergeLayout = (...layouts) => layouts.reduce((acc, l) => {
    if (!l) return acc;
    const merged = { ...acc };
    Object.keys(l).forEach((k) => {
        if (typeof l[k] === 'object' && !Array.isArray(l[k]) && l[k] !== null) {
            merged[k] = { ...(acc[k] || {}), ...l[k] };
        } else {
            merged[k] = l[k];
        }
    });
    return merged;
}, {});