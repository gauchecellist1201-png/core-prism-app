// ============================================================
// SevenAgentsOrbit — Prism トップの「7 エージェントが動いている」可視化
//
// LP の SPECTRUM と同じ 7 色・7 役割を、ダッシュボードトップで
// オーブ + パルス + 1 行ステータスのみで見せる。文字最小・視覚優先。
// ============================================================
import { motion } from 'framer-motion';
import {
  Compass, Briefcase, TrendingUp, Sparkles, BookOpen, Users, Heart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AgentKey = 'ceo' | 'sales' | 'cfo' | 'creative' | 'knowledge' | 'people' | 'life';

export interface AgentLive {
  key: AgentKey;
  /** いま動いている件数 (0 ならアイドル) */
  count: number;
  /** 1 行ステータス (8〜14 文字目安) */
  status: string;
  /** クリックで開く処理 */
  onClick: () => void;
}

const SPECS: Record<AgentKey, { name: string; role: string; color: string; Icon: LucideIcon }> = {
  ceo:       { name: '経営', role: 'CEO',       color: '#ff5757', Icon: Compass },
  sales:     { name: '営業', role: 'Sales',     color: '#ff9842', Icon: Briefcase },
  cfo:       { name: '財務', role: 'CFO',       color: '#fbbf24', Icon: TrendingUp },
  creative:  { name: '創造', role: 'Creative',  color: '#4ade80', Icon: Sparkles },
  knowledge: { name: '学び', role: 'Knowledge', color: '#60a5fa', Icon: BookOpen },
  people:    { name: '人材', role: 'People',    color: '#a78bfa', Icon: Users },
  life:      { name: '生活', role: 'Life',      color: '#f472b6', Icon: Heart },
};

const ORDER: AgentKey[] = ['ceo', 'sales', 'cfo', 'creative', 'knowledge', 'people', 'life'];

interface Props {
  agents: AgentLive[];
}

export default function SevenAgentsOrbit({ agents }: Props) {
  const map = new Map(agents.map(a => [a.key, a]));

  return (
    <div style={{
      position: 'relative',
      padding: '1rem 0.5rem 1.25rem',
      borderRadius: 22,
      background: 'radial-gradient(ellipse at 50% -10%, rgba(142,92,255,0.18) 0%, rgba(7,7,18,0) 60%), linear-gradient(180deg, rgba(15,15,30,0.55) 0%, rgba(7,7,18,0.55) 100%)',
      border: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      overflow: 'hidden',
    }}>
      {/* 微小な背景の光のスペクトル */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, #ff575722, #ff984222, #fbbf2422, #4ade8022, #60a5fa22, #a78bfa22, #f472b622)',
        opacity: 0.5, pointerEvents: 'none',
      }} />

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
          return (
            <motion.button
              key={key}
              type="button"
              onClick={live?.onClick}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              whileHover={{ y: -4, scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 6, padding: '0.5rem 0.25rem',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#fff', position: 'relative',
              }}
              aria-label={`${spec.name}エージェント (${live?.status ?? '待機中'})`}
            >
              {/* オーブ */}
              <div style={{ position: 'relative', width: 56, height: 56 }}>
                {/* 外側パルス (動いてるエージェントだけ強く) */}
                <motion.div
                  animate={active
                    ? { scale: [1, 1.18, 1], opacity: [0.55, 0, 0.55] }
                    : { scale: [1, 1.08, 1], opacity: [0.18, 0, 0.18] }
                  }
                  transition={{ duration: active ? 1.8 : 3.2, repeat: Infinity, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', inset: -6,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${spec.color}55 0%, transparent 70%)`,
                    pointerEvents: 'none',
                  }}
                />
                {/* オーブ本体 */}
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 24 + i * 3, repeat: Infinity, ease: 'linear' }}
                  style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    background: `conic-gradient(from ${i * 51}deg, ${spec.color}, ${spec.color}66, ${spec.color}cc, ${spec.color})`,
                    filter: active ? `drop-shadow(0 0 12px ${spec.color}aa)` : `drop-shadow(0 0 4px ${spec.color}55)`,
                  }}
                />
                {/* 中心ガラス */}
                <div style={{
                  position: 'absolute', inset: 4,
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25) 0%, ${spec.color}22 40%, rgba(7,7,18,0.85) 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${spec.color}55`,
                }}>
                  <Icon size={22} color="#fff" strokeWidth={2.2} />
                </div>
                {/* バッジ (件数があるときだけ) */}
                {count > 0 && (
                  <div style={{
                    position: 'absolute', top: -4, right: -4,
                    minWidth: 18, height: 18, padding: '0 5px',
                    borderRadius: 9,
                    background: spec.color, color: '#fff',
                    fontSize: 10, fontWeight: 800, lineHeight: '18px',
                    textAlign: 'center',
                    boxShadow: `0 4px 12px ${spec.color}88`,
                  }}>
                    {count > 99 ? '99+' : count}
                  </div>
                )}
              </div>
              {/* 名前 */}
              <div style={{
                fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
                color: '#fff', lineHeight: 1,
              }}>{spec.name}</div>
              {/* 1 行ステータス */}
              <div style={{
                fontSize: 9.5, color: active ? spec.color : 'rgba(255,255,255,0.45)',
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

      <p style={{
        marginTop: '0.5rem',
        textAlign: 'center',
        fontSize: 10, color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.2em', fontWeight: 700,
      }}>
        7 AGENTS · WORKING NOW
      </p>
    </div>
  );
}
