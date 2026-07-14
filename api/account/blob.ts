// ============================================================
// /api/account/blob — 同一メール基準の「軽量クラウド保存」(Upstash)
//
// 目的: 同じメールアドレスなら、PC でも スマホでも、無料期間中に貯めた
//       ナレッジ等をそのまま引き継げるようにする（端末が変わると1からやり直し、を根治）。
//
// GET  ?email=&key=            → 保存済み JSON を返す（無ければ null）
// POST { email, key, value }   → JSON を保存（上書き）。value はサイズ上限あり。
//
// キー: rb:acct:<emailHash>:<key>  （メール平文は保存しない）
// Supabase 認証を必要とせず、アプリ既存のメール+パスワード認証と噛み合う。
// 画像base64など重い値は呼び出し側で除外して渡す前提（ここでも上限で保護）。
// ============================================================
import { kvGet, kvSet, isUpstashConfigured } from "../_lib/upstash";

export const config = { runtime: "edge" };

const MAX_BYTES = 900_000; // 1リクエストの value 上限（~900KB。重い画像は除外前提）
const ALLOWED_KEYS = new Set(["knowledge", "personas", "settings"]);

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function json(res: unknown, status = 200): Response {
  return new Response(JSON.stringify(res), { status, headers: { "content-type": "application/json" } });
}
function normEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export default async function handler(req: Request): Promise<Response> {
  if (!isUpstashConfigured()) return json({ ok: false, disabled: true }, 200);

  const url = new URL(req.url);

  if (req.method === "GET") {
    const email = normEmail(url.searchParams.get("email"));
    const key = String(url.searchParams.get("key") || "");
    if (!email.includes("@") || !ALLOWED_KEYS.has(key)) return json({ error: "bad params" }, 400);
    try {
      const raw = await kvGet(`rb:acct:${await sha256Hex(email)}:${key}`);
      return json({ ok: true, value: raw ? JSON.parse(raw) : null });
    } catch {
      return json({ ok: false, value: null });
    }
  }

  if (req.method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* noop */ }
    const email = normEmail(body.email);
    const key = String(body.key || "");
    if (!email.includes("@") || !ALLOWED_KEYS.has(key)) return json({ error: "bad params" }, 400);
    if (body.value === undefined) return json({ error: "no value" }, 400);

    const serialized = JSON.stringify(body.value);
    if (serialized.length > MAX_BYTES) {
      return json({ ok: false, error: "too large", bytes: serialized.length }, 413);
    }
    try {
      await kvSet(`rb:acct:${await sha256Hex(email)}:${key}`, serialized, 400 * 86400);
      return json({ ok: true });
    } catch {
      return json({ ok: false, error: "save failed" }, 200); // ユーザーを止めない
    }
  }

  return json({ error: "method not allowed" }, 405);
}
