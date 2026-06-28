// ============================================================
// weeklyValue — 「今週、AI役員があなたのために動いた量」を実データから集計
//
// honest-numbers:
//   - 数値はすべて localStorage 上の"実際の活動"の件数。捏造・推定なし。
//   - タイムスタンプがあるものは直近7日で絞る。無いものは出さない。
//   - 全部0なら 0 を返し、UI 側で正直な空状態を見せる（嘘の数字を作らない）。
// data-source-guard: 読み取り専用。既存キーへ書き込みは一切しない。
// ============================================================

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** その日のローカル 0:00 (ミリ秒)。「今日 AI が動いた量」を実データで絞るのに使う */
function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface ValueMetric {
  key: string;
  label: string;
  count: number;
  /** 集計窓 — UI のバッジ表示に使う */
  window: 'week' | 'month';
  /** Lucide アイコン名（UI 側でマップ） */
  icon: 'sparkles' | 'send' | 'book' | 'briefcase' | 'activity' | 'file-check';
  color: string;
}

function parse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** ISO 文字列が直近7日以内か */
function withinWeekISO(iso: unknown, cutoff: number): boolean {
  if (typeof iso !== 'string') return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= cutoff;
}

/**
 * 直近7日（一部は今月）の実活動を集計。
 * 返すのは count > 0 のものだけ（UI は空配列なら空状態を出す）。
 */
export function computeWeeklyValue(now: number = Date.now()): {
  metrics: ValueMetric[];
  total: number;
  /** 今日（ローカル 0:00 以降）AI が動いた件数。タイムスタンプのある実活動だけを数える（honest-numbers） */
  todayTotal: number;
} {
  const cutoff = now - WEEK_MS;
  const dayStart = startOfLocalDay(now);
  const all: ValueMetric[] = [];
  let todayTotal = 0;

  const isTodayISO = (iso: unknown): boolean => {
    if (typeof iso !== 'string') return false;
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= dayStart;
  };

  // 1. AI が出した提案（today brief / 能動提案）
  const proposals = parse<Array<{ generatedAt?: string }>>('core_proposals', []);
  const proposalCount = proposals.filter((p) => withinWeekISO(p?.generatedAt, cutoff)).length;
  todayTotal += proposals.filter((p) => isTodayISO(p?.generatedAt)).length;
  all.push({ key: 'proposals', label: 'AIからの提案', count: proposalCount, window: 'week', icon: 'sparkles', color: '#8E5CFF' });

  // 1.5 AI がその場で仕上げた成果物（TodayBrief のアクション実行＝最も体感できる価値）
  //     core_action_artifacts_v1 は InlineActionExecutor が保存する実物。createdAt あり＝直近7日で絞れる。
  const artifacts = parse<Array<{ createdAt?: string }>>('core_action_artifacts_v1', []);
  const artifactCount = artifacts.filter((a) => withinWeekISO(a?.createdAt, cutoff)).length;
  todayTotal += artifacts.filter((a) => isTodayISO(a?.createdAt)).length;
  all.push({ key: 'artifacts', label: 'AIが仕上げた成果物', count: artifactCount, window: 'week', icon: 'file-check', color: '#C9A96E' });

  // 2. 司令塔ループが生んだ「今日の一手」（下書き＋配信）
  const signals = parse<Array<{ kind?: string; ts?: number }>>('core_loop_signals_v1', []);
  const isHand = (s: { kind?: string; ts?: number }) => s?.kind === 'draft' || s?.kind === 'delivery';
  const handCount = signals.filter(
    (s) => isHand(s) && typeof s?.ts === 'number' && s.ts >= cutoff,
  ).length;
  todayTotal += signals.filter((s) => isHand(s) && typeof s?.ts === 'number' && s.ts >= dayStart).length;
  all.push({ key: 'hands', label: '今日の一手（生成・配信）', count: handCount, window: 'week', icon: 'send', color: '#A78BFA' });

  // 3. 取り込んだナレッジ（メール/ドキュメント/会議メモ等）
  const knowledge = parse<Array<{ createdAt?: string }>>('core_knowledge_v1', []);
  const knowledgeCount = knowledge.filter((k) => withinWeekISO(k?.createdAt, cutoff)).length;
  todayTotal += knowledge.filter((k) => isTodayISO(k?.createdAt)).length;
  all.push({ key: 'knowledge', label: '取り込んだ知識', count: knowledgeCount, window: 'week', icon: 'book', color: '#2E6FFF' });

  // 4. 抽出・整理した案件（CRM）
  const deals = parse<Array<{ createdAt?: string }>>('core_crm_deals_v1', []);
  const dealCount = deals.filter((d) => withinWeekISO(d?.createdAt, cutoff)).length;
  todayTotal += deals.filter((d) => isTodayISO(d?.createdAt)).length;
  all.push({ key: 'deals', label: '整理した案件', count: dealCount, window: 'week', icon: 'briefcase', color: '#E84B97' });

  // 5. 今月の実行アクション総数（feature_usage は月単位で記録）
  //    日付を持たないため「今日」には数えない（嘘の今日件数を作らない）。
  const usage = parse<{ month?: string; counts?: Record<string, number> }>('core_feature_usage_v1', {});
  const thisMonth = new Date(now).toISOString().slice(0, 7);
  const actionCount =
    usage?.month === thisMonth && usage.counts
      ? Object.values(usage.counts).reduce((s, v) => s + (Number(v) || 0), 0)
      : 0;
  all.push({ key: 'actions', label: '実行したアクション', count: actionCount, window: 'month', icon: 'activity', color: '#06C755' });

  const metrics = all.filter((m) => m.count > 0);
  const total = metrics.reduce((s, m) => s + m.count, 0);
  return { metrics, total, todayTotal };
}
