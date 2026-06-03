// ============================================================
// themeManager.ts — グローバル テーマ (light / dark) ストア
//
// オーナー指示 (2026-06-04 第 21 波 YYY):
//   既存 useTheme は dashboard だけの useState。
//   LP / Pricing / Billing / Contact 等の どの画面でも一貫した切替が
//   できるよう、document.documentElement[data-theme] を 単一の真実源にし、
//   購読の仕組みを作る。
//
// 優先順位:
//   1. URL クエリ `?theme=light|dark`     (シェアリンクからの強制)
//   2. localStorage `core_theme`           (ユーザーの明示的選択)
//   3. ブラウザ matchMedia prefers-color-scheme
//   4. 既定 'light'
// ============================================================

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'core_theme';

const listeners = new Set<(t: Theme) => void>();

function applyToDom(t: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', t);
  // モバイル Safari 用 theme-color 反映 (UI bar 色)
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#070712' : '#FAFBFD');
  } catch { /* */ }
}

function readUrlParam(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const qp = new URL(window.location.href).searchParams.get('theme');
    if (qp === 'light' || qp === 'dark') return qp;
  } catch { /* */ }
  return null;
}

function readStorage(): Theme | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v as Theme;
  } catch { /* */ }
  return null;
}

function readMedia(): Theme | null {
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch { /* */ }
  return null;
}

/** 現在のテーマを取得 (URL → storage → media → 'light') */
export function detectTheme(): Theme {
  return readUrlParam() || readStorage() || readMedia() || 'light';
}

/** いま DOM に乗ってる data-theme を返す (起動時用) */
export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** 起動時に 1 回呼ぶ — main.tsx か LegalModal 等の上位で */
export function initTheme(): Theme {
  const t = detectTheme();
  applyToDom(t);
  // URL クエリで指定されていれば storage にも保存 (シェアリンクで来た人が次から維持)
  const fromUrl = readUrlParam();
  if (fromUrl) {
    try { localStorage.setItem(THEME_KEY, fromUrl); } catch { /* */ }
  }
  return t;
}

/** テーマを設定 → DOM + storage + 購読者通知 */
export function setTheme(next: Theme): void {
  applyToDom(next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* */ }
  listeners.forEach((l) => { try { l(next); } catch { /* */ } });
  // 他タブにも伝播 (storage event は他タブのみで発火 — 同タブには上記 listener)
}

/** 単純切替 */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** 購読: 切替が起きたらコールバック (return で解除) */
export function subscribeTheme(cb: (t: Theme) => void): () => void {
  listeners.add(cb);
  // 他タブからの localStorage 変更も拾う
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
      applyToDom(e.newValue);
      cb(e.newValue);
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}
