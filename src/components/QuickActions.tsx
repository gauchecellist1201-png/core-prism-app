import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  BarChart3, Users, Sun, Sparkles, Zap, Search, Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Persona } from '../types/identity';
import { tactileTap, triggerHaptic, playClick } from '../lib/haptic';
// 機能アイコンは 1 か所の台帳から引く。
// (同じ機能が画面ごとに違う絵・違う色で出るのを止めるため → lib/featureIcons.ts)
import { resolveFeatureIcon } from '../lib/featureIcons';
// 検索は「変換前のひらがな」でも当たり、0 件でも近い機能を返す (行き止まり防止)
import { searchActions } from '../lib/actionSearch';

// ── カテゴリは 4 つだけ。迷子をなくす ───────────────────────────
type CatName = '今すぐ' | 'つくる' | '商い' | 'つながる';

// 0 件のときに何を見せているか。文言をこれに合わせる (見つかっているのに
// 「ありません」と言わないため)
type NearKind = 'none' | 'othercat' | 'near';

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

// 「やりたいこと」でも引けるよう、機能名以外の言葉も検索対象に。
// ひらがなの読みも入れてある: 日本語入力では「変換する前のひらがな」がそのまま
// 入力欄に流れてくるため、読みが無いと打っている最中ずっと 0 件になる。
const KEYWORDS: Record<string, string> = {
  brief: '次の一手 提案 おすすめ やること ていあん つぎのいって',
  voice: '声 録音 音声 話す メモ こえ ろくおん おんせい',
  youtube: '動画 ユーチューブ 要約 学ぶ どうが ようやく',
  shadow: '返信 メール 下書き へんしん したがき',
  kb: '資料 pdf ppt 画像 取込 読ませる ナレッジ しりょう がぞう とりこみ',
  note: 'ノート メモ 議事録 書く のーと ぎじろく',
  minutes: '会議 議事録 文字起こし 録音 かいぎ ぎじろく もじおこし',
  slides: 'スライド パワポ プレゼン 資料 powerpoint すらいど しりょう',
  nego: '交渉 練習 リハーサル 商談 こうしょう れんしゅう しょうだん',
  decision: '迷い 決める 選択 整理 まよい きめる せんたく',
  email: 'メール 仕分け 返信 めーる しわけ へんしん',
  post: 'sns 投稿 note x ツイート 文章 とうこう ぶんしょう',
  image: '画像 写真 イラスト 図 生成 がぞう しゃしん せいせい',
  engine: '記事 一気に コンテンツ note x きじ',
  invoice: '請求書 インボイス 発行 せいきゅうしょ はっこう',
  sales: '売上 売り上げ 記録 うりあげ きろく',
  pnl: '利益 損益 収支 お金 pl りえき そんえき しゅうし おかね',
  'fin-consult': '財務 コンサル 相談 改善 資金繰り 数字 経営 アドバイス ざいむ そうだん しきんぐり けいえい',
  expense: '経費 レシート 領収書 撮影 けいひ れしーと りょうしゅうしょ',
  benchmark: '比較 業界 平均 ベンチマーク ひかく ぎょうかい へいきん',
  crm: '案件 商談 顧客 管理 あんけん しょうだん こきゃく かんり',
  documents: '見積 発注 納品 請求 取引 書類 みつもり はっちゅう のうひん せいきゅう しょるい',
  people: '人 1on1 部下 メンバー 気づかい ぶか めんばー',
  team: '招待 仲間 共有 チーム しょうたい なかま きょうゆう ちーむ',
  'sales-agent': '営業 商談 リード 攻める 準備 えいぎょう しょうだん じゅんび',
  'saas-agent': 'notion gmail 操作 自動 代理 そうさ じどう だいり',
  integrations: '連携 接続 gmail watch れんけい せつぞく',
  'tasks-hub': 'タスク やること todo 一覧 たすく いちらん',
  premium: '専門 相談 戦略 法務 財務 プロ せんもん そうだん せんりゃく ほうむ',
  meet: '会議 予約 カレンダー 日程 かいぎ よやく にってい',
  health: '体調 健康 睡眠 活動 たいちょう けんこう すいみん かつどう',
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
  const map = resolveFeatureIcon(a.id);
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

  // 検索 — 機能名・説明・やりたいこと・ひらがなの読み どれでもヒット
  const q = query.trim();
  const { visible, near, nearKind } = useMemo(() => {
    const none = { visible: [] as Action[], near: [] as Action[], nearKind: 'none' as NearKind };
    const inCat = (a: Action) => ((a.group as CatName) || CATEGORY[a.id] || 'つながる') === activeCat;
    const list = activeCat === 'all' ? sortedAll : sortedAll.filter(inCat);
    if (!q) return { ...none, visible: list };

    const r = searchActions(list, q, KEYWORDS);
    if (r.hits.length > 0) return { ...none, visible: r.hits };

    // この分類には無かった。分類のせいで行き止まりにしないため、必ず全部からも探し直す。
    // (「せいきゅうしょ」を「つくる」タブで打つと、請求書は「商い」に居るので
    //  今までは "ありませんでした" だけが出て、そこで手が止まっていた)
    const whole = activeCat === 'all' ? r : searchActions(sortedAll, q, KEYWORDS);
    if (whole.hits.length > 0) return { ...none, near: whole.hits.slice(0, 3), nearKind: 'othercat' };
    if (whole.near.length > 0) return { ...none, near: whole.near, nearKind: 'near' };
    return none;
  }, [sortedAll, activeCat, q]);

  // 「もしかして」も出せない時に見せる、よく使われている 3 つ (行き止まりを作らない)
  const rescue = useMemo(
    () => (near.length > 0 ? [] : sortedAll.slice(0, 3)),
    [near, sortedAll],
  );

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
            className="py-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* 見つかっているのに「ありません」と言わない。文言は実際の結果に合わせる */}
            <p className="text-fg text-sm text-center mb-1">
              {nearKind === 'othercat'
                ? `「${query}」は、いま開いている分類の外にありました。`
                : `「${query}」そのものはありませんでした。`}
            </p>
            <p className="text-fg-muted text-xs text-center mb-3">
              {nearKind === 'othercat' ? 'こちらです。'
                : nearKind === 'near' ? 'こちらではありませんか？'
                : 'よく使われているのはこの 3 つです。'}
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(near.length > 0 ? near : rescue).map(a => (
                <Tile key={`near-${a.id}`} a={a} persona={persona} onTap={onTap} />
              ))}
            </div>
            <div className="text-center">
              <button
                onClick={() => { triggerHaptic('light'); playClick('tap'); setQuery(''); setActiveCat('all'); }}
                className="text-fg text-xs font-medium rounded-full px-4"
                style={{
                  minHeight: 44,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                ぜんぶの機能（{actions.length}）から選ぶ
              </button>
            </div>
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
