// ============================================================
// /api/google/oauth?action=start|status|token|disconnect
//
// Google 連携のサーバー側入口をこの1ファイルに集約している（Vercel の関数数を
// むやみに増やさないため）。code を受け取るコールバックだけは、Google が
// redirect_uri にクエリ付きURLを許さないため別ファイル callback.ts に分けている。
//
// ★目的（2026-07-26 オーナー報告「カレンダーだけ毎回つなぎ直し」の根治）
//   refresh_token をサーバー（Upstash）に保持し、アクセストークンが切れたら
//   自動で更新する。ブラウザには短命なアクセストークンだけを渡す。
//   client_secret は一切ブラウザへ出さない。
//
//   GOOGLE_CLIENT_SECRET が未設定の間は configured:false を返し、
//   クライアントは従来の GIS ポップアップ方式に自動フォールバックする（後退しない）。
// ============================================================

export const config = { runtime: 'edge' };

import {
  G_AUTHORIZE,
  G_SCOPES,
  STATE_TTL,
  TOKEN_TTL,
  getClientId,
  getRedirectUri,
  isGoogleConfigured,
  randStr,
  stateKey,
  tokKey,
  jsonRes,
  refreshAccessToken,
  type StoredGoogleToken,
} from './_shared';
import { isUpstashConfigured, kvGetJSON, kvSetJSON, kvDel } from '../_lib/upstash';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const action = (url.searchParams.get('action') || '').toLowerCase();
  const uid = (url.searchParams.get('uid') || '').trim();

  const configured = isGoogleConfigured() && isUpstashConfigured();

  // ── status: 連携できる状態か／つながっているか ─────────────
  if (action === 'status') {
    if (!configured) return jsonRes({ configured: false, connected: false });
    if (!uid) return jsonRes({ configured: true, connected: false });
    try {
      const tok = await kvGetJSON<StoredGoogleToken>(tokKey(uid));
      // ★接続判定は refresh_token の有無で行う。
      //   アクセストークンの有無で判定すると1時間で「未接続」に落ちる（旧実装の欠陥）。
      if (!tok?.refresh_token) return jsonRes({ configured: true, connected: false });
      return jsonRes({ configured: true, connected: true, email: tok.email, name: tok.name, picture: tok.picture });
    } catch {
      // 保存先の一時障害で UI を壊さない
      return jsonRes({ configured: true, connected: false });
    }
  }

  // ── start: Google の同意画面へ 302 ─────────────────────────
  if (action === 'start') {
    if (!isGoogleConfigured()) {
      return jsonRes(
        {
          error: 'not-configured',
          message:
            'Google 連携のサーバー設定（GOOGLE_CLIENT_SECRET）が未設定です。設定されるまでは従来どおりの接続方法をお使いください。',
        },
        503,
      );
    }
    if (!isUpstashConfigured()) {
      return jsonRes({ error: 'storage-unavailable', message: '連携用の保存先が未設定です。' }, 503);
    }
    if (!uid || uid.length > 100) {
      return jsonRes({ error: 'bad-uid', message: 'uid が不正です。' }, 400);
    }

    const state = randStr(32);
    try {
      await kvSetJSON(stateKey(state), { uid }, STATE_TTL);
    } catch {
      return jsonRes({ error: 'storage-error', message: '連携の準備に失敗しました。時間をおいて再度お試しください。' }, 502);
    }

    const params = new URLSearchParams({
      client_id: getClientId(),
      redirect_uri: getRedirectUri(),
      response_type: 'code',
      scope: G_SCOPES,
      // ★この2つが無いと refresh_token が返らない＝1時間で切れる（今回の不具合の核心）
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${G_AUTHORIZE}?${params.toString()}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }

  // ── token: いま使えるアクセストークンを返す（必要なら自動更新） ──
  if (action === 'token') {
    if (!configured) return jsonRes({ error: 'not-configured' }, 503);
    if (!uid) return jsonRes({ error: 'bad-uid' }, 400);

    let tok: StoredGoogleToken | null = null;
    try {
      tok = await kvGetJSON<StoredGoogleToken>(tokKey(uid));
    } catch {
      return jsonRes({ error: 'storage-error', message: '連携情報を読み出せませんでした。' }, 502);
    }
    if (!tok?.refresh_token) {
      return jsonRes({ error: 'not-connected', message: 'Google と連携していません。' }, 401);
    }

    // 期限内ならそのまま返す（無駄な更新をしない）
    if (tok.access_token && tok.expires_at && tok.expires_at > Date.now()) {
      return jsonRes({ ok: true, access_token: tok.access_token, expires_at: tok.expires_at, email: tok.email });
    }

    const fresh = await refreshAccessToken(tok.refresh_token);
    if (!fresh) {
      // Google 側で許可が取り消された等。保存を消して、UI に再連携を促す。
      try { await kvDel(tokKey(uid)); } catch { /* best-effort */ }
      return jsonRes(
        { error: 'refresh-failed', message: 'Google の許可が取り消されたようです。もう一度「連携」してください。' },
        401,
      );
    }
    const next: StoredGoogleToken = { ...tok, access_token: fresh.access_token, expires_at: fresh.expires_at };
    try { await kvSetJSON(tokKey(uid), next, TOKEN_TTL); } catch { /* 返却は続行 */ }
    return jsonRes({ ok: true, access_token: fresh.access_token, expires_at: fresh.expires_at, email: tok.email });
  }

  // ── disconnect: 連携を切る ─────────────────────────────────
  if (action === 'disconnect') {
    if (!configured || !uid) return jsonRes({ ok: true });
    try { await kvDel(tokKey(uid)); } catch { /* best-effort */ }
    return jsonRes({ ok: true });
  }

  return jsonRes({ error: 'bad-action', message: 'action は start / status / token / disconnect のいずれかです。' }, 400);
}
