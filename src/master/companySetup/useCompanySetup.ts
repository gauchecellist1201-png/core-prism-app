// ============================================================
// /master/company-setup — 状態管理フック
// localStorage が正本 (即時 Optimistic UI)。Supabase が設定済み & サインイン済みなら
// 既存の useCloudSync (src/hooks/useCloudSync.ts) が user_state 経由で背景同期する。
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CompanySetupState,
  CompanySetupTask,
  CompanyPayment,
  CompanyDocument,
  CompanySettings,
} from './types';
import { localCompanySetupRepository, STORAGE_KEY } from './repository';
import {
  reconcileActivation,
  canCompleteTask,
  canUncompleteTask,
  isTaskUnlocked,
  indexById,
  computeTodayItems,
  computeProgress,
  computeCosts,
  computeDocPrepEstimate,
  computeFoundingWarnings,
  capitalLockWarning,
} from './derive';
import { DOCS_ARRIVED_TASK_ID } from './constants';
import { notifyInApp } from '../../lib/inAppNotify';
import { useCloudSync } from '../../hooks/useCloudSync';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getDbStatus, type DbStatus } from '../../lib/db';
import { signInMagicLink } from '../../lib/supabase';

function nowIso(): string {
  return new Date().toISOString();
}

/** ローカル日付 (YYYY-MM-DD)。toISOString() は UTC のため、JST 0〜8時台だと前日になってしまう。 */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useCompanySetup() {
  const [state, setState] = useState<CompanySetupState>(() => {
    const loaded = localCompanySetupRepository.load();
    return { ...loaded, tasks: reconcileActivation(loaded.tasks, nowIso()) };
  });

  // localStorage への保存 (Optimistic UI: state 変更は即座に画面へ反映済み、保存は裏で走る)
  useEffect(() => {
    const ok = localCompanySetupRepository.save(state);
    if (!ok) {
      notifyInApp({ kind: 'warn', title: '保存に失敗しました', body: 'ブラウザのストレージ容量を確認してください' });
    }
  }, [state]);

  // Supabase 設定済み & サインイン済みなら user_state 経由で PC/iPhone 同期 (未設定なら no-op)
  useCloudSync<CompanySetupState>({
    key: STORAGE_KEY,
    value: state,
    setValue: (next) => setState({ ...next, tasks: reconcileActivation(next.tasks, nowIso()) }),
    isEmpty: (v) => v.tasks.length === 0,
  });

  const [cloudStatus, setCloudStatus] = useState<DbStatus | null>(() => (
    isSupabaseConfigured ? null : { state: 'disabled', reason: 'no-env' }
  ));
  const refreshCloudStatus = useCallback(() => {
    if (!isSupabaseConfigured) return;
    getDbStatus().then(setCloudStatus).catch(() => setCloudStatus(null));
  }, []);
  useEffect(() => { refreshCloudStatus(); }, [refreshCloudStatus]);

  const byId = useMemo(() => indexById(state.tasks), [state.tasks]);

  // 注意: notifyInApp はイベントハンドラの中で「普通の文」として呼ぶこと。
  // setState の updater 関数の中で呼ぶと、React が updater をレンダー相当の扱いにするため
  // 「Cannot update a component while rendering a different component」警告 (InAppNotificationToast 側) が出る。
  // そのためガード判定は現在の state (クロージャ) で先に行い、updater は純粋な状態遷移だけにする。
  const toggleTaskComplete = useCallback((id: string) => {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    const now = nowIso();

    if (task.status === 'completed') {
      const uncompleteGuard = canUncompleteTask(id, state.tasks);
      if (!uncompleteGuard.ok) {
        notifyInApp({
          kind: 'warn',
          title: '取り消せません',
          body: `先に着手済みの後続タスクがあります: ${(uncompleteGuard.blockedByTitles ?? []).join(' / ')}`,
        });
        return;
      }
      setState((prev) => {
        const nextTasks = prev.tasks.map((t) => (t.id === id ? { ...t, status: 'not_started' as const, completedAt: null, updatedAt: now } : t));
        let nextPayments = prev.payments;
        if (id === DOCS_ARRIVED_TASK_ID) {
          nextPayments = prev.payments.map((p) => (p.isCapital && p.status !== 'paid' ? { ...p, status: 'locked' as const, updatedAt: now } : p));
        }
        return { ...prev, tasks: reconcileActivation(nextTasks, now), payments: nextPayments };
      });
      return;
    }

    const guard = canCompleteTask(id, state.tasks);
    if (!guard.ok) {
      if (guard.reason === 'docs_not_arrived') {
        notifyInApp({ kind: 'warn', title: '資本金はまだ払い込めません', body: '設立書類到着前に資本金を払い込まない — 先に「設立書類が到着する」を完了にしてください' });
      } else if (guard.reason === 'locked') {
        notifyInApp({ kind: 'warn', title: 'まだ着手できません', body: '先に完了させる必要があるタスクが残っています' });
      }
      return;
    }

    notifyInApp({ kind: 'success', title: `完了: ${task.title}`, duration: 2500 });
    setState((prev) => {
      const nextTasks = prev.tasks.map((t) => (t.id === id ? { ...t, status: 'completed' as const, completedAt: now, updatedAt: now } : t));
      let nextPayments = prev.payments;
      const linkedPayment = prev.payments.find((p) => p.relatedTaskId === id);
      if (linkedPayment && linkedPayment.status !== 'paid') {
        nextPayments = nextPayments.map((p) => (p.id === linkedPayment.id
          ? { ...p, status: 'paid' as const, actualAmount: p.actualAmount ?? task.actualCost ?? p.plannedAmount, paidAt: now, updatedAt: now }
          : p));
      }
      if (id === DOCS_ARRIVED_TASK_ID) {
        nextPayments = nextPayments.map((p) => (p.isCapital && p.status === 'locked' ? { ...p, status: 'unpaid' as const, updatedAt: now } : p));
      }
      return { ...prev, tasks: reconcileActivation(nextTasks, now), payments: nextPayments };
    });
  }, [state]);

  const updateTask = useCallback((id: string, patch: Partial<Pick<CompanySetupTask,
    'status' | 'priority' | 'dueDate' | 'memo' | 'cost' | 'actualCost' | 'nextAction' | 'waitingFor'
  >>) => {
    setState((prev) => {
      const now = nowIso();
      const nextTasks = prev.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: now } : t));
      return { ...prev, tasks: reconcileActivation(nextTasks, now) };
    });
  }, []);

  const updatePayment = useCallback((id: string, patch: Partial<Pick<CompanyPayment,
    'status' | 'actualAmount' | 'dueDate' | 'memo' | 'paidAt'
  >>) => {
    setState((prev) => {
      const now = nowIso();
      const nextPayments = prev.payments.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p));
      return { ...prev, payments: nextPayments };
    });
  }, []);

  const updateDocument = useCallback((id: string, patch: Partial<Pick<CompanyDocument, 'status' | 'memo' | 'fileUrl'>>) => {
    setState((prev) => {
      const now = nowIso();
      const nextDocuments = prev.documents.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: now } : d));
      return { ...prev, documents: nextDocuments };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<CompanySettings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const cloudSignIn = useCallback(async (email: string) => {
    const res = await signInMagicLink(email);
    return res;
  }, []);

  const today = todayIso();
  const todayItems = useMemo(() => computeTodayItems(state.tasks, today), [state.tasks, today]);
  const nextAction = todayItems[0] ?? null;
  const progress = useMemo(() => computeProgress(state.tasks), [state.tasks]);
  const costs = useMemo(() => computeCosts(state.payments), [state.payments]);
  const docPrepEstimate = useMemo(() => computeDocPrepEstimate(state.settings, state.tasks), [state.settings, state.tasks]);
  const foundingWarnings = useMemo(() => computeFoundingWarnings(state.settings, state.tasks), [state.settings, state.tasks]);
  const capitalWarning = useMemo(() => capitalLockWarning(state.tasks), [state.tasks]);
  const allDone = useMemo(() => state.tasks.length > 0 && state.tasks.every((t) => t.status === 'completed'), [state.tasks]);
  const foundingCompletedAt = useMemo(() => {
    const regTask = state.tasks.find((t) => t.id === 'registration-application');
    if (!regTask || regTask.status !== 'completed') return null;
    // 「期限」欄に実際の申請日を入力していればそちらを優先する。
    // completedAt はアプリでチェックを入れた時刻に過ぎず、後から遡って記録した場合は実際の設立日とずれるため。
    return regTask.dueDate ?? regTask.completedAt;
  }, [state.tasks]);

  const isUnlocked = useCallback((taskId: string) => {
    const t = byId[taskId];
    return t ? isTaskUnlocked(t, byId) : false;
  }, [byId]);

  return {
    phases: state.phases,
    tasks: state.tasks,
    payments: state.payments,
    documents: state.documents,
    settings: state.settings,
    byId,
    isUnlocked,
    todayItems,
    nextAction,
    progress,
    costs,
    docPrepEstimate,
    foundingWarnings,
    capitalWarning,
    allDone,
    foundingCompletedAt,
    toggleTaskComplete,
    updateTask,
    updatePayment,
    updateDocument,
    updateSettings,
    cloud: {
      configured: isSupabaseConfigured,
      status: cloudStatus,
      refresh: refreshCloudStatus,
      signIn: cloudSignIn,
    },
  };
}

export type UseCompanySetupReturn = ReturnType<typeof useCompanySetup>;
