import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { icon } from '../icons.jsx';
import { Toast } from '../lib/interactions.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import AppHeader from '../components/AppHeader.jsx';
import { getSharedSplit, importSharedSplit } from '../services/splitsApi.js';
import { WeekStrip, DAY_FULL } from '../components/planner/SplitBuilder.jsx';

/**
 * Read-only view of a shared split.
 *
 * Auth is not checked here: this route sits inside AuthenticatedChrome, which
 * returns a <Navigate to="/login"> before <Outlet/> renders. That ordering is
 * what guarantees a logged-out visitor never sees split content — not even for
 * a frame — and it carries the intended path so login can return them here.
 *
 * Three terminal states, deliberately distinct: loading, gone (revoked or
 * never existed — getSharedSplit returns null data with null error for both),
 * and a network/config failure, which is recoverable and says so.
 */
export default function SharedSplitPage() {
  const { slug } = useParams();
  const navigateToPage = useContext(NavigateContext);

  const [state, setState] = useState('loading'); // loading | ready | gone | error
  const [row, setRow] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    let alive = true;
    setState('loading');
    getSharedSplit(slug)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setErrorMsg(String(error.message || error));
          setState('error');
          return;
        }
        if (!data) { setState('gone'); return; }
        setRow(data);
        setState('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setErrorMsg(String(err?.message || err));
        setState('error');
      });
    return () => { alive = false; };
  }, [slug]);

  async function handleImport() {
    if (importing || imported) return;
    setImporting(true);
    try {
      const { data, error } = await importSharedSplit(row);
      if (error) {
        Toast.show('Could not import this split. Please try again.', 'error', 5000);
        return;
      }
      setImported(true);
      Toast.show(`"${data.name}" added to your splits.`, 'success', 3000);
    } finally {
      setImporting(false);
    }
  }

  const days = row?.days || [];
  const trainingDays = days.filter((d) => d?.type === 'plan').length;

  return (
    <div className="split-shared">
      <AppHeader
        title="Shared split"
        eyebrow="From a friend"
        subtitle={state === 'ready' ? `Shared by ${row.owner_display_name || 'a GymBuddy user'}` : undefined}
      />

      {state === 'loading' && (
        <div className="split-state" aria-live="polite">
          <p className="split-state-title">Loading…</p>
        </div>
      )}

      {state === 'gone' && (
        <div className="split-state" role="status">
          <p className="split-state-title">This link isn’t active</p>
          <p className="split-state-body">
            The owner revoked it, or it never existed. Ask them for a fresh link.
          </p>
          <button
            type="button"
            className="split-btn is-primary"
            onClick={() => navigateToPage?.('planner')}
          >
            Go to my plans
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="split-state" role="alert">
          <p className="split-state-title">Couldn’t load this split</p>
          <p className="split-state-body">{errorMsg || 'Check your connection and try again.'}</p>
          <button
            type="button"
            className="split-btn is-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}

      {state === 'ready' && (
        <>
          <section className="split-detail">
            <h2 className="split-detail-name">{row.name}</h2>
            {row.description && <p className="split-detail-desc">{row.description}</p>}
            <WeekStrip days={days} />
            <p className="split-count">
              {trainingDays} training {trainingDays === 1 ? 'day' : 'days'} · {7 - trainingDays} rest
            </p>
          </section>

          <button
            type="button"
            className="split-btn is-primary split-import"
            onClick={handleImport}
            disabled={importing || imported}
          >
            {imported
              ? <>{icon('check', 16)} Added to my splits</>
              : importing
                ? 'Importing…'
                : <>{icon('plus', 16)} Import to my plans</>}
          </button>
          <p className="split-hint split-hint-center">
            Import makes your own editable copy. Changes you make won’t affect the original.
          </p>

          <ul className="split-daylist is-readonly">
            {days.map((d, i) => (
              <li className={`split-day ${d.type === 'plan' ? 'is-training' : 'is-rest'}`} key={i}>
                <div className="split-day-head is-static">
                  <span className="split-day-name">{DAY_FULL[i]}</span>
                  <span className="split-day-sum">
                    {d.type === 'plan' ? (d.planName || 'Training') : 'Rest'}
                  </span>
                </div>
                {d.type === 'plan' && (d.exercises || []).length > 0 && (
                  <ul className="split-exsummary">
                    {d.exercises.map((e) => (
                      <li key={e.id}>
                        <span className="split-ex-name">{e.name}</span>
                        <span className="split-ex-muscles">{e.muscles}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
