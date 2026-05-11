// ============================================================
// CORE Identity OS — テナント基盤 Phase A
// localStorage キーに tenant prefix を自動付与する utility
// 後段の Phase B (Clerk auth) / C (Supabase) で本格マルチテナント化
// ============================================================

const TENANT_KEY = 'core_tenant_id_v1';
const MIGRATION_DONE_KEY = 'core_tenant_migration_v1';

/**
 * 現テナント ID を返す。
 * - Phase A: ブラウザごとに自動生成された local_xxx
 * - Phase B (予定): Clerk org_id or user_id
 * - 「マスターモード」のときは特別 tenant `master` を返す
 */
export function currentTenantId(): string {
  if (typeof window === 'undefined') return 'default';
  // マスターモード判定 (循環参照を避けるため直接 key check)
  const masterKey = localStorage.getItem('core_master_key_v1');
  if (masterKey === 'GAUCHE2026') return 'master';

  let id = localStorage.getItem(TENANT_KEY);
  if (!id) {
    id = `local_${Math.random().toString(36).slice(2, 12)}_${Date.now().toString(36)}`;
    localStorage.setItem(TENANT_KEY, id);
  }
  return id;
}

/** テナント ID を明示的に切替 (Phase B で Clerk と連動) */
export function setTenantId(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENANT_KEY, id);
}

/** テナント ID をリセット (logout 等) */
export function clearTenantId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TENANT_KEY);
}

/**
 * tenant scoped な localStorage 操作。
 * 既存 localStorage と衝突しないよう、`t:<tenant>:<key>` で保存。
 */
export const tenantStore = {
  key(rawKey: string): string {
    return `t:${currentTenantId()}:${rawKey}`;
  },
  getRaw(rawKey: string): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.key(rawKey));
  },
  get<T = unknown>(rawKey: string): T | null {
    const raw = this.getRaw(rawKey);
    if (raw == null) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  setRaw(rawKey: string, value: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.key(rawKey), value);
  },
  set<T>(rawKey: string, value: T): void {
    this.setRaw(rawKey, JSON.stringify(value));
  },
  remove(rawKey: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.key(rawKey));
  },
};

/**
 * 既存ユーザー (legacy localStorage) を現テナントに移行。
 * すでに tenant prefix 付きキーが存在すれば上書きしない。
 * Phase A 段階では一度だけ実行。
 */
export function migrateLegacyKeysOnce() {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_DONE_KEY) === '1') return;

  const tenantId = currentTenantId();
  // 既知の主要 localStorage キー (歴史的に accumulate されたもの)
  const legacyPrefixes = [
    'core_',         // 大半の core_xxx
    'iris_',
    'prism_',
    'persona_',
    'media_kit_',
    'deals_',
    'briefings_',
  ];

  let migrated = 0;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith('t:')) continue;          // tenant prefix 付きはスキップ
    if (k === TENANT_KEY) continue;            // tenant ID 自体
    if (k === MIGRATION_DONE_KEY) continue;
    if (k === 'core_master_key_v1') continue;  // マスターモード鍵はグローバル
    // 知っているレガシー prefix のみ移行
    if (legacyPrefixes.some(p => k.startsWith(p))) keys.push(k);
  }

  for (const k of keys) {
    const targetKey = `t:${tenantId}:${k}`;
    if (localStorage.getItem(targetKey) != null) continue;
    const v = localStorage.getItem(k);
    if (v != null) {
      localStorage.setItem(targetKey, v);
      migrated++;
    }
  }

  localStorage.setItem(MIGRATION_DONE_KEY, '1');
  if (migrated > 0) {
    // dev では console に
    try { console.info(`[tenant] migrated ${migrated} legacy keys to tenant ${tenantId}`); } catch {}
  }
}

/**
 * Phase B/C/D で使う、サーバ送信用ヘッダ生成 (現状は tenant id だけ)
 */
export function tenantHeaders(): Record<string, string> {
  return {
    'X-Tenant-Id': currentTenantId(),
  };
}
