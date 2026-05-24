import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { KnowledgeItem, Persona } from '../types/identity';

interface Props {
  persona: Persona;
  items: KnowledgeItem[];
  onAcceptAction: (action: string) => void;
  onOpenKnowledge: () => void;
}

type Tab = 'insights' | 'strategy' | 'actions' | 'risks';

interface Bucket {
  text: string;
  source: string; // タイトル
  sourceId: string;
}

export default function InsightsStream({ persona, items, onAcceptAction, onOpenKnowledge }: Props) {
  const [tab, setTab] = useState<Tab>('actions');

  const buckets = useMemo(() => {
    const ins: Bucket[] = [];
    const str: Bucket[] = [];
    const act: Bucket[] = [];
    const rsk: Bucket[] = [];
    for (const item of items) {
      if (!item.analysis) continue;
      for (const x of item.analysis.insights) ins.push({ text: x, source: item.title, sourceId: item.id });
      for (const x of item.analysis.strategy) str.push({ text: x, source: item.title, sourceId: item.id });
      for (const x of item.analysis.actions) act.push({ text: x, source: item.title, sourceId: item.id });
      for (const x of item.analysis.risks) rsk.push({ text: x, source: item.title, sourceId: item.id });
    }
    return { insights: ins, strategy: str, actions: act, risks: rsk };
  }, [items]);

  const TABS: { id: Tab; label: string; emoji: string; color: string; data: Bucket[] }[] = [
    { id: 'actions', label: 'アクション', emoji: '✓', color: '#34d399', data: buckets.actions },
    { id: 'strategy', label: '戦略', emoji: '🎯', color: persona.accentColor, data: buckets.strategy },
    { id: 'insights', label: '洞察', emoji: '💡', color: '#c9a96e', data: buckets.insights },
    { id: 'risks', label: 'リスク', emoji: '⚠', color: '#f87171', data: buckets.risks },
  ];

  const total = buckets.insights.length + buckets.strategy.length + buckets.actions.length + buckets.risks.length;

  if (items.length === 0) {
    return null;
  }

  if (total === 0) {
    const pending = items.some(i =>
      i.analysisStatus === 'pending' ||
      i.analysisStatus === 'parsing' ||
      i.analysisStatus === 'tagging' ||
      i.analysisStatus === 'summarizing' ||
      i.analysisStatus === 'extracting'
    );
    return (
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
      >
        <p className="text-fg-muted text-sm">
          {pending
            ? '🧠 資料を分析しています… しばらくお待ちください。'
            : '分析結果がまだありません。資料を追加すると AI が自動でインサイトを抽出します。'}
        </p>
      </div>
    );
  }

  const currentTab = TABS.find(t => t.id === tab)!;
  const currentData = currentTab.data;

  return (
    <motion.div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <p className="text-fg text-sm font-medium">📚 ナレッジから抽出</p>
        <button
          onClick={onOpenKnowledge}
          className="text-fg-muted hover:text-fg text-xs"
        >
          {items.length}件の資料 →
        </button>
      </div>

      {/* タブ */}
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={{
                background: active ? `${t.color}25` : 'var(--surface)',
                color: active ? t.color : 'var(--fg-muted)',
                border: `1px solid ${active ? t.color + '50' : 'var(--border)'}`,
              }}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
              <span className="opacity-60">{t.data.length}</span>
            </button>
          );
        })}
      </div>

      {/* 内容 */}
      <div className="px-3 pb-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            className="grid grid-cols-1 md:grid-cols-2 gap-2"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {currentData.length === 0 && (
              <p className="text-fg-muted text-sm py-3 col-span-full">
                まだ {currentTab.label} が抽出されていません。
              </p>
            )}
            {currentData.slice(0, 12).map((b, i) => {
              const isAction = tab === 'actions';
              return (
                <motion.div
                  key={`${b.sourceId}-${i}`}
                  className="rounded-lg p-2.5 flex items-start gap-2 group"
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${currentTab.color}25`,
                  }}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <span
                    className="text-sm flex-shrink-0 mt-0.5"
                    style={{ color: currentTab.color }}
                  >
                    {currentTab.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-fg text-sm leading-snug">{b.text}</p>
                    <p className="text-fg-muted text-xs mt-1 truncate">— {b.source}</p>
                  </div>
                  {isAction && (
                    <button
                      onClick={() => onAcceptAction(b.text)}
                      className="text-xs px-2 py-1 rounded transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
                      style={{
                        background: `${currentTab.color}25`,
                        color: currentTab.color,
                        border: `1px solid ${currentTab.color}50`,
                      }}
                      title="タスクに追加"
                    >
                      ＋追加
                    </button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {currentData.length > 12 && (
          <p className="text-fg-muted text-xs text-center mt-2">
            他 {currentData.length - 12} 件 — 資料画面で詳細を見る
          </p>
        )}
      </div>
    </motion.div>
  );
}
