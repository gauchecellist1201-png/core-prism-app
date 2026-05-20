// ============================================================
// Referral — 紹介プログラム (6 文字英数コード, 両者 +7 日トライアル)
//
// 仕様:
//  - ユーザー毎に 6 文字英数 (大文字 + 数字、紛らわしい 0/O/1/I/L 除外) の referralCode を生成
//  - localStorage 'core_referral_v2' に保存 (旧 v1 / 8 文字も後方互換で読込)
//  - 招待 URL: `<base>?ref=XXXXXX` を共有 → main.tsx で sessionStorage 'pending_ref' に保留
//  - 新規 signup 時に pending_ref が存在 → /api/referral/redeem に POST して検証
//    → 紹介された側 (新規) : トライアル +7 日
//    → 紹介した側 (既存)  : referredCount++ / pendingBonusDays += 7 (次回起動時にトライアル延長を試行)
// ============================================================

const KEY_REFERRAL = 'core_referral_v2';
const KEY_REFERRAL_LEGACY = 'core_referral_v1';

export const REFERRAL_BONUS_DAYS = 7;

/** referralCode 用文字集合: O,0,I,1,L など紛らわしい字は除外 */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export interface ReferralData {
  /** あなたの紹介コード (6 文字英数) */
  myCode: string;
  /** あなたの紹介経由でサインアップした人数 */
  referredCount: number;
  /** あなたが利用した紹介コード (誰の紹介で来たか) — 1 回のみ */
  usedCode?: string;
  /** 累計の延長日数 (1 紹介 = +7 日、両者) */
  bonusDays: number;
  /** まだトライアル期限へ反映していない延長日数 — 起動時に消化 */
  pendingBonusDays: number;
}

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** 形式チェック: 大文字英数 6 文字以上 (旧 8 文字コードとの互換のため上限は緩い) */
export function isValidReferralCode(code: string): boolean {
  if (!code) return false;
  if (code.length < CODE_LENGTH) return false;
  return /^[A-Z0-9]+$/i.test(code);
}

export function getReferralData(): ReferralData {
  if (typeof localStorage === 'undefined') {
    return emptyReferral();
  }
  // v2 を読む
  try {
    const r = localStorage.getItem(KEY_REFERRAL);
    if (r) {
      const parsed = JSON.parse(r) as Partial<ReferralData>;
      return normalize(parsed);
    }
  } catch { /* */ }
  // v1 (8 文字旧コード) を読み込み migrate
  try {
    const legacy = localStorage.getItem(KEY_REFERRAL_LEGACY);
    if (legacy) {
      const old = JSON.parse(legacy) as {
        myCode?: string; referredCount?: number; usedCode?: string; bonusMonths?: number;
      };
      const migrated: ReferralData = {
        myCode: old.myCode || generateReferralCode(),
        referredCount: old.referredCount || 0,
        usedCode: old.usedCode,
        bonusDays: (old.bonusMonths || 0) * 30,
        pendingBonusDays: 0,
      };
      saveReferralData(migrated);
      return migrated;
    }
  } catch { /* */ }
  // 初期化
  const initial: ReferralData = {
    myCode: generateReferralCode(),
    referredCount: 0,
    bonusDays: 0,
    pendingBonusDays: 0,
  };
  saveReferralData(initial);
  return initial;
}

function emptyReferral(): ReferralData {
  return { myCode: '', referredCount: 0, bonusDays: 0, pendingBonusDays: 0 };
}

function normalize(p: Partial<ReferralData>): ReferralData {
  return {
    myCode: p.myCode || generateReferralCode(),
    referredCount: typeof p.referredCount === 'number' ? p.referredCount : 0,
    usedCode: p.usedCode,
    bonusDays: typeof p.bonusDays === 'number' ? p.bonusDays : 0,
    pendingBonusDays: typeof p.pendingBonusDays === 'number' ? p.pendingBonusDays : 0,
  };
}

