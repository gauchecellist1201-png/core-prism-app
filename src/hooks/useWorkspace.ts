// ============================================================
// useWorkspace — チームワークスペース管理 (Phase 5-2)
// localStorage 'core_workspace_v1' で 1 ワークスペースを保持
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import type { Workspace, TeamMember, Invite, MemberRole } from '../types/team';

const WORKSPACE_KEY = 'core_workspace_v1';

function loadWorkspace(): Workspace | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveWorkspace(ws: Workspace) {
  try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws)); } catch { /* */ }
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function loadOwnerEmail(): string {
  try {
    const raw = localStorage.getItem('core_billing_user_v1');
    if (raw) {
      const u = JSON.parse(raw);
      if (u?.email) return u.email;
    }
  } catch { /* */ }
  return 'owner@example.com';
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(() => loadWorkspace());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === WORKSPACE_KEY) setWorkspace(loadWorkspace());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((ws: Workspace) => {
    saveWorkspace(ws);
    setWorkspace(ws);
  }, []);

  const createWorkspace = useCallback((name: string): Workspace => {
    const ownerEmail = loadOwnerEmail();
    const now = new Date().toISOString();
    const owner: TeamMember = {
      id: generateId(),
      email: ownerEmail,
      displayName: ownerEmail.split('@')[0],
      role: 'owner',
      joinedAt: now,
    };
    const ws: Workspace = {
      id: generateId(),
      name,
      ownerEmail,
      members: [owner],
      invites: [],
      createdAt: now,
    };
    update(ws);
    return ws;
  }, [update]);

  const generateInvite = useCallback((role: MemberRole, expiresInDays = 7): Invite | null => {
    if (!workspace) return null;
    const now = new Date();
    const invite: Invite = {
      code: generateInviteCode(),
      role,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiresInDays * 86400000).toISOString(),
    };
    update({ ...workspace, invites: [...workspace.invites, invite] });
    return invite;
  }, [workspace, update]);

  const redeemInvite = useCallback((code: string): { ok: boolean; message: string } => {
    if (!workspace) return { ok: false, message: 'ワークスペースが見つかりません' };

    const invite = workspace.invites.find(i => i.code === code);
    if (!invite) return { ok: false, message: '招待コードが無効です' };
    if (invite.usedAt) return { ok: false, message: 'この招待リンクは既に使用されています' };
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return { ok: false, message: '招待リンクの有効期限が切れています' };
    }

    const email = loadOwnerEmail();
    const alreadyMember = workspace.members.some(m => m.email === email);
    if (alreadyMember) return { ok: false, message: '既にこのワークスペースのメンバーです' };

    const now = new Date().toISOString();
    const newMember: TeamMember = {
      id: generateId(),
      email,
      displayName: email.split('@')[0],
      role: invite.role,
      joinedAt: now,
    };
    const updatedInvites = workspace.invites.map(i =>
      i.code === code ? { ...i, usedAt: now } : i
    );
    update({ ...workspace, members: [...workspace.members, newMember], invites: updatedInvites });
    return { ok: true, message: `${workspace.name} に参加しました` };
  }, [workspace, update]);

  const removeMember = useCallback((memberId: string) => {
    if (!workspace) return;
    update({ ...workspace, members: workspace.members.filter(m => m.id !== memberId) });
  }, [workspace, update]);

  const changeRole = useCallback((memberId: string, role: MemberRole) => {
    if (!workspace) return;
    update({
      ...workspace,
      members: workspace.members.map(m => m.id === memberId ? { ...m, role } : m),
    });
  }, [workspace, update]);

  const revokeInvite = useCallback((code: string) => {
    if (!workspace) return;
    update({ ...workspace, invites: workspace.invites.filter(i => i.code !== code) });
  }, [workspace, update]);

  const getMembers = useCallback((): TeamMember[] => {
    return workspace?.members ?? [];
  }, [workspace]);

  const getRole = useCallback((email: string): MemberRole | null => {
    return workspace?.members.find(m => m.email === email)?.role ?? null;
  }, [workspace]);

  const activeInvites = workspace?.invites.filter(
    i => !i.usedAt && new Date(i.expiresAt).getTime() > Date.now()
  ) ?? [];

  return {
    workspace,
    activeInvites,
    createWorkspace,
    generateInvite,
    redeemInvite,
    removeMember,
    changeRole,
    revokeInvite,
    getMembers,
    getRole,
  };
}
