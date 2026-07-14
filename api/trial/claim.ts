// ============================================================
// POST /api/trial/claim
//
// 同一メールアドレス = 同一ユーザーとして、トライアル窓を「サーバー側で一度だけ」確定する。
// これにより、PC → スマホのように端末が変わっても、同じメールなら:
//   - 初回：ここでトライアル開始日/終了日を記録し、それを返す
//   - 2回目以降：既に記録された終了日を **そのまま返す**（延長・再発行しない）
// localStorage 依存だと端末ごとに新規トライアルが切られてしまう不具合の根治。
//
// body: { email, brand, plan, bonusDays? }
//   email    … 正規化して小文字・trim。同一判定のキー。
//   plan     … 'free' 以外（有料で入った）ならトライアル無し。
//   bonusDays… 紹介コード等での延長日数（初回のみ加算）。
//
// 返り値: { ok, trialEndsAt, startedAt, firstTime }
//   trialEndsAt が null のときはトライアル対象外（有料入会など）。
//
// 保存キー: rb:trial:<emailHash>  （メール平文は保存しない＝プライバシー）
// ============================================================
import { kvGetJSON, kvSet, isUpstashConfigured } from "../_lib/upstash.js";

export const config = { runtime: "nodejs" };

// ★トライアル日数の唯一の正（オーナー方針 2026-07-14: 7日 → 3日）
const TRIAL_DAYS = 3;

interface TrialRecord {
  startedAt: string;     // 最初にトライアルを開始した日時（ISO）
  trialEndsAt: string;   // 確定した終了日時（ISO）。以後この値は変えない
  brand?: string;
  firstPlan?: string;
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(res: unknown, status = 200): Response {
  return new Response(JSON.stringify(res), { status, headers: { "content-type": "application/json" } });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* noop */ }

  const email = String(body.email ?? "").trim().toLowerCase();
  const brand = typeof body.brand === "string" ? body.brand : undefined;
  const plan = String(body.plan ?? "free");
  const bonusDays = Math.max(0, Math.min(90, Number(body.bonusDays) || 0));

  if (!email || !email.includes("@")) return json({ error: "メールアドレスが不正です" }, 400);

  // 有料で入った場合はトライアルの概念なし（そのまま通す）
  if (plan !== "free") return json({ ok: true, trialEndsAt: null, firstTime: false });

  // Upstash 未設定なら、従来どおりクライアント側で決めさせる（フォールバック＝サービス停止を避ける）
  if (!isUpstashConfigured()) {
    const ends = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
    return json({ ok: true, trialEndsAt: ends, startedAt: new Date().toISOString(), firstTime: true, fallback: true });
  }

  const key = `rb:trial:${await sha256Hex(email)}`;

  try {
    const existing = await kvGetJSON<TrialRecord>(key);
    if (existing && existing.trialEndsAt) {
      // ★同一メールの2回目以降：既存の終了日をそのまま返す（延長しない・リセットしない）
      return json({
        ok: true,
        trialEndsAt: existing.trialEndsAt,
        startedAt: existing.startedAt,
        firstTime: false,
      });
    }

    // 初回：この瞬間からトライアル窓を確定
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + (TRIAL_DAYS + bonusDays) * 86400000).toISOString();
    const rec: TrialRecord = { startedAt: now.toISOString(), trialEndsAt, brand, firstPlan: plan };
    // 記録は十分に長く保持（トライアル終了後も「使い切った」事実を残すため 400 日）
    await kvSet(key, JSON.stringify(rec), 400 * 86400);
    return json({ ok: true, trialEndsAt, startedAt: rec.startedAt, firstTime: true });
  } catch {
    // Redis 障害時もユーザーを止めない（フォールバックで一時トライアルを許可）
    const ends = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
    return json({ ok: true, trialEndsAt: ends, startedAt: new Date().toISOString(), firstTime: true, fallback: true });
  }
}
