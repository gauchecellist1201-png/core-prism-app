import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, KnowledgeItem } from '../types/identity';

export type CmdAction =
  | { kind: 'open-modal'; modal: ModalKey; label: string; emoji: string }
  | { kind: 'switch-persona'; personaId: string; label: string; emoji: string; color: string }
  | { kind: 'jump-knowledge'; knowledgeId: string; label: string; subtitle: string; emoji: string }
  | { kind: 'jump-task'; taskId: string; personaId: string; label: string; subtitle: string; emoji: string }
  | { kind: 'custom'; id: string; label: string; subtitle?: string; emoji: string; onRun: () => void };

export type ModalKey =
  | 'knowledge' | 'meeting' | 'health' | 'minutes' | 'slides' | 'nego'
  | 'decision' | 'email' | 'premium' | 'post' | 'image' | 'invoice'
  | 'sales' | 'expense' | 'crm' | 'tasks' | 'pnl' | 'finConsult' | 'voice' | 'youtube'
  | 'salesAgent' | 'saasAgent' | 'settings' | 'documents' | 'people';

interface Props {
  open: boolean;
  onClose: () => void;
  personas: Persona[];
  knowledge: KnowledgeItem[];
  activePersonaId: string;
  onSwitchPersona: (id: string) => void;
  onOpenModal: (m: ModalKey) => void;
  onOpenKnowledgeId?: (id: string) => void;
}

const MODAL_LIST: { key: ModalKey; label: string; emoji: string; group: string }[] = [
  { key: 'knowledge', label: 'ナレッジを開く',     emoji: '📚', group: '基本' },
  { key: 'tasks',     label: 'タスクハブ',         emoji: '✅', group: '基本' },
  { key: 'health',    label: 'ヘルスHub',           emoji: '🩺', group: '基本' },
  { key: 'minutes',   label: '議事録 AI',           emoji: '🎩', group: 'AI' },
  { key: 'slides',    label: 'スライド生成',        emoji: '🎨', group: 'AI' },
  { key: 'nego',      label: '交渉コーチ',          emoji: '🤝', group: 'AI' },
  { key: 'decision',  label: '意思決定メモ',        emoji: '💭', group: 'AI' },
  { key: 'post',      label: '投稿生成 (note/X)',   emoji: '📢', group: 'AI' },
  { key: 'image',     label: '画像生成',            emoji: '🖼', group: 'AI' },
  { key: 'voice',     label: '音声メモ → 振り分け', emoji: '🎤', group: 'AI' },
  { key: 'youtube',   label: 'YouTube 取込',        emoji: '🎤', group: 'AI' },
  { key: 'salesAgent', label: '商談 AI エージェント',  emoji: '🎯', group: 'AI' },
  { key: 'saasAgent',  label: 'SaaS エージェント',    emoji: '🤖', group: 'AI' },
  { key: 'email',     label: 'メールトリアージ',    emoji: '📬', group: 'AI' },
  { key: 'premium',   label: 'プレミアムHub',       emoji: '👑', group: '経営' },
  { key: 'invoice',   label: '請求書スタジオ',      emoji: '🧾', group: '経営' },
  { key: 'sales',     label: '売上台帳',            emoji: '📒', group: '経営' },
  { key: 'expense',   label: '経費 / OCR',          emoji: '📷', group: '経営' },
  { key: 'pnl',       label: 'P&L 損益計算書',      emoji: '📊', group: '経営' },
  { key: 'finConsult', label: '財務コンサルタント',  emoji: '🧮', group: '経営' },
  { key: 'crm',       label: 'CRM パイプライン',    emoji: '🗂', group: '経営' },
  { key: 'documents', label: '書類スタジオ',         emoji: '📄', group: '経営' },
  { key: 'people',    label: '人物ケア / 1on1',     emoji: '👥', group: '人材' },
  { key: 'meeting',   label: '会議リンク',          emoji: '📅', group: '経営' },
  { key: 'settings',  label: '環境設定',            emoji: '⚙',  group: 'その他' },
];

