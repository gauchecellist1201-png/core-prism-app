// ============================================================
// teamMembers.ts — 親 user に紐付く team メンバーの localStorage 管理
//
// オーナー指示 (2026-06-04 第 18 波 QQQ):
//   オーナー (親 user) が他メンバーを 1 タップで招待。
//   メンバー一覧 + 権限 (admin / editor / viewer) + 削除。
//
// 設計:
//   - 本番では Supabase / DB に永続化したい (将来作業)
//   - 現状: localStorage `core_team_members_v1` に保存
//   - 招待は /api/team/invite に POST → Resend で招待メール
//   - 子 user の signup 時に inviteToken を sessionStorage から拾って親と紐付け
// ============================================================

const STORAGE_KEY = 'core_team_members_v1';

export type TeamRole = 'admin' | 'editor' | 'viewer';

export interface TeamMember {
  id: string;            // 招待時に生成
  email: string;
  role: TeamRole;
  invitedAt: string;     // ISO
  status: 'invited' | 'active' | 'removed';
  inviteToken?: string;  // 招待 URL に乗せる
  acceptedAt?: string;
  invitedBy?: string;    // 親 user email
}

export const ROLE_META: Record<TeamRole, { label: string; desc: string; color: string }> = {
  admin:  { label: '管理者', desc: 'メンバー管理 + 全設定変更 + 課金',  color: '#F472B6' },
  editor: { label: '編集',   desc: 'タスク / CRM / コンテンツ 編集可',  color: '#60A5FA' },
  viewer: { label: '閲覧',   desc: '閲覧のみ。編集 / 課金は不可',       color: '#9CA3AF' },
};

function gen(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as Crypto).randomUUID();
  } catch { /* */ }
  return 'm_' + Math.random().toString(36).slice(2, 14);
}

export function loadMembers(): TeamMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as TeamMember[];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function save(list: TeamMember[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* */ }
}

/** 招待時呼ぶ — local 状態は invited で残し、API 呼出は別途 */
export function addInvite(email: string, role: TeamRole, invitedBy?: string): TeamMember {
  const m: TeamMember = {
    id: gen(),
    email: email.toLowerCase().trim(),
    role,
    invitedAt: new Date().toISOString(),
    status: 'invited',
    inviteToken: gen(),
    invitedBy,
  };
  const list = loadMembers();
  // 既存の invited (active 以外) は上書き
  const filtered = list.filter(x => x.email !== m.email || x.status === 'active');
  save([...filtered, m]);
  return m;
}

export function updateRole(id: string, role: TeamRole): void {
  const list = loadMembers();
  save(list.map(m => m.id === id ? { ...m, role } : m));
}

export function removeMember(id: string): void {
  const list = loadMembers();
  save(list.map(m => m.id === id ? { ...m, status: 'removed' as const } : m));
}

export function hardDelete(id: string): void {
  const list = loadMembers();
  save(list.filter(m => m.id !== id));
}

export function buildInviteUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://core-prism-app.vercel.app';
  return `${origin}/?invite=${encodeURIComponent(token)}`;
}
