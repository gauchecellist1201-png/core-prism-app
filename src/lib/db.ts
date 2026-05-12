// ============================================================
// CORE Identity OS — Supabase DB ラッパー (Phase C)
// JWT (auth.uid()) から tenant_id を解決し、RLS 越しに kv で永続化する。
// 未認証 / env 未設定 / オフライン時は null を返し、呼出側が localStorage で fallback。
// ============================================================
import { getSupabase, isSupabaseConfigured, getCurrentUser, getCurrentTenantId } from './supabase';

export { isSupabaseConfigured, getCurrentUser, getCurrentTenantId };

// tenant_id をメモ化 (毎クエリで JWT を解いて memberships を select するのは無駄)
let _cachedTenantId: string | null = null;
let _cachedUserId: string | null = null;

async function resolveContext(): Promise<{ tenantId: string; userId: string } | null> {
  if (!isSupabaseConfigured) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  if (_cachedUserId === user.id && _cachedTenantId) {
    return { tenantId: _cachedTenantId, userId: user.id };
  }
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  _cachedUserId = user.id;
  _cachedTenantId = tenantId;
  return { tenantId, userId: user.id };
}

export function clearAuthCache() {
  _cachedTenantId = null;
  _cachedUserId = null;
}

/** user_state kv: key で 1 行 upsert */
export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const ctx = await resolveContext();
  if (!ctx) return null;
  const { data, error } = await sb
    .from('user_state')
    .select('value')
    .eq('user_id', ctx.userId)
    .eq('key', key)
    .maybeSingle();
  if (error || !data) return null;
  return data.value as T;
}

export async function kvSet<T>(key: string, value: T): Promise<boolean> {
  const sb = await getSupabase();
  if (!sb) return false;
  const ctx = await resolveContext();
  if (!ctx) return false;
  const { error } = await sb
    .from('user_state')
    .upsert(
      { tenant_id: ctx.tenantId, user_id: ctx.userId, key, value: value as any },
      { onConflict: 'user_id,key' },
    );
  if (error) {
    console.warn('[db] kvSet failed', key, error.message);
    return false;
  }
  return true;
}

export async function kvDelete(key: string): Promise<boolean> {
  const sb = await getSupabase();
  if (!sb) return false;
  const ctx = await resolveContext();
  if (!ctx) return false;
  const { error } = await sb
    .from('user_state')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('key', key);
  return !error;
}

/** 現状の認証/接続状態 (UI 表示用) */
export type DbStatus =
  | { state: 'disabled'; reason: 'no-env' }
  | { state: 'guest';    reason: 'not-signed-in' }
  | { state: 'ready';    tenantId: string; userId: string };

export async function getDbStatus(): Promise<DbStatus> {
  if (!isSupabaseConfigured) return { state: 'disabled', reason: 'no-env' };
  const ctx = await resolveContext();
  if (!ctx) return { state: 'guest', reason: 'not-signed-in' };
  return { state: 'ready', tenantId: ctx.tenantId, userId: ctx.userId };
}
