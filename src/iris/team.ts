// ============================================================
// CORE Iris — チーム機能 (マネージャー + クリエイター複数人 連携)
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Platform, MediaKit } from '../types/influencerDeal';

const KEY_TEAM = 'core_iris_team_v1';

export type MemberRole = 'manager' | 'creator' | 'editor' | 'collaborator';

export interface IrisTeamMember {
  id: string;
  /** 表示名 */
  name: string;
  /** SNSハンドル (例: @hanako) */
  handle?: string;
  /** プロフィール画像URL */
  avatarUrl?: string;
  /** 役割 */
  role: MemberRole;
  /** 得意領域 (例: コスメ・ライフスタイル) */
  niches?: string[];
  /** 主な活動プラットフォーム */
  primaryPlatform?: Platform;
  /** 連絡先 */
  email?: string;
  line?: string;
  /** メディアキット (任意で持たせる) */
  mediaKit?: MediaKit;
  /** メモ */
  notes?: string;
  createdAt: string;
}

/** 共有テンプレ (チームで使い回せる交渉文・投稿テンプレ等) */
export interface SharedTemplate {
  id: string;
  type: 'negotiation' | 'caption' | 'reply';
  label: string;
  body: string;
  tags?: string[];
  createdBy?: string; // memberId
  createdAt: string;
  uses: number;
}

const TEMPLATES_KEY = 'core_iris_templates_v1';

function load<T>(k: string, fb: T): T {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
}
function save<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ }
}

export function useIrisTeam() {
  const [members, setMembers] = useState<IrisTeamMember[]>(() => load(KEY_TEAM, []));
  const [templates, setTemplates] = useState<SharedTemplate[]>(() => load(TEMPLATES_KEY, []));

  useEffect(() => save(KEY_TEAM, members), [members]);
  useEffect(() => save(TEMPLATES_KEY, templates), [templates]);

  const addMember = useCallback((m: Omit<IrisTeamMember, 'id' | 'createdAt'>) => {
    const created: IrisTeamMember = { ...m, id: uuidv4(), createdAt: new Date().toISOString() };
    setMembers(prev => [created, ...prev]);
    return created;
  }, []);
  const updateMember = useCallback((id: string, patch: Partial<IrisTeamMember>) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);
  const removeMember = useCallback((id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  }, []);

  const addTemplate = useCallback((t: Omit<SharedTemplate, 'id' | 'createdAt' | 'uses'>) => {
    const created: SharedTemplate = { ...t, id: uuidv4(), createdAt: new Date().toISOString(), uses: 0 };
    setTemplates(prev => [created, ...prev]);
    return created;
  }, []);
  const incrementTemplateUse = useCallback((id: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, uses: t.uses + 1 } : t));
  }, []);
  const removeTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  /** チーム全体を JSON でエクスポート */
  const exportTeam = useCallback(() => {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      members,
      templates,
    }, null, 2);
  }, [members, templates]);

  /** JSON からインポート (マージ) */
  const importTeam = useCallback((json: string): { added: number; error?: string } => {
    try {
      const data = JSON.parse(json);
      const newMembers = (data.members || []).filter((m: IrisTeamMember) => !members.some(existing => existing.id === m.id));
      const newTemplates = (data.templates || []).filter((t: SharedTemplate) => !templates.some(existing => existing.id === t.id));
      setMembers(prev => [...newMembers, ...prev]);
      setTemplates(prev => [...newTemplates, ...prev]);
      return { added: newMembers.length + newTemplates.length };
    } catch (e: any) {
      return { added: 0, error: e.message || 'JSON が読み取れませんでした' };
    }
  }, [members, templates]);

  return {
    members, templates,
    addMember, updateMember, removeMember,
    addTemplate, incrementTemplateUse, removeTemplate,
    exportTeam, importTeam,
  };
}

/** 招待リンク生成 (今は静的・将来サーバ化) */
export function generateInviteCode(memberName: string): string {
  return btoa(unescape(encodeURIComponent(`iris-invite|${memberName}|${Date.now()}`))).replace(/=/g, '');
}

export const ROLE_META: Record<MemberRole, { label: string; emoji: string; color: string }> = {
  'manager':      { label: 'マネージャー',  emoji: '👑', color: '#FFC857' },
  'creator':      { label: 'クリエイター',  emoji: '🌸', color: '#FF7AAE' },
  'editor':       { label: '編集 / 投稿担当', emoji: '✂', color: '#9B6FE8' },
  'collaborator': { label: 'コラボ',        emoji: '🤝', color: '#10B981' },
};
