// ============================================================
// GET /api/x/status?uid=<匿名ID>
//
// { configured: bool(env 有), connected: bool, username? } を返す。
// configured=false のとき UI は「準備中」を表示し偽ボタンを出さない。
// ============================================================

export const config = { runtime: 'edge' };

import { isXConfigured, tokKey, jsonRes, type StoredXToken } from './_shared';
import { isUpstashConfigured, kvGetJSON } from '../_lib/upstash';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return jsonRes({ error: 'method-not-allowed' }, 405);

  const configured = isXConfigured() && isUpstashConfigured();
  if (!configured) {
    return jsonRes({ configured: false, connected: false });
  }

  const url = new URL(req.url);
  const uid = (url.searchParams.get('uid') || '').trim();
  if (!uid) return jsonRes({ configured: true, connected: false });

  try {
    const tok = await kvGetJSON<StoredXToken>(tokKey(uid));
    if (!tok || !tok.access_token) {
      return jsonRes({ configured: true, connected: false });
    }
    return jsonRes({ configured: true, connected: true, username: tok.username });
  } catch {
    // 保存先の一時障害でも UI を壊さない（未連携扱い）
    return jsonRes({ configured: true, connected: false });
  }
}
