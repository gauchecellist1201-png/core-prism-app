// ============================================================
// /master/company-setup — 派生ロジック (依存関係解放 / 今日やること / 進捗 / 費用 / 警告)
// すべて純粋関数。React に依存しない。
// ============================================================
import type { CompanySetupTask, CompanyPayment, CompanySettings } from './types';
import { businessDaysLaterIso, isBusinessDayIso, formatMonthDayJa } from './holidays';
import { CAPITAL_TASK_ID, DOCS_ARRIVED_TASK_ID, ISAKA_DRAFTING_TASK_ID, REGISTRATION_TASK_ID, DOC_PREP_BUSINESS_DAYS } from './constants';

export function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const it of items) out[it.id] = it;
  return out;
}

export function isTaskUnlocked(task: CompanySetupTask, byId: Record<string, CompanySetupTask>): boolean {
  return task.dependencies.every((depId) => byId[depId]?.status === 'completed');
}

/**
 * 依存関係が解放された瞬間に activatedAt を刻み、waitingFor を持つタスクは
 * 自動で in_progress にする (「井坂事務所が作業中」を毎回手動で切り替えなくて済むように)。
 * 冪等: 既に activatedAt がある / 既に completed のタスクは変更しない。
 */
export function reconcileActivation(tasks: CompanySetupTask[], nowIso: string): CompanySetupTask[] {
  const byId = indexById(tasks);
  let changed = false;
  const next = tasks.map((t) => {
    if (t.status === 'completed' || t.activatedAt) return t;
    if (!isTaskUnlocked(t, byId)) return t;
    changed = true;
    return {
      ...t,
      activatedAt: nowIso,
      status: t.waitingFor ? ('in_progress' as const) : t.status,
      updatedAt: nowIso,
    };
  });
  return changed ? next : tasks;
}

export interface CompleteGuardResult {
  ok: boolean;
  reason?: 'not_found' | 'locked' | 'docs_not_arrived';
}

/** そのタスクを完了にしてよいかのガード (依存関係ロック + 資本金の強いロック) */
export function canCompleteTask(taskId: string, tasks: CompanySetupTask[]): CompleteGuardResult {
  const byId = indexById(tasks);
  const t = byId[taskId];
  if (!t) return { ok: false, reason: 'not_found' };
  if (!isTaskUnlocked(t, byId)) return { ok: false, reason: 'locked' };
  if (taskId === CAPITAL_TASK_ID) {
    const docsArrived = byId[DOCS_ARRIVED_TASK_ID];
    if (!docsArrived || docsArrived.status !== 'completed') {
      return { ok: false, reason: 'docs_not_arrived' };
    }
  }
  return { ok: true };
}

export interface UncompleteGuardResult {
  ok: boolean;
  reason?: 'dependents_active';
  blockedByTitles?: string[];
}

/**
 * 完了の取り消しを許可してよいかのガード。
 * 後続タスクが既に着手/完了している状態で先行タスクを未完了へ戻すと、
 * 依存が満たされていないのに in_progress/completed が残る不整合な表示になるため、
 * 後続タスクが not_started のときだけ取り消しを許可する。
 */
export function canUncompleteTask(taskId: string, tasks: CompanySetupTask[]): UncompleteGuardResult {
  const dependents = tasks.filter((t) => t.dependencies.includes(taskId) && t.status !== 'not_started');
  if (dependents.length > 0) {
    return { ok: false, reason: 'dependents_active', blockedByTitles: dependents.map((d) => d.title) };
  }
  return { ok: true };
}

const PRIORITY_WEIGHT: Record<CompanySetupTask['priority'], number> = {
  critical: 0, high: 1, normal: 2, low: 3,
};

function tierOf(t: CompanySetupTask, todayIso: string): number {
  if (t.dueDate && t.dueDate < todayIso) return 0; // 期限超過
  if (t.dueDate === todayIso) return 1; // 今日締切
  if (t.priority === 'critical') return 2; // 最優先
  if (t.status === 'in_progress') return 3; // 現在進行中
  return 4; // 次に解放されたタスク
}

