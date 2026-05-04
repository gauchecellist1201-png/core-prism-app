// ============================================================
// CORE Iris — カスタム背景エディタ
// 色 3 つ + パターン + ラベル + 絵文字 で自分だけの背景を作る
// ============================================================
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  buildGradient, pickInkForBackground,
  addCustomBackground, type CustomIrisBackground, type GradientPattern,
  IRIS_COLORS, IRIS_FONTS,
  complementaryColor, buildComplementaryPalette,
} from './irisStyle';

interface Props {
  onClose: () => void;
  onCreated: (b: CustomIrisBackground) => void;
}

const PATTERNS: { id: GradientPattern; label: string; emoji: string }[] = [
  { id: 'radial-soft', label: 'ふんわり',  emoji: '🌸' },
  { id: 'linear',      label: 'グラデ',    emoji: '🌅' },
  { id: 'conic',       label: 'オーロラ',  emoji: '🌈' },
  { id: 'mesh',        label: 'メッシュ',  emoji: '✨' },
  { id: 'minimal',     label: 'ミニマル',  emoji: '🤍' },
];

// 補色ベースのインパクトのあるパレット (色相環で対極を組ませる)
const SUGGESTED_PALETTES = [
  { label: 'ローズ × ミント',     c: ['#FFD4E5', '#FFB8D8', '#C8F0E0', '#10B981'] },  // ピンク↔緑
  { label: 'ラベンダー × ハニー', c: ['#E8DCFA', '#D4BFEF', '#FFF0C9', '#D9A41A'] },  // 紫↔黄
  { label: 'コーラル × ティール', c: ['#FFB89A', '#FF9670', '#A0E8E8', '#0EA5E9'] },  // 橙↔青
  { label: 'マゼンタ × ライム',   c: ['#FF7AAE', '#E84B97', '#D8F587', '#9CC600'] },  // 紅↔黄緑
  { label: 'プラム × ピーチ',     c: ['#5C2F5C', '#7E4080', '#FFD8C2', '#FFB89A'] },  // 暗紫↔桃
  { label: 'モカ × アクア',       c: ['#A88670', '#8B6F58', '#B8E0E5', '#06B6D4'] },  // 茶↔水
  { label: 'インディゴ × ゴールド', c: ['#2A2F6E', '#3F4694', '#FFD96B', '#FFC107'] },// 紺↔金
  { label: 'グレープ × アプリコット',c: ['#9B6FE8', '#7B4FC9', '#FFD4A8', '#FF9B5A'] },// 紫↔橙
  { label: 'ブラッシュ × フォレスト',c: ['#F5C8D0', '#E8A0AC', '#A0C898', '#4A8B5A'] },// 桃↔深緑
  { label: 'ナイト × ローズ',     c: ['#1F1A2E', '#2E2440', '#FFB89A', '#FF7AAE'] },  // 暗↔暖色
];

const EMOJI_OPTIONS = ['🌸', '🌷', '🌹', '🌻', '🌼', '🌺', '💐', '🪷', '🌿', '🍃', '✨', '💫', '⭐', '🌙', '☁', '🤍', '💖', '💝', '🎀', '🦄'];

