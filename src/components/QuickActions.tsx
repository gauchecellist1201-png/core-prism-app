import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  Lightbulb, Mic, Film, MailOpen, BookOpen, FileText, Quote, Palette,
  Handshake, MessagesSquare, Send, Image as ImageIcon, Radio, Receipt,
  ScrollText, BarChart3, Camera, Files, FolderKanban,
  Users, Sword, Target, Bot, CheckSquare, Crown, Calendar, HeartPulse,
  Sun, Sparkles, BarChart2, Zap, Search, Star, Link2, Calculator,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Persona } from '../types/identity';
import { tactileTap, triggerHaptic, playClick } from '../lib/haptic';

const QUICK_ICON_MAP: Record<string, { Icon: LucideIcon; color: string }> = {
  brief:        { Icon: Lightbulb,     color: '#F59E0B' },
  voice:        { Icon: Mic,           color: '#FF5C9C' },
  youtube:      { Icon: Film,          color: '#FF0033' },
  shadow:       { Icon: MailOpen,      color: '#A78BFA' },
  kb:           { Icon: BookOpen,      color: '#5BA8FF' },
  note:         { Icon: FileText,      color: '#5BA8FF' },
  minutes:      { Icon: Quote,         color: '#9088A8' },
  slides:       { Icon: Palette,       color: '#C084FC' },
  nego:         { Icon: Handshake,     color: '#FFA94D' },
  decision:     { Icon: MessagesSquare,color: '#A78BFA' },
  email:        { Icon: MailOpen,      color: '#A78BFA' },
  post:         { Icon: Send,          color: '#FF6FB5' },
  image:        { Icon: ImageIcon,     color: '#C084FC' },
  engine:       { Icon: Radio,         color: '#4ADE80' },
  invoice:      { Icon: Receipt,       color: '#5BA8FF' },
  sales:        { Icon: ScrollText,    color: '#10B981' },
  pnl:          { Icon: BarChart3,     color: '#10B981' },
  'fin-consult':{ Icon: Calculator,    color: '#10B981' },
  expense:      { Icon: Camera,        color: '#FFA94D' },
  benchmark:    { Icon: BarChart2,     color: '#5BA8FF' },
  crm:          { Icon: FolderKanban,  color: '#FFA94D' },
  documents:    { Icon: Files,         color: '#9CA3AF' },
  people:       { Icon: Users,         color: '#FF6FB5' },
  team:         { Icon: Sword,         color: '#9088A8' },
  'sales-agent':{ Icon: Target,        color: '#10B981' },
  'saas-agent': { Icon: Bot,           color: '#A78BFA' },
  integrations: { Icon: Link2,         color: '#5BA8FF' },
  'tasks-hub':  { Icon: CheckSquare,   color: '#4ADE80' },
  premium:      { Icon: Crown,         color: '#FACC15' },
  meet:         { Icon: Calendar,      color: '#5BA8FF' },
  health:       { Icon: HeartPulse,    color: '#F472B6' },
};

// ── カテゴリは 4 つだけ。迷子をなくす ───────────────────────────
type CatName = '今すぐ' | 'つくる' | '商い' | 'つながる';

const CAT_ICONS: Record<CatName, { Icon: LucideIcon; color: string }> = {
  '今すぐ':   { Icon: Sun,       color: '#FACC15' },
  'つくる':   { Icon: Sparkles,  color: '#C084FC' },
  '商い':     { Icon: BarChart3, color: '#10B981' },
  'つながる': { Icon: Users,     color: '#FF6FB5' },
};
const CAT_ORDER: CatName[] = ['今すぐ', 'つくる', '商い', 'つながる'];

// アクション ID → 4 カテゴリ
const CATEGORY: Record<string, CatName> = {
  brief: '今すぐ', voice: '今すぐ', shadow: '今すぐ', email: '今すぐ',
  'tasks-hub': '今すぐ', meet: '今すぐ', 'sales-agent': '今すぐ',
  youtube: 'つくる', kb: 'つくる', note: 'つくる', minutes: 'つくる',
  slides: 'つくる', post: 'つくる', image: 'つくる', engine: 'つくる',
  decision: 'つくる', nego: 'つくる',
  invoice: '商い', sales: '商い', pnl: '商い', 'fin-consult': '商い', expense: '商い',
  benchmark: '商い', crm: '商い', documents: '商い',
  people: 'つながる', team: 'つながる', 'saas-agent': 'つながる',
  integrations: 'つながる', premium: 'つながる', health: 'つながる',
};

