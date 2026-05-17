import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import "./Home.css";

const ROTATING_WORDS = ["anxious", "drained", "restless", "foggy", "wired"];

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Home() {
  const { user } = useUser();
  if (user) return <Navigate to="/dashboard" replace />;
  const [wordIndex, setWordIndex] = useState(0);
  const now = useNow();

  useEffect(() => {
    const id = setInterval(
      () => setWordIndex((i) => (i + 1) % ROTATING_WORDS.length),
      2600
    );
    return () => clearInterval(id);
  }, []);

  const tick = now.toLocaleTimeString("en-GB", { hour12: false });

  return (
    <main className="home">
      {/* Atmosphere */}
      <div className="home__aurora" aria-hidden="true" />
      <div className="home__grain" aria-hidden="true" />

      {/* ECG scanline crossing the background */}
      <svg
        className="home__ecg"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ecgFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(11,239,196,0)" />
            <stop offset="50%" stopColor="rgba(11,239,196,0.55)" />
            <stop offset="100%" stopColor="rgba(11,239,196,0)" />
          </linearGradient>
        </defs>
        <path
          className="home__ecg-path"
          d="M0 100 L 320 100 L 340 80 L 354 130 L 366 40 L 380 160 L 396 100 L 720 100 L 740 80 L 754 130 L 766 40 L 780 160 L 796 100 L 1120 100 L 1140 80 L 1154 130 L 1166 40 L 1180 160 L 1196 100 L 1440 100"
          fill="none"
          stroke="url(#ecgFade)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      
      

      {/* Hero */}
      <section className="home__hero">

        <h1 className="home__headline">
          <span className="home__line">You feel</span>
          <span className="home__rotator">
            <span
              key={ROTATING_WORDS[wordIndex]}
              className="home__rotator-word"
            >
              {ROTATING_WORDS[wordIndex]}
            </span>
            <span className="home__rotator-stroke" aria-hidden="true" />
          </span>
          <span className="home__line home__line--quiet">We see why.</span>
        </h1>

        <p className="home__lede">
          MoodLens translates the silent data inside your wearables — sleep,
          motion, energy — into something that actually helps. Built on Apple
          Health. Refined for the mind.
        </p>

        <div className="home__cta">
          <Link to="/register" className="home__btn home__btn--primary">
            Begin
            <span className="home__btn-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link to="/login" className="home__btn home__btn--ghost">
            I already have an account
          </Link>
        </div>

        {/* Inline marker row */}
        <div className="home__markers" aria-hidden="true">
          <div className="home__marker">
            <span className="home__marker-dot home__marker-dot--teal" />
            <span className="home__marker-label">SLEEP</span>
          </div>
          <div className="home__marker">
            <span className="home__marker-dot home__marker-dot--amber" />
            <span className="home__marker-label">ENERGY</span>
          </div>
          <div className="home__marker">
            <span className="home__marker-dot home__marker-dot--violet" />
            <span className="home__marker-label">MIND</span>
          </div>
        </div>
      </section>

      {/* Footer ledger */}
      <footer className="home__ledger" aria-hidden="true">
        <span>READING · PASSIVE</span>
        <span className="home__ledger-sep">·</span>
        <span>PRIVACY · LOCAL FIRST</span>
        <span className="home__ledger-sep">·</span>
        <span>MOODLENS · 2026</span>
      </footer>
    </main>
  );
}

export default Home;