/** Dashboard「今日やること」— 最大 max 件、優先順位付き */
export function computeTodayItems(tasks: CompanySetupTask[], todayIso: string, max = 5): CompanySetupTask[] {
  const byId = indexById(tasks);
  const actionable = tasks.filter((t) => t.status !== 'completed' && isTaskUnlocked(t, byId));
  const scored = actionable.map((t) => ({ t, tier: tierOf(t, todayIso) }));
  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const aDue = a.t.dueDate ?? '9999-99-99';
    const bDue = b.t.dueDate ?? '9999-99-99';
    if (aDue !== bDue) return aDue < bDue ? -1 : 1;
    const aw = PRIORITY_WEIGHT[a.t.priority];
    const bw = PRIORITY_WEIGHT[b.t.priority];
    if (aw !== bw) return aw - bw;
    const aAct = a.t.activatedAt ?? '';
    const bAct = b.t.activatedAt ?? '';
    return aAct < bAct ? -1 : aAct > bAct ? 1 : 0;
  });
  return scored.slice(0, max).map((s) => s.t);
}

export interface ProgressSummary { completed: number; total: number; percent: number }

export function computeProgress(tasks: CompanySetupTask[]): ProgressSummary {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

export interface CostSummary {
  plannedTotal: number;
  actualPaid: number;
  remainingPlanned: number;
  capitalPlanned: number;
  capitalPaid: number;
  capitalStatus: 'locked' | 'unpaid' | 'paid' | 'none';
}

export function computeCosts(payments: CompanyPayment[]): CostSummary {
  const costItems = payments.filter((p) => !p.isCapital);
  const plannedTotal = costItems.reduce((sum, p) => sum + p.plannedAmount, 0);
  const actualPaid = costItems.reduce((sum, p) => sum + (p.status === 'paid' ? (p.actualAmount ?? p.plannedAmount) : 0), 0);
  const capital = payments.find((p) => p.isCapital) ?? null;
  return {
    plannedTotal,
    actualPaid,
    remainingPlanned: plannedTotal - actualPaid,
    capitalPlanned: capital?.plannedAmount ?? 0,
    capitalPaid: capital?.status === 'paid' ? (capital.actualAmount ?? capital.plannedAmount) : 0,
    capitalStatus: capital?.status ?? 'none',
  };
}

export interface DocPrepEstimate { startDate: string | null; estimatedArrival: string | null; label: string }

export function computeDocPrepEstimate(settings: CompanySettings, tasks: CompanySetupTask[]): DocPrepEstimate {
  const isakaTask = tasks.find((t) => t.id === ISAKA_DRAFTING_TASK_ID) ?? null;
  const startDate = settings.docPrepStartDateOverride ?? (isakaTask?.activatedAt ? isakaTask.activatedAt.slice(0, 10) : null);
  if (!startDate) return { startDate: null, estimatedArrival: null, label: '未着手' };
  const estimatedArrival = businessDaysLaterIso(startDate, DOC_PREP_BUSINESS_DAYS);
  return {
    startDate,
    estimatedArrival,
    label: estimatedArrival ? `発送予定：${formatMonthDayJa(estimatedArrival)}頃` : '計算中',
  };
}

/** 設立日まわりの警告文 (spec #10: 未設定 / 非営業日 / 登記申請予定日との矛盾) */
export function computeFoundingWarnings(settings: CompanySettings, tasks: CompanySetupTask[]): string[] {
  const warnings: string[] = [];
  const target = settings.foundingDateTarget;
  if (!target) {
    warnings.push('⚠️ 株式会社COREの設立日がまだ決まっていません');
    return warnings;
  }
  if (!isBusinessDayIso(target)) {
    warnings.push(`⚠️ 設立希望日(${formatMonthDayJa(target)})は法務局の非営業日です。営業日を選び直してください`);
  }
  const regTask = tasks.find((t) => t.id === REGISTRATION_TASK_ID) ?? null;
  if (regTask?.dueDate && regTask.dueDate !== target) {
    warnings.push(`⚠️ 登記申請予定日(${formatMonthDayJa(regTask.dueDate)})と設立希望日(${formatMonthDayJa(target)})が一致していません`);
  }
  return warnings;
}

/** 資本金タスクが未解放の間、常時表示する警告文 (spec #5) */
export function capitalLockWarning(tasks: CompanySetupTask[]): string | null {
  const byId = indexById(tasks);
  const docsArrived = byId[DOCS_ARRIVED_TASK_ID];
  const capital = byId[CAPITAL_TASK_ID];
  if (capital && capital.status === 'completed') return null;
  if (docsArrived && docsArrived.status === 'completed') return null;
  return '⚠️ 設立書類到着前に資本金を払い込まない';
}
