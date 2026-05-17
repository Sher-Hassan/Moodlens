/**
 * Client-side DASS-21 scoring — mirrors the backend computation.
 * Used to display live score previews if needed and to validate before submission.
 */

export const classifyDepression = (s) => {
    if (s <= 9)  return { label: 'Normal',           tone: 'normal'   };
    if (s <= 13) return { label: 'Mild',              tone: 'mild'     };
    if (s <= 20) return { label: 'Moderate',          tone: 'moderate' };
    if (s <= 27) return { label: 'Severe',            tone: 'severe'   };
    return             { label: 'Extremely Severe',   tone: 'extreme'  };
};

export const classifyAnxiety = (s) => {
    if (s <= 7)  return { label: 'Normal',            tone: 'normal'   };
    if (s <= 9)  return { label: 'Mild',              tone: 'mild'     };
    if (s <= 14) return { label: 'Moderate',          tone: 'moderate' };
    if (s <= 19) return { label: 'Severe',            tone: 'severe'   };
    return             { label: 'Extremely Severe',   tone: 'extreme'  };
};

export const classifyStress = (s) => {
    if (s <= 14) return { label: 'Normal',            tone: 'normal'   };
    if (s <= 18) return { label: 'Mild',              tone: 'mild'     };
    if (s <= 25) return { label: 'Moderate',          tone: 'moderate' };
    if (s <= 33) return { label: 'Severe',            tone: 'severe'   };
    return             { label: 'Extremely Severe',   tone: 'extreme'  };
};

/** Maximum scaled scores per dimension (7 questions × 3 × 2) */
export const MAXIMA = { depression: 42, anxiety: 28, stress: 42 };

export const SEVERITY_COLORS = {
    normal:   '#34D399',
    mild:     '#0BEFC4',
    moderate: '#F5C842',
    severe:   '#FB923C',
    extreme:  '#F87171',
};

export const SEVERITY_MESSAGES = {
    normal:   'Within the healthy range. No significant symptoms detected.',
    mild:     'Mild symptoms noted. Worth keeping an eye on over the coming weeks.',
    moderate: 'Moderate symptoms present. Consider speaking with a professional.',
    severe:   'Significant symptoms detected. Professional support is recommended.',
    extreme:  'Extreme symptoms detected. Please reach out to a qualified mental health professional.',
};

export const computeFromResponses = (responses) => {
    const sum = (ids) => ids.reduce((acc, id) => {
        const r = responses.find((r) => r.questionId === id);
        return acc + (r?.value ?? 0);
    }, 0);

    const dRaw = sum([1, 2, 3, 4, 5, 6, 7]);
    const aRaw = sum([8, 9, 10, 11, 12, 13, 14]);
    const sRaw = sum([15, 16, 17, 18, 19, 20, 21]);

    return {
        depression: { raw: dRaw, scaled: dRaw * 2, ...classifyDepression(dRaw * 2) },
        anxiety:    { raw: aRaw, scaled: aRaw * 2, ...classifyAnxiety(aRaw * 2) },
        stress:     { raw: sRaw, scaled: sRaw * 2, ...classifyStress(sRaw * 2) },
    };
};