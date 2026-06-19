// ============================================================
// coreLink.ts — 5アプリを「ひとつのブレーン」として横断する軽量ハンドオフ
//
// 各アプリは別ドメイン(Vercel)で動くため、URLパラメータ ?core= で識別子/文脈を
// 受け渡し、localStorage に保持する。これで「Resonanceで見ていた相手をIrisでも」
// のような“持ち越し”が、サーバ無しでも成立する（将来は本物のSSOへ差し替え可能）。
//
// 使い方:
//   1) 各アプリの起動時に一度 readCoreHandoff() を呼ぶ（?core= を取り込み、URLから消す）
//   2) 別アプリへ遷移するリンクは withCoreHandoff(url) で包む（?core= を付与）
// ============================================================

const KEY = "core_handoff_v1";

export type CoreAppKey = "prism" | "iris" | "resonance" | "lume" | "guild" | "core";

/** 受け渡された文脈（最小限の identity ＋ 直近の作業）。必要に応じて拡張する。 */
export interface CoreHandoff {
  uid?: string;        // 共通の利用者識別子（任意）
  name?: string;       // 表示名
  from?: CoreAppKey;   // どのアプリから来たか
  ctx?: string;        // 直近の文脈（例: 見ていた相手・キャンペーン）
  ts?: number;         // 発行時刻
}

function safeParse(s: string | null): CoreHandoff | null {
  if (!s) return null;
  try { return JSON.parse(s) as CoreHandoff; } catch { return null; }
}

/** 起動時に ?core= を取り込み、localStorage へ保存し、URLからは消す。保存済みがあれば返す。 */
export function readCoreHandoff(): CoreHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const u = new URL(window.location.href);
    const raw = u.searchParams.get("core");
    if (raw) {
      const decoded = decodeURIComponent(raw);
      localStorage.setItem(KEY, decoded);
      u.searchParams.delete("core");
      window.history.replaceState({}, "", u.toString());
      return safeParse(decoded);
    }
    return safeParse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/** 現在の文脈を更新（このアプリで分かったことを次のアプリへ持ち越せるように）。 */
export function setCoreHandoff(patch: Partial<CoreHandoff>): void {
  if (typeof window === "undefined") return;
  try {
    const cur = safeParse(localStorage.getItem(KEY)) ?? {};
    const next: CoreHandoff = { ...cur, ...patch, ts: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* no-op */ }
}

/** 別アプリURLに ?core= を付けて「持ち越し」リンクにする。 */
export function withCoreHandoff(url: string, from?: CoreAppKey): string {
  if (typeof window === "undefined") return url;
  try {
    const cur = safeParse(localStorage.getItem(KEY)) ?? {};
    if (from) cur.from = from;
    cur.ts = Date.now();
    const u = new URL(url);
    u.searchParams.set("core", encodeURIComponent(JSON.stringify(cur)));
    return u.toString();
  } catch {
    return url;
  }
}
