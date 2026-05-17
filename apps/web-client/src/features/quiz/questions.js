/**
 * DASS-21 question bank.
 * Questions 1–7: Depression
 * Questions 8–14: Anxiety
 * Questions 15–21: Stress
 *
 * Section metadata drives the visual theme changes between sections.
 */

export const SECTIONS = [
    {
        id:    'depression',
        label: 'Depression',
        range: [1, 7],
        color: '#60A5FA',           // state-focused blue
        soft:  'rgba(96,165,250,0.10)',
        border:'rgba(96,165,250,0.35)',
        desc:  'These questions relate to depressive feelings experienced over the past week.',
    },
    {
        id:    'anxiety',
        label: 'Anxiety',
        range: [8, 14],
        color: '#F5C842',           // amber
        soft:  'rgba(245,200,66,0.10)',
        border:'rgba(245,200,66,0.35)',
        desc:  'These questions relate to anxious feelings and physical manifestations of tension.',
    },
    {
        id:    'stress',
        label: 'Stress',
        range: [15, 21],
        color: '#FB923C',           // state-stressed orange
        soft:  'rgba(251,146,60,0.10)',
        border:'rgba(251,146,60,0.35)',
        desc:  'These questions relate to persistent arousal, irritability, and difficulty relaxing.',
    },
];

export const OPTIONS = [
    { value: 0, label: 'Did not apply to me at all' },
    { value: 1, label: 'Applied to some degree, or some of the time' },
    { value: 2, label: 'Applied to a considerable degree, or a good part of time' },
    { value: 3, label: 'Applied very much, or most of the time' },
];

export const QUESTIONS = [
    // Depression (1–7)
    { id: 1,  text: "I couldn't seem to experience any positive feeling at all." },
    { id: 2,  text: "I found it difficult to work up the initiative to do things." },
    { id: 3,  text: "I felt that I had nothing to look forward to." },
    { id: 4,  text: "I felt down-hearted and blue." },
    { id: 5,  text: "I was unable to become enthusiastic about anything." },
    { id: 6,  text: "I felt I wasn't worth much as a person." },
    { id: 7,  text: "I felt that life was meaningless." },
    // Anxiety (8–14)
    { id: 8,  text: "I was aware of dryness of my mouth." },
    { id: 9,  text: "I experienced breathing difficulty (e.g., excessively fast breathing, breathlessness in the absence of physical exertion)." },
    { id: 10, text: "I experienced trembling (e.g., in the hands)." },
    { id: 11, text: "I was worried about situations in which I might panic and make a fool of myself." },
    { id: 12, text: "I felt I was close to panic." },
    { id: 13, text: "I was aware of the action of my heart in the absence of physical exertion." },
    { id: 14, text: "I felt scared without any good reason." },
    // Stress (15–21)
    { id: 15, text: "I found it hard to wind down." },
    { id: 16, text: "I tended to over-react to situations." },
    { id: 17, text: "I felt that I was using a lot of nervous energy." },
    { id: 18, text: "I found myself getting agitated." },
    { id: 19, text: "I found it difficult to relax." },
    { id: 20, text: "I was intolerant of anything that kept me from getting on with what I was doing." },
    { id: 21, text: "I felt that I was rather touchy." },
];

/** Returns the section object for a given 1-indexed question id. */
export const sectionForQuestion = (qId) =>
    SECTIONS.find(({ range }) => qId >= range[0] && qId <= range[1]);

/** Returns true if this question is the last in its section. */
export const isLastInSection = (qId) => {
    const s = sectionForQuestion(qId);
    return s && qId === s.range[1];
};