export default function CommandPalette({
  open, onClose, personas, knowledge, activePersonaId,
  onSwitchPersona, onOpenModal, onOpenKnowledgeId,
}: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const activePersona = personas.find(p => p.id === activePersonaId);
  const personaKnowledge = useMemo(
    () => knowledge.filter(k => k.personaId === activePersonaId),
    [knowledge, activePersonaId]
  );

  // 全候補をビルド
  const allItems = useMemo<CmdAction[]>(() => {
    const items: CmdAction[] = [];
    // 機能起動
    for (const m of MODAL_LIST) {
      items.push({ kind: 'open-modal', modal: m.key, label: m.label, emoji: m.emoji });
    }
    // 人格切替
    for (const p of personas) {
      if (p.id === activePersonaId) continue;
      items.push({ kind: 'switch-persona', personaId: p.id, label: `人格切替: ${p.name}`, emoji: p.icon, color: p.accentColor });
    }
    // ナレッジ
    for (const k of personaKnowledge.slice(0, 50)) {
      items.push({
        kind: 'jump-knowledge',
        knowledgeId: k.id,
        label: k.title,
        subtitle: `📄 ナレッジ · ${k.fileKind || 'note'}${k.tags.length > 0 ? ' · ' + k.tags.slice(0, 2).join(', ') : ''}`,
        emoji: k.fileKind === 'image' ? '🖼' : k.fileKind === 'pdf' ? '📑' : '📄',
      });
    }
    // タスク
    if (activePersona) {
      for (const t of activePersona.tasks.filter(t => !t.done).slice(0, 30)) {
        items.push({
          kind: 'jump-task',
          taskId: t.id,
          personaId: activePersona.id,
          label: t.title,
          subtitle: `✅ タスク · ${t.priority === 'high' ? '高' : t.priority === 'mid' ? '中' : '低'} · ${t.due}`,
          emoji: '✅',
        });
      }
    }
    return items;
  }, [personas, personaKnowledge, activePersona, activePersonaId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(item => {
      const haystack = (item.label + ' ' + ('subtitle' in item ? item.subtitle || '' : '')).toLowerCase();
      return q.split(/\s+/).every(part => haystack.includes(part));
    });
  }, [allItems, query]);

  // selectedIdx を範囲内に保つ
  useEffect(() => {
    if (selectedIdx >= filtered.length) setSelectedIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, selectedIdx]);

  const runItem = (item: CmdAction) => {
    if (item.kind === 'open-modal') {
      onClose();
      onOpenModal(item.modal);
    } else if (item.kind === 'switch-persona') {
      onClose();
      onSwitchPersona(item.personaId);
    } else if (item.kind === 'jump-knowledge') {
      onClose();
      onOpenKnowledgeId?.(item.knowledgeId);
      onOpenModal('knowledge');
    } else if (item.kind === 'jump-task') {
      onClose();
      onOpenModal('tasks');
    } else if (item.kind === 'custom') {
      onClose();
      item.onRun();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[selectedIdx];
      if (item) runItem(item);
    } else if (e.key === 'Escape') {
      e.preventDefault(); onClose();
    }
  };

  // グルーピング
  const grouped = useMemo(() => {
    const map = new Map<string, CmdAction[]>();
    for (const item of filtered) {
      let group = '';
      if (item.kind === 'open-modal') {
        const def = MODAL_LIST.find(m => m.key === item.modal);
        group = def?.group || '機能';
      } else if (item.kind === 'switch-persona') group = '人格';
      else if (item.kind === 'jump-knowledge') group = 'ナレッジ';
      else if (item.kind === 'jump-task') group = 'タスク';
      else group = 'その他';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    }
    return [...map.entries()];
  }, [filtered]);

  // フラット index 計算用
  const flatItems = filtered;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center pt-20 px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', maxHeight: 'calc(100dvh - 4rem)' }}
            initial={{ scale: 0.96, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: -20 }}
            onClick={e => e.stopPropagation()}
          >
            {/* 検索ボックス */}
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-2xl">🔮</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
                onKeyDown={handleKeyDown}
                placeholder="機能・ナレッジ・タスク・人格を横断検索..."
                className="flex-1 bg-transparent text-fg text-lg outline-none placeholder:text-fg-subtle"
              />
              <span className="cp-pill" style={{ fontSize: '0.65rem' }}>ESC</span>
            </div>

            {/* 結果リスト */}
            <div className="flex-1 overflow-y-auto py-2">
              {flatItems.length === 0 ? (
                <div className="cp-empty">
                  <p className="cp-empty-icon">🔍</p>
                  <p>該当なし</p>
                </div>
              ) : (
                grouped.map(([groupName, items]) => (
                  <div key={groupName} className="mb-1">
                    <p className="cp-tiny px-5 py-1.5 sticky top-0" style={{ background: 'var(--bg-2)' }}>{groupName}</p>
                    {items.map((item) => {
                      const flatIdx = flatItems.indexOf(item);
                      const isSelected = flatIdx === selectedIdx;
                      const subtitle = 'subtitle' in item ? item.subtitle : null;
                      return (
                        <button
                          key={(item.kind === 'open-modal' ? item.modal : item.kind === 'switch-persona' ? item.personaId : item.kind === 'jump-knowledge' ? item.knowledgeId : item.kind === 'jump-task' ? item.taskId : item.id) + flatIdx}
                          onMouseEnter={() => setSelectedIdx(flatIdx)}
                          onClick={() => runItem(item)}
                          className="w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors"
                          style={{
                            background: isSelected ? 'var(--surface-3)' : 'transparent',
                            borderLeft: isSelected ? `3px solid ${('color' in item ? item.color : 'var(--prism-creative)')}` : '3px solid transparent',
                          }}
                        >
                          <span className="text-xl flex-shrink-0">{item.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="cp-body truncate" style={{ fontWeight: isSelected ? 600 : 400 }}>{item.label}</p>
                            {subtitle && <p className="cp-meta truncate">{subtitle}</p>}
                          </div>
                          {isSelected && (
                            <span className="cp-pill" style={{ fontSize: '0.65rem' }}>↵</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* フッタヒント */}
            <div className="px-5 py-2 cp-row text-fg-subtle" style={{ borderTop: '1px solid var(--border)', fontSize: '0.7rem' }}>
              <span>↑↓ 選択</span><span>↵ 開く</span><span>esc 閉じる</span>
              <span className="ml-auto">{flatItems.length} 件</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Cmd+K / Ctrl+K グローバルキーバインド */
export function useCommandPaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
