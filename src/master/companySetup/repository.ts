// ============================================================
// /master/company-setup — Repository / Data Layer
//
// Phase 1: localStorage が正本。将来 Supabase へ移行する際は、この
// ファイルの load/save の中身だけを差し替えれば呼び出し側 (useCompanySetup)
// は一切変更不要 — というのが本ファイルの契約。
//
// 実際には既存の user_state KV (src/lib/db.ts) + useCloudSync が
// 「Supabase 設定済み & オーナーがサインイン済み」の場合だけ自動で
// 双方向同期する (useCompanySetup.ts 側で配線)。ここでは localStorage
// への読み書きだけを担当する。
// ============================================================
import type {
  CompanySetupState,
  CompanySetupTask,
  CompanyPayment,
  CompanyDocument,
} from './types';
import { buildInitialState, INITIAL_TASKS, INITIAL_PAYMENTS, INITIAL_DOCUMENTS, PHASES } from './seedData';

export const STORAGE_KEY = 'core_company_setup_v1';

function mergeById<T extends { id: string }>(stored: T[], seed: T[]): T[] {
  const storedIds = new Set(stored.map((s) => s.id));
  const merged = [...stored];
  for (const s of seed) {
    if (!storedIds.has(s.id)) merged.push(s);
  }
  return merged;
}

function normalize(raw: unknown): CompanySetupState {
  const initial = buildInitialState();
  if (!raw || typeof raw !== 'object') return initial;
  const r = raw as Partial<CompanySetupState>;

  const tasks: CompanySetupTask[] = Array.isArray(r.tasks) ? mergeById(r.tasks, INITIAL_TASKS) : INITIAL_TASKS;
  const payments: CompanyPayment[] = Array.isArray(r.payments) ? mergeById(r.payments, INITIAL_PAYMENTS) : INITIAL_PAYMENTS;
  const documents: CompanyDocument[] = Array.isArray(r.documents) ? mergeById(r.documents, INITIAL_DOCUMENTS) : INITIAL_DOCUMENTS;

  return {
    version: 1,
    phases: PHASES,
    tasks,
    payments,
    documents,
    settings: {
      foundingDateTarget: r.settings?.foundingDateTarget ?? null,
      docPrepStartDateOverride: r.settings?.docPrepStartDateOverride ?? null,
    },
  };
}

export interface CompanySetupRepository {
  load(): CompanySetupState;
  save(state: CompanySetupState): boolean;
}

export const localCompanySetupRepository: CompanySetupRepository = {
  load(): CompanySetupState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return buildInitialState();
      return normalize(JSON.parse(raw));
    } catch {
      return buildInitialState();
    }
  },
  save(state: CompanySetupState): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  },
};
