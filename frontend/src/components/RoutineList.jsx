import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import ProgramEditor from './ProgramEditor.jsx';

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

export default function RoutineList({ onOpenProgram }) {
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editorProgram, setEditorProgram] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState('');

  useEffect(() => {
    let active = true;

    api.getPrograms()
      .then((data) => {
        if (active) setPrograms(Array.isArray(data) ? data : []);
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
  }, []);

  function openCreateEditor() {
    setEditorProgram(null);
    setEditorError('');
    setEditorOpen(true);
  }

  function openEditEditor(program) {
    setEditorProgram(program);
    setEditorError('');
    setEditorOpen(true);
  }

  async function saveProgram(payload) {
    setSaving(true);
    setEditorError('');
    try {
      const saved = editorProgram
        ? await api.updateProgram(editorProgram.id, payload)
        : await api.createProgram(payload);
      setPrograms((current) => {
        const found = current.some((program) => program.id === saved.id);
        return found
          ? current.map((program) => program.id === saved.id ? saved : program)
          : [...current, saved];
      });
      setEditorOpen(false);
      setEditorProgram(null);
    } catch (requestError) {
      setEditorError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProgram(program) {
    const confirmed = window.confirm(
      `¿Eliminar “${program.name}”? Se archivarán sus días, pero las sesiones y series históricas se conservarán.`,
    );
    if (!confirmed) return;

    setError('');
    try {
      await api.deleteProgram(program.id);
      setPrograms((current) => current.filter((item) => item.id !== program.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <section aria-labelledby="routine-list-title">
      <div className="mb-4">
        <h2 id="routine-list-title" className="text-xl font-semibold">Mis rutinas</h2>
        <p className="mt-1 text-sm text-app-muted">Abre una rutina compuesta para ver sus días de entrenamiento</p>
      </div>

      {loading && <p className="text-sm text-app-muted">Cargando rutinas…</p>}
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </p>
      )}
      {!loading && !error && programs.length === 0 && (
        <div className="mb-4 rounded-2xl border border-dashed border-app-border bg-app-panel p-7 text-center">
          <p className="font-medium">Todavía no tienes rutinas compuestas</p>
          <p className="mt-2 text-sm text-app-muted">Crea una rutina y organiza en ella tus días y ejercicios.</p>
        </div>
      )}

      {programs.length > 0 && (
        <ul className="space-y-4">
          {programs.map((program) => (
            <li key={program.id} className="rounded-2xl border border-app-border bg-app-panel">
              <div className="flex items-start justify-between gap-3 p-5">
                <button
                  type="button"
                  onClick={() => onOpenProgram?.(program)}
                  className="min-w-0 flex-1 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-app-accent"
                >
                  <h3 className="truncate text-lg font-semibold">{program.name}</h3>
                  <p className="mt-1 text-sm text-app-muted">
                    {program.days?.length ?? 0} días de entrenamiento
                  </p>
                  <span className="mt-3 inline-block text-sm font-medium text-app-accent">
                    Ver rutina y ejercicios →
                  </span>
                </button>

                <details className="group relative shrink-0">
                  <summary
                    aria-label={`Opciones de ${program.name}`}
                    className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-app-muted hover:bg-app-elevated hover:text-app-text [&::-webkit-details-marker]:hidden"
                  >
                    <MoreIcon />
                  </summary>
                  <div className="absolute right-0 top-10 z-10 min-w-32 rounded-lg border border-app-border bg-app-elevated p-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => openEditEditor(program)}
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-app-panel"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProgram(program)}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-red-300 hover:bg-app-panel"
                    >
                      Eliminar
                    </button>
                  </div>
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={openCreateEditor}
        className="mt-4 w-full rounded-xl border border-dashed border-app-accent/60 bg-app-panel px-5 py-4 text-sm font-semibold text-app-accent transition-colors hover:bg-app-elevated"
      >
        + Crear nueva rutina
      </button>

      {editorOpen && (
        <ProgramEditor
          program={editorProgram}
          onSave={saveProgram}
          onCancel={() => {
            if (!saving) {
              setEditorOpen(false);
              setEditorProgram(null);
            }
          }}
          saving={saving}
          error={editorError}
        />
      )}
    </section>
  );
}
