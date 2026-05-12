-- ============================================================
-- CORE Identity OS — Phase D: Stripe 1:1 + Org 管理 + Owner ロール
-- ============================================================

-- ── 1. tenants: Stripe Customer は 1 テナント 1 件 ──
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_stripe_customer_id_unique'
  ) then
    alter table tenants
      add constraint tenants_stripe_customer_id_unique unique (stripe_customer_id);
  end if;
end$$;

alter table tenants add column if not exists subscription_id text;
alter table tenants add column if not exists subscription_status text;
alter table tenants add column if not exists current_period_end timestamptz;
alter table tenants add column if not exists cancel_at_period_end boolean default false;

-- ── 2. memberships.role を CHECK で 3 値に限定 ──
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'memberships_role_check'
  ) then
    alter table memberships
      add constraint memberships_role_check
      check (role in ('owner', 'admin', 'member'));
  end if;
end$$;

-- ── 3. invitations: 受諾ステータス ──
alter table invitations add column if not exists status text default 'pending';
alter table invitations add column if not exists accepted_at timestamptz;
alter table invitations add column if not exists invited_by uuid references auth.users(id) on delete set null;

-- ── 4. ロール権限ヘルパー ──
create or replace function user_role_in(p_tenant_id uuid) returns text
  language sql stable security definer set search_path = public
as $$
  select role from memberships
  where tenant_id = p_tenant_id
    and user_id = auth.uid()
  limit 1;
$$;

create or replace function is_owner_or_admin(p_tenant_id uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select coalesce(user_role_in(p_tenant_id) in ('owner', 'admin'), false);
$$;

create or replace function is_owner(p_tenant_id uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select coalesce(user_role_in(p_tenant_id) = 'owner', false);
$$;

-- ── 5. メンバー招待 RPC: admin / owner のみ ──
create or replace function invite_member(
  p_tenant_id uuid,
  p_email text,
  p_role text default 'member'
) returns invitations
  language plpgsql security definer set search_path = public
as $$
declare
  v_inv invitations;
  v_token text;
begin
  if not is_owner_or_admin(p_tenant_id) then
    raise exception 'permission denied: only owner/admin may invite';
  end if;
  if p_role not in ('owner', 'admin', 'member') then
    raise exception 'invalid role: %', p_role;
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into invitations (tenant_id, email, role, token, invited_by)
  values (p_tenant_id, lower(p_email), p_role, v_token, auth.uid())
  returning * into v_inv;

  return v_inv;
end;
$$;

-- ── 6. 招待受諾 RPC ──
create or replace function accept_invitation(p_token text) returns memberships
  language plpgsql security definer set search_path = public, auth
as $$
declare
  v_inv invitations;
  v_user auth.users;
  v_mem memberships;
begin
  select * into v_inv from invitations
   where token = p_token and (status is null or status = 'pending')
   limit 1;
  if v_inv is null then raise exception 'invalid or expired invitation'; end if;
  if v_inv.expires_at < now() then raise exception 'invitation expired'; end if;

  select * into v_user from auth.users where id = auth.uid();
  if v_user is null then raise exception 'must be authenticated'; end if;
  if lower(v_user.email) <> lower(v_inv.email) then
    raise exception 'email mismatch: invitation was for %', v_inv.email;
  end if;

  insert into memberships (tenant_id, user_id, role)
  values (v_inv.tenant_id, auth.uid(), v_inv.role)
  on conflict (tenant_id, user_id) do update set role = excluded.role
  returning * into v_mem;

  update invitations
     set status = 'accepted', accepted_at = now()
   where id = v_inv.id;

  return v_mem;
end;
$$;

-- ── 7. ロール変更 RPC: owner のみ。owner は最低 1 名残す ──
create or replace function change_member_role(
  p_membership_id uuid,
  p_new_role text
) returns memberships
  language plpgsql security definer set search_path = public
as $$
declare
  v_mem memberships;
  v_owner_count int;
begin
  select * into v_mem from memberships where id = p_membership_id;
  if v_mem is null then raise exception 'membership not found'; end if;
  if not is_owner(v_mem.tenant_id) then
    raise exception 'permission denied: only owner may change roles';
  end if;
  if p_new_role not in ('owner','admin','member') then
    raise exception 'invalid role';
  end if;

  if v_mem.role = 'owner' and p_new_role <> 'owner' then
    select count(*) into v_owner_count
      from memberships
     where tenant_id = v_mem.tenant_id and role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'cannot demote the last owner';
    end if;
  end if;

  update memberships set role = p_new_role where id = p_membership_id
  returning * into v_mem;
  return v_mem;
end;
$$;

-- ── 8. メンバー削除 RPC: owner のみ + 最後の owner 削除禁止 ──
create or replace function remove_member(p_membership_id uuid) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_mem memberships;
  v_owner_count int;
begin
  select * into v_mem from memberships where id = p_membership_id;
  if v_mem is null then return; end if;
  if not is_owner(v_mem.tenant_id) then
    raise exception 'permission denied: only owner may remove members';
  end if;
  if v_mem.role = 'owner' then
    select count(*) into v_owner_count
      from memberships where tenant_id = v_mem.tenant_id and role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'cannot remove the last owner';
    end if;
  end if;
  delete from memberships where id = p_membership_id;
end;
$$;

-- ── 9. RLS 追加: tenants の更新は owner/admin のみ ──
drop policy if exists "tenant_update" on tenants;
create policy "tenant_update" on tenants
  for update using (is_owner_or_admin(id));

-- ============================================================
-- 既存「マスターユーザー」自動 owner 化:
-- Supabase 側に "master" tenant が無ければ何もしない。
-- 既存 schema の trigger が新規 signup を owner にしているので、
-- 移行は signup 直後の 1 ユーザー = 1 tenant モデルで自然に Owner となる。
-- ============================================================
