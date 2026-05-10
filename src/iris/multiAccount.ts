// ============================================================
// CORE Iris — マルチアカウント管理
// IG アカウントを複数登録 (個人 / サブ / タイアップ専用) し
// ダッシュボードでタブ切り替えできるようにする
// ============================================================

export type AccountType = 'personal' | 'sub' | 'tieup' | 'business';

export interface IrisAccount {
  id: string;
  type: AccountType;
  handle: string;
  displayName: string;
  avatarEmoji?: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'x';
  followerCount?: number;
  bio?: string;
  isActive: boolean;
  createdAt: string;
}

export const ACCOUNT_TYPE_META: Record<AccountType, { label: string; emoji: string; color: string; hint: string }> = {
  personal:  { label: '個人',       emoji: '🌸', color: '#E1306C', hint: 'メインの個人アカウント' },
  sub:       { label: 'サブ',       emoji: '✨', color: '#833AB4', hint: 'サブアカウント・趣味用' },
  tieup:     { label: 'タイアップ', emoji: '🤝', color: '#F77737', hint: 'ブランドタイアップ専用' },
  business:  { label: 'ビジネス',   emoji: '💼', color: '#2D9CDB', hint: '法人・ビジネス用途' },
};

export const PLATFORM_META_ACCOUNT: Record<IrisAccount['platform'], { label: string; emoji: string }> = {
  instagram: { label: 'Instagram', emoji: '📸' },
  tiktok:    { label: 'TikTok',    emoji: '🎵' },
  youtube:   { label: 'YouTube',   emoji: '▶️' },
  x:         { label: 'X (Twitter)', emoji: '𝕏' },
};

const STORAGE_KEY = 'core_iris_accounts_v1';
const ACTIVE_KEY  = 'core_iris_active_account_v1';

function genId(): string {
  return 'acct-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function loadAll(): IrisAccount[] {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) return JSON.parse(r);
  } catch { /* */ }
  const def: IrisAccount = {
    id: genId(),
    type: 'personal',
    handle: '@your_handle',
    displayName: 'あなた',
    avatarEmoji: '🌸',
    platform: 'instagram',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([def]));
  localStorage.setItem(ACTIVE_KEY, def.id);
  return [def];
}

function saveAll(list: IrisAccount[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* */ }
}

export function getAccounts(): IrisAccount[] {
  return loadAll();
}

export function getActiveAccount(): IrisAccount | undefined {
  const all = loadAll();
  const activeId = localStorage.getItem(ACTIVE_KEY);
  return all.find(a => a.id === activeId) || all.find(a => a.isActive) || all[0];
}

export function setActiveAccount(id: string): IrisAccount[] {
  const all = loadAll().map(a => ({ ...a, isActive: a.id === id }));
  saveAll(all);
  localStorage.setItem(ACTIVE_KEY, id);
  return all;
}

export function addAccount(input: Omit<IrisAccount, 'id' | 'createdAt' | 'isActive'>): IrisAccount {
  const all = loadAll();
  const account: IrisAccount = { ...input, id: genId(), isActive: false, createdAt: new Date().toISOString() };
  saveAll([...all, account]);
  return account;
}

export function updateAccount(id: string, patch: Partial<Omit<IrisAccount, 'id' | 'createdAt'>>): IrisAccount[] {
  const updated = loadAll().map(a => a.id === id ? { ...a, ...patch } : a);
  saveAll(updated);
  return updated;
}

export function removeAccount(id: string): IrisAccount[] {
  const all = loadAll().filter(a => a.id !== id);
  saveAll(all);
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (activeId === id && all.length > 0) {
    localStorage.setItem(ACTIVE_KEY, all[0].id);
    all[0].isActive = true;
    saveAll(all);
  }
  return all;
}

import { useState, useCallback } from 'react';

export function useMultiAccount() {
  const [accounts, setAccounts] = useState<IrisAccount[]>(loadAll);

  const switchTo = useCallback((id: string) => {
    setAccounts(setActiveAccount(id));
  }, []);

  const add = useCallback((input: Omit<IrisAccount, 'id' | 'createdAt' | 'isActive'>) => {
    const created = addAccount(input);
    setAccounts(loadAll());
    return created;
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<IrisAccount, 'id' | 'createdAt'>>) => {
    setAccounts(updateAccount(id, patch));
  }, []);

  const remove = useCallback((id: string) => {
    setAccounts(removeAccount(id));
  }, []);

  const active = accounts.find(a => a.id === (localStorage.getItem(ACTIVE_KEY) || ''))
    || accounts.find(a => a.isActive)
    || accounts[0];

  return { accounts, active, switchTo, add, update, remove };
}
