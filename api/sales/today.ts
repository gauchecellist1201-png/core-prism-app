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
import { listFeed, listRows, todayISO } from '../_lib/sales/store';
import { priorityValue, scoreBand } from '../../src/sales/shared/score';
import { FUNNEL_STAGES, stageMeta, targetByTier } from '../../src/sales/shared/catalog';
import type { CompanyRow, FunnelRow, Mission, TodayLead, TodayResponse } from '../../src/sales/shared/types';

export const config = { runtime: 'edge' };

const LEAD_LIMIT = 12;

function decide(row: CompanyRow, today: string): { action: TodayLead['action']; label: string } {
  // 未分析かどうかは stage だけで決める。
  // 「根拠が取れず 0 点」は正しい分析結果なので、score 0 を未分析の代わりにすると
  // 分析ずみの会社に永遠に「分析をかける」を出し続け、本来の追客を押しのける。
  if (row.stage === 'NEW') return { action: 'analyze', label: '企業分析をかける' };
  // 予定が入っていればそれが最優先。接触回数は見ない。
  // 不在 (call_no_answer) は接触に数えない仕様なので、touches>0 を条件にすると
  // 「2日後にかけ直す」と決めた会社に「メールを送る」と言ってしまう。
  if (row.nextActionAt && row.nextActionAt <= today && row.nextActionLabel) {
    return { action: 'followup', label: row.nextActionLabel };
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
  if (row.stage === 'LOST') out.push('失注からの再アプローチ');
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
    // 今日の件数は日次カウンタ (sales:day:*) ではなく活動フィードから数える。
    // カウンタは会社を消しても減らないので、消したテスト会社の電話・メールが
    // いつまでも「今日の接触」に残る。フィードなら生きている会社だけを数えられる。
    const [rows, feed] = await Promise.all([listRows(), listFeed(1500)]);

    // 失注は普段は出さないが、90日後の再アプローチ日が来たら戻す。
    // 出さないままだと applyActivity が入れた再アプローチ日が永久に届かない。
    const alive = new Set(rows.map(r => r.id));
    const todayActs = feed.filter(a => alive.has(a.companyId) && todayISO(new Date(a.at)) === today);
    const countToday = (k: string) => todayActs.filter(a => a.kind === k).length;

    const active = rows.filter(r => r.stage !== 'LOST' || (r.nextActionAt !== null && r.nextActionAt <= today));

    // 予定日が先の会社は今日の相手ではない。
    // 順位を下げるだけだと、母数が少ない日に「2日後に再架電」の会社が上位に出て、
    // decide() が「今すぐ電話」と言ってしまい、せっかく決めた予定が崩れる。
    const dueToday = active.filter(r => !r.nextActionAt || r.nextActionAt <= today);

    const ranked = dueToday
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
    // 不在で 2 日後に再架電予定の会社は「今すぐ電話」に数えない。
    // 不在は接触回数に数えない仕様なので、日付を見ないと毎日かけ直せと言い続ける。
    const untouched = active.filter(r =>
      r.touches === 0 && r.stage !== 'NEW' && (!r.nextActionAt || r.nextActionAt <= today));
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
    // 受注率も到達段で数える (あとから失注にしても、取れた事実は消えない)
    const wonRows = rows.filter(r => step(r) >= stageMeta('TRIAL').step);
    // 単発と月額は単位が違うので別の欄に積んである (report.ts と同じ数え方)
    const oneOffYen = rows.reduce((a, r) => a + (r.oneOffYen || 0), 0);
    const oneOffCount = rows.reduce((a, r) => a + (r.oneOffCount || 0), 0);
    const mrrYen = rows.reduce((a, r) => a + (r.mrrYen || 0), 0);
    const pipelineYen = rows
      .filter(r => r.stage === 'MEETING' || r.stage === 'PROPOSAL')
      .reduce((a, r) => a + (r.dealYen || 0), 0);

    const body: TodayResponse = {
      asOf: new Date().toISOString(),
      leads,
      mission,
      kpi: {
        todayTouched: countToday('call') + countToday('email'),
        todayCalls: countToday('call') + countToday('call_no_answer'),
        todayEmails: countToday('email'),
        replies: replied,
        meetings,
        won: rows.filter(r => r.stage === 'WON' || r.stage === 'TRIAL').length,
        monthly: rows.filter(r => r.stage === 'MONTHLY').length,
        oem: rows.filter(r => r.stage === 'OEM').length,
        replyRatePct: contacted ? Math.round((replied / contacted) * 1000) / 10 : 0,
        winRatePct: contacted ? Math.round((wonRows.length / contacted) * 1000) / 10 : 0,
        pipelineYen,
        oneOffYen,
        mrrYen,
        // 分母は「金額を入れた件数」。未入力を0円として数えると平均が半分になる
        avgOneOffYen: oneOffCount ? Math.round(oneOffYen / oneOffCount) : 0,
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
