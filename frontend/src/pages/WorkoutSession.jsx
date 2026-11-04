import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import ExerciseTracker from '../components/ExerciseTracker.jsx';
import { api } from '../lib/api.js';

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  const [year, month, day] = dateString.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export default function WorkoutSession() {
  const { routineId } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedWorkoutId = searchParams.get('workoutId');
  const [workout, setWorkout] = useState(null);
  const [routine, setRoutine] = useState(location.state?.routine ?? null);
  const [pastWorkouts, setPastWorkouts] = useState([]);
  const [showPastWorkouts, setShowPastWorkouts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [extraName, setExtraName] = useState('');
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [addingExtra, setAddingExtra] = useState(false);
  const [extraError, setExtraError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    Promise.all([
      selectedWorkoutId
        ? api.getWorkout(Number(selectedWorkoutId))
        : api.startWorkout(Number(routineId), getLocalDate()),
      api.getRoutines(),
      api.getPastWorkouts(Number(routineId)),
    ])
      .then(([session, routines, pastSessions]) => {
        if (!active) return;
        if (session.routineId !== Number(routineId)) {
          throw new Error('La sesión seleccionada no corresponde a esta rutina.');
        }
        setWorkout(session);
        setRoutine(routines.find((item) => item.id === Number(routineId)) ?? location.state?.routine ?? null);
        setPastWorkouts(Array.isArray(pastSessions) ? pastSessions : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [routineId, selectedWorkoutId]);

  const readOnly = Boolean(selectedWorkoutId || workout?.completedAt);

  async function handleAddSet(exerciseLogId, set) {
    const savedSet = await api.addSet(exerciseLogId, set);
    setWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => (
        exercise.id === exerciseLogId
          ? {
            ...exercise,
            sets: [...(exercise.sets ?? []), savedSet]
              .sort((first, second) => first.setNumber - second.setNumber),
          }
          : exercise
      )),
    }));
  }

  async function handleAddExtra(event) {
    event.preventDefault();
    setExtraError('');
    setAddingExtra(true);
    try {
      const exercise = await api.addExtraExercise(workout.id, { exerciseName: extraName });
      setWorkout((current) => ({
        ...current,
        exercises: [...(current.exercises ?? []), { ...exercise, sets: [] }],
      }));
      setExtraName('');
      setShowExtraForm(false);
    } catch (requestError) {
      setExtraError(requestError.message);
    } finally {
      setAddingExtra(false);
    }
  }

  async function handleFinishWorkout() {
    setFinishError('');
    setFinishing(true);
    try {
      const completedWorkout = await api.completeWorkout(workout.id);
      setWorkout((current) => ({ ...current, ...completedWorkout }));
    } catch (requestError) {
      setFinishError(requestError.message);
    } finally {
      setFinishing(false);
    }
  }

  function showToday() {
    setSearchParams({});
    setShowPastWorkouts(false);
  }

  function selectPastWorkout(pastWorkout) {
    setSearchParams({ workoutId: String(pastWorkout.id) });
    setShowPastWorkouts(false);
  }

  return (
    <main className="min-h-screen bg-app-bg px-4 py-8 text-app-text sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <Link
            to="/app/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm text-app-muted transition-colors hover:text-app-accent"
          >
            <span aria-hidden="true">←</span> Volver al dashboard
          </Link>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-app-accent">
            {readOnly ? 'Sesión guardada' : 'Sesión de hoy'} · {workout ? formatDate(workout.date) : formatDate(getLocalDate())}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {routine?.name ?? 'Entrenamiento'}
            </h1>
            <button
              type="button"
              onClick={() => setShowPastWorkouts((show) => !show)}
              className="rounded-lg border border-app-border px-3 py-2 text-sm font-medium text-app-accent transition-colors hover:bg-app-panel"
            >
              Sesiones pasadas
            </button>
          </div>
          {routine?.description && <p className="mt-2 text-app-muted">{routine.description}</p>}
          {readOnly && (
            <button
              type="button"
              onClick={showToday}
              className="mt-3 text-sm text-app-accent underline underline-offset-4 hover:text-app-accent-hover"
            >
              Volver a la sesión de hoy
            </button>
          )}
        </header>

        {showPastWorkouts && (
          <section aria-label="Sesiones pasadas" className="mb-6 rounded-2xl border border-app-border bg-app-panel p-5">
            <h2 className="mb-3 font-semibold">Sesiones pasadas</h2>
            {pastWorkouts.length ? (
              <ul className="space-y-2">
                {pastWorkouts.map((pastWorkout) => (
                  <li key={pastWorkout.id}>
                    <button
                      type="button"
                      onClick={() => selectPastWorkout(pastWorkout)}
                      className="flex w-full items-center justify-between rounded-lg bg-app-elevated px-4 py-3 text-left transition-colors hover:bg-app-border"
                    >
                      <span>{formatDate(pastWorkout.date)}</span>
                      <span className="text-sm text-app-muted">
                        {pastWorkout.completedAt ? 'Completada' : 'Ver sesión'} →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-app-muted">Todavía no hay sesiones anteriores con series registradas.</p>
            )}
          </section>
        )}

        {loading && (
          <p role="status" className="rounded-xl border border-app-border bg-app-panel p-5 text-app-muted">
            Preparando tu sesión…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-xl border border-red-900/60 bg-red-950/30 p-5 text-red-200">
            <p>{error}</p>
            <Link to="/app/dashboard" className="mt-3 inline-block text-sm underline underline-offset-4">
              Volver a mis rutinas
            </Link>
          </div>
        )}

        {!loading && !error && workout && (
          <>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Ejercicios</h2>
              <span className="text-sm text-app-muted">
                {workout.exercises?.length ?? 0} en esta sesión
              </span>
            </div>
            {workout.exercises?.length ? (
              <div className="space-y-4">
                {workout.exercises.map((exercise) => (
                  <ExerciseTracker
                    key={exercise.id}
                    exerciseLog={exercise}
                    onAddSet={handleAddSet}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-app-border bg-app-panel p-5 text-sm text-app-muted">
                Esta sesión todavía no tiene ejercicios.
              </p>
            )}

            {!readOnly && (
              <>
                <section className="mt-6">
                  {!showExtraForm ? (
                    <button
                      type="button"
                      onClick={() => setShowExtraForm(true)}
                      className="w-full rounded-xl border border-dashed border-app-accent/60 bg-app-panel px-5 py-4 text-sm font-semibold text-app-accent transition-colors hover:bg-app-elevated"
                    >
                      + Agregar ejercicio extra
                    </button>
                  ) : (
                    <form onSubmit={handleAddExtra} className="rounded-2xl border border-app-border bg-app-panel p-5">
                      <p className="mb-3 text-xs text-app-muted">
                        Este ejercicio se agrega solo a esta sesión y no cambia la rutina.
                      </p>
                      <label htmlFor="extra-exercise-name" className="mb-2 block text-sm font-medium">
                        Nombre del ejercicio
                      </label>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          id="extra-exercise-name"
                          type="text"
                          maxLength={120}
                          required
                          autoFocus
                          value={extraName}
                          onChange={(event) => setExtraName(event.target.value)}
                          placeholder="Ej. Abdominales en polea"
                          className="min-w-0 flex-1 rounded-lg border border-app-border bg-app-bg px-3 py-2.5 text-sm outline-none focus:border-app-accent"
                        />
                        <button
                          type="submit"
                          disabled={addingExtra}
                          className="rounded-lg bg-app-accent px-4 py-2.5 text-sm font-semibold text-app-bg hover:bg-app-accent-hover disabled:opacity-60"
                        >
                          {addingExtra ? 'Agregando…' : 'Agregar'}
                        </button>
                        <button
                          type="button"
                          disabled={addingExtra}
                          onClick={() => {
                            setShowExtraForm(false);
                            setExtraError('');
                          }}
                          className="rounded-lg border border-app-border px-4 py-2.5 text-sm text-app-muted hover:bg-app-elevated"
                        >
                          Cancelar
                        </button>
                      </div>
                      {extraError && <p role="alert" className="mt-3 text-sm text-red-300">{extraError}</p>}
                    </form>
                  )}
                </section>

                <section className="mt-8 border-t border-app-border pt-6">
                  <button
                    type="button"
                    onClick={handleFinishWorkout}
                    disabled={finishing}
                    className="w-full rounded-xl border border-app-accent/50 bg-app-elevated px-5 py-4 text-sm font-semibold text-app-text transition-colors hover:border-app-accent hover:bg-app-panel disabled:cursor-wait disabled:opacity-60"
                  >
                    {finishing ? 'Guardando sesión…' : 'Terminar esta sesión de entrenamiento'}
                  </button>
                  {finishError && <p role="alert" className="mt-3 text-sm text-red-300">{finishError}</p>}
                </section>
              </>
            )}
            {workout.completedAt && !selectedWorkoutId && (
              <p role="status" className="mt-6 rounded-xl border border-app-border bg-app-panel p-4 text-sm text-app-muted">
                Sesión terminada. Los ejercicios y las series quedan disponibles en modo lectura.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
