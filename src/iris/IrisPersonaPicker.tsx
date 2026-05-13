// ============================================================
// CORE Iris ▸ Persona Picker
// Iris のキャラクターを 6 つから選ぶ。選択でシステムプロンプトの口調が切替
// ============================================================
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Flower, Eye, Sparkles, Moon, Gem, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useIrisBond, IRIS_PERSONAS, type IrisPersonaId, type IrisPersonaIconId } from './useIrisBond';
import { IRIS_FONTS, type IrisBackgroundDef } from './irisStyle';

const ICON_MAP: Record<IrisPersonaIconId, LucideIcon> = {
  flower: Flower,
  eye: Eye,
  sparkles: Sparkles,
  moon: Moon,
  gem: Gem,
  zap: Zap,
};

interface Props {
  bg: IrisBackgroundDef;
  /** モーダル表示 */
  open: boolean;
  onClose: () => void;
}

export default function IrisPersonaPicker({ bg, open, onClose }: Props) {
  const bond = useIrisBond();
  const current = bond.personaId;

  const choose = (id: IrisPersonaId) => {
    bond.setPersona(id);
    setTimeout(onClose, 220);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(20,8,32,0.55)',
            backdropFilter: 'blur(8px)',
            zIndex: 1500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}>
          <motion.div
            initial={{ y: 16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 540,
              maxHeight: '88vh', overflowY: 'auto',
              background: '#fff',
              borderRadius: 22,
              padding: '1.4rem 1.25rem 1.6rem',
              fontFamily: IRIS_FONTS.body,
              color: bg.ink,
              boxShadow: `0 30px 90px ${bg.accent}33`,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.7rem' }}>
              <div>
                <div style={{
                  fontSize: '0.6rem', letterSpacing: '0.22em',
                  color: bg.accent, fontWeight: 800, marginBottom: 6,
                }}>
                  IRIS PERSONALITY
                </div>
                <h2 style={{
                  margin: 0, fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
                  fontSize: '1.55rem', fontWeight: 500, letterSpacing: '-0.01em',
                }}>
                  Iris のキャラクター
                </h2>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: bg.inkSoft, lineHeight: 1.6 }}>
                  選ぶと、Iris の口調と提案のトーンがそのキャラクターに切り替わる。いつでも変更可。
                </p>
              </div>
              <button onClick={onClose} aria-label="閉じる" style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: bg.inkSoft, padding: 4,
              }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 9, marginTop: '1rem' }}>
              {IRIS_PERSONAS.map(p => {
                const selected = p.id === current;
                const Icon = ICON_MAP[p.iconId];
                return (
                  <button
                    key={p.id}
                    onClick={() => choose(p.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '42px 1fr 22px',
                      alignItems: 'center', gap: 12,
                      padding: '0.85rem 1rem',
                      background: selected
                        ? `linear-gradient(135deg, ${p.accentColor}1a, ${p.accentColor}08)`
                        : 'rgba(250,248,253,0.7)',
                      border: `1.5px solid ${selected ? p.accentColor : '#EEE6F4'}`,
                      borderRadius: 16,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'all 0.18s',
                    }}
                    onMouseEnter={e => {
                      if (!selected) {
                        e.currentTarget.style.background = `${p.accentColor}10`;
                        e.currentTarget.style.borderColor = `${p.accentColor}66`;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!selected) {
                        e.currentTarget.style.background = 'rgba(250,248,253,0.7)';
                        e.currentTarget.style.borderColor = '#EEE6F4';
                      }
                    }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${p.accentColor}, ${p.accentColor}aa)`,
                      color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'inherit',
                    }}>
                      <Icon size={20} strokeWidth={2.2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.96rem', color: bg.ink, marginBottom: 2 }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: bg.inkSoft, lineHeight: 1.5 }}>
                        {p.title}
                      </div>
                    </div>
                    {selected && (
                      <Check size={20} color={p.accentColor} strokeWidth={3} />
                    )}
                  </button>
                );
              })}
            </div>

            <p style={{
              margin: '1.1rem 0 0',
              fontSize: '0.7rem',
              color: bg.inkSoft,
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              キャラクターはあなたの端末にだけ保存される。サーバー送信なし。
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
