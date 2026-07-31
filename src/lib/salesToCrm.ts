// ============================================================
// salesToCrm — 営業エージェントで「採用」した相手を、案件管理(CRM)へ渡す
//
// これまで営業エージェント (core_sales_leads_v1) と
// 案件管理 (core_crm_deals_v1) は別々の置き場所で、行き来がなかった。
// = 採用しても案件一覧には一件も出ない (成果が届かない) 状態だったのを繋ぐ。
//
// 方針:
//  - 数字を作らない。想定金額は不明なので入れない (0円のまま)。
//  - 失敗を黙って飲み込まない。書けなかったら 'failed' を返し、画面に理由を出す。
//  - 同じ会社を二重に増やさない (同じ来歴＋同じ会社名なら 'duplicate')。
// ============================================================
import type { CRMDeal } from '../types/crm';

const CRM_STORE = 'core_crm_deals_v1';

/** どこから来た案件かを CRMDeal.source に入れる接頭辞 */
export const SALES_AGENT_SOURCE = 'sales-agent';

export type PushLeadResult = 'added' | 'duplicate' | 'failed';

export interface PushLeadInput {
  companyName: string;
  contactName?: string;
  email?: string;
  /** AI が選んだ理由 (そのまま案件の説明に残す) */
  reason?: string;
  /** 来歴の表示名: 「今日の5社」/「Gmail の受信箱」 */
  origin: string;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function readDeals(): CRMDeal[] {
  const raw = localStorage.getItem(CRM_STORE);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * 営業エージェントのリードを CRM の案件として追加する。
 * すでに同じ会社が営業エージェント由来で入っていれば何もしない。
 */
export function pushLeadToCrm(personaId: string, input: PushLeadInput): PushLeadResult {
  const company = input.companyName.trim();
  if (!company) return 'failed';
  try {
    const existing = readDeals();
    const dup = existing.some(d =>
      d.personaId === personaId &&
      (d.source || '').startsWith(SALES_AGENT_SOURCE) &&
      normalize(d.contact?.company || d.title || '') === normalize(company)
    );
    if (dup) return 'duplicate';

    const now = new Date().toISOString();
    const deal: CRMDeal = {
      id: `sa-${now}-${Math.random().toString(36).slice(2, 8)}`,
      personaId,
      title: company,
      contact: {
        id: `sa-c-${Math.random().toString(36).slice(2, 10)}`,
        name: input.contactName?.trim() || '担当者未確認',
        company,
        email: input.email?.trim() || undefined,
      },
      // 想定金額は分からないので入れない (勝手な数字を作らない)
      probability: 10,
      stage: 'lead',
      source: `${SALES_AGENT_SOURCE}:${input.origin}`,
      description: input.reason
        ? `AI が選んだ理由: ${input.reason}\n\n営業エージェント（${input.origin}）で採用。メールの下書きは営業エージェント側に保存されています。`
        : `営業エージェント（${input.origin}）で採用。メールの下書きは営業エージェント側に保存されています。`,
      activities: [{
        id: `sa-a-${Math.random().toString(36).slice(2, 10)}`,
        date: now.slice(0, 10),
        type: 'note',
        summary: `営業エージェント（${input.origin}）で採用。メールの下書きを保存しました。`,
      }],
      createdAt: now,
      updatedAt: now,
    };

    localStorage.setItem(CRM_STORE, JSON.stringify([deal, ...existing]));
    // 本当に書けたかを読み直して確認する (容量超過などを黙って見逃さない)
    const after = readDeals();
    return after.some(d => d.id === deal.id) ? 'added' : 'failed';
  } catch {
    return 'failed';
  }
}

/** 営業エージェント由来で CRM に入っている案件の数 */
export function countSalesAgentDeals(personaId: string): number {
  try {
    return readDeals().filter(d =>
      d.personaId === personaId && (d.source || '').startsWith(SALES_AGENT_SOURCE)
    ).length;
  } catch { return 0; }
}

/** 案件管理の画面を開く (IdentityDashboard の core:open-modal を使う) */
export function openCrmStudio() {
  try {
    window.dispatchEvent(new CustomEvent('core:open-modal', { detail: { modal: 'crm' } }));
  } catch { /* 画面遷移に失敗しても他の動作は止めない */ }
}
