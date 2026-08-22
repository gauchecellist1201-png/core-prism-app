// ============================================================
// GET /api/sales/today — 今日やること
//
// ・TODAY'S TOP LEADS (理由つき)
// ・TODAY'S MISSION (電話/メール/追客/商談/分析の件数)
// ・KPI とファネル
// 期限が来ている追客を必ず先頭に出す。スコア順だけで並べると、
// 追客が新規の高スコアに一生抜かされて「1回打って終わり」になる。
// x-master-key 必須
// ============================================================
import { corsHeaders, errMessage, json, requireMaster } from '../_lib/sales/http';
import { KvNotConfigured } from '../_lib/sales/kv';
import { listRows, readDay, todayISO } from '../_lib/sales/store';
import { priorityValue, scoreBand } from '../../src/sales/shared/score';
import { FUNNEL_STAGES, WON_STAGES, stageMeta, targetByTier } from '../../src/sales/shared/catalog';
import type { CompanyRow, FunnelRow, Mission, TodayLead, TodayResponse } from '../../src/sales/shared/types';

export const config = { runtime: 'edge' };

const LEAD_LIMIT = 12;

function decide(row: CompanyRow, today: string): { action: TodayLead['action']; label: string } {
  if (row.stage === 'NEW' || row.score === 0) return { action: 'analyze', label: '企業分析をかける' };
  if (row.nextActionAt && row.nextActionAt <= today && row.touches > 0) {
    return { action: 'followup', label: row.nextActionLabel || '追客する' };
  }
  if (row.touches === 0) {
    // 代理店(A)は電話が通りやすい。B/C は先にメールで企画を見せる。
    return row.targetTier === 'A'
      ? { action: 'call', label: '電話をかける' }
      : { action: 'email', label: 'メールを送る' };
  }
  return { action: 'followup', label: row.nextActionLabel || '追客する' };
}

function reasons(row: CompanyRow, today: string): string[] {
  const out: string[] = [];
  if (row.nextActionAt && row.nextActionAt < today) out.push(`期限を ${daysBetween(row.nextActionAt, today)} 日超過`);
  else if (row.nextActionAt === today) out.push('今日が予定日');
  if (row.score >= 60) out.push(`スコア ${row.score} (${scoreBand(row.score).label})`);
  const t = targetByTier(row.targetTier);
  if (row.targetTier !== 'X') out.push(t.tier === 'A' ? 'OEM候補' : t.tier === 'B' ? '動画関連の求人あり' : '動画と相性の良い業種');
  if (row.industry) out.push(row.industry);
  if (row.touches === 0) out.push('未接触');
  else out.push(`接触 ${row.touches} 回`);
  return out.slice(0, 5);
}

function daysBetween(a: string, b: string): number {
  const t1 = Date.parse(`${a}T00:00:00.000Z`);
  const t2 = Date.parse(`${b}T00:00:00.000Z`);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 0;
  return Math.max(0, Math.round((t2 - t1) / 86_400_000));
}

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, ch);

  const denied = requireMaster(req, ch);
  if (denied) return denied;

  try {
    const today = todayISO();
    const [rows, day] = await Promise.all([listRows(), readDay(today)]);

    const active = rows.filter(r => r.stage !== 'LOST');

    const ranked = active
      .map(r => ({ r, p: priorityValue({ score: r.score, nextActionAt: r.nextActionAt, touches: r.touches, todayISO: today }) }))
      .sort((a, b) => (b.p - a.p) || (b.r.score - a.r.score) || a.r.name.localeCompare(b.r.name, 'ja'));

    const leads: TodayLead[] = ranked.slice(0, LEAD_LIMIT).map(({ r }) => {
      const d = decide(r, today);
      return {
        row: r,
        reason: reasons(r, today),
        action: d.action,
        actionLabel: d.label,
        recommendedPlan: r.targetTier === 'A' ? 'oem' : r.score >= 70 ? 'm8' : r.score >= 50 ? 'm4' : 'entry',
      };
    });

    // ---- ミッション (実データから逆算。空想の目標を出さない) ----
    const due = active.filter(r => r.nextActionAt && r.nextActionAt <= today);
    const unanalyzed = active.filter(r => r.stage === 'NEW');
    const untouched = active.filter(r => r.touches === 0 && r.stage !== 'NEW');
    const mission: Mission = {
      followup: due.filter(r => r.touches > 0).length,
      analyze: unanalyzed.length,
      call: untouched.filter(r => r.targetTier === 'A').length,
      email: untouched.filter(r => r.targetTier !== 'A').length,
      meeting: active.filter(r => r.stage === 'MEETING' || r.stage === 'PROPOSAL').length,
    };

    // ---- ファネル ----
    const funnel: FunnelRow[] = FUNNEL_STAGES.map(sid => ({
      stage: sid,
      label: stageMeta(sid).label,
      count: rows.filter(r => r.stage === sid).length,
    }));

    // ---- KPI ----
    // 失注しても「返信はもらえた」「商談まで行けた」は消さない (report.ts と同じ数え方)
    const step = (r: CompanyRow) => Math.max(r.maxStep ?? 0, stageMeta(r.stage).step);
    const contacted = rows.filter(r => step(r) >= 2 || r.touches > 0).length;
    const replied = rows.filter(r => step(r) >= 3).length;
    const meetings = rows.filter(r => step(r) >= 4).length;
    const wonRows = rows.filter(r => WON_STAGES.includes(r.stage));
    const wonYen = wonRows.reduce((a, r) => a + (r.dealYen || 0), 0);
    const pipelineYen = rows
      .filter(r => r.stage === 'MEETING' || r.stage === 'PROPOSAL')
      .reduce((a, r) => a + (r.dealYen || 0), 0);

    const body: TodayResponse = {
      asOf: new Date().toISOString(),
      leads,
      mission,
      kpi: {
        todayTouched: (day.call || 0) + (day.email || 0),
        todayCalls: (day.call || 0) + (day.call_no_answer || 0),
        todayEmails: day.email || 0,
        replies: replied,
        meetings,
        won: rows.filter(r => r.stage === 'WON' || r.stage === 'TRIAL').length,
        monthly: rows.filter(r => r.stage === 'MONTHLY').length,
        oem: rows.filter(r => r.stage === 'OEM').length,
        replyRatePct: contacted ? Math.round((replied / contacted) * 1000) / 10 : 0,
        winRatePct: contacted ? Math.round((wonRows.length / contacted) * 1000) / 10 : 0,
        pipelineYen,
        wonYen,
        avgDealYen: wonRows.length ? Math.round(wonYen / wonRows.length) : 0,
      },
      funnel,
      overdue: active.filter(r => r.nextActionAt && r.nextActionAt < today).length,
      total: rows.length,
    };

    return json(body, 200, ch);
  } catch (e) {
    if (e instanceof KvNotConfigured) {
      return json({ error: 'STORAGE_NOT_CONFIGURED', message: '保存先 (Upstash Redis) が未設定です。' }, 503, ch);
    }
    return json({ error: 'INTERNAL', message: errMessage(e).slice(0, 200) }, 500, ch);
  }
}
