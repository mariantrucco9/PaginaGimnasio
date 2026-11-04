import { useState } from 'react';

export default function ExerciseTracker({ exerciseLog, onAddSet, readOnly = false }) {
  const [expanded, setExpanded] = useState(true);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sets = exerciseLog.sets ?? [];
  const lastSet = sets[sets.length - 1];

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onAddSet(exerciseLog.id, {
        weight: Number(weight),
        reps: Number(reps),
        weightUnit: 'kg',
      });
      setWeight('');
      setReps('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-app-border bg-app-panel">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-lg font-semibold">{exerciseLog.exerciseName}</span>
          <span className="mt-1 block text-sm text-app-muted">
            {sets.length} {sets.length === 1 ? 'serie registrada' : 'series registradas'}
          </span>
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-app-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-app-border px-5 pb-5 pt-4">
          {lastSet && !readOnly ? (
            <p className="mb-4 text-xs text-app-muted">
              Última serie de hoy: {lastSet.weight}{lastSet.weightUnit} × {lastSet.reps}
            </p>
          ) : !readOnly && (
            <p className="mb-4 text-xs text-app-muted">Historial reciente: disponible próximamente.</p>
          )}

          {sets.length > 0 && (
            <ol className="mb-5 space-y-2" aria-label={`Series de ${exerciseLog.exerciseName}`}>
              {sets.map((set) => (
                <li
                  key={set.id}
                  className="flex items-center justify-between rounded-lg bg-app-elevated px-3 py-2 text-sm"
                >
                  <span className="text-app-muted">Serie {set.setNumber}</span>
                  <span className="font-medium">{set.weight} {set.weightUnit} × {set.reps}</span>
                </li>
              ))}
            </ol>
          )}

          {!readOnly && (
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label htmlFor={`weight-${exerciseLog.id}`} className="mb-1.5 block text-xs text-app-muted">
                Peso (kg)
              </label>
              <input
                id={`weight-${exerciseLog.id}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder={lastSet ? String(lastSet.weight) : 'Ej. 80'}
                className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2.5 text-sm outline-none focus:border-app-accent"
              />
            </div>
            <div>
              <label htmlFor={`reps-${exerciseLog.id}`} className="mb-1.5 block text-xs text-app-muted">
                Repeticiones
              </label>
              <input
                id={`reps-${exerciseLog.id}`}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                required
                value={reps}
                onChange={(event) => setReps(event.target.value)}
                placeholder="Ej. 8"
                className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2.5 text-sm outline-none focus:border-app-accent"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="col-span-2 self-end rounded-lg bg-app-accent px-4 py-2.5 text-sm font-semibold text-app-bg transition-colors hover:bg-app-accent-hover disabled:cursor-wait disabled:opacity-60 sm:col-span-1"
            >
              {saving ? 'Guardando…' : 'Registrar serie'}
            </button>
            </form>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        </div>
      )}
    </article>
  );
}
