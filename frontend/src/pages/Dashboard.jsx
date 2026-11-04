import ActivityCalendar from '../components/ActivityCalendar.jsx';
import RoutineList from '../components/RoutineList.jsx';

export default function Dashboard({ user, onLogout, onOpenProgram }) {
  const displayName = user?.name === 'Usuario personal' ? 'Mariano' : user?.name;

  return (
    <main className="min-h-screen bg-app-bg px-4 py-8 text-app-text sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-app-accent">
              Workout Tracker
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tu progreso</h1>
            {displayName && <p className="mt-2 text-sm text-app-muted">Hola, {displayName}</p>}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-app-border px-4 py-2 text-sm text-app-muted transition-colors hover:bg-app-panel hover:text-app-text"
          >
            Cerrar sesión
          </button>
        </header>

        <div className="space-y-8">
          <RoutineList onOpenProgram={onOpenProgram} />
          <ActivityCalendar />
        </div>
      </div>
    </main>
  );
}
