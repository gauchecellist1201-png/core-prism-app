// ============================================================
// cxoDeliverables — CXO 14 名が 作った 「成果物」 を 蓄積 / 表示 する 共通 ストア
//
// オーナー指示 (2026-06-05):
//   「13 名の役員 が 勝手 に 仕事 を こなして 成果物 を 納品 する 感覚 を
//    一般 ユーザー に 見せる。 全部 アプリ内 で 確認 できる 様 に。
//    どの CXO が 何を どの ナレッジ を 元に 作った のか まで 全部 わかる 様 に。」
//
// 設計:
//   - localStorage 永続化 (persona ID で 隔離)
//   - 各 CXO の 「タスク完了 = 成果物 1 件」 として 記録
//   - 全文 markdown / サマリ / カテゴリ / 参照 ナレッジ を 保存
//   - 既読 / ピン留め / 削除 操作 + 検索 + フィルタ 用 API
//   - logDeliverable() を CXO 実行 完了 時 に 必ず 呼ぶ
//
// プライバシー: persona ID で 隔離 (ペルソナ間文脈漏洩 NG ルール 遵守)
// ============================================================
import type { CxoRole } from '../hooks/useAgentTaskQueue';

const STORE_KEY = 'core_cxo_deliverables_v1';
const MAX_ITEMS = 500;

export type DeliverableCategory =
  | 'plan'        // 計画 / 戦略
  | 'copy'        // コピー / 文章
  | 'analysis'    // 分析 / リサーチ
  | 'outreach'    // 営業 / 連絡
  | 'design'      // デザイン / 視覚
  | 'finance'     // 数値 / 財務
  | 'product'     // プロダクト / 仕様
  | 'ops'         // 運用 / プロセス
  | 'other';

export const CATEGORY_LABEL: Record<DeliverableCategory, { label: string; emoji: string; color: string }> = {
  plan:     { label: '計画', emoji: '🗺️', color: '#A78BFA' },
  copy:     { label: '文章', emoji: '✍️', color: '#34D399' },
  analysis: { label: '分析', emoji: '🔍', color: '#22D3EE' },
  outreach: { label: '営業', emoji: '📞', color: '#FBBF24' },
  design:   { label: 'デザイン', emoji: '🎨', color: '#F472B6' },
  finance:  { label: '数値', emoji: '💴', color: '#10B981' },
  product:  { label: 'プロダクト', emoji: '🧩', color: '#818CF8' },
  ops:      { label: '運用', emoji: '⚙️', color: '#94A3B8' },
  other:    { label: 'その他', emoji: '📦', color: '#CBD5E1' },
};

export interface CxoDeliverable {
  id: string;
  personaId: string;
  cxoRole: CxoRole;
  cxoName: string;
  cxoEmoji: string;
  title: string;         // 何を 作った か (例: 「今週 の 集客 案 3 つ」)
  summary: string;       // 1 行 サマリ
  content: string;       // markdown 全文 (1-3000 字)
  category: DeliverableCategory;
  taskId?: string;       // AgentTask への 参照 (任意)
  durationSec?: number;  // 実行 時間 (秒)
  knowledgeRef?: string; // どの ナレッジ を 参照 した か (1-2 行)
  source?: 'agent-monitor' | 'inline-executor' | 'studio' | 'morning-coach' | 'demo' | 'other';
  createdAt: string;     // ISO
  pinned?: boolean;
  viewed?: boolean;
}

// ─── 永続化 ──────────────────────────────────────────────
function loadAll(): CxoDeliverable[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is CxoDeliverable =>
      d && typeof d === 'object' &&
      typeof d.id === 'string' &&
      typeof d.cxoRole === 'string' &&
      typeof d.title === 'string' &&
      typeof d.content === 'string' &&
      typeof d.createdAt === 'string'
    );
  } catch { return []; }
}

function saveAll(items: CxoDeliverable[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS))); }
  catch { /* quota */ }
}