// 「やりたいこと」でも引けるよう、機能名以外の言葉も検索対象に
const KEYWORDS: Record<string, string> = {
  brief: '次の一手 提案 おすすめ やること',
  voice: '声 録音 音声 話す メモ',
  youtube: '動画 ユーチューブ 要約 学ぶ',
  shadow: '返信 メール 下書き',
  kb: '資料 pdf ppt 画像 取込 読ませる ナレッジ',
  note: 'ノート メモ 議事録 書く',
  minutes: '会議 議事録 文字起こし 録音',
  slides: 'スライド パワポ プレゼン 資料 powerpoint',
  nego: '交渉 練習 リハーサル 商談',
  decision: '迷い 決める 選択 整理',
  email: 'メール 仕分け 返信',
  post: 'sns 投稿 note x ツイート 文章',
  image: '画像 写真 イラスト 図 生成',
  engine: '記事 一気に コンテンツ note x',
  invoice: '請求書 インボイス 発行',
  sales: '売上 売り上げ 記録',
  pnl: '利益 損益 収支 お金 pl',
  'fin-consult': '財務 コンサル 相談 改善 資金繰り 数字 経営 アドバイス',
  expense: '経費 レシート 領収書 撮影',
  benchmark: '比較 業界 平均 ベンチマーク',
  crm: '案件 商談 顧客 管理',
  documents: '見積 発注 納品 請求 取引 書類',
  people: '人 1on1 部下 メンバー 気づかい',
  team: '招待 仲間 共有 チーム',
  'sales-agent': '営業 商談 リード 攻める 準備',
  'saas-agent': 'notion gmail 操作 自動 代理',
  integrations: '連携 接続 gmail watch',
  'tasks-hub': 'タスク やること todo 一覧',
  premium: '専門 相談 戦略 法務 財務 プロ',
  meet: '会議 予約 カレンダー 日程',
  health: '体調 健康 睡眠 活動',
};

// ── よく使う順を覚える (localStorage) ──────────────────────────
const USAGE_KEY = 'core-qa-usage';

function loadUsage(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function recordUsage(id: string): Record<string, number> {
  const u = loadUsage();
  u[id] = (u[id] || 0) + 1;
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(u));
  } catch {
    // noop
  }
  return u;
}

interface Action {
  id: string;
  emoji?: string;
  label: string;
  desc: string;
  onClick: () => void;
  primary?: boolean;
  group?: string;
}

interface Props {
  persona: Persona;
  actions: Action[];
}

function Tile({
  a, persona, big, onTap,
}: {
  a: Action; persona: Persona; big?: boolean; onTap: (id: string) => void;
}) {
  const map = QUICK_ICON_MAP[a.id];
  const Icon = map?.Icon;
  const color = map?.color || persona.accentColor;
  const iconBox = big ? 46 : 38;
  const iconSize = big ? 24 : 20;
  return (
    <motion.button
      onClick={() => { tactileTap(); onTap(a.id); a.onClick?.(); }}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl qa-tile ${big ? 'p-4' : 'p-3'}`}
      style={{
        background: big
          ? `linear-gradient(135deg, ${color}28, ${color}0E)`
          : a.primary
            ? `linear-gradient(135deg, ${persona.accentColor}25, ${persona.accentColor}10)`
            : 'var(--surface)',
        border: `1px solid ${big ? color + '55' : a.primary ? persona.accentColor + '50' : 'var(--border)'}`,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        userSelect: 'none',
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.92, y: 1, transition: { type: 'spring', stiffness: 500, damping: 18 } }}
    >
      {Icon ? (
        <div style={{
          width: iconBox, height: iconBox, borderRadius: big ? 13 : 10,
          background: `linear-gradient(135deg, ${color}, ${color}cc)`,
          boxShadow: `0 6px 14px ${color}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={iconSize} color="#fff" strokeWidth={2.2} />
        </div>
      ) : (
        <span className="text-2xl leading-none">{a.emoji}</span>
      )}
      <span className={`text-fg font-medium leading-tight text-center ${big ? 'text-[15px]' : 'text-sm'}`}>{a.label}</span>
      <span className="text-fg-muted text-[11px] leading-tight text-center">{a.desc}</span>
    </motion.button>
  );
}

