const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const TOKEN_KEY = 'workout-tracker-token';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const { auth = true, headers: requestHeaders, ...fetchOptions } = options;
  const headers = new Headers(requestHeaders);
  const token = auth ? getAuthToken() : null;

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (fetchOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Intenta nuevamente.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && body.error
      ? body.error
      : 'Ocurrió un error al comunicarse con el servidor.';
    throw new Error(message);
  }

  return body;
}

export const api = {
  login(pin) {
    return request('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ pin }),
    });
  },

  getCalendar() {
    return request('/api/calendar');
  },

  getRoutines() {
    return request('/api/routines');
  },

  getPrograms() {
    return request('/api/programs');
  },

  createProgram(program) {
    return request('/api/programs', {
      method: 'POST',
      body: JSON.stringify(program),
    });
  },

  updateProgram(programId, program) {
    return request(`/api/programs/${programId}`, {
      method: 'PUT',
      body: JSON.stringify(program),
    });
  },

  deleteProgram(programId) {
    return request(`/api/programs/${programId}`, { method: 'DELETE' });
  },

  startWorkout(routineId, date) {
    return request('/api/workouts', {
      method: 'POST',
      body: JSON.stringify({ routineId, date }),
    });
  },

  getWorkout(workoutId) {
    return request(`/api/workouts/${workoutId}`);
  },

  getPastWorkouts(routineId) {
    return request(`/api/routines/${routineId}/workouts`);
  },

  completeWorkout(workoutId) {
    return request(`/api/workouts/${workoutId}/complete`, { method: 'POST' });
  },

  addSet(exerciseLogId, set) {
    return request(`/api/exercise-logs/${exerciseLogId}/sets`, {
      method: 'POST',
      body: JSON.stringify(set),
    });
  },

  addExtraExercise(workoutId, exercise) {
    return request(`/api/workouts/${workoutId}/extra-exercise`, {
      method: 'POST',
      body: JSON.stringify(exercise),
    });
  },
};
