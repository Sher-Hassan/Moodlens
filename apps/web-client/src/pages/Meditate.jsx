import { useCallback, useEffect, useRef, useState } from 'react';
import './Meditate.css';

/* ─────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────── */

// SVG box corners (viewBox 0 0 400 400, 72px margin for glow room)
const B = { x1: 72, y1: 72, x2: 328, y2: 328 };

const PHASE_DUR  = 4;   // seconds per phase
const CYCLE_DUR  = 16;  // seconds per full cycle

// Phase → semantic color
const PC = {
    inhale : '#0BEFC4',   // teal  — rising, fresh
    hold1  : '#B794F4',   // violet — still, aware
    exhale : '#60A5FA',   // blue  — releasing, calm
    hold2  : '#F5C842',   // amber — grounded, warm
};

const PRESETS = [
    { l: '2 min',  s: 120  },
    { l: '5 min',  s: 300  },
    { l: '10 min', s: 600  },
    { l: '15 min', s: 900  },
    { l: '20 min', s: 1200 },
];

/* ─────────────────────────────────────────────────────
   Pure helpers (outside component — never re-created)
───────────────────────────────────────────────────── */

const fmt = (sec) =>
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/**
 * Returns the exact dot (x, y) for a given cycle time (0–16s).
 * Clockwise from bottom-left:
 *   Inhale  → up the left side
 *   Hold 1  → right across the top
 *   Exhale  → down the right side
 *   Hold 2  → left across the bottom
 */
const calcDot = (t) => {
    const { x1, y1, x2, y2 } = B;
    if (t < 4)  return { x: x1,                            y: y2 - (t / 4)        * (y2 - y1) };
    if (t < 8)  return { x: x1 + ((t - 4) / 4) * (x2 - x1), y: y1 };
    if (t < 12) return { x: x2,                            y: y1 + ((t - 8) / 4)  * (y2 - y1) };
    return             { x: x2 - ((t - 12) / 4) * (x2 - x1), y: y2 };
};

const calcPhase = (t) =>
    t < 4 ? 'inhale' : t < 8 ? 'hold1' : t < 12 ? 'exhale' : 'hold2';

/**
 * SVG arc path tracing clockwise progress (0→1) around the dot.
 * Gives a "phase clock" that resets every 4 seconds.
 */
const calcArc = ({ x, y }, progress) => {
    if (progress <= 0 || progress >= 0.999) return '';
    const r = 25, a0 = -Math.PI / 2;
    const a1 = a0 + progress * 2 * Math.PI;
    return [
        `M ${x + r * Math.cos(a0)} ${y + r * Math.sin(a0)}`,
        `A ${r} ${r} 0 ${progress > 0.5 ? 1 : 0} 1`,
        `${x + r * Math.cos(a1)} ${y + r * Math.sin(a1)}`,
    ].join(' ');
};

/* ─────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────── */

