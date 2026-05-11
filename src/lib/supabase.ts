// ============================================================
// CORE Identity OS — Supabase クライアント (Phase B+C 用 stub)
// env 未設定なら null を返し、既存 localStorage モードで動作継続
// 5/26 のスケジュールタスクが env 検知で本実装を起動
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// 動的 import で @supabase/supabase-js が未インストールでもビルドが通る
let _client: any = null;
let _initPromise: Promise<any> | null = null;

async function _initClient() {
  if (!isSupabaseConfigured) return null;
  if (_client) return _client;
  try {
    // 動的 import + 文字列 specifier で TypeScript の解決をバイパス (パッケージ未インストールでも build 可)
    const specifier = '@supabase/supabase-js';
    const mod: any = await import(/* @vite-ignore */ specifier);
    _client = mod.createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    return _client;
  } catch {
    // パッケージ未インストール → null で fallback
    return null;
  }
}

export async function getSupabase(): Promise<any | null> {
  if (!_initPromise) _initPromise = _initClient();
  return _initPromise;
}

// ─── 認証 ヘルパー ──────────────────────────

export async function signInMagicLink(email: string, redirectTo?: string): Promise<{ ok: boolean; message: string }> {
  const sb = await getSupabase();
  if (!sb) return { ok: false, message: 'Supabase 未接続 (Phase B 実装前)' };
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo || `${window.location.origin}/auth/callback` },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'メールに送ったマジックリンクをクリックしてください' };
}

export async function signOut(): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function getCurrentUser() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data?.user ?? null;
}

// ─── テナント ヘルパー ──────────────────────────

export async function getCurrentTenantId(): Promise<string | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await sb
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();
  return data?.tenant_id ?? null;
}

// ─── データアクセスヘルパー (どのテーブルでも tenant_id 自動付与) ──────────────

export async function dbInsert<T extends Record<string, any>>(table: string, row: T): Promise<any> {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const tenantId = await getCurrentTenantId();
  const { data, error } = await sb.from(table).insert({ ...row, tenant_id: tenantId }).select().single();
  if (error) throw error;
  return data;
}

export async function dbSelect<T = any>(table: string, opts?: { eq?: Record<string, any>; order?: string; limit?: number }): Promise<T[]> {
  const sb = await getSupabase();
  if (!sb) return [];
  let query = sb.from(table).select('*');
  if (opts?.eq) {
    for (const [k, v] of Object.entries(opts.eq)) {
      query = query.eq(k, v);
    }
  }
  if (opts?.order) query = query.order(opts.order, { ascending: false });
  if (opts?.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function dbUpdate(table: string, id: string, patch: Record<string, any>): Promise<any> {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function dbDelete(table: string, id: string): Promise<void> {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw error;
}
