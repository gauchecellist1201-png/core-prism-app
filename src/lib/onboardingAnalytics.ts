const EVENTS_KEY = 'core_events_v1';

interface OBEvent {
  name: string;
  props?: Record<string, unknown>;
  ts: string;
}

function loadEvents(): OBEvent[] {
  try {
    const r = localStorage.getItem(EVENTS_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

export function logEvent(name: string, props?: Record<string, unknown>): void {
  try {
    const events = loadEvents();
    events.push({ name, props, ts: new Date().toISOString() });
    // Keep last 500 events to avoid unbounded growth
    const trimmed = events.slice(-500);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed));
  } catch { /* quota — silently drop */ }
}

export function getEventStats(): Record<string, number> {
  const events = loadEvents();
  const counts: Record<string, number> = {};
  for (const e of events) {
    counts[e.name] = (counts[e.name] ?? 0) + 1;
  }
  return counts;
}

export function clearEvents(): void {
  localStorage.removeItem(EVENTS_KEY);
}
