-- ============================================================
-- CORE Identity OS — 汎用 user_state (kv) テーブル
-- Phase C: hooks (usePersonas / useInfluencerDesk / useKnowledge 等) を
-- 構造化スキーマに ALTER せずに段階移行するためのバッファ
-- ----------
-- 各行: (tenant_id, user_id, key) で一意、value は jsonb
-- 既存 localStorage キーをそのまま key にして突っ込める
-- ============================================================

create table if not exists user_state (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (user_id, key)
);
create index if not exists user_state_tenant_idx on user_state(tenant_id);
create index if not exists user_state_user_idx on user_state(user_id);

alter table user_state enable row level security;

drop policy if exists "user_state_rw" on user_state;
create policy "user_state_rw" on user_state
  for all
  using (
    user_id = auth.uid()
    and tenant_id in (select user_tenant_ids())
  )
  with check (
    user_id = auth.uid()
    and tenant_id in (select user_tenant_ids())
  );

-- updated_at 自動更新
create or replace function user_state_touch() returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_state_touch_trg on user_state;
create trigger user_state_touch_trg
  before update on user_state
  for each row execute function user_state_touch();
