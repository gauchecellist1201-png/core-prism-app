// ============================================================
// SevenAgentsOrbit v2 — 7 エージェントが「生きている」可視化
//
// オーナー指示 (2026-05-15): 入力するだけで感動しない、生命感を出す。
//
// v2 で入れた演出:
// - 上部に AI の吹き出し: エージェント間の会話を 3 秒ごとローテーション
// - 各オーブ間を薄い光線で接続、光の粒が時々流れる (情報がやり取りされてる感)
// - 各オーブの中で脈動・粒子・回転 (生きてる感)
// - ホバーで「今これを考えています」がタイプライター表示
// - クリックで爆発エフェクト + 触感フィードバック
// - エージェントごとに違うリズムで脈動
// ============================================================
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, Briefcase, TrendingUp, Sparkles, BookOpen, Users, Heart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AgentKey = 'ceo' | 'sales' | 'cfo' | 'creative' | 'knowledge' | 'people' | 'life';

export interface AgentLive {
  key: AgentKey;
  count: number;
  status: string;
  onClick: () => void;
}

const SPECS: Record<AgentKey, {
  name: string; role: string; color: string; Icon: LucideIcon;
  tagline: string;          // 1 行で「この人は何屋さん?」
  canDo: [string, string, string];  // 3 つの具体的にできること
  thinking: string[];
}> = {
  ceo: {
    name: '経営', role: 'CEO', color: '#ff5757', Icon: Compass,
    tagline: 'あなたの代わりに「次、何やる?」を決める参謀',
    canDo: [
      '今月の数字を見て優先順位を組み直す',
      '会社の方針を 3 行にまとめる',
      'リスクや見落としを先に教えてくれる',
    ],
    thinking: ['次の一手を考えています', '今月の数字を見直しています', '優先順位を組み直しています', 'リスクを洗い出しています'],
  },
  sales: {
    name: '営業', role: 'Sales', color: '#ff9842', Icon: Briefcase,
    tagline: '見込み客を探して、提案文まで下書きしてくれる営業マン',
    canDo: [
      '新しい見込みのお客さんを探してリストにする',
      '商談メモから提案文を 3 通り書き分ける',
      '断られそうな反論への返しを用意しておく',
    ],
    thinking: ['見込みのお客さんを探しています', '商談メモを整理しています', '提案文を下書きしています', '反論への返しを用意しています'],
  },
  cfo: {
    name: '財務', role: 'CFO', color: '#fbbf24', Icon: TrendingUp,
    tagline: 'お金の流れを見張ってくれる経理部長',
    canDo: [
      '今月の売上を自動で集計してグラフにする',
      '来月以降の現金残高を予測する',
      '経費レシートを科目ごとに振り分ける',
    ],
    thinking: ['今月の売上を集計しています', 'キャッシュを予測しています', '経費を分類しています', '請求書の発行待ちを確認しています'],
  },
  creative: {
    name: '創造', role: 'Creative', color: '#4ade80', Icon: Sparkles,
    tagline: '画像・原稿・スライドをぱっと作るデザイン担当',
    canDo: [
      '指示 1 行から SNS 画像をその場で作る',
      '原稿の骨組みと見出しを下書きする',
      'プレゼン資料の構成を整える',
    ],
    thinking: ['画像を構図しています', '原稿の骨組みを考えています', 'ブランドの色を整えています', 'スライドの順番を組み直しています'],
  },
  knowledge: {
    name: '学び', role: 'Knowledge', color: '#60a5fa', Icon: BookOpen,
    tagline: '読んだ資料を全部覚えてくれる図書館の司書',
    canDo: [
      'PDF や議事録を読み込んで要点だけ抜く',
      '「あの件、過去にどう言ってた?」を即答する',
      '関連する社内の話を横断でつなげる',
    ],
    thinking: ['資料を読み込んでいます', '関連する文脈を結びつけています', '要点を抜き出しています', '横断検索の道を作っています'],
  },
  people: {
    name: '人材', role: 'People', color: '#a78bfa', Icon: Users,
    tagline: 'チームの空気と人間関係を見ているマネージャー',
    canDo: [
      '1on1 で何を話せばいいか準備する',
      '採用候補のメモを整理して比較表を作る',
      '相手に合わせて言葉づかいを直す',
    ],
    thinking: ['チームの空気を読んでいます', '1on1 の話題を準備しています', '採用候補を整理しています', '言葉づかいを調整しています'],
  },
  life: {
    name: '生活', role: 'Life', color: '#f472b6', Icon: Heart,
    tagline: 'あなた自身の調子と暮らしを整えるパートナー',
    canDo: [
      '今日の睡眠・体調から無理なリズムを警告する',
      '休む時間と集中時間を 1 日に組み込む',
      '家族や個人の予定も忘れずに教える',
    ],
    thinking: ['睡眠の質を見ています', '今日のリズムを設計しています', '心の余白を見守っています', '家族の予定を整えています'],
  },
};