function makeId(): string {
  return 'dlv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// ─── 公開 API ─────────────────────────────────────────────
export function listDeliverables(personaId: string): CxoDeliverable[] {
  return loadAll()
    .filter((d) => d.personaId === personaId)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
}

export function listAllDeliverables(): CxoDeliverable[] {
  return loadAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** CXO 実行 完了 時 に 呼ぶ — 成果物 を 1 件 記録 */
export function logDeliverable(input: Omit<CxoDeliverable, 'id' | 'createdAt' | 'viewed'> & { createdAt?: string }): CxoDeliverable {
  const all = loadAll();
  const item: CxoDeliverable = {
    id: makeId(),
    createdAt: input.createdAt || new Date().toISOString(),
    viewed: false,
    ...input,
  };
  saveAll([item, ...all]);
  try {
    window.dispatchEvent(new CustomEvent('core:deliverable-added', { detail: item }));
  } catch { /* SSR */ }
  return item;
}

export function markViewed(id: string) {
  const all = loadAll();
  const next = all.map((d) => d.id === id ? { ...d, viewed: true } : d);
  saveAll(next);
}

export function markAllViewed(personaId: string) {
  const all = loadAll();
  const next = all.map((d) => d.personaId === personaId ? { ...d, viewed: true } : d);
  saveAll(next);
}

export function togglePin(id: string) {
  const all = loadAll();
  const next = all.map((d) => d.id === id ? { ...d, pinned: !d.pinned } : d);
  saveAll(next);
}

export function removeDeliverable(id: string) {
  saveAll(loadAll().filter((d) => d.id !== id));
}

export function clearPersona(personaId: string) {
  saveAll(loadAll().filter((d) => d.personaId !== personaId));
}

export function unreadCount(personaId: string): number {
  return loadAll().filter((d) => d.personaId === personaId && !d.viewed).length;
}

export function statsForPersona(personaId: string): {
  todayCount: number; weekCount: number; totalCount: number; unread: number;
  byCxo: Record<string, number>;
  byCategory: Record<string, number>;
  weekByCategory: Record<string, number>;
} {
  const items = loadAll().filter((d) => d.personaId === personaId);
  return statsFromItems(items);
}

/**
 * 嘘禁止版 — デモ シード (source==='demo') を 除いた 「本当に 役員 が 作った」 件数 だけ を 数える。
 * 「今週 役員 が あなた の ために 動いた 量」 など、価値 を 主張 する 数字 は すべて これ を 使う。
 * (オーナー方針 honest-numbers: サンプル を 実績 として 見せない)
 */
export function realStatsForPersona(personaId: string): {
  todayCount: number; weekCount: number; totalCount: number; unread: number;
  byCxo: Record<string, number>;
  byCategory: Record<string, number>;
  weekByCategory: Record<string, number>;
} {
  const items = loadAll().filter((d) => d.personaId === personaId && d.source !== 'demo');
  return statsFromItems(items);
}

function statsFromItems(items: CxoDeliverable[]): {
  todayCount: number; weekCount: number; totalCount: number; unread: number;
  byCxo: Record<string, number>;
  byCategory: Record<string, number>;
  weekByCategory: Record<string, number>;
} {
  const now = Date.now();
  const dayMs = 86400_000;
  const today = items.filter((d) => now - new Date(d.createdAt).getTime() < dayMs).length;
  const week = items.filter((d) => now - new Date(d.createdAt).getTime() < dayMs * 7).length;
  const byCxo: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const weekByCategory: Record<string, number> = {};
  for (const d of items) {
    byCxo[d.cxoRole] = (byCxo[d.cxoRole] || 0) + 1;
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
    if (now - new Date(d.createdAt).getTime() < dayMs * 7) {
      weekByCategory[d.category] = (weekByCategory[d.category] || 0) + 1;
    }
  }
  return {
    todayCount: today,
    weekCount: week,
    totalCount: items.length,
    unread: items.filter((d) => !d.viewed).length,
    byCxo, byCategory, weekByCategory,
  };
}

/** デモ シード (初回 ユーザー が 空 の タブ を 見ない 様 に) */
export function seedDemoDeliverables(personaId: string) {
  const existing = loadAll().filter((d) => d.personaId === personaId);
  if (existing.length > 0) return; // 既に何かある なら 触らない
  const now = Date.now();
  const SAMPLES: Array<Omit<CxoDeliverable, 'id' | 'createdAt' | 'personaId' | 'viewed'>> = [
    {
      cxoRole: 'CMO', cxoName: '陽菜 (CMO)', cxoEmoji: '📣',
      title: '今週 の 集客 案 3 つ',
      summary: 'SNS / メール / リアル イベント の 3 つ で 想定 流入 を 試算',
      content: `# 今週 の 集客 案 3 つ (試算 込み)\n\n## 1. X (旧 Twitter) で 「失敗談 → 解決」 投稿\n- 想定 リーチ: 12,000\n- 想定 LP CTR: 2.4%\n- 想定 試用: 14 件\n\n## 2. 既存 顧客 へ 紹介 キャンペーン メール\n- 配信 数: 280\n- 想定 開封 率: 38%\n- 想定 紹介 数: 6 件\n\n## 3. 渋谷 共創 スペース で 1 時間 デモ 会\n- 会場 費: 0 円\n- 想定 来場: 12 人\n- 想定 試用: 5 件\n\n**合計 試用 見込み: 25 件 / 想定 7 日 売上 +¥125,000**`,
      category: 'plan',
      knowledgeRef: '直近 3 週 の Stripe 試用 → 課金 転換 17% を 元に 試算',
      source: 'demo',
      durationSec: 38,
    },
    {
      cxoRole: 'CFO', cxoName: '颯太 (CFO)', cxoEmoji: '💴',
      title: '今月 の 損益 を 1 枚 に まとめる',
      summary: '売上 / 経費 / 純利益 の 3 数字 と 来月 リスク を 抽出',
      content: `# 2026 年 5 月 の 損益 サマリ\n\n| 項目 | 金額 | 前月 比 |\n|---|---:|---:|\n| 売上 | ¥1,840,000 | +12% |\n| 経費 | ¥740,000 | +3% |\n| **純 利益** | **¥1,100,000** | **+19%** |\n\n## 来月 (6 月) の リスク 3 点\n1. AWS が +¥45,000 (新規 機能 サーバー 追加)\n2. 7 日 無料 終了 ユーザー 12 名 — 解約 率 8% 想定 = ¥9,600 マイナス\n3. 紙 媒体 出稿 ¥120,000 を 入れる か 判断 待ち\n\n**推奨**: ¥120,000 出稿 は 保留 → AWS と 解約 リスク を 吸収 する 余力 を 残す`,
      category: 'finance',
      knowledgeRef: 'Stripe (直近 30 日) + 経費 タブ + Vercel 請求',
      source: 'demo',
      durationSec: 52,
    },
    {
      cxoRole: 'CPO', cxoName: '凛 (CPO)', cxoEmoji: '🧩',
      title: '商標 調査 を 今夜 30 分 で 終わらせる',
      summary: '4 商標 (CORE Prism / Iris / コアプリズム / コアアイリス) の 既存 登録 確認',
      content: `# 商標 調査 結果 (J-PlatPat 風 簡易 確認)\n\n## 1. CORE Prism (区分 9, 42)\n- 既存: なし\n- リスク: 「Prism」 単体 で 9 区分 に 3 件 ヒット → 識別 性 確保 で OK\n\n## 2. CORE Iris (区分 9, 42)\n- 既存: なし\n- リスク: 「Iris」 は 区分 3 (化粧 品) に 多数 → 区分 違い で 問題 なし\n\n## 3. コアプリズム / コアアイリス (区分 9, 42)\n- 既存: なし\n- 同音 異義: なし\n\n**推奨 次 手**:\n- 4 商標 とも 出願 可能 — 弁理士 へ 依頼 (見積 ¥36,000 × 4 = ¥144,000)\n- 出願 前 に 「使用 開始 日」 を ブログ に 残す こと で 先 使用 権 を 保全`,
      category: 'analysis',
      knowledgeRef: 'J-PlatPat 検索 結果 4 件 + 弁理士 過去 見積 メール',
      source: 'demo',
      durationSec: 47,
    },
    {
      cxoRole: 'CSO', cxoName: '誠 (CSO)', cxoEmoji: '🎯',
      title: '来週 商談 5 件 の 事前 メモ',
      summary: '相手 業種 / 想定 課題 / 持ち込む 提案 を 5 件 一気に',
      content: `# 来週 商談 5 件 の 事前 メモ\n\n## 月 14:00 — (株) 田中 カフェ\n- 業種: 飲食 (個人 経営)\n- 想定 課題: 客 数 が 平日 半減\n- 持ち込み: LINE 配信 で リピート 訴求 の 1 週 分 文面 + 来店 数 試算\n\n## 火 10:30 — Beauty Salon Lumière\n- 業種: 美容 室\n- 想定 課題: Instagram の フォロワー は 多い が 来店 に 繋がらない\n- 持ち込み: Iris の 「予約 動線」 設計 デモ\n\n## (省略) 残 3 件 も 同 形式 で 続く`,
      category: 'outreach',
      knowledgeRef: 'CRM タブ の deal 5 件 + 業界 比較表',
      source: 'demo',
      durationSec: 89,
    },
    {
      cxoRole: 'CDO', cxoName: '蒼 (CDO)', cxoEmoji: '📊',
      title: '今週 の KPI 異常 値 を 3 つ',
      summary: 'DAU / 解約 / オンボ 完了 を 先週 比 で 比較',
      content: `# 今週 の KPI 異常 値 (先週 比)\n\n## 🔴 オンボ 完了 率 ↓\n- 今週: 52% / 先週: 71% → -19pt\n- 推測 原因: 6/3 に 追加 した 「自社 ロゴ アップロード」 ステップ が 離脱 ポイント\n- 推奨: ロゴ アップロード を 任意 化 (skip 可能 に)\n\n## 🟡 DAU ↑ だが 滞在 時間 ↓\n- DAU: 18 → 24 (+33%)\n- 平均 滞在: 6 分 12 秒 → 3 分 41 秒 (-41%)\n- 推測 原因: 新規 が 増えた が 行動 が 浅い\n- 推奨: 「最初 の 1 件 を 一緒 に 作る」 ウェルカム ツアー 強化\n\n## 🟢 課金 転換 ↑\n- 試用 → 課金: 14% → 19% (+5pt)\n- 推奨: 何 が 効いた か 把握 — 直近 課金 5 名 に ヒアリング メール`,
      category: 'analysis',
      knowledgeRef: '/api/track/onboarding-step + /api/track/retention 直近 14 日',
      source: 'demo',
      durationSec: 64,
    },
  ];
  const all = loadAll();
  const items: CxoDeliverable[] = SAMPLES.map((s, i) => ({
    ...s,
    id: makeId(),
    personaId,
    createdAt: new Date(now - i * 3600_000 * (i + 1)).toISOString(), // 1h, 2h, 6h, 24h, 5d ago
    viewed: false,
  }));
  saveAll([...items, ...all]);
}
