import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const WEEKDAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function monthName(date, options = { month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('es', options).format(date);
}

function getMonthDates(month) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function MonthGrid({ month, activeDates, compact = false }) {
  const dates = getMonthDates(month);
  const currentMonth = month.getMonth();
  const todayKey = dateKey(new Date());

  return (
    <div>
      <div className={`grid grid-cols-7 ${compact ? 'mb-1 gap-0.5' : 'mb-2 gap-1'}`}>
        {WEEKDAYS.map((day) => (
          <span key={day} className={`text-center text-app-muted ${compact ? 'text-[9px]' : 'text-xs'}`}>
            {compact ? day.slice(0, 1) : day}
          </span>
        ))}
      </div>
      <div className={`grid grid-cols-7 ${compact ? 'gap-0.5' : 'gap-1.5'}`}>
        {dates.map((date) => {
          const key = dateKey(date);
          const hasActivity = activeDates.has(key);
          const outsideMonth = date.getMonth() !== currentMonth;
          const isToday = key === todayKey;
          const classes = [
            'flex items-center justify-center rounded-md tabular-nums',
            compact ? 'aspect-square text-[8px]' : 'aspect-square text-[10px] sm:text-xs',
            outsideMonth && !hasActivity ? 'text-app-muted/40' : 'text-app-text',
            hasActivity ? 'bg-app-accent font-semibold text-app-bg' : 'bg-app-elevated',
            isToday && !hasActivity ? 'ring-1 ring-app-accent' : '',
          ].join(' ');

          return (
            <span
              key={key}
              title={`${formatDate(date)}${hasActivity ? ' · Entrenamiento registrado' : ''}`}
              aria-label={`${formatDate(date)}${hasActivity ? ', entrenamiento registrado' : ''}`}
              className={classes}
            >
              {date.getDate()}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function ActivityCalendar() {
  const [activityDates, setActivityDates] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const activeDates = useMemo(() => new Set(activityDates), [activityDates]);

  useEffect(() => {
    let active = true;

    api.getCalendar()
      .then((dates) => {
        if (active) setActivityDates(Array.isArray(dates) ? dates : []);
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

  function moveMonth(amount) {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1));
  }

  function moveYear(amount) {
    setVisibleMonth((month) => new Date(month.getFullYear() + amount, month.getMonth(), 1));
  }

  function selectYearMonth(monthIndex) {
    setVisibleMonth((month) => new Date(month.getFullYear(), monthIndex, 1));
    setView('month');
  }

  return (
    <section
      aria-labelledby="activity-calendar-title"
      className="mx-auto max-w-md rounded-2xl border border-app-border bg-app-panel p-3 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="activity-calendar-title" className="text-base font-semibold">Actividad</h2>
          <p className="mt-0.5 text-xs text-app-muted">
            {loading ? 'Cargando actividad…' : `${activityDates.length} días con entrenamiento`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView((current) => current === 'month' ? 'year' : 'month')}
          className="rounded-lg border border-app-border px-2.5 py-1.5 text-xs font-medium text-app-accent transition-colors hover:bg-app-elevated"
        >
          {view === 'month' ? 'Ver año' : 'Ver mes'}
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : view === 'month' ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="Mes anterior"
              className="rounded-lg border border-app-border px-2.5 py-1 text-sm text-app-muted hover:bg-app-elevated hover:text-app-text"
            >
              ‹
            </button>
            <h3 className="text-center text-sm font-medium capitalize">{monthName(visibleMonth)}</h3>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Mes siguiente"
              className="rounded-lg border border-app-border px-2.5 py-1 text-sm text-app-muted hover:bg-app-elevated hover:text-app-text"
            >
              ›
            </button>
          </div>
          <MonthGrid month={visibleMonth} activeDates={activeDates} compact />
          <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-app-muted">
            <span>Sin actividad</span>
            <span className="h-2.5 w-2.5 rounded-sm bg-app-elevated" />
            <span className="h-2.5 w-2.5 rounded-sm bg-app-accent" />
            <span>Entrenamiento</span>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveYear(-1)}
              aria-label="Año anterior"
              className="rounded-lg border border-app-border px-3 py-2 text-app-muted hover:bg-app-elevated hover:text-app-text"
            >
              ‹
            </button>
            <h3 className="text-center text-lg font-medium">{visibleMonth.getFullYear()}</h3>
            <button
              type="button"
              onClick={() => moveYear(1)}
              aria-label="Año siguiente"
              className="rounded-lg border border-app-border px-3 py-2 text-app-muted hover:bg-app-elevated hover:text-app-text"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, index) => {
              const month = new Date(visibleMonth.getFullYear(), index, 1);
              return (
                <button
                  type="button"
                  key={index}
                  onClick={() => selectYearMonth(index)}
                  aria-label={`Ver ${monthName(month)}`}
                  className="rounded-xl border border-app-border bg-app-bg/40 p-3 text-left transition-colors hover:border-app-accent/60"
                >
                  <span className="mb-2 block text-sm font-medium capitalize">{monthName(month, { month: 'long' })}</span>
                  <MonthGrid month={month} activeDates={activeDates} compact />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