export default function Meditate() {
    const [phase,      setPhase]      = useState('inhale');
    const [isRunning,  setIsRunning]  = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [remaining,  setRemaining]  = useState(300);
    const [duration,   setDuration]   = useState(300);
    const [cycles,     setCycles]     = useState(0);

    // ── Refs for direct DOM animation (60fps, no React overhead) ──
    const dotEl  = useRef(null);   // main dot circle
    const glowEl = useRef(null);   // large blurred halo behind dot
    const arcEl  = useRef(null);   // progress arc around dot

    // ── Refs for animation control ──
    const rafId    = useRef(null);
    const ivId     = useRef(null);
    const t0       = useRef(null);   // session start timestamp
    const phaseR   = useRef('inhale');
    const cyclesR  = useRef(0);
    const runR     = useRef(false);  // mirrors isRunning without closure issues

    /* Writes cx/cy/fill directly to the SVG dot elements.
       React never owns these attributes so they won't be clobbered on re-renders. */
    const placeDot = useCallback((x, y, color) => {
        [dotEl.current, glowEl.current].forEach((el) => {
            if (!el) return;
            el.setAttribute('cx', x);
            el.setAttribute('cy', y);
            if (color) el.setAttribute('fill', color);
        });
    }, []);

    /* The animation loop. Runs at ~60fps via rAF. */
    const tick = useCallback(() => {
        if (!runR.current || !t0.current) return;

        const elapsed  = (Date.now() - t0.current) / 1000;
        const ct       = elapsed % CYCLE_DUR;
        const pos      = calcDot(ct);
        const ph       = calcPhase(ct);
        const progress = (ct % PHASE_DUR) / PHASE_DUR;
        const col      = PC[ph];

        // Direct DOM — no React re-renders for position or color
        placeDot(pos.x, pos.y, col);
        if (arcEl.current) {
            arcEl.current.setAttribute('d',      calcArc(pos, progress));
            arcEl.current.setAttribute('stroke', col);
        }

        // Phase change: triggers React re-render ONLY for side glow (every 4s)
        if (ph !== phaseR.current) {
            phaseR.current = ph;
            setPhase(ph);
        }

        // Cycle counter update
        const c = Math.floor(elapsed / CYCLE_DUR);
        if (c !== cyclesR.current) {
            cyclesR.current = c;
            setCycles(c);
        }

        rafId.current = requestAnimationFrame(tick);
    }, [placeDot]);

    /* Stop the session (done=true means timer reached 0). */
    const stop = useCallback((done = false) => {
        runR.current = false;
        if (rafId.current) cancelAnimationFrame(rafId.current);
        if (ivId.current)  clearInterval(ivId.current);
        setIsRunning(false);
        if (done) {
            setIsComplete(true);
            setRemaining(0);
        }
    }, []);

    /* Start a new session. */
    const begin = useCallback(() => {
        // Reset all state
        setIsComplete(false);
        setPhase('inhale');
        setCycles(0);
        setRemaining(duration);
        phaseR.current  = 'inhale';
        cyclesR.current = 0;
        runR.current    = true;
        t0.current      = Date.now();

        // Put dot at starting position (bottom-left corner)
        placeDot(B.x1, B.y2, PC.inhale);
        if (arcEl.current) arcEl.current.setAttribute('d', '');

        // Kick off animation loop
        rafId.current = requestAnimationFrame(tick);

        // Countdown timer (1s resolution is fine here)
        let rem = duration;
        ivId.current = setInterval(() => {
            rem -= 1;
            setRemaining(rem);
            if (rem <= 0) stop(true);
        }, 1000);

        setIsRunning(true);
    }, [duration, tick, stop, placeDot]);

    // Set initial dot position on mount
    useEffect(() => {
        placeDot(B.x1, B.y2, PC.inhale);
    }, [placeDot]);

    // Cleanup on unmount (navigation away mid-session)
    useEffect(() => () => {
        if (rafId.current) cancelAnimationFrame(rafId.current);
        if (ivId.current)  clearInterval(ivId.current);
    }, []);

    /* SVG line with per-phase glow */
    const Side = ({ p, x1, y1, x2, y2 }) => (
        <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            className="med-side"
            stroke={phase === p ? PC[p] : 'rgba(36,48,68,0.55)'}
            strokeWidth={phase === p ? 2.5 : 1}
            filter={phase === p ? 'url(#gs)' : undefined}
        />
    );

    return (
        <main className={`meditate med-phase--${phase}${isRunning ? ' is-running' : ''}`}>

            {/* ── Ambient aurora (4 layers, one per phase direction) ── */}
            <div className="med-aurora" aria-hidden="true">
                {Object.keys(PC).map((p) => (
                    <div
                        key={p}
                        className={`med-slab med-slab--${p}${phase === p && isRunning ? ' is-on' : ''}`}
                    />
                ))}
            </div>
            <div className="med-left">
            {/* ── Session timer ── */}
            <time className="med-timer" dateTime={`PT${remaining}S`}>
                {fmt(remaining)}
            </time>

            {/* ── The breathing box (SVG) ── */}
            <div
                className="med-canvas"
                role="img"
                aria-label="Box breathing visualization — follow the moving dot"
            >
                <svg viewBox="0 0 400 400" className="med-svg">
                    <defs>
                        {/* Glow for the active side */}
                        <filter id="gs" x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="5" result="b" />
                            <feMerge>
                                <feMergeNode in="b" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                        {/* Glow for the dot halo */}
                        <filter id="gd" x="-80%" y="-80%" width="260%" height="260%">
                            <feGaussianBlur stdDeviation="10" result="b" />
                            <feMerge>
                                <feMergeNode in="b" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Subtle box fill */}
                    <rect
                        x={B.x1} y={B.y1}
                        width={B.x2 - B.x1} height={B.y2 - B.y1}
                        fill="rgba(12,21,37,0.5)"
                        stroke="none"
                    />

                    {/* Four sides — each lights up for its phase */}
                    <Side p="inhale" x1={B.x1} y1={B.y2} x2={B.x1} y2={B.y1} /> {/* left  */}
                    <Side p="hold1"  x1={B.x1} y1={B.y1} x2={B.x2} y2={B.y1} /> {/* top   */}
                    <Side p="exhale" x1={B.x2} y1={B.y1} x2={B.x2} y2={B.y2} /> {/* right */}
                    <Side p="hold2"  x1={B.x2} y1={B.y2} x2={B.x1} y2={B.y2} /> {/* bottom */}

                    {/* Corner anchors */}
                    {[[B.x1, B.y1], [B.x2, B.y1], [B.x2, B.y2], [B.x1, B.y2]].map(([x, y], i) => (
                        <circle
                            key={i} cx={x} cy={y} r={4}
                            fill="#0C1525"
                            stroke="rgba(36,48,68,0.9)"
                            strokeWidth={1.5}
                        />
                    ))}

                    {/* ─ Phase progress arc (fills 0→100% over 4s, resets) ─ */}
                    {/* React owns: fill, strokeWidth, strokeLinecap, opacity   */}
                    {/* Direct DOM owns: d, stroke                              */}
                    <path
                        ref={arcEl}
                        fill="none"
                        strokeWidth={2}
                        strokeLinecap="round"
                        opacity={isRunning ? 0.65 : 0}
                    />

                    {/* ─ Dot glow halo (blurred, large) ─ */}
                    <circle
                        ref={glowEl}
                        r={22}
                        opacity={isRunning ? 0.3 : 0}
                        filter="url(#gd)"
                    />

                    {/* ─ Main dot ─ */}
                    {/* cx, cy, fill → managed by placeDot() via direct DOM    */}
                    {/* opacity → managed by React (show/hide based on state)  */}
                    <circle
                        ref={dotEl}
                        r={11}
                        opacity={isRunning ? 1 : 0.18}
                    />
                </svg>
            </div>
            </div>
            <div className="med-right">
            {/* ── Status row under the box ── */}
            <div className="med-status">
                {isComplete ? (
                    <div className="med-done">
                        <span className="med-done__glyph" aria-hidden="true">✦</span>
                        <p className="med-done__title">Session complete</p>
                        <p className="med-done__sub">
                            {cycles} full {cycles === 1 ? 'cycle' : 'cycles'}
                        </p>
                    </div>
                ) : isRunning ? (
                    <p className="med-count" key={cycles}>
                        {cycles === 0 ? '—' : `${cycles} ${cycles === 1 ? 'cycle' : 'cycles'}`}
                    </p>
                ) : (
                    <p className="med-hint">
                        4 · 4 · 4 · 4 &nbsp;·&nbsp; follow the light
                    </p>
                )}
            </div>

            {/* ── Begin / End button ── */}
            <div className="med-controls">
                {!isRunning ? (
                    <button className="med-btn med-btn--start" onClick={begin}>
                        {isComplete ? 'Again' : 'Begin'}
                    </button>
                ) : (
                    <button
                        className="med-btn med-btn--stop"
                        onClick={() => stop(false)}
                        aria-label="End meditation session"
                    >
                        End session
                    </button>
                )}
            </div>

            {/* ── Duration presets (hidden while running) ── */}
            {!isRunning && (
                <nav className="med-presets" aria-label="Session duration">
                    {PRESETS.map((p) => (
                        <button
                            key={p.s}
                            className={`med-preset ${duration === p.s ? 'is-active' : ''}`}
                            onClick={() => {
                                setDuration(p.s);
                                setRemaining(p.s);
                                setIsComplete(false);
                                placeDot(B.x1, B.y2, PC.inhale);
                            }}
                        >
                            {p.l}
                        </button>
                    ))}
                </nav>
            )}
            </div>
        </main>
    );
}