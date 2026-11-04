import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

function getExerciseName(item) {
  return item.exercise?.name ?? item.exerciseName ?? 'Ejercicio';
}

export default function RoutineProgram() {
  const { programId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [program, setProgram] = useState(location.state?.program ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api.getPrograms()
      .then((programs) => {
        if (!active) return;
        const found = programs.find((item) => item.id === Number(programId));
        if (!found) {
          setError('No se encontró esta rutina.');
          return;
        }
        setProgram(found);
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
  }, [programId]);

  return (
    <main className="min-h-screen bg-app-bg px-4 py-8 text-app-text sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <Link
            to="/app/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm text-app-muted transition-colors hover:text-app-accent"
          >
            <span aria-hidden="true">←</span> Volver a mis rutinas
          </Link>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-app-accent">
            Rutina compuesta
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {program?.name ?? 'Rutina'}
          </h1>
          {program && (
            <p className="mt-2 text-sm text-app-muted">
              {program.days?.length ?? 0} días de entrenamiento
            </p>
          )}
        </header>

        {loading && (
          <p role="status" className="rounded-xl border border-app-border bg-app-panel p-5 text-app-muted">
            Cargando rutina…
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-200">
            {error}
          </p>
        )}

        {!loading && !error && program && (
          <div className="space-y-4">
            {program.days?.map((day, index) => (
              <section key={day.id} className="rounded-2xl border border-app-border bg-app-panel p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-app-accent">
                      Día {index + 1}
                    </p>
                    <h2 className="text-xl font-semibold">{day.name}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/workouts/${day.id}`, { state: { routine: day, program } })}
                    className="rounded-lg bg-app-accent px-4 py-2.5 text-sm font-semibold text-app-bg transition-colors hover:bg-app-accent-hover"
                  >
                    Iniciar entrenamiento
                  </button>
                </div>

                {day.description && <p className="mb-4 text-sm text-app-muted">{day.description}</p>}

                {day.exercises?.length ? (
                  <ol className="space-y-2">
                    {day.exercises.map((item, exerciseIndex) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg bg-app-bg/60 px-3 py-2.5 text-sm"
                      >
                        <span className="w-6 shrink-0 text-xs tabular-nums text-app-muted">
                          {exerciseIndex + 1}.
                        </span>
                        <span>{getExerciseName(item)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-lg bg-app-bg/60 px-3 py-3 text-sm text-app-muted">
                    Este día todavía no tiene ejercicios.
                  </p>
                )}
              </section>
            ))}

            {!program.days?.length && (
              <p className="rounded-xl border border-app-border bg-app-panel p-5 text-sm text-app-muted">
                Esta rutina todavía no tiene días configurados.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
