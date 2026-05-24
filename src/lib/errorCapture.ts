// ============================================================
// 自前 telemetry — console.error / window.onerror / unhandledrejection
//   - オプトイン (localStorage 'core_telemetry_optin' === '1' のみ送信)
//   - rate limit: 同一エラーは 60s 内 5 回まで
//   - ring buffer: 直近 50 件をメモリ + localStorage に保持
//   - 失敗時は localStorage キューに積み、次の visibility 時に再送
//   - 個人情報は乗せない (pathname のみ、入力値・メアド・名前は除外)
// ============================================================

const OPTIN_KEY = 'core_telemetry_optin';
const OPTIN_KEY_LEGACY = 'core_error_capture_optin'; // 旧キー (互換)
const LOCAL_BUFFER_KEY = 'core_error_log_v1';
const PENDING_QUEUE_KEY = 'core_telemetry_pending_v1';
const MAX_LOCAL = 50;
const MAX_PENDING = 30;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

let installed = false;

// ─── オプトイン管理 ───
export function isTelemetryOptedIn(): boolean {
  try {
    if (localStorage.getItem(OPTIN_KEY) === '1') return true;
    if (localStorage.getItem(OPTIN_KEY_LEGACY) === '1') return true;
    return false;
  } catch {
    return false;
  }
}

export function setTelemetryOptIn(v: boolean) {
  try {
    localStorage.setItem(OPTIN_KEY, v ? '1' : '0');
    // 旧キーも同期 (削除はしない、他コードが読んでる可能性)
    localStorage.setItem(OPTIN_KEY_LEGACY, v ? '1' : '0');
  } catch {
    /* */
  }
}

// 後方互換 export
export const setErrorCaptureOptIn = setTelemetryOptIn;

// ─── ブランド / 環境情報 ───
function detectBrand(): 'prism' | 'iris' | 'corp' | 'unknown' {
  try {
    const p = window.location.pathname;
    if (p.startsWith('/iris')) return 'iris';
    if (p.startsWith('/corp') || p.startsWith('/company')) return 'corp';
    return 'prism';
  } catch {
    return 'unknown';
  }
}

function getPersonaId(): string | null {
  try {
    // tenant prefix 配下を順に探す (key 名は usePersonas が決めるので幅広く)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith(':active_persona_id_v1')) {
        return localStorage.getItem(k);
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getAppVersion(): string {
  try {
    // Vite が build hash を埋め込む場合は import.meta.env.VITE_APP_VERSION を見る
    const v = (import.meta as any).env?.VITE_APP_VERSION as string | undefined;
    if (v) return v;
  } catch {
    /* */
  }
  return 'dev';
}

function getViewport(): string {
  try {
    return `${window.innerWidth}x${window.innerHeight}`;
  } catch {
    return '';
  }
}

// ─── エラーエントリ ───
interface ErrorEntry {
  type: 'console' | 'window' | 'unhandledrejection';
  message: string;
  stack?: string;
  url: string; // pathname のみ (個人情報を含む可能性のある query は除外)
  ts: number;
  // 追加メタ
  ua?: string;
  viewport?: string;
  referrer?: string;
  brand?: string;
  personaId?: string | null;
  version?: string;
}

// pathname だけ取り出して個人情報リスクを下げる
function safePath(): string {
  try {
    return window.location.pathname || '/';
  } catch {
    return '/';
  }
}

function buildMeta(): Partial<ErrorEntry> {
  return {
    ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 240) : '',
    viewport: getViewport(),
    referrer: typeof document !== 'undefined' ? (document.referrer || '').slice(0, 240) : '',
    brand: detectBrand(),
    personaId: getPersonaId(),
    version: getAppVersion(),
  };
}

// ─── rate limit (同一エラーの message+stack hash で算出) ───
function hashKey(message: string, stack?: string): string {
  const src = (message || '') + '|' + (stack || '').slice(0, 200);
  // 簡易ハッシュ (FNV-1a 風)
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

const rateMap = new Map<string, number[]>();

function isRateLimited(message: string, stack?: string): boolean {
  const key = hashKey(message, stack);
  const now = Date.now();
  const arr = (rateMap.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    rateMap.set(key, arr);
    return true;
  }
  arr.push(now);
  rateMap.set(key, arr);
  return false;
}

// ─── ring buffer (localStorage) ───
function pushLocal(entry: ErrorEntry) {
  try {
    const raw = localStorage.getItem(LOCAL_BUFFER_KEY);
    const arr: ErrorEntry[] = raw ? JSON.parse(raw) : [];
    arr.unshift(entry);
    localStorage.setItem(LOCAL_BUFFER_KEY, JSON.stringify(arr.slice(0, MAX_LOCAL)));
  } catch {
    /* */
  }
}

export function readLocalErrors(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_BUFFER_KEY);
    return raw ? (JSON.parse(raw) as ErrorEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearLocalErrors() {
  try {
    localStorage.removeItem(LOCAL_BUFFER_KEY);
  } catch {
    /* */
  }
}

// ─── pending queue (送信失敗時) ───
function pushPending(entry: ErrorEntry) {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    const arr: ErrorEntry[] = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    localStorage.setItem(
      PENDING_QUEUE_KEY,
      JSON.stringify(arr.slice(-MAX_PENDING)),
    );
  } catch {
    /* */
  }
}

function drainPending(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ErrorEntry[];
    localStorage.removeItem(PENDING_QUEUE_KEY);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// ─── 送信 ───
async function postEntry(entry: ErrorEntry): Promise<boolean> {
  try {
    const res = await fetch('/api/log/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function send(entry: ErrorEntry) {
  // ring buffer には常時記録 (ローカル閲覧用、オプトイン無関係)
  pushLocal(entry);
  if (!isTelemetryOptedIn()) return;
  if (isRateLimited(entry.message, entry.stack)) return;

  postEntry(entry).then((ok) => {
    if (!ok) pushPending(entry);
  });
}

async function flushPending() {
  if (!isTelemetryOptedIn()) return;
  const queued = drainPending();
  for (const e of queued) {
    const ok = await postEntry(e);
    if (!ok) {
      pushPending(e);
      break; // 連続失敗で無限ループしないように 1 回で止める
    }
  }
}

// ─── format ───
function fmt(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')
    .slice(0, 2000);
}

// ─── install ───
export function installErrorCapture() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      send({
        type: 'console',
        message: fmt(args),
        url: safePath(),
        ts: Date.now(),
        ...buildMeta(),
      });
    } catch {
      /* */
    }
    origError(...args);
  };

  window.addEventListener('error', (ev) => {
    send({
      type: 'window',
      message: ev.message || 'window.onerror',
      stack: ev.error?.stack?.slice(0, 2000),
      url: safePath(),
      ts: Date.now(),
      ...buildMeta(),
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    send({
      type: 'unhandledrejection',
      message:
        reason instanceof Error
          ? `${reason.name}: ${reason.message}`
          : String(reason).slice(0, 2000),
      stack: reason instanceof Error ? reason.stack?.slice(0, 2000) : undefined,
      url: safePath(),
      ts: Date.now(),
      ...buildMeta(),
    });
  });

  // visibility 復帰 / load 時に pending を flush
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void flushPending();
    }
  });
  window.addEventListener('load', () => {
    void flushPending();
  });
}
