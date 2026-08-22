// ============================================================
// Sales OS — AI の生 JSON を型に落とす (信用しない側の処理)
// ============================================================
import type { Analysis, CallScript, EmailDraft, Fact, PlanKind, TargetTier, VideoPlan } from '../../../src/sales/shared/types';
import { guessTier, mayQuotePrice, productById } from '../../../src/sales/shared/catalog';
import { str, strArr } from './ai';

type Raw = Record<string, unknown>;
const asObj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});

function fact(v: unknown): Fact {
  const o = asObj(v);
  const value = str(o.value, 200);
  const evidence = str(o.evidence, 300);
  // 根拠が無い事実は value も残さない。画面が「未確認」と言えなくなるため。
  return evidence ? { value, evidence } : { value: '', evidence: '' };
}

function tier(v: unknown, fallbackText: string): TargetTier {
  const s = str(v, 4).toUpperCase();
  if (s === 'A' || s === 'B' || s === 'C' || s === 'X') return s;
  return guessTier(fallbackText);
}

export function toAnalysis(raw: unknown, fallbackIndustry: string): Analysis {
  const o = asObj(raw);
  const industry = str(o.industry, 20) || fallbackIndustry;
  const business = str(o.business, 300);
  const recommended = str(o.recommendedPlan, 12);
  return {
    summary: str(o.summary, 300),
    business,
    products: strArr(o.products, 8, 60),
    customers: str(o.customers, 160),
    sns: fact(o.sns),
    videoUsage: fact(o.videoUsage),
    ads: fact(o.ads),
    hiring: fact(o.hiring),
    competitors: strArr(o.competitors, 6, 40),
    aiVideoFit: str(o.aiVideoFit, 240),
    painHypothesis: strArr(o.painHypothesis, 6, 120),
    angle: str(o.angle, 240),
    recommendedPlan: productById(recommended) ? recommended : 'entry',
    budgetGuess: str(o.budgetGuess, 80),
    targetTier: tier(o.targetTier, `${industry} ${business}`),
    industry,
    warnings: strArr(o.warnings, 5, 200),
  };
}

export function analysisName(raw: unknown): string {
  return str(asObj(raw).name, 80);
}

export function rawScoreItems(raw: unknown): Array<{ key?: string; value?: unknown; evidence?: unknown }> {
  const arr = asObj(raw).score;
  if (!Array.isArray(arr)) return [];
  return arr.map(x => {
    const o = asObj(x);
    return { key: str(o.key, 24), value: o.value, evidence: str(o.evidence, 300) };
  });
}

const PLAN_KINDS: PlanKind[] = ['A', 'B', 'C'];

export function toPlans(raw: unknown): VideoPlan[] {
  const arr = Array.isArray(asObj(raw).plans) ? (asObj(raw).plans as unknown[]) : Array.isArray(raw) ? (raw as unknown[]) : [];
  const out: VideoPlan[] = [];
  arr.slice(0, 3).forEach((x, i) => {
    const o = asObj(x);
    const k = str(o.kind, 2).toUpperCase() as PlanKind;
    const beatsRaw = Array.isArray(o.beats) ? (o.beats as unknown[]) : [];
    const beats = beatsRaw.slice(0, 8).map(b => {
      const bo = asObj(b);
      return { time: str(bo.time, 24), shot: str(bo.shot, 400), audio: str(bo.audio, 240) };
    }).filter(b => b.shot);
    const title = str(o.title, 60);
    if (!title && !beats.length) return;
    out.push({
      kind: PLAN_KINDS.includes(k) ? k : PLAN_KINDS[i] ?? 'A',
      purpose: str(o.purpose, 24),
      title,
      hook3s: str(o.hook3s, 300),
      beats,
      story: str(o.story, 400),
      visual: str(o.visual, 300),
      narration: str(o.narration, 400),
      cta: str(o.cta, 120),
    });
  });
  return out;
}

/**
 * 金額を出してよくない状態のときに、万一 AI が書いてしまった金額を消す。
 * 「書くな」と指示するだけでは守られる保証が無く、間違った金額が1回でも
 * お客様に出たら取り返しがつかないので、最後に機械で落とす。
 */
export function redactPrices(text: string): string {
  if (!text || mayQuotePrice()) return text;
  return text
    // ¥49,800 / 49,800円 / 5万円 / 10万円〜 など
    .replace(/[¥￥]\s?[\d,]+(?:\s?[〜~]\s?[¥￥]?[\d,]+)?(?:円)?/g, '別途お見積り')
    .replace(/[\d,]+\s?円(?:\s?[〜~]\s?[\d,]+\s?円)?/g, '別途お見積り')
    .replace(/[\d,]+\s?万円(?:\s?[〜~]\s?[\d,]+\s?万円)?/g, '別途お見積り');
}

export function toEmail(raw: unknown, touch: number, angle: string): EmailDraft | null {
  const o = asObj(raw);
  const subject = redactPrices(str(o.subject, 120));
  const body = redactPrices(str(o.body, 1600));
  if (!subject || body.length < 40) return null;
  return { subject, body, touch, angle };
}

export function toCall(raw: unknown): CallScript | null {
  const o = asObj(raw);
  const opening = redactPrices(str(o.opening, 300));
  const question = redactPrices(str(o.question, 200));
  if (!opening || !question) return null;
  const objRaw = Array.isArray(o.objections) ? (o.objections as unknown[]) : [];
  return {
    opening,
    question,
    bridge: redactPrices(str(o.bridge, 240)),
    hook: redactPrices(str(o.hook, 300)),
    close: redactPrices(str(o.close, 240)),
    objections: objRaw.slice(0, 6).map(x => {
      const oo = asObj(x);
      return { q: str(oo.q, 80), a: redactPrices(str(oo.a, 200)) };
    }).filter(x => x.q && x.a),
  };
}
