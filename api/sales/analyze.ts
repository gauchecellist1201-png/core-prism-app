// ============================================================
// POST /api/sales/analyze — 企業URLを読んで分析 + CORE SALES SCORE
//
// body: { id } もしくは { url, name? }
// x-master-key 必須
//
// 時間設計 (Edge は 25 秒で切られる。コールドスタート込みなので自前は 21 秒):
//   サイト取得 5 秒 → AI 16 秒 (残り時間で clamp) → 保存。長いJSONを出す分析は haiku。
// 途中で時間切れになっても 500 にせず、取れたところまで正直に返す。
// ============================================================
import { Deadline, corsHeaders, errMessage, json, requireMaster } from '../_lib/sales/http';
import { KvNotConfigured } from '../_lib/sales/kv';
import {
  blankCompany, claimDomain, domainOf, getCompany, newId, normalizeUrl, putCompany, todayISO,
} from '../_lib/sales/store';
import { fetchSiteText } from '../_lib/sales/fetchSite';
import { MODEL_FAST, askJson } from '../_lib/sales/ai';
import { analysisSystem, analysisUser } from '../_lib/sales/prompts';
import { analysisName, rawScoreItems, toAnalysis } from '../_lib/sales/normalize';
import { buildScore, emptyScore } from '../../src/sales/shared/score';
import type { Company } from '../../src/sales/shared/types';

export const config = { runtime: 'edge' };

const s = (v: unknown, max = 500): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  const denied = requireMaster(req, ch);
  if (denied) return denied;

  const deadline = new Deadline(22_000);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = s(body.id, 80);
    const rawUrl = s(body.url, 500);

    // ---- 対象の特定 (無ければ作る) ----
    let company: Company | null = null;
    if (id) {
      company = await getCompany(id);
      if (!company) return json({ error: 'NOT_FOUND', message: 'その営業先は見つかりませんでした。' }, 404, ch);
    } else {
      const url = normalizeUrl(rawUrl);
      if (!url) return json({ error: 'EMPTY', message: '分析するにはURLが必要です。' }, 400, ch);
      const domain = domainOf(url);
      const claim = await claimDomain(domain, newId());
      const existing = claim.created ? null : await getCompany(claim.id);
      company = existing ?? blankCompany({
        id: claim.id,
        name: s(body.name, 120) || domain,
        url,
        domain,
      });
      if (!existing) company = await putCompany(company);
    }

    if (!company.url) {
      return json({ error: 'NO_URL', message: 'この営業先にはURLが登録されていません。先にURLを入れてください。' }, 400, ch);
    }

    // ---- サイト取得 ----
    const site = await fetchSiteText(company.url, deadline.signal(4_500));

    // 本文が取れていないのに AI を呼ぶと、15 秒かけて「何も分かりませんでした」が返るだけ。
    // ただし営業担当がメモに会社情報を書いていれば、それを材料に分析できる。
    // メモも無いときだけ、取れなかった理由をそのまま画面へ返す。
    const memoUsable = company.memo.trim().length >= 20;
    if (!site.ok && !memoUsable) {
      const blocked: Company = {
        ...company,
        analysis: {
          summary: '', business: '', products: [], customers: '',
          sns: { value: '', evidence: '' }, videoUsage: { value: '', evidence: '' },
          ads: { value: '', evidence: '' }, hiring: { value: '', evidence: '' },
          competitors: [], aiVideoFit: '', painHypothesis: [], angle: '',
          recommendedPlan: 'entry', budgetGuess: '',
          targetTier: company.targetTier, industry: company.industry,
          warnings: [site.note || 'サイト本文を取得できませんでした。'],
        },
        score: emptyScore(),
      };
      const savedBlocked = await putCompany(blocked);
      return json({
        error: 'SITE_UNREADABLE',
        message: `${site.note || 'サイト本文を取得できませんでした。'} URLを確かめるか、会社情報をメモに20文字以上書いてから、もう一度分析してください (メモがあればそれを材料に分析します)。`,
        company: savedBlocked,
        site: { ok: false, note: site.note },
      }, 422, ch);
    }

    if (deadline.remaining() < 5_000) {
      return json({
        error: 'TIMEOUT',
        message: 'サイトの取得に時間がかかりすぎました。もう一度お試しください。',
        site: { ok: site.ok, note: site.note },
      }, 504, ch);
    }

    // ---- AI 分析 ----
    const ai = await askJson<Record<string, unknown>>({
      req,
      system: analysisSystem(),
      user: analysisUser({ name: company.name, url: company.url, site, memo: company.memo }),
      maxTokens: 1800,
      model: MODEL_FAST,
      deadline,
    });

    if (!ai.ok || !ai.data) {
      return json({
        error: 'AI_FAILED',
        message: ai.note || 'AI が分析を返しませんでした。もう一度お試しください。',
        site: { ok: site.ok, note: site.note },
      }, 502, ch);
    }

    const analysis = toAnalysis(ai.data, company.industry);
    if (!site.ok) {
      analysis.warnings = [
        `${site.note || 'サイト本文を取得できませんでした。'} 営業担当のメモだけを材料に分析しています。`,
        ...analysis.warnings,
      ].slice(0, 6);
    }

    const score = buildScore(rawScoreItems(ai.data));
    const foundName = analysisName(ai.data);

    const next: Company = {
      ...company,
      name: company.name && company.name !== company.domain ? company.name : (foundName || company.name),
      industry: analysis.industry || company.industry,
      targetTier: analysis.targetTier,
      analysis,
      score,
      stage: company.stage === 'NEW' ? 'ANALYZED' : company.stage,
      nextActionAt: company.nextActionAt ?? todayISO(),
      nextActionLabel: company.touches > 0 ? company.nextActionLabel : '電話またはメールで接触する',
    };
    const saved = await putCompany(next);

    return json({
      company: saved,
      site: { ok: site.ok, note: site.note, title: site.title, chars: site.text.length },
    }, 200, ch);
  } catch (e) {
    if (e instanceof KvNotConfigured) {
      return json({ error: 'STORAGE_NOT_CONFIGURED', message: '保存先 (Upstash Redis) が未設定です。' }, 503, ch);
    }
    return json({ error: 'INTERNAL', message: errMessage(e).slice(0, 200) }, 500, ch);
  }
}
