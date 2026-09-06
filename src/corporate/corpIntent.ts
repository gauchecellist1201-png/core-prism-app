// ============================================================
// corpIntent — 招待（企業を変えたい／地域を変えたい／協業したい）や ASHITAKA・ENERGY の相談ボタンで
// 選んだ意図を、相談フォームの「希望内容」の事前選択として渡す小箱（sessionStorage）。
// 個人情報は入れない。フォーム側は読むだけで消さない（StrictMode の二重初期化で消えるのを防ぐ）。
// ============================================================
export const INTENT_KEY = 'core_corp_intent';

export function rememberIntent(interest: string, id: string) {
  try { sessionStorage.setItem(INTENT_KEY, JSON.stringify({ interest, id })); } catch { /* */ }
}

export function peekIntent(): { interest: string; id: string } | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { interest?: unknown; id?: unknown };
    if (typeof v.interest !== 'string' || typeof v.id !== 'string') return null;
    return { interest: v.interest, id: v.id };
  } catch { return null; }
}
