-- ============================================================
-- CORE Identity OS — マルチテナント初期スキーマ
-- 1 つの Postgres に全テナントのデータを RLS 分離で詰め込む
-- 無料 500MB で約 5,000 ユーザーを収容する設計
-- ============================================================

-- ── 1. tenants (= ワークスペース) ──────────────
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free',
  stripe_customer_id text,
  trial_ends_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── 2. memberships (auth.users と tenants の紐付け) ──────────────
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner', -- owner | admin | member
  invited_email text,
  joined_at timestamptz default now(),
  unique (tenant_id, user_id)
);
create index if not exists memberships_user_idx on memberships(user_id);
create index if not exists memberships_tenant_idx on memberships(tenant_id);

-- ── 3. personas (Prism: 7 役割 / Iris: 6 ファセット) ──────────────
create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text not null check (brand in ('prism', 'iris')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists personas_tenant_idx on personas(tenant_id);

-- ── 4. deals (Iris の案件 / Prism のディール) ──────────────
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  persona_id uuid references personas(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  stage text default 'inquiry',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists deals_tenant_idx on deals(tenant_id);

-- ── 5. briefings (デイリーコーチ等、30 日 auto-delete) ──────────────
create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid references personas(id) on delete set null,
  slot text, -- morning | noon | evening
  content jsonb not null,
  created_at timestamptz default now()
);
create index if not exists briefings_created_idx on briefings(created_at);
create index if not exists briefings_tenant_idx on briefings(tenant_id);

-- ── 6. events (telemetry / フィードバック、30 日 auto-delete) ──────────────
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  payload jsonb,
  created_at timestamptz default now()
);
create index if not exists events_created_idx on events(created_at);

-- ── 7. invitations (Org メンバー招待) ──────────────
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  role text default 'member',
  token text unique not null,
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table tenants     enable row level security;
alter table memberships enable row level security;
alter table personas    enable row level security;
alter table deals       enable row level security;
alter table briefings   enable row level security;
alter table events      enable row level security;
alter table invitations enable row level security;

-- 現ユーザーが属する tenant_id 一覧を返す関数
create or replace function user_tenant_ids() returns setof uuid
  language sql stable security definer set search_path = public
as $$
  select tenant_id from memberships where user_id = auth.uid();
$$;

-- ── ポリシー ──────────────
drop policy if exists "tenant_read" on tenants;
create policy "tenant_read" on tenants
  for select using (id in (select user_tenant_ids()));

drop policy if exists "tenant_update" on tenants;
create policy "tenant_update" on tenants
  for update using (id in (select user_tenant_ids()));

drop policy if exists "membership_rw" on memberships;
create policy "membership_rw" on memberships
  for all using (tenant_id in (select user_tenant_ids()));

drop policy if exists "personas_rw" on personas;
create policy "personas_rw" on personas
  for all using (tenant_id in (select user_tenant_ids()));

drop policy if exists "deals_rw" on deals;
create policy "deals_rw" on deals
  for all using (tenant_id in (select user_tenant_ids()));

drop policy if exists "briefings_rw" on briefings;
create policy "briefings_rw" on briefings
  for all using (tenant_id in (select user_tenant_ids()));

drop policy if exists "events_rw" on events;
create policy "events_rw" on events
  for all using (tenant_id in (select user_tenant_ids()));

drop policy if exists "invitations_rw" on invitations;
create policy "invitations_rw" on invitations
  for all using (tenant_id in (select user_tenant_ids()));

-- ============================================================
-- Trigger: 新規 signup 時に tenant + owner membership を自動作成
-- ============================================================
create or replace function create_tenant_for_new_user() returns trigger
  language plpgsql security definer set search_path = public, auth
as $$
declare
  new_tenant_id uuid;
  base_slug text;
  unique_slug text;
  i int := 0;
begin
  base_slug := regexp_replace(coalesce(new.email, 'user'), '[^a-zA-Z0-9]', '_', 'g');
  unique_slug := base_slug || '_' || substr(new.id::text, 1, 8);

  insert into tenants (name, slug)
    values (
      coalesce(new.raw_user_meta_data->>'workspace_name', new.email || ' のワークスペース'),
      unique_slug
    )
    returning id into new_tenant_id;

  insert into memberships (tenant_id, user_id, role)
    values (new_tenant_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_tenant_for_new_user();

-- ============================================================
-- 自動データ削除 (Vercel Cron 経由で日次呼び出し想定)
-- ============================================================
create or replace function cleanup_old_data() returns void
  language sql security definer set search_path = public
as $$
  delete from briefings where created_at < now() - interval '30 days';
  delete from events    where created_at < now() - interval '30 days';
  delete from invitations where expires_at < now();
$$;
