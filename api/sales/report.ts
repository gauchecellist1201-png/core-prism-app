// ============================================================
// GET /api/sales/report — CORE Studio Sales Report (週次) + 業種別学習
//
// ?days=7 (既定) で集計期間を変えられる。
// 「母数が小さいのに率を出して意思決定させる」のが一番の事故なので、
// 接触 10 件未満の区分は tooSmall を立て、率を根拠にした提案を出さない。
// x-master-key 必須
// ============================================================
import { corsHeaders, errMessage, json, requireMaster } from '../_lib/sales/http';
import { KvNotConfigured } from '../_lib/sales/kv';
import { listFeed, listRows, todayISO } from '../_lib/sales/store';
import { ONE_OFF_STAGES, RECURRING_STAGES, WON_STAGES, stageMeta, targetByTier } from '../../src/sales/shared/catalog';
import type { CompanyRow, IndustryStat, ReportResponse, TargetTier } from '../../src/sales/shared/types';

export const config = { runtime: 'edge' };

/** これ未満の接触数では率を読まない */
const MIN_BASE = 10;

function statOf(label: string, rows: CompanyRow[]): IndustryStat {
  // 失注すると stage は LOST (step -1) になる。現在の段で数えると
  // 「商談まで行ったが失注した10件」が商談率 0% として出て、次に狙う業種を誤らせる。
  const step = (r: CompanyRow) => Math.max(r.maxStep ?? 0, stageMeta(r.stage).step);
  const contacted = rows.filter(r => r.touches > 0 || step(r) >= 2).length;
  const replied = rows.filter(r => step(r) >= 3).length;
  const meetings = rows.filter(r => step(r) >= 4).length;
  const wonRows = rows.filter(r => WON_STAGES.includes(r.stage));
  // dealYen は単発なら「1本の金額」、継続なら「月額」。足すと単位の無い数字になる。
  const oneOff = rows.filter(r => ONE_OFF_STAGES.includes(r.stage));
  const oneOffYen = oneOff.reduce((a, r) => a + (r.dealYen || 0), 0);
  const mrrYen = rows.filter(r => RECURRING_STAGES.includes(r.stage)).reduce((a, r) => a + (r.dealYen || 0), 0);
  const pct = (n: number) => (contacted ? Math.round((n / contacted) * 1000) / 10 : 0);
  return {
    industry: label,
    companies: rows.length,
    contacted,
    replied,
    meetings,
    won: wonRows.length,
    replyRatePct: pct(replied),
    meetingRatePct: pct(meetings),
    winRatePct: pct(wonRows.length),
    avgOneOffYen: oneOff.length ? Math.round(oneOffYen / oneOff.length) : 0,
    mrrYen,
    tooSmall: contacted < MIN_BASE,
  };
}

