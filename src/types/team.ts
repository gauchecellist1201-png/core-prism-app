// ============================================================
// Team / Workspace 型定義 (Phase 5-2)
// ============================================================

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string; // ISO
}

export interface Invite {
  code: string;
  email?: string; // 特定メール宛の場合
  role: MemberRole;
  expiresAt: string; // ISO
  createdAt: string; // ISO
  usedAt?: string;   // ISO — 使用済みの場合
}

export interface Workspace {
  id: string;
  name: string;
  ownerEmail: string;
  members: TeamMember[];
  invites: Invite[];
  createdAt: string; // ISO
}

export type ShareResourceType = 'persona' | 'knowledge' | 'document' | 'deal';

export interface ShareRecord {
  resourceType: ShareResourceType;
  resourceId: string;
  sharedWith: string[]; // member email list
}
