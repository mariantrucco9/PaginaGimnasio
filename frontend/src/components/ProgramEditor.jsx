import { useState } from 'react';

function createEmptyDay(index) {
  return { name: `Día ${index + 1}`, exercises: [] };
}

export default function ProgramEditor({ program, onSave, onCancel, saving, error }) {
  const [name, setName] = useState(program?.name ?? '');
  const [days, setDays] = useState(() => (
    program?.days?.map((day) => ({
      id: day.id,
      name: day.name,
      exercises: (day.exercises ?? []).map((item) => item.exercise?.name ?? item.exerciseName ?? ''),
    })) ?? [createEmptyDay(0)]
  ));
  const [exerciseDrafts, setExerciseDrafts] = useState({});

  function updateDay(index, patch) {
    setDays((current) => current.map((day, dayIndex) => (
      dayIndex === index ? { ...day, ...patch } : day
    )));
  }

  function addDay() {
    setDays((current) => [...current, createEmptyDay(current.length)]);
  }

  function removeDay(index) {
    setDays((current) => current.filter((_, dayIndex) => dayIndex !== index));
    setExerciseDrafts((current) => {
      const next = {};
      Object.entries(current).forEach(([key, value]) => {
        const dayIndex = Number(key);
        if (dayIndex < index) next[dayIndex] = value;
        if (dayIndex > index) next[dayIndex - 1] = value;
      });
      return next;
    });
  }

  function addExercise(index) {
    const exerciseName = (exerciseDrafts[index] ?? '').trim();
    if (!exerciseName) return;
    updateDay(index, { exercises: [...days[index].exercises, exerciseName] });
    setExerciseDrafts((current) => ({ ...current, [index]: '' }));
  }

  function removeExercise(dayIndex, exerciseIndex) {
    updateDay(dayIndex, {
      exercises: days[dayIndex].exercises.filter((_, index) => index !== exerciseIndex),
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      name: name.trim(),
      days: days.map((day) => ({
        ...(day.id ? { id: day.id } : {}),
        name: day.name.trim(),
        exercises: day.exercises,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-editor-title"
        className="my-auto w-full max-w-2xl rounded-2xl border border-app-border bg-app-panel p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="program-editor-title" className="text-xl font-semibold">
              {program ? 'Editar rutina compuesta' : 'Crear nueva rutina'}
            </h2>
            <p className="mt-1 text-sm text-app-muted">
              Define el plan, sus días y los ejercicios de cada día.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar formulario"
            className="rounded-lg px-2 py-1 text-xl leading-none text-app-muted hover:bg-app-elevated hover:text-app-text"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="program-name" className="mb-1.5 block text-sm font-medium">
              Nombre de la rutina
            </label>
            <input
              id="program-name"
              type="text"
              maxLength={120}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Rutina PowerBuilding"
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2.5 text-sm outline-none focus:border-app-accent"
            />
          </div>

          <div className="space-y-4">
            {days.map((day, dayIndex) => (
              <fieldset key={day.id ?? `new-${dayIndex}`} className="rounded-xl border border-app-border p-4">
                <div className="mb-3 flex items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`day-name-${dayIndex}`} className="mb-1.5 block text-xs font-medium text-app-muted">
                      Día {dayIndex + 1}
                    </label>
                    <input
                      id={`day-name-${dayIndex}`}
                      type="text"
                      maxLength={120}
                      required
                      value={day.name}
                      onChange={(event) => updateDay(dayIndex, { name: event.target.value })}
                      placeholder={`Ej. Día ${dayIndex + 1}: Empuje`}
                      className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2.5 text-sm outline-none focus:border-app-accent"
                    />
                  </div>
                  {days.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDay(dayIndex)}
                      className="rounded-lg px-3 py-2.5 text-xs text-red-300 hover:bg-app-elevated"
                    >
                      Quitar día
                    </button>
                  )}
                </div>

                {day.exercises.length > 0 && (
                  <ul className="mb-3 space-y-1.5">
                    {day.exercises.map((exercise, exerciseIndex) => (
                      <li
                        key={`${exercise}-${exerciseIndex}`}
                        className="flex items-center justify-between gap-3 rounded-lg bg-app-elevated px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">{exercise}</span>
                        <button
                          type="button"
                          onClick={() => removeExercise(dayIndex, exerciseIndex)}
                          aria-label={`Quitar ${exercise}`}
                          className="shrink-0 text-app-muted hover:text-red-300"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={120}
                    value={exerciseDrafts[dayIndex] ?? ''}
                    onChange={(event) => setExerciseDrafts((current) => ({
                      ...current,
                      [dayIndex]: event.target.value,
                    }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addExercise(dayIndex);
                      }
                    }}
                    placeholder="Agregar ejercicio"
                    aria-label={`Agregar ejercicio al día ${dayIndex + 1}`}
                    className="min-w-0 flex-1 rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm outline-none focus:border-app-accent"
                  />
                  <button
                    type="button"
                    onClick={() => addExercise(dayIndex)}
                    className="rounded-lg border border-app-border px-3 py-2 text-sm text-app-accent hover:bg-app-elevated"
                  >
                    Agregar
                  </button>
                </div>
              </fieldset>
            ))}
          </div>

          {days.length < 14 && (
            <button
              type="button"
              onClick={addDay}
              className="w-full rounded-lg border border-dashed border-app-border px-4 py-3 text-sm text-app-accent hover:bg-app-elevated"
            >
              + Agregar día
            </button>
          )}

          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

          <div className="flex flex-col-reverse gap-3 border-t border-app-border pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-app-border px-4 py-2.5 text-sm text-app-muted hover:bg-app-elevated"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-app-accent px-4 py-2.5 text-sm font-semibold text-app-bg hover:bg-app-accent-hover disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? 'Guardando…' : program ? 'Guardar cambios' : 'Crear rutina'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