function groupBy<T, K extends string>(list: T[], key: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of list) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x); else m.set(k, [x]);
  }
  return m;
}

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, ch);

  const denied = requireMaster(req, ch);
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const daysRaw = Number(url.searchParams.get('days'));
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.round(daysRaw))) : 7;

    const [rows, feed] = await Promise.all([listRows(), listFeed(4000)]);

    const today = todayISO();
    const fromMs = Date.now() - days * 86_400_000;
    const weekFrom = todayISO(new Date(fromMs));
    const inWindow = feed.filter(a => Date.parse(a.at) >= fromMs);

    const countKind = (k: string) => inWindow.filter(a => a.kind === k).length;

    const totals = {
      added: rows.filter(r => r.updatedAt >= weekFrom && r.touches === 0 && r.score === 0).length,
      contacted: countKind('call') + countKind('email'),
      replied: countKind('reply'),
      meetings: countKind('meeting'),
      proposals: countKind('proposal'),
      won: countKind('won') + countKind('trial'),
      monthly: countKind('monthly'),
      oem: countKind('oem'),
      lost: countKind('lost'),
      oneOffYen: rows.filter(r => ONE_OFF_STAGES.includes(r.stage)).reduce((a, r) => a + (r.dealYen || 0), 0),
      mrrYen: rows.filter(r => RECURRING_STAGES.includes(r.stage)).reduce((a, r) => a + (r.dealYen || 0), 0),
    };

    // ---- 業種別 / 区分別 ----
    const byIndustry = [...groupBy(rows, r => r.industry || '業種未設定')]
      .map(([k, v]) => statOf(k, v))
      .sort((a, b) => b.companies - a.companies)
      .slice(0, 20);

    const tierOrder: TargetTier[] = ['A', 'B', 'C', 'X'];
    const byTier = tierOrder
      .map(t => statOf(targetByTier(t).label, rows.filter(r => r.targetTier === t)))
      .filter(s => s.companies > 0);

    // ---- 失注理由 (活動メモから) ----
    const lostNotes = inWindow.filter(a => a.kind === 'lost').map(a => (a.note || '理由未入力').trim() || '理由未入力');
    const lostReasons = [...groupBy(lostNotes, n => n.slice(0, 40))]
      .map(([reason, arr]) => ({ reason, count: arr.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ---- 提案 (データから機械的に。母数不足なら出さない) ----
    const recommendations: string[] = [];
    const notes: string[] = [];

    const overdue = rows.filter(r => r.stage !== 'LOST' && r.nextActionAt && r.nextActionAt < today).length;
    if (overdue > 0) {
      recommendations.push(`まず期限を過ぎている ${overdue} 件を消してください。新規を足すより先に、ここが受注に一番近い母数です。`);
    }

    const readable = [...byIndustry, ...byTier].filter(x => !x.tooSmall);
    if (readable.length) {
      const bestReply = [...readable].sort((a, b) => b.replyRatePct - a.replyRatePct)[0];
      const bestWin = [...readable].sort((a, b) => b.winRatePct - a.winRatePct)[0];
      if (bestReply.replyRatePct > 0) {
        recommendations.push(`返信率が一番高いのは「${bestReply.industry}」(${bestReply.replyRatePct}% / 接触${bestReply.contacted}件)。来週はここに本数を寄せてください。`);
      }
      if (bestWin.winRatePct > 0 && bestWin.industry !== bestReply.industry) {
        recommendations.push(`受注率が一番高いのは「${bestWin.industry}」(${bestWin.winRatePct}% / 接触${bestWin.contacted}件)。`);
      }
    } else {
      notes.push(`まだどの区分も接触が ${MIN_BASE} 件に届いていないため、返信率・受注率から「次に狙う業種」は出せません。まず数を打ってください。`);
    }

    const oemStat = byTier.find(t => t.industry.startsWith('TARGET A'));
    if (oemStat && !oemStat.tooSmall && oemStat.winRatePct > 0) {
      recommendations.push(`代理店/OEM (TARGET A) は接触${oemStat.contacted}件で受注率 ${oemStat.winRatePct}%。1社取れば継続で効くので、ここの本数を落とさないでください。`);
    }

    const untouched = rows.filter(r => r.stage === 'NEW').length;
    if (untouched > 0) recommendations.push(`未分析が ${untouched} 件あります。分析をかけないと弾が作れません。`);

    if (!inWindow.length) {
      notes.push(`直近 ${days} 日の活動記録が 0 件です。結果を入れていないと、この数字は「営業していない」ではなく「記録していない」を表します。`);
    }

    const body: ReportResponse = {
      asOf: new Date().toISOString(),
      weekFrom,
      weekTo: today,
      totals,
      byIndustry,
      byTier,
      lostReasons,
      recommendations,
      notes,
    };
    return json(body, 200, ch);
  } catch (e) {
    if (e instanceof KvNotConfigured) {
      return json({ error: 'STORAGE_NOT_CONFIGURED', message: '保存先 (Upstash Redis) が未設定です。' }, 503, ch);
    }
    return json({ error: 'INTERNAL', message: errMessage(e).slice(0, 200) }, 500, ch);
  }
}
