// ============================================================
// GET /api/sales/config — カタログ・ターゲット・ステージ・価格矛盾
// x-master-key 必須
// ============================================================
import { corsHeaders, json, requireMaster } from '../_lib/sales/http';
import { kvConfigured } from '../_lib/sales/kv';
import {
  PRODUCTS, TARGETS, STAGES, OEM_RESALE, PUBLISHED_PRICES, PUBLISHED_SNAPSHOT_DATE,
  priceConflicts, mayQuotePrice, FOLLOWUPS, POSITIONING,
} from '../../src/sales/shared/catalog';
import { SCORE_DEFS } from '../../src/sales/shared/score';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, ch);

  const denied = requireMaster(req, ch);
  if (denied) return denied;

  return json({
    products: PRODUCTS,
    targets: TARGETS,
    stages: STAGES,
    scoreDefs: SCORE_DEFS,
    followups: FOLLOWUPS,
    positioning: POSITIONING,
    oemResale: OEM_RESALE,
    published: { asOf: PUBLISHED_SNAPSHOT_DATE, prices: PUBLISHED_PRICES, source: '/studio/film' },
    priceConflicts: priceConflicts(),
    mayQuotePrice: mayQuotePrice(),
    storage: { configured: kvConfigured() },
  }, 200, ch);
}
