import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import RoutineProgram from './pages/RoutineProgram.jsx';
import WorkoutSession from './pages/WorkoutSession.jsx';
import { api, clearAuthToken, getAuthToken, setAuthToken } from './lib/api.js';

const USER_KEY = 'workout-tracker-user';

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function Login({ onLogin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onLogin(pin);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center bg-app-bg px-4 py-12 text-app-text">
      <section className="mx-auto w-full max-w-sm">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-app-accent">Workout Tracker</p>
        <h1 className="mb-8 text-3xl font-semibold">Tus entrenamientos</h1>
        <form onSubmit={handleSubmit} className="rounded-2xl border border-app-border bg-app-panel p-6">
          <label htmlFor="pin" className="mb-2 block text-sm text-app-muted">
            Código PIN de 6 dígitos
          </label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="mb-4 w-full rounded-lg border border-app-border bg-app-bg px-4 py-3 outline-none focus:border-app-accent"
            placeholder="••••••"
          />
          <button
            disabled={submitting}
            className="w-full rounded-lg bg-app-accent px-4 py-3 font-semibold text-app-bg transition-colors hover:bg-app-accent-hover disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
          {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        </form>
      </section>
    </main>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState(readStoredUser);

  async function handleLogin(pin) {
    const result = await api.login(pin);
    setAuthToken(result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user ?? null));
    setToken(result.token);
    setUser(result.user ?? null);
    navigate('/app/dashboard', { replace: true });
  }

  function handleLogout() {
    clearAuthToken();
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    navigate('/', { replace: true });
  }

  return (
    <Routes>
      <Route
        path="/"
        element={token ? <Navigate to="/app/dashboard" replace /> : <Login onLogin={handleLogin} />}
      />
      <Route
        path="/app/dashboard"
        element={token
          ? (
            <Dashboard
              user={user}
              onLogout={handleLogout}
              onOpenProgram={(program) => navigate(
                `/app/programs/${program.id}`,
                { state: { program } },
              )}
            />
          )
          : <Navigate to="/" replace />}
      />
      <Route
        path="/app/programs/:programId"
        element={token ? <RoutineProgram /> : <Navigate to="/" replace />}
      />
      <Route
        path="/app/workouts/:routineId"
        element={token ? <WorkoutSession /> : <Navigate to="/" replace />}
      />
      <Route
        path="*"
        element={<Navigate to={token ? '/app/dashboard' : '/'} replace />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
