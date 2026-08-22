// ============================================================
// POST /api/sales/generate — 動画企画3案 / 営業メール / 電話トーク
//
// body: { id, kind: 'plan' | 'email' | 'call', planKind?: 'A'|'B'|'C', touch?: number }
//   ・企画は 1 案ずつ (A/B/C)。3 案を 1 回で書かせると Edge の 25 秒に収まらない
//     (実測 18 秒で時間切れ)。画面が A→B→C と 3 回呼ぶ。
//   ・touch を省くと「今この会社に送るべき回」を自動で決める (追客の切り口が毎回変わる)
// x-master-key 必須
// ============================================================
import { Deadline, corsHeaders, errMessage, json, requireMaster } from '../_lib/sales/http';
import { KvNotConfigured } from '../_lib/sales/kv';
import { acquireCompanyLock, getCompany, putCompany, releaseCompanyLock } from '../_lib/sales/store';
import { MODEL_FAST, MODEL_WRITE, askJson } from '../_lib/sales/ai';
import {
  callSystem, callUser, emailSystem, emailUser, plansSystem, planUser,
} from '../_lib/sales/prompts';
import { toCall, toEmail, toPlans } from '../_lib/sales/normalize';
import { FOLLOWUPS, nextFollowUp } from '../../src/sales/shared/catalog';
import type { Company, PlanKind, VideoPlan } from '../../src/sales/shared/types';

export const config = { runtime: 'edge' };

