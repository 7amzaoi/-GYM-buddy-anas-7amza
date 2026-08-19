import { Store } from '../store.js';
import { computeXp, levelFromXp, titleForLevel } from '../lib/gamification.js';

/**
 * XP / level card.
 *
 * Extracted verbatim from DashboardPage when the Dashboard became the
 * athletic-editorial "Today" screen (which has no room for it). Kept as a
 * standalone component so the gamification feature survives the redesign; it is
 * mounted on Profile rather than deleted.
 */
export default function XpCard() {
  const progress = Store.get('progressData');
  const history = Store.get('workoutHistory');
  const records = Store.get('records') || [];

  const xp = computeXp({ history, records, streak: progress.streak || 0 });
  const lvl = levelFromXp(xp);
  const tier = titleForLevel(lvl.level);

  return (
    <div className="gx-card dash-xp" data-reveal>
      <div className="dash-xp-head">
        <div className="dash-xp-left">
          <span className="dash-xp-tier">{tier}</span>
          <h3 className="dash-xp-level">
            Level <span className="dash-xp-level-num">{lvl.level}</span>
          </h3>
        </div>
        <div className="dash-xp-right">
          <span className="dash-xp-current" data-counter={xp}>{xp.toLocaleString()}</span>
          <span className="dash-xp-suffix">XP</span>
        </div>
      </div>
      <div className="dash-xp-track">
        <div className="dash-xp-fill" style={{ width: `${lvl.pct}%` }} />
      </div>
      <div className="dash-xp-foot">
        <span>{lvl.currentInLevel.toLocaleString()} / {lvl.neededForLevel.toLocaleString()} XP this level</span>
        <span className="dash-xp-next">
          {(lvl.neededForLevel - lvl.currentInLevel).toLocaleString()} to Level {lvl.level + 1}
        </span>
      </div>
    </div>
  );
}
