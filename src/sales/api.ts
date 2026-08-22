// ============================================================
// Sales OS — API クライアント
//
// 合言葉は localStorage に置くが、既存の 'core_master_key_v1' とは別の場所にする。
// あちらは src/lib/billing.ts の isMasterAuth() / src/lib/tenant.ts が
// 'GAUCHE2026' と一致することを前提にしているため、営業OSの新しい合言葉で
// 上書きすると Prism / Iris のオーナーモードが同じブラウザで壊れる。
// サーバーが 401 を返したら鍵を消して入力画面に戻す。
// ============================================================
import type {
  Activity, ActivityKind, Company, CompanyRow, PlanKind, ReportResponse, TodayResponse,
} from './shared/types';
import type { FollowUpStep, PriceConflict, Product, TargetDef } from './shared/catalog';
import type { StageMeta } from './shared/types';

const KEY_STORAGE = 'core_sales_key_v1';

export function getKey(): string {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}
export function setKey(k: string): void {
  try { localStorage.setItem(KEY_STORAGE, k); } catch { /* noop */ }
}
export function clearKey(): void {
  try { localStorage.removeItem(KEY_STORAGE); } catch { /* noop */ }
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-master-key': getKey(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* 本文が JSON でない */ }
  if (!res.ok) {
    const b = (body || {}) as { error?: string; message?: string };
    if (res.status === 401) {
      clearKey();
      // 子の画面から出た 401 でも、親 (SalesOS) を合言葉入力へ戻す。
      // storage を消すだけだと親は古い key state を持ったままで、
      // 以後ずっと空ヘッダで叩き続ける画面になる。
      try { window.dispatchEvent(new CustomEvent('sales:unauthorized')); } catch { /* noop */ }
    }
    throw new ApiError(res.status, b.error || 'ERROR', b.message || `通信に失敗しました (HTTP ${res.status})`);
  }
  return body as T;
}

// ---- config --------------------------------------------------------------
export interface SalesConfig {
  products: Product[];
  targets: TargetDef[];
  stages: StageMeta[];
  scoreDefs: Array<{ key: string; label: string; max: number; what: string }>;
  followups: FollowUpStep[];
  positioning: { weAre: string; weAreNot: string; goal: string; strengths: string[]; customerSaves: string[] };
  oemResale: { low: number; high: number };
  published: { asOf: string; prices: Array<{ label: string; yen: number; note: string }>; source: string };
  priceConflicts: PriceConflict[];
  mayQuotePrice: boolean;
  storage: { configured: boolean };
  security: { usingDefaultKey: boolean };
}


export const fetchConfig = () => call<SalesConfig>('/api/sales/config');

// ---- companies -----------------------------------------------------------
export const fetchRows = () => call<{ rows: CompanyRow[]; total: number }>('/api/sales/companies');

export const fetchCompany = (id: string) =>
  call<{ company: Company; activities: Activity[] }>(`/api/sales/companies?id=${encodeURIComponent(id)}`);

export const createCompany = (seed: Record<string, string>) =>
  call<{ created: boolean; company: Company | null; message?: string }>('/api/sales/companies', {
    method: 'POST', body: JSON.stringify(seed),
  });

export interface BulkResult {
  created: number;
  skipped: number;
  skippedDetail: string[];
  truncated: number;
  /** 上限を超えて処理しなかった行。入力欄に戻して続きを取り込ませる */
  leftover: string;
  note: string;
}

export const createBulk = (bulk: string) =>
  call<BulkResult>('/api/sales/companies', { method: 'POST', body: JSON.stringify({ bulk }) });

export const patchCompany = (id: string, patch: Record<string, string>) =>
  call<{ company: Company; reanalyzeNeeded?: boolean; message?: string }>('/api/sales/companies', {
    method: 'PATCH', body: JSON.stringify({ id, patch }),
  });

export const removeCompany = (id: string) =>
  call<{ deleted: boolean }>('/api/sales/companies', { method: 'DELETE', body: JSON.stringify({ id }) });

// ---- AI ------------------------------------------------------------------
export const analyze = (payload: { id?: string; url?: string; name?: string }) =>
  call<{ company: Company; site: { ok: boolean; note: string; title: string; chars: number } }>(
    '/api/sales/analyze', { method: 'POST', body: JSON.stringify(payload) },
  );

export const generate = (id: string, kind: 'email' | 'call', touch?: number) =>
  call<{ company: Company }>('/api/sales/generate', {
    method: 'POST', body: JSON.stringify({ id, kind, ...(touch ? { touch } : {}) }),
  });

/** 企画は 1 案ずつ。3案を1回で書かせると Edge の 25 秒に収まらない (実測18秒で時間切れ)。 */
export const generatePlan = (id: string, planKind: PlanKind) =>
  call<{ company: Company }>('/api/sales/generate', {
    method: 'POST', body: JSON.stringify({ id, kind: 'plan', planKind }),
  });

// ---- 活動 ----------------------------------------------------------------
/** 押し直し・再送で二重に記録されないための札。1回の送信につき1つ作って使い回す。 */
export function newRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* noop */ }
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const logActivity = (payload: {
  id: string; kind: ActivityKind; note?: string; dealYen?: number; lostReason?: string;
  requestId: string;
}) => call<{ company: Company; activity: Activity | null; duplicate: boolean; message?: string }>(
  '/api/sales/activity', { method: 'POST', body: JSON.stringify(payload) },
);

// ---- ダッシュボード ------------------------------------------------------
export const fetchToday = () => call<TodayResponse>('/api/sales/today');
export const fetchReport = (days = 7) => call<ReportResponse>(`/api/sales/report?days=${days}`);