type Kind = 'plan' | 'email' | 'call';
const KINDS: Kind[] = ['plan', 'email', 'call'];
const PLAN_KINDS: PlanKind[] = ['A', 'B', 'C'];

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  const denied = requireMaster(req, ch);
  if (denied) return denied;

  const deadline = new Deadline(22_000);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id.trim().slice(0, 80) : '';
    const kind = String(body.kind || '') as Kind;
    if (!id) return json({ error: 'EMPTY', message: 'id がありません。' }, 400, ch);
    if (!KINDS.includes(kind)) return json({ error: 'BAD_KIND', message: 'kind は plan / email / call のいずれかです。' }, 400, ch);

    const company = await getCompany(id);
    if (!company) return json({ error: 'NOT_FOUND', message: 'その営業先は見つかりませんでした。' }, 404, ch);

    const analysis = company.analysis;
    if (!analysis) {
      return json({
        error: 'NOT_ANALYZED',
        message: 'まず企業分析をかけてください。分析なしで書くと、この会社に当てはまらない一般論になります。',
      }, 409, ch);
    }

    // 生成した項目だけを、最後に読み直した最新の企業へ重ねる。
    // 生成には10〜20秒かかる。その間に結果入力や編集が入ることがあり、
    // 読み込み時のスナップショットで丸ごと書き戻すと、その入力が黙って消える。
    const patch: Partial<Company> = {};
    // 企画は「作っただけ」にしておき、札を取ったあとの最新 plans に重ねる。
    // ここで配列を組み立てて丸ごと書くと、別タブが先に保存した別の案を消してしまう。
    let madePlan: VideoPlan | null = null;
    let planKind: PlanKind = 'A';

    if (kind === 'plan') {
      const pk = String(body.planKind || 'A').toUpperCase() as PlanKind;
      if (!PLAN_KINDS.includes(pk)) return json({ error: 'BAD_PLAN', message: 'planKind は A / B / C のいずれかです。' }, 400, ch);
      planKind = pk;
      const already = (company.plans || []).filter(p => p.kind !== pk);
      const ai = await askJson<Record<string, unknown>>({
        req, system: plansSystem(), user: planUser(company, analysis, pk, already),
        maxTokens: 1100, model: MODEL_FAST, deadline,
      });
      if (!ai.ok || !ai.data) return json({ error: 'AI_FAILED', message: ai.note || 'AI が企画を返しませんでした。' }, 502, ch);
      const made = toPlans({ plans: [ai.data] });
      if (!made.length) return json({ error: 'AI_EMPTY', message: 'AI が使える企画を返しませんでした。もう一度お試しください。' }, 502, ch);
      madePlan = { ...made[0], kind: pk };
    }

    if (kind === 'email') {
      // 何回目として書くか。指定が無ければ「次に送るべき回」。
      const requested = Number(body.touch);
      const touch = Number.isFinite(requested) && requested >= 1
        ? Math.min(Math.round(requested), FOLLOWUPS[FOLLOWUPS.length - 1].touch)
        : Math.max(1, company.touches + 1);
      const step = touch <= 1 ? null : nextFollowUp(touch - 1);
      const ai = await askJson<Record<string, unknown>>({
        req,
        system: emailSystem(),
        user: emailUser({
          c: company, a: analysis, plans: company.plans,
          touch,
          angle: step?.angle || '初回',
          instruction: step?.instruction || '',
        }),
        maxTokens: 1200,
        model: MODEL_WRITE,
        deadline,
      });
      if (!ai.ok || !ai.data) return json({ error: 'AI_FAILED', message: ai.note || 'AI がメールを返しませんでした。' }, 502, ch);
      const draft = toEmail(ai.data, touch, step?.angle || '初回');
      if (!draft) return json({ error: 'AI_EMPTY', message: 'AI が使えるメールを返しませんでした。もう一度お試しください。' }, 502, ch);
      patch.email1 = draft;
    }

    if (kind === 'call') {
      const ai = await askJson<Record<string, unknown>>({
        req, system: callSystem(), user: callUser(company, analysis, company.plans),
        maxTokens: 1200, model: MODEL_WRITE, deadline,
      });
      if (!ai.ok || !ai.data) return json({ error: 'AI_FAILED', message: ai.note || 'AI がトークを返しませんでした。' }, 502, ch);
      const script = toCall(ai.data);
      if (!script) return json({ error: 'AI_EMPTY', message: 'AI が使えるトークを返しませんでした。もう一度お試しください。' }, 502, ch);
      patch.call = script;
    }

    // 書くときだけ札を取る (生成を待っている間ずっと持つと、その会社に何も記録できない)
    const lock = await acquireCompanyLock(id);
    if (!lock) {
      return json({
        error: 'BUSY',
        message: 'この営業先はいま別の更新を処理中です。作ったものは保存していません。もう一度お試しください。',
      }, 409, ch);
    }
    try {
      const fresh = await getCompany(id);
      if (!fresh) {
        // 生成中に削除された。古いスナップショットで書き戻すと消した会社が復活する。
        return json({
          error: 'NOT_FOUND',
          message: '作成している間にこの営業先が削除されました。結果は保存していません。',
        }, 404, ch);
      }
      // 作っている間に URL が別のサイトへ変わっていたら、この文面はもう別の会社宛て。
      // (PATCH 側は変更時に分析・企画・文面を消しているので、ここで戻してはいけない)
      if (fresh.domain !== company.domain) {
        return json({
          error: 'URL_CHANGED',
          message: '作っている間にURLが変わりました。前のサイト向けの内容は保存していません。分析からやり直してください。',
          company: fresh,
        }, 409, ch);
      }
      // 作っている間に分析がやり直されていたら、この内容は古い分析から作ったもの。
      if (fresh.analysisAt !== company.analysisAt) {
        return json({
          error: 'STALE_ANALYSIS',
          message: '作っている間に分析がやり直されました。古い分析から作った内容は保存していません。もう一度作ってください。',
          company: fresh,
        }, 409, ch);
      }
      // メールは「何回目の接触か」で中身が変わる。作っている間に別のタブで記録が入ると、
      // 2回目を送るべき相手に初回のメールを保存してしまう。
      if (kind === 'email' && fresh.touches !== company.touches) {
        return json({
          error: 'STALE',
          message: '作っている間にこの営業先の記録が進みました。回数がずれるので保存していません。もう一度書き直してください。',
          company: fresh,
        }, 409, ch);
      }
      // 企画は最新の plans に重ねる (別タブが保存した別の案を消さない)
      if (madePlan) {
        const merged = [...(fresh.plans || []).filter(p => p.kind !== planKind), madePlan];
        merged.sort((x, y) => PLAN_KINDS.indexOf(x.kind) - PLAN_KINDS.indexOf(y.kind));
        patch.plans = merged;
      }
      const saved = await putCompany({ ...fresh, ...patch });
      return json({ company: saved }, 200, ch);
    } finally {
      await releaseCompanyLock(id, lock);
    }
  } catch (e) {
    if (e instanceof KvNotConfigured) {
      return json({ error: 'STORAGE_NOT_CONFIGURED', message: '保存先 (Upstash Redis) が未設定です。' }, 503, ch);
    }
    return json({ error: 'INTERNAL', message: errMessage(e).slice(0, 200) }, 500, ch);
  }
}
