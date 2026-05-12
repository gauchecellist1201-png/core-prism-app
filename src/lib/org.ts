// ============================================================
// CORE Identity OS — Phase D: Org メンバー / 招待 / ロール管理
// Supabase が未接続でも build 通る (動的 import)
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { getSupabase, getCurrentTenantId, isSupabaseConfigured } from './supabase';

export type OrgRole = 'owner' | 'admin' | 'member';

export interface OrgMember {
  id: string;            // memberships.id
  user_id: string;
  email: string | null;
  role: OrgRole;
  joined_at: string;
  is_self: boolean;
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: OrgRole;
  token: string;
  expires_at: string;
  status: 'pending' | 'accepted' | string;
  accepted_at: string | null;
}

export interface TenantInfo {
  id: string;
  name: string;
  plan: string;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

// ── 現在ユーザーのロール ──
export async function fetchMyRole(): Promise<OrgRole | null> {
  if (!isSupabaseConfigured) return null;
  const sb = await getSupabase();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  const { data } = await sb
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();
  return (data?.role as OrgRole) || null;
}

// ── テナント情報 ──
export async function fetchTenant(): Promise<TenantInfo | null> {
  if (!isSupabaseConfigured) return null;
  const sb = await getSupabase();
  if (!sb) return null;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  const { data } = await sb
    .from('tenants')
    .select('id,name,plan,stripe_customer_id,subscription_id,subscription_status,current_period_end,cancel_at_period_end')
    .eq('id', tenantId)
    .maybeSingle();
  return data as TenantInfo | null;
}

// ── メンバー一覧 ──
export async function fetchMembers(): Promise<OrgMember[]> {
  if (!isSupabaseConfigured) return [];
  const sb = await getSupabase();
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];
  const { data, error } = await sb
    .from('memberships')
    .select('id,user_id,role,joined_at,invited_email')
    .eq('tenant_id', tenantId)
    .order('joined_at', { ascending: true });
  if (error || !data) return [];

  // 各 user_id のメール解決 (auth.users は直接 select 不可なので、自分のメールだけ判明)
  return (data as any[]).map(m => ({
    id: m.id,
    user_id: m.user_id,
    email: m.user_id === user?.id ? (user?.email ?? null) : (m.invited_email ?? null),
    role: m.role,
    joined_at: m.joined_at,
    is_self: m.user_id === user?.id,
  }));
}

// ── 保留中の招待 ──
export async function fetchPendingInvitations(): Promise<OrgInvitation[]> {
  if (!isSupabaseConfigured) return [];
  const sb = await getSupabase();
  if (!sb) return [];
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];
  const { data, error } = await sb
    .from('invitations')
    .select('id,email,role,token,expires_at,status,accepted_at')
    .eq('tenant_id', tenantId)
    .neq('status', 'accepted')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as OrgInvitation[];
}

// ── 招待発行 → メール送信 ──
export async function inviteMember(input: {
  email: string;
  role: OrgRole;
  brand: 'iris' | 'prism';
}): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: 'Supabase 未接続' };
  const sb = await getSupabase();
  if (!sb) return { ok: false, message: 'Supabase 未接続' };
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return { ok: false, message: 'テナント未取得' };

  const { data, error } = await sb.rpc('invite_member', {
    p_tenant_id: tenantId,
    p_email: input.email.trim().toLowerCase(),
    p_role: input.role,
  });
  if (error || !data) return { ok: false, message: error?.message || '招待失敗' };
  const inv = Array.isArray(data) ? data[0] : data;

  const tenant = await fetchTenant();
  const { data: { user } } = await sb.auth.getUser();

  try {
    const resp = await fetch('/api/org/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: input.email,
        tenant_name: tenant?.name || 'CORE ワークスペース',
        inviter: user?.email || 'チームオーナー',
        role: input.role,
        token: inv.token,
        brand: input.brand,
      }),
    });
    if (!resp.ok) {
      // メール送信失敗してもトークンは発行済み → success
      return { ok: true, message: '招待を作成しました (メール送信失敗 — リンクをコピーしてください)' };
    }
  } catch { /* ignore */ }

  return { ok: true, message: `${input.email} に招待メールを送信しました` };
}

// ── 招待受諾 ──
export async function acceptInvitation(token: string): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: 'Supabase 未接続' };
  const sb = await getSupabase();
  if (!sb) return { ok: false, message: 'Supabase 未接続' };
  const { error } = await sb.rpc('accept_invitation', { p_token: token });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: '組織への参加が完了しました' };
}

// ── ロール変更 ──
export async function changeRole(membershipId: string, newRole: OrgRole): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: 'Supabase 未接続' };
  const sb = await getSupabase();
  if (!sb) return { ok: false, message: 'Supabase 未接続' };
  const { error } = await sb.rpc('change_member_role', {
    p_membership_id: membershipId,
    p_new_role: newRole,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'ロールを更新しました' };
}

// ── メンバー削除 ──
export async function removeMember(membershipId: string): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: 'Supabase 未接続' };
  const sb = await getSupabase();
  if (!sb) return { ok: false, message: 'Supabase 未接続' };
  const { error } = await sb.rpc('remove_member', { p_membership_id: membershipId });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'メンバーを削除しました' };
}

// ── React hook: org 全体状態 ──
export function useOrg() {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [myRole, setMyRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [m, i, t, r] = await Promise.all([
      fetchMembers(),
      fetchPendingInvitations(),
      fetchTenant(),
      fetchMyRole(),
    ]);
    setMembers(m);
    setInvitations(i);
    setTenant(t);
    setMyRole(r);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { members, invitations, tenant, myRole, loading, refresh };
}

// ── URL ?invite=... の自動キャプチャ ──
export function captureInvitationFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get('invite');
    if (t && t.length >= 16) {
      sessionStorage.setItem('pending_invite', t);
      url.searchParams.delete('invite');
      window.history.replaceState({}, '', url.toString());
    }
  } catch { /* */ }
}

export function consumePendingInvitation(): string | null {
  try {
    const t = sessionStorage.getItem('pending_invite');
    if (t) sessionStorage.removeItem('pending_invite');
    return t;
  } catch { return null; }
}