export function saveReferralData(data: ReferralData) {
  try { localStorage.setItem(KEY_REFERRAL, JSON.stringify(data)); } catch { /* */ }
}

/** 招待 URL を生成 (?ref=CODE)
 * Prism は SNS で見栄えの良い OG カードのために /invite.html を経由させる
 * (静的ページの OG メタが SNS Bot に拾われ、人間は 1.2 秒後に / にリダイレクトされる)
 */
export function getReferralUrl(brand: 'iris' | 'prism', code: string): string {
  const base = brand === 'iris'
    ? 'https://core-prism-app.vercel.app/iris'
    : 'https://core-prism-app.vercel.app/invite.html';
  return `${base}?ref=${code}`;
}

/** URL の ?ref=XXX を読み取り sessionStorage に保留 (signup 時に消化) */
export function captureReferralFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (ref && isValidReferralCode(ref)) {
      const data = getReferralData();
      if (!data.usedCode) {
        sessionStorage.setItem('pending_ref', ref);
      }
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    }
  } catch { /* */ }
}

/** sessionStorage に保留されている招待コード (signup 前のプレビュー用) */
export function getPendingReferral(): string | null {
  try {
    return sessionStorage.getItem('pending_ref');
  } catch { return null; }
}

/** signup 完了時に呼ぶ: pending_ref を /api/referral/redeem で検証 → ボーナス日数を返す */
export async function redeemPendingReferral(refereeEmail: string): Promise<{
  ok: boolean;
  bonusDays: number;
  message: string;
}> {
  const pending = getPendingReferral();
  if (!pending) return { ok: false, bonusDays: 0, message: '紹介コードはありません' };

  const data = getReferralData();
  if (pending === data.myCode) {
    sessionStorage.removeItem('pending_ref');
    return { ok: false, bonusDays: 0, message: '自分の紹介コードは使えません' };
  }

  // クライアント側の最低限の形式チェック
  if (!isValidReferralCode(pending)) {
    sessionStorage.removeItem('pending_ref');
    return { ok: false, bonusDays: 0, message: '紹介コードの形式が不正です' };
  }

  // /api/referral/redeem に検証を委ねる
  let bonusDays = REFERRAL_BONUS_DAYS;
  let serverMessage = '';
  try {
    const resp = await fetch('/api/referral/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referral_code: pending,
        referee_email: refereeEmail,
      }),
    });
    const body = await resp.json() as {
      ok?: boolean; bonus_days?: number; message?: string;
    };
    if (resp.ok && body.ok && typeof body.bonus_days === 'number') {
      bonusDays = body.bonus_days;
      serverMessage = body.message || '';
    } else if (!resp.ok) {
      // API 未配備でも UX を止めない (オフライン/ローカル開発)
      console.warn('[referral] redeem API failed, granting bonus locally:', body.message);
    }
  } catch (e) {
    console.warn('[referral] redeem API unreachable, granting bonus locally:', e);
  }

  // 紹介された側 (自分) の状態を確定
  data.usedCode = pending;
  data.bonusDays += bonusDays;
  saveReferralData(data);
  sessionStorage.removeItem('pending_ref');

  return {
    ok: true,
    bonusDays,
    message: serverMessage || `🎉 友達招待ボーナスで +${bonusDays} 日のトライアル延長が適用されました!`,
  };
}

/** 自分が紹介した人がサインアップしたことをローカルで記録 (招待リンクで戻ってきた本人が確認した時など) */
export function markReferredOne(): void {
  const data = getReferralData();
  data.referredCount += 1;
  data.pendingBonusDays += REFERRAL_BONUS_DAYS;
  saveReferralData(data);
}

/** トライアル期限へ未反映の延長日数を消費する (BillingUser.trialEndsAt に加算後に呼ぶ) */
export function consumePendingBonusDays(): number {
  const data = getReferralData();
  const days = data.pendingBonusDays;
  if (days > 0) {
    data.bonusDays += days;
    data.pendingBonusDays = 0;
    saveReferralData(data);
  }
  return days;
}
