// ============================================================
// console.error / window.onerror キャプチャ → /api/log/error
// オプトイン (localStorage 'core_error_capture_optin' === '1' のとき送信)
// env が無ければ Edge Function 側で noop なので、誤って何も漏らさない
// ============================================================

const OPTIN_KEY = 'core_error_capture_optin';
const LOCAL_BUFFER_KEY = 'core_error_log_v1';
const MAX_LOCAL = 50;
let installed = false;

function isOptedIn(): boolean {
  try { return localStorage.getItem(OPTIN_KEY) === '1'; } catch { return false; }
}

export function setErrorCaptureOptIn(v: boolean) {
  try { localStorage.setItem(OPTIN_KEY, v ? '1' : '0'); } catch { /* */ }
}

interface ErrorEntry {
  type: 'console' | 'window' | 'unhandledrejection';
  message: string;
  stack?: string;
  url: string;
  ts: number;
}

function pushLocal(entry: ErrorEntry) {
  try {
    const raw = localStorage.getItem(LOCAL_BUFFER_KEY);
    const arr: ErrorEntry[] = raw ? JSON.parse(raw) : [];
    arr.unshift(entry);
    localStorage.setItem(LOCAL_BUFFER_KEY, JSON.stringify(arr.slice(0, MAX_LOCAL)));
  } catch { /* */ }
}

function send(entry: ErrorEntry) {
  pushLocal(entry);
  if (!isOptedIn()) return;
  try {
    fetch('/api/log/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true,
    }).catch(() => { /* swallow */ });
  } catch { /* */ }
}

function fmt(args: unknown[]): string {
  return args.map(a => {
    if (a instanceof Error) return `${a.name}: ${a.message}`;
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ').slice(0, 2000);
}

export function installErrorCapture() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      send({
        type: 'console',
        message: fmt(args),
        url: window.location.href,
        ts: Date.now(),
      });
    } catch { /* */ }
    origError(...args);
  };

  window.addEventListener('error', (ev) => {
    send({
      type: 'window',
      message: ev.message || 'window.onerror',
      stack: ev.error?.stack?.slice(0, 2000),
      url: window.location.href,
      ts: Date.now(),
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    send({
      type: 'unhandledrejection',
      message: reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason).slice(0, 2000),
      stack: reason instanceof Error ? reason.stack?.slice(0, 2000) : undefined,
      url: window.location.href,
      ts: Date.now(),
    });
  });
}
