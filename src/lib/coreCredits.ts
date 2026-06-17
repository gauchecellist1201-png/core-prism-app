// ============================================================
// CORE Credits — 自家型ユーティリティ・ポイント（Phase 1）
//
// 設計方針（日本の規制を最も軽く保つ）:
//  - CORE のサービス内でのみ価値を持つ / 第三者への譲渡・換金は不可 / 無料配布。
//    → 暗号資産でも有価証券でも前払式支払手段でもない。登録不要・低コスト。
//  - 利益分配はしない（だから合同会社DAOの制約も回避）。
//  - 「貯まる＝貢献への還元」「使う＝サービス内の実利（トライアル延長など）」。
//
// 永続化: localStorage（+ cookie バックアップで Safari ITP/揮発に耐性）。
// ============================================================

export interface CreditEntry {
  id: string;
  ts: string; // ISO
  reason: string; // 機械用キー
  label: string; // 人間可読
  amount: number; // 獲得=+, 利用=-
}

interface CreditState {
  entries: CreditEntry[];
  onceClaimed: string[]; // 一度きりの獲得（重複防止）
}

const KEY = "core_credits_v1";
const COOKIE = "core_credits_v1";

export interface Rank {
  key: string;
  name: string;
  min: number;
  color: string;
}

export const RANKS: Rank[] = [
  { key: "bronze", name: "ブロンズ", min: 0, color: "#C8865A" },
  { key: "silver", name: "シルバー", min: 500, color: "#AEB7C2" },
  { key: "gold", name: "ゴールド", min: 2000, color: "#E6B422" },
  { key: "partner", name: "コア・パートナー", min: 5000, color: "#A78BFA" },
];

export function rankFor(balance: number): { rank: Rank; next: Rank | null; toNext: number } {
  let rank = RANKS[0];
  for (const r of RANKS) if (balance >= r.min) rank = r;
  const idx = RANKS.findIndex((r) => r.key === rank.key);
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
  return { rank, next, toNext: next ? Math.max(0, next.min - balance) : 0 };
}

function uid(): string {
  return "c_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

function setCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=34560000; SameSite=Lax`;
  } catch { /* */ }
}
function getCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

function load(): CreditState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* */ }
  try {
    const c = getCookie(COOKIE);
    if (c) {
      const s = normalize(JSON.parse(c));
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ }
      return s;
    }
  } catch { /* */ }
  return { entries: [], onceClaimed: [] };
}

function normalize(s: unknown): CreditState {
  const o = (s ?? {}) as Partial<CreditState>;
  return { entries: Array.isArray(o.entries) ? o.entries : [], onceClaimed: Array.isArray(o.onceClaimed) ? o.onceClaimed : [] };
}

function save(s: CreditState) {
  const json = JSON.stringify(s);
  try { localStorage.setItem(KEY, json); } catch { /* */ }
  setCookie(COOKIE, json);
  try { window.dispatchEvent(new CustomEvent("core-credits-changed")); } catch { /* */ }
}

export function getBalance(): number {
  return load().entries.reduce((a, e) => a + e.amount, 0);
}

export function getHistory(limit = 30): CreditEntry[] {
  return load().entries.slice(-limit).reverse();
}

/** 通常の獲得（毎回加算）。 */
export function earn(reason: string, label: string, amount: number): void {
  if (amount <= 0) return;
  const s = load();
  s.entries.push({ id: uid(), ts: new Date().toISOString(), reason, label, amount });
  save(s);
}

/** 一度きりの獲得（onceKey で重複防止）。すでに獲得済みなら何もしない。 */
export function earnOnce(onceKey: string, label: string, amount: number): boolean {
  const s = load();
  if (s.onceClaimed.includes(onceKey)) return false;
  s.onceClaimed.push(onceKey);
  s.entries.push({ id: uid(), ts: new Date().toISOString(), reason: onceKey, label, amount });
  save(s);
  return true;
}

/** 1日1回の獲得（dateで判定）。 */
export function earnDaily(baseKey: string, label: string, amount: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  return earnOnce(`${baseKey}:${day}`, label, amount);
}

/** 利用（残高が足りれば減算してtrue）。 */
export function spend(reason: string, label: string, amount: number): boolean {
  if (amount <= 0) return false;
  if (getBalance() < amount) return false;
  const s = load();
  s.entries.push({ id: uid(), ts: new Date().toISOString(), reason, label, amount: -amount });
  save(s);
  return true;
}

export function hasClaimed(onceKey: string): boolean {
  return load().onceClaimed.includes(onceKey);
}
