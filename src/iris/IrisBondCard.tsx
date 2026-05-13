// ============================================================
// CORE Iris ▸ Bond Card
// 「Iris と仲良くなる」プロフィール深堀り UI
// ・押し付けがましくない (1 度に 1 質問、スキップ可)
// ・親密度メーターでゲーミフィケーション
// ・回答するたびに Iris の口調 / 提案が個人最適化
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, X, Check, ChevronRight, Star } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { useIrisBond, LEVEL_VIBE } from './useIrisBond';

interface Props {
  bg: IrisBackgroundDef;
  /** Home 上での通常表示 (false で intimacy panel として強制表示) */
  variant?: 'inline' | 'modal';
}

export default function IrisBondCard({ bg, variant = 'inline' }: Props) {
  const bond = useIrisBond();
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [multiValue, setMultiValue] = useState<string[]>([]);

  const q = bond.nextQuestion;
  const vibe = LEVEL_VIBE[bond.level];

  // ─── 答えを保存 ─────
  const submit = (val: string | string[] | number) => {
    if (!q) return;
    bond.answer(q, val);
    setInputValue('');
    setMultiValue([]);
  };

  // ─── 全回答済 ─────
  if (!q && variant === 'inline') {
    return (
      <div style={{
        padding: '0.95rem 1.1rem',
        background: `linear-gradient(135deg, ${bg.accent}10, transparent)`,
        border: `1px solid ${bg.accent}30`,
        borderRadius: 14,
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: bg.accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Heart size={18} fill="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: bg.ink }}>
            Iris との絆 · Lv.{bond.level} {vibe.emoji} {vibe.title}
          </div>
          <div style={{ fontSize: '0.74rem', color: bg.inkSoft, marginTop: 2 }}>
            全部教えてくれてありがとう。あなた専用の Iris、稼働中。
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;

  // 通常: コンパクトな招待カード (押し付けがましくない)
  if (!expanded && variant === 'inline') {
    return (
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        onClick={() => setExpanded(true)}
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr auto',
          alignItems: 'center', gap: 12,
          padding: '0.8rem 0.95rem',
          background: `linear-gradient(135deg, ${bg.accent}14, transparent)`,
          border: `1px solid ${bg.accent}40`,
          borderRadius: 14,
          cursor: 'pointer', textAlign: 'left',
          color: bg.ink, fontFamily: IRIS_FONTS.body,
          width: '100%',
        }}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: `linear-gradient(135deg, ${bg.accent}, #F472B6)`,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem',
        }}>
          <Heart size={16} fill="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 2 }}>
            <Sparkles size={10} color={bg.accent} />
            <span style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: bg.accent, fontWeight: 800 }}>
              IRIS と仲良くなる · LV.{bond.level} {vibe.emoji}
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.4 }}>
            {q.prompt}
          </div>
          {q.hint && (
            <div style={{ fontSize: '0.7rem', color: bg.inkSoft, marginTop: 2, lineHeight: 1.4 }}>
              {q.hint}
            </div>
          )}
        </div>
        <ChevronRight size={16} style={{ opacity: 0.6 }} />
      </motion.button>
    );
  }

  // 展開: 入力フォーム
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="bond-expanded"
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        style={{
          padding: '1.2rem 1.15rem',
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(20px)',
          border: `1.5px solid ${bg.accent}55`,
          borderRadius: 18,
          fontFamily: IRIS_FONTS.body,
          color: bg.ink,
          boxShadow: `0 12px 36px ${bg.accent}22`,
        }}>
        {/* ヘッダ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.7rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 4 }}>
              <Heart size={11} fill={bg.accent} color={bg.accent} />
              <span style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: bg.accent, fontWeight: 800 }}>
                LV.{bond.level} {vibe.title.toUpperCase()}
              </span>
            </div>
            <h3 style={{
              margin: 0, fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
              fontSize: '1.25rem', fontWeight: 500, lineHeight: 1.4,
            }}>
              {q.prompt}
            </h3>
            {q.hint && (
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: bg.inkSoft, lineHeight: 1.6 }}>
                {q.hint}
              </p>
            )}
          </div>
          <button onClick={() => setExpanded(false)} aria-label="閉じる" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: bg.inkSoft, padding: 4,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* 入力フォーム */}
        {q.kind === 'text' && (
          <>
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={q.placeholder}
              rows={2}
              style={{
                width: '100%', padding: '0.65rem 0.85rem',
                border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
                fontSize: '0.95rem', fontFamily: 'inherit',
                marginBottom: '0.6rem', resize: 'vertical',
                background: '#fff',
              }}
              autoFocus
            />
          </>
        )}

        {q.kind === 'date' && (
          <input
            type="date"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            style={{
              width: '100%', padding: '0.65rem 0.85rem',
              border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
              fontSize: '0.95rem', fontFamily: 'inherit',
              marginBottom: '0.6rem', background: '#fff',
            }}
            autoFocus
          />
        )}

        {q.kind === 'time' && (
          <input
            type="time"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            style={{
              width: '100%', padding: '0.65rem 0.85rem',
              border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
              fontSize: '0.95rem', fontFamily: 'inherit',
              marginBottom: '0.6rem', background: '#fff',
            }}
            autoFocus
          />
        )}

        {q.kind === 'select' && q.options && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6, marginBottom: '0.7rem' }}>
            {q.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => submit(opt.value)}
                style={{
                  padding: '0.7rem 0.85rem',
                  background: 'rgba(255,255,255,0.7)',
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 12,
                  fontSize: '0.86rem', fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: bg.ink, fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = bg.accent + '12';
                  e.currentTarget.style.borderColor = bg.accent;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.7)';
                  e.currentTarget.style.borderColor = bg.cardBorder;
                }}
              >
                {opt.emoji && <span style={{ fontSize: '1.1rem' }}>{opt.emoji}</span>}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {q.kind === 'multi' && q.options && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: '0.7rem' }}>
              {q.options.map(opt => {
                const selected = multiValue.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => setMultiValue(prev => selected ? prev.filter(v => v !== opt.value) : [...prev, opt.value])}
                    style={{
                      padding: '0.5rem 0.85rem',
                      background: selected ? bg.accent : 'rgba(255,255,255,0.7)',
                      border: `1px solid ${selected ? bg.accent : bg.cardBorder}`,
                      borderRadius: 999,
                      fontSize: '0.82rem', fontWeight: 600,
                      cursor: 'pointer',
                      color: selected ? '#fff' : bg.ink,
                      fontFamily: 'inherit',
                      display: 'inline-flex', gap: 4, alignItems: 'center',
                    }}>
                    {selected && <Check size={10} />} {opt.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* アクションボタン */}
        {(q.kind !== 'select') && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { bond.skip(q.id); setExpanded(false); }} style={{
              padding: '0.6rem 1rem',
              background: 'transparent', color: bg.inkSoft,
              border: `1px solid ${bg.cardBorder}`,
              borderRadius: 999,
              fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              またあとで
            </button>
            <button
              onClick={() => submit(q.kind === 'multi' ? multiValue : inputValue)}
              disabled={q.kind === 'multi' ? !multiValue.length : !inputValue}
              style={{
                flex: 1, padding: '0.65rem',
                background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
                color: '#fff', border: 'none', borderRadius: 999,
                fontSize: '0.88rem', fontWeight: 800,
                cursor: (q.kind === 'multi' ? multiValue.length : inputValue) ? 'pointer' : 'not-allowed',
                opacity: (q.kind === 'multi' ? multiValue.length : inputValue) ? 1 : 0.5,
                fontFamily: 'inherit',
                boxShadow: `0 4px 14px ${bg.accent}55`,
              }}>
              + {q.points} 親密度
            </button>
          </div>
        )}

        {/* 親密度ゲージ */}
        <div style={{ marginTop: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: bg.inkSoft, marginBottom: 4 }}>
            <span>絆ゲージ</span>
            <span>{bond.profile.points} pt → Lv.{Math.min(5, bond.level + 1)}</span>
          </div>
          <div style={{ height: 4, background: '#F4F0FA', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (bond.profile.points / 30) * 100)}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${bg.accent}, #F472B6)`,
              transition: 'width 0.4s',
            }} />
          </div>
        </div>

        {/* 四柱推命プレビュー (誕生日入力済なら) */}
        {bond.fortune && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              marginTop: '0.85rem',
              padding: '0.65rem 0.85rem',
              background: `linear-gradient(135deg, ${bg.accent}10, transparent)`,
              border: `1px solid ${bg.accent}30`,
              borderRadius: 10,
              fontSize: '0.76rem', color: bg.ink, lineHeight: 1.6,
            }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
              <Star size={11} color={bg.accent} fill={bg.accent} />
              <span style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: bg.accent, fontWeight: 800 }}>
                四柱推命 · 日干 {bond.fortune.dayStem}{bond.fortune.dayBranch}
              </span>
            </div>
            <span>
              <strong>{bond.fortune.element} の {bond.fortune.yinYang}</strong> — {bond.fortune.oneLineFortune}
            </span>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── 親密度バッジ (ヘッダー / アバター付近に置くミニ表示) ─────
export function BondLevelBadge({ bg }: { bg: IrisBackgroundDef }) {
  const bond = useIrisBond();
  const vibe = LEVEL_VIBE[bond.level];
  if (bond.level === 0 && bond.profile.points === 0) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px',
      background: `linear-gradient(135deg, ${bg.accent}22, ${bg.accent}10)`,
      border: `1px solid ${bg.accent}44`,
      borderRadius: 999,
      fontSize: '0.68rem', fontWeight: 700,
      color: bg.accent,
      letterSpacing: '0.05em',
    }}>
      <Heart size={9} fill={bg.accent} />
      Lv.{bond.level} {vibe.emoji}
    </span>
  );
}

