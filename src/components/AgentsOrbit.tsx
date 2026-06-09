// ============================================================
// AgentsOrbit — 汎用「N エージェントが生きてる」可視化
//
// Prism (7 エージェント) と Iris (6 エージェント) で共用。
// specs / conversations / agents を props で受ける。
//
// 機能面の感動 (オーナー指示 2026-05-15):
// - 各エージェントが「実データから生んだアドバイス」を持つ
// - ホバー / タップ時にそのアドバイスをタイプライターで表示
// - エージェント色のグロー + 粒子 + 脈動で「生きてる」感
// - エージェント同士の会話バナー (3.5 秒ローテーション)
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface AgentSpec {
  key: string;
  name: string;
  role: string;
  color: string;
  Icon: LucideIcon;
  /** ホバー時にタイプライターで表示される思考フレーズ (固定アドバイスが無いときのフォールバック) */
  thinking: string[];
  /**
   * 「これは何ができる?」3 行のやさしい説明。
   * ホバー / タップで必ず表示される。初見の人がこのオーブの役割を 3 秒で掴めるレベルで書く。
   */
  whatItDoes?: string[];
}

export interface AgentLive {
  key: string;
  count: number;
  status: string;
  /** 実データから生成したアドバイス (1〜2 文、やさしい日本語)。あればホバーで表示。 */
  advice?: string;
  onClick: () => void;
}

export interface AgentConversation {
  from: string; // spec.key
  msg: string;
}

interface Props {
  specs: AgentSpec[];
  /** 並び順 (key の配列) */
  order: string[];
  agents: AgentLive[];
  conversations: AgentConversation[];
  /** 一番下に出すラベル */
  footerLabel?: string;
  /** ライン用の虹色グラデーション (n 色) */
  lineColors?: string[];
}