export default function QuickActions({ persona, actions }: Props) {
  const [activeCat, setActiveCat] = useState<'all' | CatName>('all');
  const [query, setQuery] = useState('');
  const [usage, setUsage] = useState<Record<string, number>>(() => loadUsage());

  const onTap = (id: string) => setUsage(recordUsage(id));

  // 「今のあなたに必要な 3 つ」= よく使う順 上位 3。記録が無ければ おすすめ 3 つ
  const topThree = useMemo(() => {
    const used = actions
      .filter(a => (usage[a.id] || 0) > 0)
      .sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0));
    const fallback = actions.filter(a => a.primary);
    const picked: Action[] = [];
    for (const a of [...used, ...fallback, ...actions]) {
      if (picked.length >= 3) break;
      if (!picked.some(p => p.id === a.id)) picked.push(a);
    }
    return picked;
  }, [actions, usage]);

  // よく使う順ソート
  const sortedAll = useMemo(() => {
    return [...actions].sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0));
  }, [actions, usage]);

  const catCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of actions) {
      const cat = (a.group as CatName) || CATEGORY[a.id] || 'つながる';
      c[cat] = (c[cat] || 0) + 1;
    }
    return c;
  }, [actions]);

  // 検索 — 機能名・説明・やりたいこと どれでもヒット
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = sortedAll;
    if (activeCat !== 'all') {
      list = list.filter(a => ((a.group as CatName) || CATEGORY[a.id] || 'つながる') === activeCat);
    }
    if (q) {
      list = list.filter(a => {
        const hay = `${a.label} ${a.desc} ${KEYWORDS[a.id] || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [sortedAll, activeCat, q]);

  return (
    <motion.div
      className="rounded-2xl p-3 md:p-4"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-fg text-base font-medium inline-flex items-center gap-2">
          <Zap size={16} color={persona.accentColor} strokeWidth={2.4} />
          クイックアクション
        </p>
      </div>

      {/* 今のあなたに必要な 3 つ */}
      {!q && topThree.length > 0 && (
        <div className="mb-4">
          <p className="text-fg-muted text-xs font-medium mb-2 inline-flex items-center gap-1.5">
            <Star size={13} color="#FACC15" strokeWidth={2.4} fill="#FACC15" />
            今のあなたに必要な 3 つ
          </p>
          <div className="grid grid-cols-3 gap-2">
            {topThree.map(a => (
              <Tile key={`top-${a.id}`} a={a} persona={persona} big onTap={onTap} />
            ))}
          </div>
        </div>
      )}

      {/* 検索 */}
      <div
        className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <Search size={15} color="var(--fg-muted)" strokeWidth={2.2} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="やりたいことで探す（例: 請求書・動画・売上）"
          className="flex-1 bg-transparent text-fg text-sm outline-none"
          style={{ minWidth: 0 }}
        />
        {query && (
          <button
            onClick={() => { triggerHaptic('light'); playClick('tap'); setQuery(''); }}
            className="text-fg-muted text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--surface-3)' }}
          >
            消す
          </button>
        )}
      </div>

      {/* カテゴリは 4 つだけ */}
      {!q && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          <button
            onClick={() => { triggerHaptic('light'); playClick('tap'); setActiveCat('all'); }}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap qa-chip"
            style={{
              background: activeCat === 'all' ? persona.accentColor : 'var(--surface)',
              color: activeCat === 'all' ? '#fff' : 'var(--fg-muted)',
              border: `1px solid ${activeCat === 'all' ? persona.accentColor : 'var(--border)'}`,
            }}
          >
            ぜんぶ ({actions.length})
          </button>
          {CAT_ORDER.filter(c => catCounts[c]).map(cat => {
            const ci = CAT_ICONS[cat];
            const CIcon = ci.Icon;
            const active = activeCat === cat;
            return (
              <button
                key={cat}
                onClick={() => { triggerHaptic('light'); playClick('tap'); setActiveCat(cat); }}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 qa-chip"
                style={{
                  background: active ? persona.accentColor : 'var(--surface)',
                  color: active ? '#fff' : 'var(--fg-muted)',
                  border: `1px solid ${active ? persona.accentColor : 'var(--border)'}`,
                }}
              >
                <CIcon size={13} strokeWidth={2.2} color={active ? '#fff' : ci.color} />
                {cat} ({catCounts[cat]})
              </button>
            );
          })}
        </div>
      )}

      {/* 一覧 */}
      <AnimatePresence mode="popLayout">
        {visible.length > 0 ? (
          <motion.div
            key={`${activeCat}-${q}`}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {visible.map(a => (
              <Tile key={a.id} a={a} persona={persona} onTap={onTap} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="text-center py-8 text-fg-muted text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            「{query}」に合う機能はありませんでした。<br />
            <span className="text-xs">別の言葉で探してみてください。</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .qa-tile {
          transition: box-shadow 0.18s ease, border-color 0.18s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .qa-tile:hover {
          box-shadow: 0 6px 18px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.04);
        }
        .qa-tile:active {
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.10), 0 1px 1px rgba(0,0,0,0.03);
        }
        .qa-chip {
          transition: transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s, border-color 0.2s, box-shadow 0.2s;
        }
        .qa-chip:active {
          transform: scale(0.94);
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);
        }
      `}</style>
    </motion.div>
  );
}
