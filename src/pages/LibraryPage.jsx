import { useContext, useEffect, useMemo, useState } from 'react';
import { Store } from '../store.js';
import { EXERCISES } from '../data.js';
import { CATEGORY_TABS } from '../components/workouts/helpers.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { Toast } from '../lib/interactions.js';
import { icon } from '../icons.jsx';
import AppHeader from '../components/AppHeader.jsx';
import ExerciseTile from '../components/library/ExerciseTile.jsx';
import ExerciseDetail from '../components/library/ExerciseDetail.jsx';

/* Category tabs are shared with the in-session picker (helpers.js) so the two
   surfaces never drift apart on ids or labels. */

/** ms to wait after the last keystroke before re-filtering. */
const SEARCH_DEBOUNCE = 200;

export default function LibraryPage() {
  const navigateToPage = useContext(NavigateContext);
  const [cat, setCat] = useState('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [openEx, setOpenEx] = useState(null);

  // Debounced search: typing stays at 60fps, filtering runs once you pause.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE);
    return () => window.clearTimeout(id);
  }, [query]);

  /* Flatten the catalogue and tag each entry with the category key it came
     from. data.js keeps its shape — the category is derived here, in the
     component, because the raw records don't carry one. */
  const allExercises = useMemo(
    () => Object.entries(EXERCISES).flatMap(
      ([category, list]) => list.map((e) => ({ ...e, category }))
    ),
    []
  );

  const counts = useMemo(() => {
    const c = { all: allExercises.length };
    allExercises.forEach((e) => { c[e.category] = (c[e.category] || 0) + 1; });
    return c;
  }, [allExercises]);

  const labelForCategory = useMemo(() => {
    const map = {};
    CATEGORY_TABS.forEach((t) => { map[t.id] = t.label; });
    return map;
  }, []);

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return allExercises.filter((e) => {
      if (cat !== 'all' && e.category !== cat) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q)
        || (e.muscles || '').toLowerCase().includes(q);
    });
  }, [allExercises, cat, debouncedQuery]);

  /* With no filter and no search, show the catalogue in its natural groups —
     34 undifferentiated tiles read as a wall. Any filter or query collapses it
     to one flat, ranked grid, because then the grouping is the answer. */
  const grouped = cat === 'all' && !debouncedQuery.trim();
  const sections = useMemo(() => {
    if (!grouped) return [];
    return Object.keys(EXERCISES).map((key) => ({
      key,
      label: labelForCategory[key] || key,
      items: results.filter((e) => e.category === key),
    })).filter((s) => s.items.length > 0);
  }, [grouped, results, labelForCategory]);

  function clearFilters() {
    setCat('all');
    setQuery('');
  }

  /* Adding from the library: if a workout is running we can genuinely append to
     it, so we do, and land the user on the session. With no session there is
     nothing to append to — the honest behaviour is to just go to Train rather
     than pretend something was queued. */
  const hasSession = !!Store.get('activeSession');
  function handleAdd(exercise) {
    if (hasSession) {
      Store.addExerciseToSession(exercise.id);
      Toast.show(`${exercise.name} added to your workout`, 'success', 1800);
    }
    setOpenEx(null);
    navigateToPage?.('workouts');
  }

  return (
    <div className="lib">
      <AppHeader
        title="Exercises"
        eyebrow="Library"
        subtitle={`${counts.all} movements across ${CATEGORY_TABS.length - 1} categories`}
      />

      {/* Sticky control bar — search then filters, pinned just under the
          collapsed header so both survive the scroll. */}
      <div className="lib-controls">
        <div className="lib-search">
          <span className="lib-search-icon" aria-hidden="true">{icon('search', 17)}</span>
          <input
            type="search"
            className="lib-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises or muscles…"
            aria-label="Search exercises or muscles"
            autoComplete="off"
          />
        </div>

        <div className="lib-chips" role="group" aria-label="Filter by category">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`lib-chip ${cat === t.id ? 'is-active' : ''}`}
              onClick={() => setCat(t.id)}
              aria-pressed={cat === t.id}
            >
              {t.label}
              <span className="lib-chip-count">{counts[t.id] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stays mounted so the live region can announce every filter change, but
          goes visually silent while grouped — there the section headings and the
          chip badges already carry the counts, so showing it too is noise. */}
      <p className={`lib-count ${grouped ? 'is-quiet' : ''}`} aria-live="polite">
        {results.length} exercise{results.length === 1 ? '' : 's'}
      </p>

      {results.length === 0 ? (
        <div className="lib-empty">
          <p className="lib-empty-title">No exercises match</p>
          <p className="lib-empty-body">
            Nothing here for “{query.trim() || labelForCategory[cat]}”. Try a
            different muscle or movement name.
          </p>
          <button type="button" className="lib-empty-btn" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : grouped ? (
        sections.map((s) => (
          <section className="lib-section" key={s.key}>
            <h2 className="lib-section-title">
              {s.label}
              <span className="lib-section-count">{s.items.length}</span>
            </h2>
            <Grid items={s.items} onOpen={setOpenEx} />
          </section>
        ))
      ) : (
        <Grid items={results} onOpen={setOpenEx} />
      )}

      <ExerciseDetail
        exercise={openEx}
        categoryLabel={openEx ? labelForCategory[openEx.category] : ''}
        addLabel={hasSession ? 'Add to workout' : 'Go to Train'}
        onAdd={handleAdd}
        onClose={() => setOpenEx(null)}
      />
    </div>
  );
}

function Grid({ items, onOpen }) {
  return (
    <div className="lib-grid">
      {items.map((e) => (
        /* gifUrl is intentionally not passed yet — see the WORKOUTX
           INTEGRATION POINT comment inside ExerciseTile. */
        <ExerciseTile key={e.id} exercise={e} onOpen={onOpen} />
      ))}
    </div>
  );
}
