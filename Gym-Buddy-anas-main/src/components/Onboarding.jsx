import { useState } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { ACCENTS, applyAccent, getStoredAccentId, markOnboarded } from '../lib/personalization.js';

const GOALS = [
  { id: 'muscle gain', label: 'Muscle Gain', iconKey: 'dumbbell', desc: 'Build size with hypertrophy splits.' },
  { id: 'fat loss',    label: 'Fat Loss',    iconKey: 'fire',     desc: 'Burn fat with high-intensity work.' },
  { id: 'strength',    label: 'Strength',    iconKey: 'trophy',   desc: 'Heavy compounds, real overload.' },
  { id: 'cardio',      label: 'Cardio',      iconKey: 'activity', desc: 'Endurance, conditioning, stamina.' },
];

const LEVELS = [
  { id: 'beginner',     label: 'Beginner',     desc: 'New to training or returning after a break.' },
  { id: 'intermediate', label: 'Intermediate', desc: '6+ months of consistent training.' },
  { id: 'advanced',     label: 'Advanced',     desc: 'Years in — chasing fine-tuned progress.' },
];

const STEP_COUNT = 6;

/**
 * First-login onboarding overlay. Collects goal, level, body metrics
 * and an accent color, merges them into the Store user, then marks
 * onboarding done so it never shows again.
 */
export default function Onboarding({ onComplete }) {
  const user = Store.get('user');
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(user?.goal || 'muscle gain');
  const [level, setLevel] = useState('intermediate');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [accentId, setAccentId] = useState(getStoredAccentId());

  const firstName = (user?.name || 'Athlete').trim().split(/\s+/)[0];

  function pickAccent(id) {
    setAccentId(id);
    applyAccent(id); // live preview — re-themes the overlay instantly
  }

  function finish() {
    const current = Store.get('user') || {};
    Store.set('user', {
      ...current,
      goal,
      experience_level: level,
      ...(height ? { height_cm: Number(height) } : {}),
      ...(weight ? { weight_kg: Number(weight) } : {}),
      ...(age ? { age: Number(age) } : {}),
    });
    applyAccent(accentId);
    markOnboarded();
    onComplete?.();
  }

  const next = () => setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="onb-overlay" role="dialog" aria-modal="true" aria-label="Welcome to GymBuddy">
      <div className="onb-ambient" aria-hidden="true">
        <span className="onb-glow onb-glow-1" />
        <span className="onb-glow onb-glow-2" />
      </div>

      <div className="onb-card">
        {/* Progress dots */}
        <div className="onb-progress" aria-hidden="true">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span key={i} className={`onb-dot ${i <= step ? 'is-on' : ''} ${i === step ? 'is-current' : ''}`} />
          ))}
        </div>

        {/* Step body — keyed so each step replays its entrance animation */}
        <div className="onb-step" key={step}>
          {step === 0 && (
            <>
              <div className="onb-badge"><span className="onb-badge-dot" /> Welcome aboard</div>
              <h2 className="onb-h">Let&apos;s set you up, <span className="onb-accent">{firstName}</span></h2>
              <p className="onb-p">
                A few quick taps and GymBuddy tunes itself to how you train. Takes under a minute.
              </p>
              <div className="onb-welcome-icons" aria-hidden="true">
                <span>{icon('dumbbell', 26)}</span>
                <span>{icon('chart', 26)}</span>
                <span>{icon('trophy', 26)}</span>
                <span>{icon('fire', 26)}</span>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="onb-h">What&apos;s your main <span className="onb-accent">goal</span>?</h2>
              <p className="onb-p">We&apos;ll shape plans and coaching around this.</p>
              <div className="onb-grid onb-grid-2">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`onb-choice ${goal === g.id ? 'is-selected' : ''}`}
                    onClick={() => setGoal(g.id)}
                  >
                    <span className="onb-choice-icon">{icon(g.iconKey, 22)}</span>
                    <span className="onb-choice-label">{g.label}</span>
                    <span className="onb-choice-desc">{g.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="onb-h">Your experience <span className="onb-accent">level</span></h2>
              <p className="onb-p">So the AI coach pitches advice at the right depth.</p>
              <div className="onb-grid">
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`onb-choice onb-choice-row ${level === l.id ? 'is-selected' : ''}`}
                    onClick={() => setLevel(l.id)}
                  >
                    <span className="onb-choice-label">{l.label}</span>
                    <span className="onb-choice-desc">{l.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="onb-h">A few <span className="onb-accent">body metrics</span></h2>
              <p className="onb-p">Optional — powers BMI and progress charts. You can skip and add later.</p>
              <div className="onb-fields">
                <label className="onb-field">
                  <span>Height (cm)</span>
                  <input type="number" min="80" max="250" value={height}
                         onChange={(e) => setHeight(e.target.value)} placeholder="175" />
                </label>
                <label className="onb-field">
                  <span>Weight (kg)</span>
                  <input type="number" min="30" max="300" value={weight}
                         onChange={(e) => setWeight(e.target.value)} placeholder="80" />
                </label>
                <label className="onb-field">
                  <span>Age</span>
                  <input type="number" min="13" max="100" value={age}
                         onChange={(e) => setAge(e.target.value)} placeholder="25" />
                </label>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="onb-h">Pick your <span className="onb-accent">accent</span></h2>
              <p className="onb-p">Colors the whole app. Change it anytime in your profile.</p>
              <div className="onb-swatches">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`onb-swatch ${accentId === a.id ? 'is-selected' : ''}`}
                    onClick={() => pickAccent(a.id)}
                    aria-label={a.label}
                  >
                    <span className="onb-swatch-dot" style={{ background: a.hex }} />
                    <span className="onb-swatch-label">{a.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="onb-done-mark" aria-hidden="true">{icon('check', 34)}</div>
              <h2 className="onb-h">You&apos;re all <span className="onb-accent">set</span></h2>
              <p className="onb-p">
                GymBuddy is tuned to your goal and ready. Time to log your first session.
              </p>
              <ul className="onb-summary">
                <li>{icon('check', 14)} Goal — <strong>{goal}</strong></li>
                <li>{icon('check', 14)} Level — <strong>{level}</strong></li>
                <li>{icon('check', 14)} Accent — <strong>{ACCENTS.find((a) => a.id === accentId)?.label}</strong></li>
              </ul>
            </>
          )}
        </div>

        {/* Footer controls */}
        <div className="onb-actions">
          {step > 0 && step < STEP_COUNT - 1 && (
            <button type="button" className="onb-btn onb-btn-ghost" onClick={back}>
              Back
            </button>
          )}
          {step === 3 && (
            <button type="button" className="onb-btn onb-btn-ghost" onClick={next}>
              Skip
            </button>
          )}
          {step < STEP_COUNT - 1 ? (
            <button type="button" className="onb-btn onb-btn-primary" onClick={next}>
              Continue {icon('arrow', 16)}
            </button>
          ) : (
            <button type="button" className="onb-btn onb-btn-primary" onClick={finish}>
              {icon('zap', 16)} Enter GymBuddy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
