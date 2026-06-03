// ============================================================
// CxoProfileModal — CXO 役員の人格 詳細 (経歴 / 得意 / 苦手 / 名言)
//
// オーナー指示 (2026-06-04 第 24 波 JJJJ):
//   AgentTeamMonitor の 14 ピル の popover を発展させ、
//   リッチな「人物プロフィール」モーダルに。
// ============================================================

import { motion, AnimatePresence } from 'framer-motion';
import { X, Briefcase, ThumbsUp, AlertTriangle, Quote, Heart } from 'lucide-react';
import { CXO_META, cxoDisplayName, cxoNickname, type CxoRole } from '../hooks/useAgentTaskQueue';
import { getCxoProfile } from '../lib/cxoProfiles';

interface Props {
  role: CxoRole | null;
  onClose: () => void;
  /** 「この役員にいま頼む」CTA — 親が onAssign を渡せばボタン表示 */
  onAssign?: (role: CxoRole) => void;
}

export default function CxoProfileModal({ role, onClose, onAssign }: Props) {
  const open = !!role;
  const meta = role ? CXO_META[role] : null;
  const profile = role ? getCxoProfile(role) : null;

  return (
    <AnimatePresence>
      {open && meta && profile && role && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 110,
            background: 'rgba(0,0,12,0.7)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 12px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(560px, 100%)',
              maxHeight: 'calc(100vh - 48px)',
              background: 'rgba(15,14,27,0.98)',
              border: `1px solid ${meta.color}55`,
              borderRadius: 20,
              color: '#fff',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: `0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px ${meta.color}22`,
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              background: `linear-gradient(180deg, ${meta.color}22 0%, transparent 100%)`,
              borderBottom: `1px solid ${meta.color}33`,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)`,
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30,
                flexShrink: 0,
                boxShadow: `0 8px 24px ${meta.color}55`,
              }}>{meta.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10, letterSpacing: '0.25em',
                  color: meta.color, fontWeight: 800, marginBottom: 2,
                }}>{meta.shortLabel}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, lineHeight: 1.3 }}>
                  {cxoNickname(role)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                  {meta.tagline}
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="閉じる"
                style={{
                  width: 30, height: 30, borderRadius: 15,
                  background: 'rgba(255,255,255,0.08)', border: 'none',
                  color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              ><X size={14} /></button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {/* Personality */}
              <div style={{
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 10,
                marginBottom: 14,
                fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.82)',
                lineHeight: 1.7,
                fontStyle: 'italic',
                borderLeft: `3px solid ${meta.color}`,
              }}>
                {profile.personality}
              </div>

              {/* Career */}
              <Section icon={<Briefcase size={13} />} title="経歴" color={meta.color}>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.75 }}>
                  {profile.career.map((c, i) => <li key={i} style={{ marginBottom: 3 }}>{c}</li>)}
                </ul>
              </Section>

              {/* Strengths / Weaknesses 並列 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.3)',
                  borderRadius: 10,
                }}>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.1em',
                    color: '#34D399', fontWeight: 800, marginBottom: 5,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <ThumbsUp size={11} /> 得意
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.7 }}>
                    {profile.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  borderRadius: 10,
                }}>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.1em',
                    color: '#FBBF24', fontWeight: 800, marginBottom: 5,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <AlertTriangle size={11} /> 苦手
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.7 }}>
                    {profile.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>

              {/* Motto */}
              <div style={{
                marginTop: 14,
                padding: '14px 16px',
                background: `linear-gradient(135deg, ${meta.color}18, transparent)`,
                border: `1px solid ${meta.color}44`,
                borderRadius: 12,
                position: 'relative',
              }}>
                <Quote size={20} color={meta.color} style={{ position: 'absolute', top: 8, left: 10, opacity: 0.6 }} />
                <div style={{
                  fontSize: '0.92rem', fontWeight: 700,
                  color: '#fff', lineHeight: 1.6,
                  paddingLeft: 28, fontStyle: 'italic',
                }}>
                  {profile.motto}
                </div>
                <div style={{
                  marginTop: 6, paddingLeft: 28,
                  fontSize: 10, color: 'rgba(255,255,255,0.5)',
                  textAlign: 'right',
                }}>
                  — {cxoDisplayName(role)}
                </div>
              </div>

              {/* canDo (今 任せられること) */}
              {meta.canDo?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.15em',
                    color: 'rgba(255,255,255,0.55)', fontWeight: 700,
                    marginBottom: 8,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <Heart size={10} /> いま任せられること
                  </div>
                  {meta.canDo.map((task, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      fontSize: 12, color: 'rgba(255,255,255,0.85)',
                      marginBottom: 4, lineHeight: 1.55,
                    }}>
                      ▸ {task}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer CTA */}
            {onAssign && (
              <div style={{
                padding: '12px 18px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
              }}>
                <button
                  onClick={() => { onAssign(role); onClose(); }}
                  style={{
                    width: '100%',
                    padding: '11px 0',
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
                    color: '#fff',
                    border: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: `0 10px 22px ${meta.color}44`,
                  }}
                >
                  ✨ {cxoNickname(role)} にいま頼む
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, letterSpacing: '0.15em',
        fontWeight: 800, color, marginBottom: 6,
      }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}
