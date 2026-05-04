import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { Persona } from '../types/identity';

interface Action {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  onClick: () => void;
  primary?: boolean;
  group?: string;     // カテゴリ (新規。なければ "その他")
}

interface Props {
  persona: Persona;
  actions: Action[];
}

// アクション ID からカテゴリへ自動マッピング (上位コンポーネントを変えずにグルーピング可能)
const AUTO_GROUP: Record<string, string> = {
  brief:        '今日',
  kb:           'ナレッジ',
  note:         'ナレッジ',
  minutes:      '生成・分析',
  slides:       '生成・分析',
  nego:         '生成・分析',
  decision:     '生成・分析',
  email:        '生成・分析',
  post:         '生成・分析',
  image:        '生成・分析',
  invoice:      '経営',
  sales:        '経営',
  pnl:          '経営',
  expense:      '経営',
  crm:          '経営',
  'sales-agent':'営業',
  'tasks-hub':  'タスク',
  premium:      'プレミアム',
  meet:         'スケジュール',
  health:       'ヘルス',
};

const GROUP_ORDER = ['今日', 'ナレッジ', '生成・分析', '営業', '経営', 'タスク', 'スケジュール', 'ヘルス', 'プレミアム', 'その他'];
const GROUP_EMOJI: Record<string, string> = {
  '今日': '☀',
  'ナレッジ': '📚',
  '生成・分析': '✨',
  '営業': '🎯',
  '経営': '📊',
  'タスク': '✅',
  'スケジュール': '📅',
  'ヘルス': '🩺',
  'プレミアム': '👑',
  'その他': '·',
};

export default function QuickActions({ persona, actions }: Props) {
  // すべて表示 / フィルタ
  const [activeGroup, setActiveGroup] = useState<string>('all');

  // グルーピング
  const grouped = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const a of actions) {
      const g = a.group || AUTO_GROUP[a.id] || 'その他';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(a);
    }
    // GROUP_ORDER 順にソート
    return GROUP_ORDER
      .filter(g => map.has(g))
      .map(g => ({ name: g, actions: map.get(g)! }));
  }, [actions]);

  const filtered = activeGroup === 'all'
    ? actions
    : grouped.find(g => g.name === activeGroup)?.actions || [];

  return (
    <motion.div
      className="rounded-2xl p-3 md:p-4"
      style={{
        background: 'var(--surface-3)',
        border: '1px solid var(--border)',
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-fg text-base font-medium">⚡ クイックアクション</p>
        <p className="text-fg-muted text-xs">{filtered.length} / {actions.length} 件</p>
      </div>

      {/* カテゴリフィルタ */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        <button
          onClick={() => setActiveGroup('all')}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap"
          style={{
            background: activeGroup === 'all' ? persona.accentColor : 'var(--surface)',
            color: activeGroup === 'all' ? '#fff' : 'var(--fg-muted)',
            border: `1px solid ${activeGroup === 'all' ? persona.accentColor : 'var(--border)'}`,
          }}
        >
          すべて
        </button>
        {grouped.map(g => (
          <button
            key={g.name}
            onClick={() => setActiveGroup(g.name)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap"
            style={{
              background: activeGroup === g.name ? persona.accentColor : 'var(--surface)',
              color: activeGroup === g.name ? '#fff' : 'var(--fg-muted)',
              border: `1px solid ${activeGroup === g.name ? persona.accentColor : 'var(--border)'}`,
            }}
          >
            {GROUP_EMOJI[g.name]} {g.name} ({g.actions.length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {filtered.map((a, i) => (
          <motion.button
            key={a.id}
            onClick={a.onClick}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all"
            style={{
              background: a.primary
                ? `linear-gradient(135deg, ${persona.accentColor}25, ${persona.accentColor}10)`
                : 'var(--surface)',
              border: `1px solid ${a.primary ? persona.accentColor + '50' : 'var(--border)'}`,
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="text-2xl leading-none">{a.emoji}</span>
            <span className="text-fg text-sm font-medium leading-tight text-center">{a.label}</span>
            <span className="text-fg-muted text-[11px] leading-tight text-center hidden md:block">{a.desc}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