const ORDER: AgentKey[] = ['ceo', 'sales', 'cfo', 'creative', 'knowledge', 'people', 'life'];

// エージェント同士の会話 (吹き出しに流れる)
const CONVERSATIONS: { from: AgentKey; msg: string }[] = [
  { from: 'ceo',       msg: '営業さん、今月の有望案件 3 つに集中しよう' },
  { from: 'sales',     msg: '了解。Aさんに今日中に下書きを送ります' },
  { from: 'cfo',       msg: '財務から見ると粗利 38% の案件を優先で' },
  { from: 'creative',  msg: '提案資料のビジュアルは今夜整えます' },
  { from: 'knowledge', msg: '過去の似た案件 5 件を読み込み済み、参考にどうぞ' },
  { from: 'people',    msg: '担当者の好みは「数字より物語」型でした' },
  { from: 'life',      msg: '今日は午後 3 時に少し休むのがいいリズムです' },
  { from: 'ceo',       msg: 'ありがとう。みんなで進めよう' },
  { from: 'sales',     msg: '新しい見込み客 2 件追加しました' },
  { from: 'cfo',       msg: '今月の売上、目標の 78% に達しています' },
];

interface Props {
  agents: AgentLive[];
}

export default function SevenAgentsOrbit({ agents }: Props) {
  const map = new Map(agents.map(a => [a.key, a]));
  const [convIdx, setConvIdx] = useState(0);
  const [hoverKey, setHoverKey] = useState<AgentKey | null>(null);
  const [hoverThinking, setHoverThinking] = useState('');
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const burstId = useRef(0);

  // 「できること」自動ローテーション (4 秒ごとに 7 人を順に紹介)
  const [spotIdx, setSpotIdx] = useState(0);

  // 会話を 3.5 秒ごとに切替
  useEffect(() => {
    const t = setInterval(() => setConvIdx(i => (i + 1) % CONVERSATIONS.length), 3500);
    return () => clearInterval(t);
  }, []);

  // 「できること」紹介を 4 秒ごとに切替 (ホバー中は停止)
  useEffect(() => {
    if (hoverKey) return;
    const t = setInterval(() => setSpotIdx(i => (i + 1) % ORDER.length), 4000);
    return () => clearInterval(t);
  }, [hoverKey]);

  // ホバー時のタイプライター
  useEffect(() => {
    if (!hoverKey) { setHoverThinking(''); return; }
    const spec = SPECS[hoverKey];
    const full = spec.thinking[Math.floor(Math.random() * spec.thinking.length)];
    let i = 0;
    setHoverThinking('');
    const t = setInterval(() => {
      i += 1;
      setHoverThinking(full.slice(0, i));
      if (i >= full.length) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, [hoverKey]);

  const triggerBurst = (e: React.MouseEvent, color: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const parent = (e.currentTarget as HTMLElement).closest('[data-orbit-root]') as HTMLElement;
    const pRect = parent?.getBoundingClientRect() || rect;
    const x = rect.left + rect.width / 2 - pRect.left;
    const y = rect.top + rect.height / 2 - pRect.top;
    const id = ++burstId.current;
    setBursts(b => [...b, { id, x, y, color }]);
    setTimeout(() => setBursts(b => b.filter(x => x.id !== id)), 800);
    // 触感フィードバック (対応端末のみ)
    if ('vibrate' in navigator) (navigator as any).vibrate?.(20);
  };

  const conv = CONVERSATIONS[convIdx];
  const convSpec = SPECS[conv.from];

  return (
    <div
      data-orbit-root
      style={{
        position: 'relative',
        padding: '1rem 0.5rem 1.25rem',
        borderRadius: 22,
        background: 'radial-gradient(ellipse at 50% -10%, rgba(142,92,255,0.22) 0%, rgba(7,7,18,0) 60%), linear-gradient(180deg, rgba(15,15,30,0.6) 0%, rgba(7,7,18,0.6) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        overflow: 'hidden',
      }}
    >
      {/* 背景の星雲 */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 15% 30%, rgba(255,87,87,0.10) 0%, transparent 22%), radial-gradient(circle at 85% 20%, rgba(244,114,182,0.10) 0%, transparent 22%), radial-gradient(circle at 50% 80%, rgba(96,165,250,0.10) 0%, transparent 28%)',
        pointerEvents: 'none',
        animation: 'orbitNebula 18s ease-in-out infinite alternate',
      }} />

      {/* エージェント間の会話バナー */}
      <div style={{
        position: 'relative',
        margin: '0 0.5rem 0.6rem',
        minHeight: 40,
        padding: '8px 14px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 10,
        overflow: 'hidden',
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={convIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.3), ${convSpec.color}cc 60%, ${convSpec.color})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 18px ${convSpec.color}66`,
              flexShrink: 0,
            }}>
              <convSpec.Icon size={14} color="#fff" strokeWidth={2.4} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9.5, color: convSpec.color, fontWeight: 800, letterSpacing: '0.1em', lineHeight: 1 }}>
                {convSpec.name.toUpperCase()}
              </div>
              <div style={{ fontSize: 12, color: '#fff', opacity: 0.92, lineHeight: 1.35, marginTop: 2 }}>
                {conv.msg}
              </div>
            </div>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}
            >
              ●
            </motion.span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* オーブ間を結ぶ薄いライン (SVG) */}
      <svg aria-hidden style={{
        position: 'absolute', left: 0, right: 0, top: 78, height: 'calc(100% - 100px)',
        width: '100%', pointerEvents: 'none', opacity: 0.18,
      }}>
        <defs>
          <linearGradient id="orbitLine" x1="0" x2="1">
            <stop offset="0%" stopColor="#ff5757" />
            <stop offset="20%" stopColor="#ff9842" />
            <stop offset="40%" stopColor="#fbbf24" />
            <stop offset="55%" stopColor="#4ade80" />
            <stop offset="70%" stopColor="#60a5fa" />
            <stop offset="85%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <line x1="7%" y1="35%" x2="93%" y2="35%" stroke="url(#orbitLine)" strokeWidth="1" />
      </svg>

      {/* 光の粒が流れる */}
      <FlowingParticles />

      {/* オーブグリッド */}
      <div style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: '0.4rem',
        padding: '0.25rem 0.4rem',
      }}>
        {ORDER.map((key, i) => {
          const spec = SPECS[key];
          const live = map.get(key);
          const count = live?.count ?? 0;
          const active = count > 0;
          const Icon = spec.Icon;
          const pulseDur = 1.6 + i * 0.15; // 各エージェントで違うリズム
          return (
            <motion.button
              key={key}
              type="button"
              onMouseEnter={() => setHoverKey(key)}
              onMouseLeave={() => setHoverKey(null)}
              onPointerEnter={() => setHoverKey(key)}
              onClick={(e) => { triggerBurst(e, spec.color); live?.onClick?.(); }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              whileHover={{ y: -6, scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 6, padding: '0.55rem 0.25rem 0.45rem',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#fff', position: 'relative',
              }}
              aria-label={`${spec.name}エージェント (${live?.status ?? '待機中'})`}
            >
              {/* オーブ */}
              <div style={{ position: 'relative', width: 60, height: 60 }}>
                {/* 外側の脈動光輪 */}
                <motion.div
                  animate={active
                    ? { scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }
                    : { scale: [1, 1.1, 1], opacity: [0.2, 0, 0.2] }}
                  transition={{ duration: pulseDur, repeat: Infinity, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', inset: -8,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${spec.color}66 0%, transparent 70%)`,
                    pointerEvents: 'none',
                  }}
                />
                {/* 第 2 リング (より遅く、外へ) */}
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.35, 0, 0.35] }}
                  transition={{ duration: pulseDur * 1.8, repeat: Infinity, ease: 'easeOut', delay: pulseDur * 0.4 }}
                  style={{
                    position: 'absolute', inset: -4,
                    borderRadius: '50%',
                    border: `1px solid ${spec.color}88`,
                    pointerEvents: 'none',
                  }}
                />
                {/* 回転するグラデーション本体 */}
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20 + i * 2, repeat: Infinity, ease: 'linear' }}
                  style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    background: `conic-gradient(from ${i * 51}deg, ${spec.color}, ${spec.color}33, ${spec.color}cc, ${spec.color}66, ${spec.color})`,
                    filter: active ? `drop-shadow(0 0 14px ${spec.color}cc)` : `drop-shadow(0 0 6px ${spec.color}66)`,
                  }}
                />
                {/* 中央ガラス + 内側の粒子 */}
                <div style={{
                  position: 'absolute', inset: 4,
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.32) 0%, ${spec.color}22 38%, rgba(7,7,18,0.88) 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${spec.color}66`,
                  overflow: 'hidden',
                }}>
                  {/* 内側に揺れる粒子 (生命感) */}
                  {active && [0, 1, 2].map(p => (
                    <motion.div
                      key={p}
                      animate={{
                        x: [0, 8 * Math.cos(p), -8 * Math.cos(p), 0],
                        y: [0, 8 * Math.sin(p + 1), -8 * Math.sin(p + 1), 0],
                        opacity: [0.4, 0.9, 0.4],
                      }}
                      transition={{ duration: 2 + p * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute',
                        width: 4, height: 4, borderRadius: '50%',
                        background: spec.color,
                        boxShadow: `0 0 8px ${spec.color}`,
                      }}
                    />
                  ))}
                  <motion.div
                    animate={active ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ duration: pulseDur, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ position: 'relative', zIndex: 2, display: 'flex' }}
                  >
                    <Icon size={22} color="#fff" strokeWidth={2.2} />
                  </motion.div>
                </div>
                {/* 件数バッジ */}
                {count > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 220 }}
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      minWidth: 18, height: 18, padding: '0 5px',
                      borderRadius: 9,
                      background: spec.color, color: '#fff',
                      fontSize: 10, fontWeight: 800, lineHeight: '18px',
                      textAlign: 'center',
                      boxShadow: `0 4px 12px ${spec.color}cc`,
                    }}
                  >
                    {count > 99 ? '99+' : count}
                  </motion.div>
                )}
              </div>
              {/* 名前 */}
              <div style={{
                fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
                color: '#fff', lineHeight: 1,
              }}>{spec.name}</div>
              {/* 1 行ステータス */}
              <div style={{
                fontSize: 9.5, color: active ? spec.color : 'rgba(255,255,255,0.5)',
                fontWeight: 600, lineHeight: 1.25,
                textAlign: 'center', minHeight: '2.2em',
                maxWidth: 80, wordBreak: 'keep-all',
              }}>
                {live?.status || '待機中'}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* 「これは何ができる?」スポットライト
          ホバー中 → ホバーしたエージェント
          ホバー外 → 4 秒ごとに 7 人を順番に紹介 */}
      {(() => {
        const focusKey: AgentKey = hoverKey ?? ORDER[spotIdx];
        const spec = SPECS[focusKey];
        const live = map.get(focusKey);
        return (
          <div style={{
            position: 'relative',
            margin: '0.5rem 0.6rem 0.2rem',
            padding: '0.7rem 0.95rem 0.75rem',
            borderRadius: 14,
            background: `linear-gradient(135deg, ${spec.color}18 0%, rgba(7,7,18,0.55) 100%)`,
            border: `1px solid ${spec.color}55`,
            overflow: 'hidden',
            minHeight: 118,
          }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={focusKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
              >
                {/* ヘッダ: 名前 + ロール + 今動いているか */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.3), ${spec.color})`,
                    boxShadow: `0 0 12px ${spec.color}aa`,
                  }}>
                    <spec.Icon size={12} color="#fff" strokeWidth={2.4} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>
                    {spec.name}エージェント
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
                    color: spec.color, opacity: 0.9,
                  }}>
                    {spec.role.toUpperCase()}
                  </span>
                  {(live?.count ?? 0) > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 10, fontWeight: 700,
                      color: spec.color, opacity: 0.95,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: spec.color, display: 'inline-block' }}
                      />
                      今動いています
                    </span>
                  )}
                </div>

                {/* タグライン: この人は何屋さんか */}
                <div style={{
                  fontSize: 11.5, color: 'rgba(255,255,255,0.85)',
                  lineHeight: 1.45, marginBottom: 6,
                }}>
                  {spec.tagline}
                </div>

                {/* 3 つのできること */}
                <ul style={{
                  listStyle: 'none', padding: 0, margin: 0,
                  display: 'grid', gap: 3,
                }}>
                  {spec.canDo.map((line, i) => (
                    <li key={i} style={{
                      display: 'flex', gap: 7, alignItems: 'flex-start',
                      fontSize: 11, color: '#fff', opacity: 0.92, lineHeight: 1.45,
                    }}>
                      <span style={{
                        flexShrink: 0, marginTop: 5,
                        width: 4, height: 4, borderRadius: '50%',
                        background: spec.color,
                        boxShadow: `0 0 6px ${spec.color}`,
                      }} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                {/* 思考タイプライター (ホバー時のみ) */}
                {hoverKey && hoverThinking && (
                  <div style={{
                    marginTop: 7,
                    fontSize: 10, color: spec.color, opacity: 0.85,
                    fontFamily: '"SF Mono", Menlo, monospace',
                    lineHeight: 1.4,
                  }}>
                    今ちょうど: {hoverThinking}
                    <span style={{ animation: 'orbitCaretBlink 0.8s infinite' }}>▎</span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* ローテーション進捗インジケーター (ホバー外のみ) */}
            {!hoverKey && (
              <div style={{
                display: 'flex', gap: 3, justifyContent: 'center',
                marginTop: 7,
              }}>
                {ORDER.map((k, i) => (
                  <span key={k} style={{
                    width: i === spotIdx ? 14 : 4,
                    height: 3, borderRadius: 2,
                    background: i === spotIdx ? SPECS[k].color : 'rgba(255,255,255,0.18)',
                    transition: 'all 0.4s ease',
                  }} />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <p style={{
        marginTop: '0.55rem',
        textAlign: 'center',
        fontSize: 10, color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.2em', fontWeight: 700,
        lineHeight: 1.5,
      }}>
        触ると詳しく見えます · タップでそのエージェントを開きます
      </p>

      {/* クリック爆発エフェクト */}
      <AnimatePresence>
        {bursts.map(b => (
          <motion.div
            key={b.id}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: b.x - 40, top: b.y - 40,
              width: 80, height: 80,
              borderRadius: '50%',
              border: `2px solid ${b.color}`,
              boxShadow: `0 0 40px ${b.color}, inset 0 0 30px ${b.color}55`,
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />
        ))}
      </AnimatePresence>

      <style>{`
        @keyframes orbitNebula {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(-2%, -1%); }
        }
        @keyframes orbitCaretBlink {
          0%, 50%   { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// 光の粒が左から右へ流れる (情報がやり取りされてる感)
function FlowingParticles() {
  return (
    <div aria-hidden style={{
      position: 'absolute', left: 0, right: 0, top: 78,
      height: 'calc(100% - 100px)',
      pointerEvents: 'none', overflow: 'hidden',
    }}>
      {[0, 1, 2, 3, 4].map(i => (
        <motion.div
          key={i}
          initial={{ x: '-5%', opacity: 0 }}
          animate={{ x: '105%', opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 3.5 + i * 0.4,
            repeat: Infinity,
            delay: i * 1.2,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            top: `${20 + i * 8}%`,
            width: 6, height: 6,
            borderRadius: '50%',
            background: ['#ff5757', '#fbbf24', '#4ade80', '#60a5fa', '#f472b6'][i],
            boxShadow: `0 0 12px ${['#ff5757', '#fbbf24', '#4ade80', '#60a5fa', '#f472b6'][i]}`,
          }}
        />
      ))}
    </div>
  );
}
