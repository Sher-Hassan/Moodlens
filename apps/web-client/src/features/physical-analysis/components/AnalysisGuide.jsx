import './AnalysisGuide.css';

export default function AnalysisGuide() {
    return (
        <div className="pa-guide">
            <div className="pa-guide__item">
                <span className="pa-guide__icon pa-guide__icon--steps">👣</span>
                <div className="pa-guide__text">
                    <h4>Motion (Steps)</h4>
                    <p>Your base activity level. We track consistency—not just high peaks—to see how active your lifestyle is.</p>
                </div>
            </div>
            <div className="pa-guide__item">
                <span className="pa-guide__icon pa-guide__icon--sleep">☾</span>
                <div className="pa-guide__text">
                    <h4>Rest (Sleep)</h4>
                    <p>The foundation of mental clarity. We look at your sleep duration to calculate your recovery capacity.</p>
                </div>
            </div>
            <div className="pa-guide__item">
                <span className="pa-guide__icon pa-guide__icon--energy">⚡</span>
                <div className="pa-guide__text">
                    <h4>Effort (Energy)</h4>
                    <p>Active calories burned. This tells us the intensity of your movement compared to your rest.</p>
                </div>
            </div>
        </div>
    );
}