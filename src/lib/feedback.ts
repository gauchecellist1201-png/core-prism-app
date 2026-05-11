// ============================================================
// CORE Prism / Iris — フィードバック収集
// localStorage に蓄積し、/api/feedback があれば送信も行う
// ============================================================

export interface FeedbackEntry {
  id: string;
  brand: 'prism' | 'iris';
  nps: number;          // 0-10
  comment: string;
  email: string;
  url: string;
  userAgent: string;
  ts: number;
}

const STORAGE_KEY = 'core_feedback_v1';
const MAX_ENTRIES = 200;

export function listFeedback(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLocal(entry: FeedbackEntry) {
  const all = listFeedback();
  all.unshift(entry);
  const trimmed = all.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota exceeded — drop silently */
  }
}

export interface SubmitInput {
  brand: 'prism' | 'iris';
  nps: number;
  comment: string;
  email: string;
}

export async function submitFeedback(input: SubmitInput): Promise<{ ok: boolean; sent: boolean }> {
  const entry: FeedbackEntry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    brand: input.brand,
    nps: Math.max(0, Math.min(10, Math.round(input.nps))),
    comment: input.comment.trim().slice(0, 4000),
    email: input.email.trim().slice(0, 200),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : '',
    ts: Date.now(),
  };

  saveLocal(entry);

  let sent = false;
  try {
    const resp = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    sent = resp.ok;
  } catch {
    sent = false;
  }

  return { ok: true, sent };
}

export function clearFeedback() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}