export default function IrisCustomBgEditor({ onClose, onCreated }: Props) {
  const [c1, setC1] = useState('#FFD4E5');
  const [c2, setC2] = useState('#FFE5EE');
  const [c3, setC3] = useState('#FFF0F5');
  const [accent, setAccent] = useState('#E84B97');
  const [pattern, setPattern] = useState<GradientPattern>('radial-soft');
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('🌸');

  const preview = useMemo(() => buildGradient(pattern, c1, c2, c3), [pattern, c1, c2, c3]);

  const applyPalette = (cs: string[]) => {
    setC1(cs[0]); setC2(cs[1]); setC3(cs[2]); setAccent(cs[3]);
  };

  const create = () => {
    const inkPick = pickInkForBackground(c1);
    const b = addCustomBackground({
      label: label.trim() || 'My Background',
      emoji,
      background: preview,
      accent,
      ink: inkPick.ink,
      inkSoft: inkPick.inkSoft,
      card: inkPick.card,
      cardBorder: inkPick.cardBorder,
    });
    onCreated(b);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(20,15,30,0.6)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 24, padding: '1.5rem',
          maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto',
          fontFamily: IRIS_FONTS.body, color: IRIS_COLORS.navy,
        }}
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: IRIS_COLORS.roseDeep, fontWeight: 600 }}>CUSTOM</p>
          <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: IRIS_COLORS.navy, margin: '0.25rem 0 0' }}>
            自分の背景を作る。
          </h3>
        </div>

        {/* プレビュー */}
        <div style={{
          background: preview,
          borderRadius: 16,
          height: 180,
          marginBottom: '1.25rem',
          position: 'relative',
          border: `1px solid ${IRIS_COLORS.roseSoft}`,
          padding: '1rem',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{emoji}</span>
            <span style={{
              fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
              fontSize: '1.5rem', color: pickInkForBackground(c1).ink,
            }}>
              {label || 'プレビュー'}
            </span>
          </div>
          <div style={{
            alignSelf: 'flex-end',
            background: accent,
            color: '#fff',
            padding: '0.4rem 1rem',
            borderRadius: 999,
            fontSize: '0.85rem',
            fontWeight: 600,
          }}>
            アクセント色
          </div>
        </div>

        {/* おすすめパレット */}
        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>おすすめパレット</p>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {SUGGESTED_PALETTES.map(p => (
            <button key={p.label} onClick={() => applyPalette(p.c)} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: '#fff', border: `1px solid ${IRIS_COLORS.roseSoft}`,
              borderRadius: 999, padding: '0.35rem 0.7rem',
              cursor: 'pointer', fontSize: '0.78rem', color: IRIS_COLORS.navy,
              fontFamily: IRIS_FONTS.body,
            }}>
              {p.c.slice(0, 4).map((c, i) => (
                <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.08)' }} />
              ))}
              {p.label}
            </button>
          ))}
        </div>

        {/* 色ピッカー + 補色自動計算 */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => {
            const p = buildComplementaryPalette(c2);
            setC1(p.c1); setC3(p.c3); setAccent(p.accent);
          }} style={{
            background: 'linear-gradient(90deg, #FF7AAE, #10B981)',
            color: '#fff', border: 'none',
            padding: '0.55rem 1rem', borderRadius: 999,
            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
            boxShadow: '0 4px 14px rgba(255,122,174,0.35)',
          }}>
            🎨 補色パレットを自動生成 (ベース2 から)
          </button>
          <button onClick={() => setAccent(complementaryColor(c2))} style={{
            background: '#fff',
            color: IRIS_COLORS.navy, border: `1px solid ${IRIS_COLORS.roseSoft}`,
            padding: '0.55rem 1rem', borderRadius: 999,
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
          }}>
            ✨ アクセントだけ補色化
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
          <ColorField label="ベース 1" value={c1} onChange={setC1} />
          <ColorField label="ベース 2 (主役)" value={c2} onChange={setC2} />
          <ColorField label="ベース 3" value={c3} onChange={setC3} />
          <ColorField label="アクセント (補色推奨)" value={accent} onChange={setAccent} />
        </div>

        {/* パターン */}
        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>パターン</p>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {PATTERNS.map(p => (
            <button key={p.id} onClick={() => setPattern(p.id)} style={{
              background: pattern === p.id ? IRIS_COLORS.roseDeep : '#fff',
              color: pattern === p.id ? '#fff' : IRIS_COLORS.navy,
              border: `1px solid ${IRIS_COLORS.roseSoft}`,
              borderRadius: 999, padding: '0.45rem 0.95rem',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              fontFamily: IRIS_FONTS.body,
            }}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>

        {/* 名前 + 絵文字 */}
        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>名前 / 絵文字</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            placeholder="例: 春の朝, My Vibes など"
            value={label}
            onChange={e => setLabel(e.target.value)}
            style={{
              flex: 1,
              border: `1px solid ${IRIS_COLORS.roseSoft}`,
              borderRadius: 12, padding: '0.65rem 0.9rem', fontSize: '0.9rem',
              fontFamily: IRIS_FONTS.body, color: IRIS_COLORS.navy,
              background: '#fff',
            }}
          />
          <div style={{
            border: `1px solid ${IRIS_COLORS.roseSoft}`, borderRadius: 12,
            padding: '0.4rem', minWidth: 60, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem',
            background: '#fff',
          }}>
            {emoji}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {EMOJI_OPTIONS.map(e => (
            <button key={e} onClick={() => setEmoji(e)} style={{
              background: emoji === e ? IRIS_COLORS.roseSoft : 'transparent',
              border: `1px solid ${emoji === e ? IRIS_COLORS.roseDeep : IRIS_COLORS.roseSoft}`,
              borderRadius: 8, padding: '0.3rem', cursor: 'pointer',
              fontSize: '1.1rem', minWidth: 32,
            }}>
              {e}
            </button>
          ))}
        </div>

        {/* ボタン */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onClose} style={{
            flex: 1,
            background: '#fff', color: IRIS_COLORS.navy,
            border: `1px solid ${IRIS_COLORS.roseSoft}`,
            padding: '0.85rem', borderRadius: 999, fontWeight: 600, cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
          }}>
            キャンセル
          </button>
          <button onClick={create} style={{
            flex: 1,
            background: `linear-gradient(135deg, ${IRIS_COLORS.rose}, ${IRIS_COLORS.roseDeep})`,
            color: '#fff', border: 'none',
            padding: '0.85rem', borderRadius: 999, fontWeight: 700, cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
            boxShadow: `0 6px 20px ${IRIS_COLORS.roseDeep}55`,
          }}>
            ✨ この背景を保存
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: '0.75rem', color: IRIS_COLORS.inkSoft, marginBottom: '0.25rem', display: 'block' }}>
        {label}
      </span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        background: '#fff', border: `1px solid ${IRIS_COLORS.roseSoft}`,
        borderRadius: 12, padding: '0.4rem 0.5rem',
      }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: 36, height: 36, borderRadius: 8, border: 'none',
            cursor: 'pointer', padding: 0, background: 'transparent',
          }}
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none',
            fontFamily: 'monospace', fontSize: '0.85rem',
            color: IRIS_COLORS.navy, background: 'transparent',
            minWidth: 0,
          }}
        />
      </div>
    </label>
  );
}
