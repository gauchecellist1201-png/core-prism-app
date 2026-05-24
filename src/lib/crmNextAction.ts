// ============================================================
// CRM Next Action — 案件カードに「次に何をすべきか」を 1 行で提案
//
// 設計方針:
//  - まずヒューリスティック (放置日数 / ステージ / 確度 / クローズ日) で
//    AI 呼出しなしでも 80% は意味ある提案が出るようにする
//  - localStorage キャッシュ (24h) で同じ案件を何度も AI に投げない
//  - AI 呼出しは Haiku 経由 (apiQueue) で 1 文 (40 字以内) 返す
// ============================================================
import type { CRMDeal } from '../types/crm';
import { STAGE_META } from '../types/crm';
import { enqueueClaudeCall } from './apiQueue';

const CACHE_KEY = 'core_crm_next_action_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry { text: string; at: number; signature: string; }

function loadCache(): Record<string, CacheEntry> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
  catch { return {}; }
}
function saveCache(c: Record<string, CacheEntry>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* */ }
}

/** 案件のキー情報を文字列化 (中身が変わったら再生成する判定用) */
function dealSignature(d: CRMDeal): string {
  return [
    d.stage,
    d.amount || 0,
    d.probability ?? 30,
    d.expectedCloseDate || '',
    d.activities.length,
    d.activities[0]?.date || '',
  ].join('|');
}

/** 最後の活動から何日経ったか */
export function daysSinceLastActivity(d: CRMDeal): number | null {
  const last = d.activities[0]?.date || d.updatedAt?.slice(0, 10);
  if (!last) return null;
  const t = new Date(last).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

/** AI 不要・即座のヒューリスティック提案 */
export function heuristicNextAction(d: CRMDeal): string {
  if (d.stage === 'won')  return '🎉 受注の御礼メール + 次の案件への布石を打つ';
  if (d.stage === 'lost') return '失注理由を 1 行メモして、3 ヶ月後に再アプローチ予定を立てる';

  const days = daysSinceLastActivity(d);
  const closeDate = d.expectedCloseDate ? new Date(d.expectedCloseDate) : null;
  const daysToClose = closeDate
    ? Math.floor((closeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // 期限が近い / 過ぎている
  if (daysToClose != null && daysToClose < 0)
    return `クローズ予定日を ${-daysToClose} 日超過。今すぐ状況確認の連絡を`;
  if (daysToClose != null && daysToClose <= 3)
    return `クローズ予定まで ${daysToClose} 日。最終判断を仰ぐメールを送る`;

  // 放置が長い
  if (days != null && days >= 14)
    return `${days} 日連絡なし。軽い近況伺いメールで関係を再起動`;
  if (days != null && days >= 7)
    return `${days} 日連絡なし。リマインダーを 1 通送るのが効きます`;

  // ステージ別の定番アクション
  switch (d.stage) {
    case 'lead':
      return d.contact?.name
        ? `初回ヒアリング日程を 3 候補で打診する`
        : `連絡先 (氏名 / 会社 / メール) を埋める`;
    case 'qualified':
      return '課題と予算感をヒアリング → 提案の骨子を 1 枚作る';
    case 'proposal':
      return (d.probability ?? 30) < 50
        ? '懸念点を直接ヒアリング → 提案を 1 段リライト'
        : '決裁者の判断日を確認し、後押し材料を 1 つ追加';
    case 'negotiation':
      return '条件の最終確認 + 契約書のドラフトを送付';
  }
  return '次のアクションを 1 つメモして、活動履歴に記録する';
}

/** AI で「次のアクション」を生成 (キャッシュあり) */
export async function suggestNextAction(d: CRMDeal, opts?: { force?: boolean }): Promise<string> {
  const cache = loadCache();
  const sig = dealSignature(d);
  const cached = cache[d.id];
  if (!opts?.force && cached && cached.signature === sig && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.text;
  }

  // ヒューリスティックを即座のフォールバックに
  const fallback = heuristicNextAction(d);

  try {
    const days = daysSinceLastActivity(d);
    const recent = d.activities.slice(0, 3).map(a => `- ${a.date} [${a.type}] ${a.summary}`).join('\n') || '(履歴なし)';
    const sys = `あなたは敏腕の営業マネージャー。一つの商談カードを見て「次に何をすべきか」を 1 文 (40 字以内、語尾は「〜する」「〜を送る」など動詞で終える) で提案する。
売り込みではなく、関係を前に進める具体的な一手を。`;
    const prompt = `# 商談\n- タイトル: ${d.title}\n- 顧客: ${d.contact?.name || '未設定'}${d.contact?.company ? ` (${d.contact.company})` : ''}\n- ステージ: ${STAGE_META[d.stage].label}\n- 想定金額: ${d.amount ? `¥${d.amount.toLocaleString()}` : '未設定'}\n- 確度: ${d.probability ?? 30}%\n- クローズ予定: ${d.expectedCloseDate || '未設定'}\n- 最終活動から: ${days != null ? `${days} 日経過` : '不明'}\n- メモ: ${d.description || '(なし)'}\n\n## 直近の活動\n${recent}\n\n次に取るべき一手を 1 文で。`;

    const r = await enqueueClaudeCall(async () => {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 120,
          system: sys,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ content?: Array<{ text?: string }> }>;
    });

    const text = (r.content?.[0]?.text || '').trim().replace(/^["「]|["」]$/g, '');
    const final = text || fallback;
    cache[d.id] = { text: final, at: Date.now(), signature: sig };
    saveCache(cache);
    return final;
  } catch {
    // AI 失敗時はキャッシュせず、ヒューリスティックを返す
    return fallback;
  }
}

/** 案件の優先度スコア (高いほど今すぐ着手すべき) */
export function priorityScore(d: CRMDeal): number {
  if (d.stage === 'won' || d.stage === 'lost') return 0;
  let s = 10;
  const days = daysSinceLastActivity(d);
  if (days != null) s += Math.min(days, 30);
  if (d.amount) s += Math.log10(d.amount + 1) * 3;
  s += ((d.probability ?? 30) / 100) * 10;
  const close = d.expectedCloseDate ? new Date(d.expectedCloseDate).getTime() : null;
  if (close) {
    const daysToClose = Math.floor((close - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysToClose < 0) s += 30;
    else if (daysToClose <= 3) s += 20;
    else if (daysToClose <= 7) s += 10;
  }
  return Math.round(s);
}
