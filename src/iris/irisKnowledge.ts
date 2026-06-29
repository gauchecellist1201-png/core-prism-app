// ============================================================
// CORE Iris — 自己強化学習ナレッジ
// AI 生成物 (リール / キャプション / 応募文 / ストーリー)
// + 手書きメモを集約し、次の AI 呼び出しに context として渡す
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { useCloudSync } from '../hooks/useCloudSync';
import { readCreatorCoreContextSync } from './irisCore';

const STORAGE_KEY = 'iris_knowledge_v1';

export type IrisKnowledgeKind =
  | 'reel-idea'        // 次の投稿提案カード
  | 'caption'          // 投稿下書き
  | 'application'      // ブランド応募文
  | 'story-arc'        // 30日ストーリーアーク
  | 'reel-caption'     // リールスタジオ生成
  | 'note';            // 手書きメモ

export interface IrisKnowledgeItem {
  id: string;
  kind: IrisKnowledgeKind;
  title: string;
  content: string;       // 全文
  summary: string;       // AI コンテキスト用の短い要約 (200字以内)
  tags: string[];
  source?: string;       // 例: ブランド名・プラットフォーム
  createdAt: string;     // ISO
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `ik-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function load(): IrisKnowledgeItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: IrisKnowledgeItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

function compactSummary(text: string, maxLen = 200): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1) + '…';
}

// ─── 公開: AI 呼び出しに渡す context 文字列 ──────────────────
// 上位 topK 件の summary を改行で連結。空ならから文字列を返す
export function buildIrisKnowledgeContext(items: IrisKnowledgeItem[], topK = 10): string {
  if (items.length === 0) return '';
  // 新しい順 (createdAt desc)
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const top = sorted.slice(0, topK);
  const lines = top.map((i, idx) => {
    const tagStr = i.tags.length ? ` [${i.tags.slice(0, 3).join('/')}]` : '';
    return `${idx + 1}. (${i.kind}) ${i.title}${tagStr} — ${i.summary}`;
  });
  return lines.join('\n');
}

// ─── 公開: ナレッジ件数取得 (UI バッジ用) ──────────────────
export function loadIrisKnowledgeCount(): number {
  return load().length;
}

// ─── React フック ──────────────────────────────────────────
export function useIrisKnowledge() {
  const [items, setItems] = useState<IrisKnowledgeItem[]>(load);

  useEffect(() => { save(items); }, [items]);

  useCloudSync({ key: STORAGE_KEY, value: items, setValue: setItems, isEmpty: v => v.length === 0 });

  const add = useCallback((input: Omit<IrisKnowledgeItem, 'id' | 'createdAt' | 'summary'> & { summary?: string }): IrisKnowledgeItem => {
    const item: IrisKnowledgeItem = {
      id: genId(),
      kind: input.kind,
      title: input.title.slice(0, 80),
      content: input.content,
      summary: input.summary ?? compactSummary(input.content),
      tags: input.tags ?? [],
      source: input.source,
      createdAt: new Date().toISOString(),
    };
    setItems(prev => [item, ...prev]);
    return item;
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<IrisKnowledgeItem, 'id' | 'createdAt'>>) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const next = { ...i, ...patch };
      // summary を content に合わせて再生成 (明示的に渡されていなければ)
      if (patch.content !== undefined && patch.summary === undefined) {
        next.summary = compactSummary(patch.content);
      }
      return next;
    }));
  }, []);

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  // AI 呼び出しに渡す context。先頭に「発信者の核（あなたの核）」を毎回差し込み、
  // 全 AI（分析/戦略/台本/ブランドマッチ）があなたらしさに沿うようにする。
  const getContext = useCallback((topK = 10) => {
    const coreCtx = readCreatorCoreContextSync();
    const knowledgeCtx = buildIrisKnowledgeContext(items, topK);
    return [coreCtx, knowledgeCtx].filter(Boolean).join('\n\n');
  }, [items]);

  return {
    items,
    count: items.length,
    add,
    update,
    remove,
    clearAll,
    getContext,
  };
}

// ─── ラベル ────────────────────────────────────────────────
export const IRIS_KNOWLEDGE_KIND_META: Record<IrisKnowledgeKind, { label: string; emoji: string; color: string }> = {
  'reel-idea':    { label: '投稿アイデア',     emoji: '💡', color: '#A78BFA' },
  'caption':      { label: '投稿キャプション', emoji: '📝', color: '#E1306C' },
  'application':  { label: '応募文',           emoji: '✉️', color: '#F77737' },
  'story-arc':    { label: '30日ストーリー',   emoji: '🌙', color: '#3B82F6' },
  'reel-caption': { label: 'リール台本',       emoji: '🎬', color: '#10B981' },
  'note':         { label: 'メモ',             emoji: '📌', color: '#9CA3AF' },
};