export default function AgentsOrbit({
  specs, order, agents, conversations,
  footerLabel = 'あなたの参謀が、いま動いています',
  lineColors,
}: Props) {
  const specMap = new Map(specs.map(s => [s.key, s]));
  const liveMap = new Map(agents.map(a => [a.key, a]));
  const cols = order.length;
  const fallbackLineColors = order.map(k => specMap.get(k)?.color || '#fff');
  const usedLineColors = lineColors || fallbackLineColors;

  const [convIdx, setConvIdx] = useState(0);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [tappedKey, setTappedKey] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const burstId = useRef(0);
  // タッチ端末か (hover が無い端末は最初の 1 タップで説明を出し、2 タップ目で開く)
  const isTouchRef = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches,
  );
  // プレビュー対象: タッチでロックされていればそれ、無ければホバー中のオーブ
  const previewKey = tappedKey || hoverKey;

  // 会話バナーローテーション
  useEffect(() => {
    if (conversations.length === 0) return;
    const t = setInterval(() => setConvIdx(i => (i + 1) % conversations.length), 3500);
    return () => clearInterval(t);
  }, [conversations.length]);

  // プレビュー時のタイプライター (advice 優先、無ければ thinking のランダム)
  useEffect(() => {
    if (!previewKey) { setTyped(''); return; }
    const live = liveMap.get(previewKey);
    const spec = specMap.get(previewKey);
    const full = live?.advice || spec?.thinking[Math.floor(Math.random() * (spec?.thinking.length || 1))] || '';
    let i = 0;
    setTyped('');
    const t = setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(t);
    }, 28);
    return () => clearInterval(t);
  }, [previewKey, agents]);

  const triggerBurst = (e: React.MouseEvent, color: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const parent = (e.currentTarget as HTMLElement).closest('[data-orbit-root]') as HTMLElement;
    const pRect = parent?.getBoundingClientRect() || rect;
    const x = rect.left + rect.width / 2 - pRect.left;
    const y = rect.top + rect.height / 2 - pRect.top;
    const id = ++burstId.current;
    setBursts(b => [...b, { id, x, y, color }]);
    setTimeout(() => setBursts(b => b.filter(x => x.id !== id)), 800);
    if ('vibrate' in navigator) (navigator as any).vibrate?.(20);
  };

  const conv = conversations.length > 0 ? conversations[convIdx] : null;
  const convSpec = conv ? specMap.get(conv.from) : null;

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
      {/* 背景星雲 */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 15% 30%, ${usedLineColors[0] || '#ff5757'}1A 0%, transparent 22%), radial-gradient(circle at 85% 20%, ${usedLineColors[usedLineColors.length - 1] || '#f472b6'}1A 0%, transparent 22%), radial-gradient(circle at 50% 80%, rgba(96,165,250,0.10) 0%, transparent 28%)`,
        pointerEvents: 'none',
        animation: 'agentsOrbitNebula 18s ease-in-out infinite alternate',
      }} />

      {/* 会話バナー */}
      {conv && convSpec && (
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
              >●</motion.span>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* オーブ間ライン */}
      <svg aria-hidden style={{
        position: 'absolute', left: 0, right: 0, top: 78, height: 'calc(100% - 100px)',
        width: '100%', pointerEvents: 'none', opacity: 0.18,
      }}>
        <defs>
          <linearGradient id={`orbitLine-${cols}`} x1="0" x2="1">
            {usedLineColors.map((c, i) => (
              <stop key={i} offset={`${(i / (usedLineColors.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <line x1="7%" y1="35%" x2="93%" y2="35%" stroke={`url(#orbitLine-${cols})`} strokeWidth="1" />
      </svg>

      {/* 流れる光の粒 */}
      <FlowingParticles colors={usedLineColors.slice(0, 5)} />

      {/* オーブグリッド
          (オーナー報告 2026-06-03: iPhone で 7 列が狭すぎてオーブが潰れていた)
          - md 以上: ${cols} 列 (元のまま)
          - mobile : 自動的に 4 列 → 2 段に折り返す (orb 56px + gap 6px で 375px に収まる) */}
      <div className="orbit-grid-responsive" style={{
        position: 'relative',
        display: 'grid',
        // mobile は 4 列、md 以上は cols 列 → 下の <style> で切替
        ['--orbit-cols-desktop' as never]: String(cols),
      }}>
        {order.map((key, i) => {
          const spec = specMap.get(key);
          if (!spec) return null;
          const live = liveMap.get(key);
          const count = live?.count ?? 0;
          const active = count > 0;
          const Icon = spec.Icon;
          const pulseDur = 1.6 + i * 0.15;
          return (
            <motion.button
              key={key}
              type="button"
              onMouseEnter={() => setHoverKey(key)}
              onMouseLeave={() => setHoverKey(null)}
              onFocus={() => setHoverKey(key)}
              onBlur={() => setHoverKey(null)}
              onClick={(e) => {
                // タッチ端末: 1 タップ目は「説明を出す」、2 タップ目 (同じオーブ) で「開く」
                if (isTouchRef.current) {
                  if (tappedKey === key) {
                    setTappedKey(null);
                    triggerBurst(e, spec.color);
                    live?.onClick?.();
                  } else {
                    setTappedKey(key);
                  }
                  return;
                }
                triggerBurst(e, spec.color);
                live?.onClick?.();
              }}
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
              data-explain-id={`orbit-${key}`}
            >
              <div style={{ position: 'relative', width: 60, height: 60 }}>
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
                <div style={{
                  position: 'absolute', inset: 4,
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.32) 0%, ${spec.color}22 38%, rgba(7,7,18,0.88) 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${spec.color}66`,
                  overflow: 'hidden',
                }}>
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
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: '#fff', lineHeight: 1 }}>
                {spec.name}
              </div>
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

      {/* プレビュー: 「これは何ができる?」3 行 + ひと言アドバイス */}
      <AnimatePresence>
        {previewKey && (() => {
          const pSpec = specMap.get(previewKey);
          const pLive = liveMap.get(previewKey);
          if (!pSpec) return null;
          const showOpenCta = isTouchRef.current && tappedKey === previewKey;
          return (
            <motion.div
              key={previewKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              style={{
                margin: '0.6rem 0.8rem 0',
                padding: '12px 14px',
                borderRadius: 14,
                background: `linear-gradient(180deg, ${pSpec.color}1F 0%, ${pSpec.color}10 100%)`,
                border: `1px solid ${pSpec.color}66`,
                color: '#fff',
                textAlign: 'left',
                boxShadow: `0 10px 28px ${pSpec.color}33`,
              }}
            >
              {/* ヘッダー: 名前 + 役割 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.3), ${pSpec.color}cc 60%, ${pSpec.color})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 0 14px ${pSpec.color}66`,
                  flexShrink: 0,
                }}>
                  <pSpec.Icon size={13} color="#fff" strokeWidth={2.4} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ color: pSpec.color, fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}>
                    {pSpec.name}
                  </span>
                  <span style={{ opacity: 0.55, fontSize: 10, letterSpacing: '0.12em' }}>
                    {pSpec.role}
                  </span>
                </div>
                <span style={{ opacity: 0.5, fontSize: 10, fontWeight: 700 }}>これは何ができる?</span>
              </div>

              {/* できること 3 行 */}
              {pSpec.whatItDoes && pSpec.whatItDoes.length > 0 && (
                <ul style={{
                  listStyle: 'none', padding: 0, margin: '0 0 6px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  {pSpec.whatItDoes.map((line, idx) => (
                    <li key={idx} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.95)',
                    }}>
                      <span style={{
                        color: pSpec.color, fontWeight: 800, fontSize: 12,
                        flexShrink: 0, marginTop: 1,
                      }}>✓</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* ひと言アドバイス (タイプライター) */}
              {typed && (
                <div style={{
                  marginTop: 8, paddingTop: 8,
                  borderTop: `1px dashed ${pSpec.color}44`,
                  display: 'flex', alignItems: 'baseline', gap: 8,
                  fontFamily: '"SF Mono", Menlo, monospace',
                  fontSize: 11.5, lineHeight: 1.5,
                }}>
                  <span style={{ color: pSpec.color, fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', flexShrink: 0 }}>
                    ひと言
                  </span>
                  <span style={{ opacity: 0.92 }}>
                    {typed}
                    <span style={{ animation: 'agentsOrbitCaret 0.8s infinite' }}>▎</span>
                  </span>
                </div>
              )}

              {/* タッチ端末: 2 タップ目で開く CTA */}
              {showOpenCta && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTappedKey(null);
                    pLive?.onClick?.();
                  }}
                  style={{
                    marginTop: 10,
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: `linear-gradient(135deg, ${pSpec.color} 0%, ${pSpec.color}cc 100%)`,
                    color: '#fff',
                    fontSize: 13, fontWeight: 800, letterSpacing: '0.05em',
                    cursor: 'pointer',
                    boxShadow: `0 6px 18px ${pSpec.color}66`,
                  }}
                >
                  {pSpec.name}を開く →
                </button>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <p style={{
        marginTop: '0.6rem',
        textAlign: 'center',
        fontSize: 10, color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.25em', fontWeight: 700,
      }}>
        {footerLabel}
      </p>

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
        @keyframes agentsOrbitNebula {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(-2%, -1%); }
        }
        @keyframes agentsOrbitCaret {
          0%, 50%   { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        /* グリッド: 既定 (mobile) は 4 列で 2 段に折り返す。md 以上は元の cols 列。
           (オーナー報告 2026-06-03: iPhone で 7 列がはみ出し/文字キレ) */
        .orbit-grid-responsive {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem 0.35rem;
          padding: 0.35rem 0.5rem;
        }
        @media (min-width: 768px) {
          .orbit-grid-responsive {
            grid-template-columns: repeat(var(--orbit-cols-desktop), minmax(0, 1fr));
            gap: 0.4rem;
            padding: 0.25rem 0.4rem;
          }
        }
        /* iPhone: オーブ・ラベルを縮小して 4 列でも息ができる余白に */
        @media (max-width: 767px) {
          .orbit-grid-responsive > button > div:first-child { width: 48px !important; height: 48px !important; }
          .orbit-grid-responsive > button > div:first-child svg { width: 18px !important; height: 18px !important; }
          .orbit-grid-responsive > button > div:nth-child(2) { font-size: 11px !important; }
          .orbit-grid-responsive > button > div:nth-child(3) {
            font-size: 10.5px !important;
            min-height: 0 !important;
            max-width: 100% !important;
            line-height: 1.3 !important;
          }
        }
      `}</style>
    </div>
  );
}

function FlowingParticles({ colors }: { colors: string[] }) {
  return (
    <div aria-hidden style={{
      position: 'absolute', left: 0, right: 0, top: 78,
      height: 'calc(100% - 100px)',
      pointerEvents: 'none', overflow: 'hidden',
    }}>
      {colors.map((c, i) => (
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
            background: c,
            boxShadow: `0 0 12px ${c}`,
          }}
        />
      ))}
    </div>
  );
}
