// ============================================================
// PersonaPresetSuggestion — オンボ完了直後に「業種に合う 4 名を 1 タップで追加」
//
// オーナー指示 (2026-06-04 第 23 波 GGGG):
//   OnboardingFlow が localStorage `core_persona_preset_suggest_v1` に industry を
//   保留する。本コンポーネントが それを読み、4 名のペルソナ プリセットを表示。
//   「追加する」で usePersonas.createPersona を 4 回呼ぶ。
//
// 表示は 1 回だけ — 追加 / スキップ で localStorage を消す。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, ArrowRight } from 'lucide-react';
import { usePersonas } from '../hooks/usePersonas';
import { getPersonaPresets, presetTagline } from '../lib/personaPresets';

const SUGGEST_KEY = 'core_persona_preset_suggest_v1';

export default function PersonaPresetSuggestion() {
  const personas = usePersonas();
  const [visible, setVisible] = useState(false);
  const [industry, setIndustry] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SUGGEST_KEY);
      if (!raw) return;
      const j = JSON.parse(raw) as { industry?: string; ts?: number };
      if (!j.industry) return;
      // すでに 2 件以上ペルソナがあれば提示しない (運用 中)
      if ((personas.personas || []).length >= 2) {
        localStorage.removeItem(SUGGEST_KEY);
        return;
      }
      setIndustry(j.industry);
      setVisible(true);
      // 既定で全選択
      const presets = getPersonaPresets(j.industry as never);
      setPicked(new Set(presets.map(p => p.key)));
    } catch { /* */ }
  }, [personas.personas]);

  const presets = useMemo(() => industry ? getPersonaPresets(industry as never) : [], [industry]);

  const close = (also: 'add' | 'skip') => {
    try { localStorage.removeItem(SUGGEST_KEY); } catch { /* */ }
    setVisible(false);
    // also 区別は今のところログ用 (Slack や analytics に流したい場合は ここで)
    void also;
  };

  const toggle = (key: string) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAdd = async () => {
    if (picked.size === 0) { close('skip'); return; }
    setBusy(true);
    for (const p of presets) {
      if (!picked.has(p.key)) continue;
      try {
        personas.createPersona(
          p.name, p.subtitle, p.icon, p.description, p.accentColor, p.accentColorLight,
        );
      } catch { /* */ }
    }
    setBusy(false);
    close('add');
  };

  if (!visible || !industry) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 95,
          background: 'rgba(0,0,10,0.65)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 12px',
        }}
        onClick={() => close('skip')}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.22 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(520px, 100%)',
            maxHeight: 'calc(100vh - 48px)',
            background: 'rgba(15,14,27,0.97)',
            border: '1px solid rgba(167,139,250,0.4)',
            borderRadius: 18,
            color: '#fff',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--cp-elev-4)',
          }}
        >
          <button
            aria-label="閉じる"
            onClick={() => close('skip')}
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 36, height: 36, borderRadius: 18,
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1,
            }}
          ><X size={16} /></button>

          <div style={{
            padding: '20px 22px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(167,139,250,0.12), transparent)',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10, letterSpacing: '0.22em',
              color: '#A78BFA', fontWeight: 800, marginBottom: 8,
            }}>
              <Sparkles size={11} /> AI ペルソナ プリセット
            </div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, lineHeight: 1.4 }}>
              業種に合う <span style={{
                background: 'linear-gradient(120deg, #A78BFA, #F472B6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>4 名の AI 役員</span> を 1 タップで追加
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>
              チェックを外すと その役員はスキップされます。後で個別に追加できます。
            </p>
          </div>

          {/* OOOOOO (2026-06-04): お試し ペルソナ 3 ボタン — 1 タップで 1 名 だけ追加 → 即ダッシュ */}
          <QuickTrialPresets
            onPick={(preset) => {
              try {
                const p = personas.createPersona(
                  preset.name, preset.subtitle, preset.icon,
                  preset.description, preset.accentColor, preset.accentColorLight,
                );
                personas.selectPersona(p.id);
              } catch { /* */ }
              close('add');
            }}
          />

          <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
            {presets.map((p) => {
              const on = picked.has(p.key);
              return (
                <button
                  key={p.key}
                  onClick={() => toggle(p.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', textAlign: 'left',
                    padding: '12px 14px', borderRadius: 12,
                    background: on ? `${p.accentColor}15` : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${on ? p.accentColor : 'rgba(255,255,255,0.06)'}`,
                    color: '#fff', cursor: 'pointer',
                    marginBottom: 8,
                    transition: 'background 0.15s, border 0.15s',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `linear-gradient(135deg, ${p.accentColor}, ${p.accentColor}99)`,
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {p.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>{p.name}</div>
                    <div style={{ fontSize: '0.7rem', color: p.accentColor, fontWeight: 700, marginTop: 1 }}>
                      {p.subtitle}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', marginTop: 2, lineHeight: 1.55 }}>
                      {presetTagline(p.key)}
                    </div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: on ? p.accentColor : 'rgba(255,255,255,0.06)',
                    border: on ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    {on && <Check size={13} />}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', gap: 6,
            background: 'rgba(255,255,255,0.02)',
          }}>
            <button
              onClick={() => close('skip')}
              disabled={busy}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                background: 'transparent',
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
                fontSize: '0.82rem', fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              スキップ
            </button>
            <button
              onClick={handleAdd}
              disabled={busy || picked.size === 0}
              style={{
                flex: 2, padding: '10px 0', borderRadius: 12,
                background: busy || picked.size === 0
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #A78BFA, #F472B6)',
                color: '#fff', border: 'none',
                fontSize: '0.9rem', fontWeight: 800,
                cursor: busy || picked.size === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {busy ? '追加中…' : <>選んだ {picked.size} 名を追加 <ArrowRight size={14} /></>}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// OOOOOO (2026-06-04): 3 ボタン で 即 ペルソナ 作成 + 即 アクティブ化
interface QuickPreset {
  key: string;
  emoji: string;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  accentColor: string;
  accentColorLight: string;
  tagline: string;
}
const QUICK_PRESETS: QuickPreset[] = [
  {
    key: 'shop-owner',
    emoji: '🍜',
    name: '飲食店オーナー',
    subtitle: '3 店舗 / 月商 800 万',
    description: '売上 / 在庫 / 採用 を 14 役員 で 回す 飲食店オーナー (例: 田中)',
    icon: '🍜',
    accentColor: '#F97316',
    accentColorLight: 'rgba(249,115,22,0.18)',
    tagline: '売上 / 採用 / 在庫 を 1 画面で',
  },
  {
    key: 'consultant',
    emoji: '🧠',
    name: 'コンサルタント',
    subtitle: '独立 5 年 / 提案 8h → 30 分',
    description: '提案書 + リサーチ を AI に 任せる 独立コンサル (例: 森本)',
    icon: '🧠',
    accentColor: '#6366F1',
    accentColorLight: 'rgba(99,102,241,0.18)',
    tagline: '提案 / リサーチ / 議事録 ぜんぶ AI',
  },
  {
    key: 'freelancer',
    emoji: '⚡',
    name: 'フリーランス エンジニア',
    subtitle: '月単価 ¥120 万 / 副業 2 件',
    description: '案件管理 + 単価交渉 + 確定申告 を AI で (例: 山口)',
    icon: '⚡',
    accentColor: '#A855F7',
    accentColorLight: 'rgba(168,85,247,0.18)',
    tagline: '案件 / 交渉 / 経理 を AI で',
  },
];

// OS絵文字禁止ルール: プリセットのアイコンは import 不要のインライン SVG ライン（実行時クラッシュ回避）
function PresetGlyph({ k, color }: { k: string; color: string }) {
  const common = {
    width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.9,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  if (k === 'shop-owner') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M4 12h16a8 8 0 0 1-16 0Z" />
        <path d="M8 3c0 1-1 1-1 2s1 1 1 2M12 3c0 1-1 1-1 2s1 1 1 2M16 3c0 1-1 1-1 2s1 1 1 2" />
      </svg>
    );
  }
  if (k === 'consultant') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-4 10.5c.7.8 1 1.5 1 2.5h6c0-1 .3-1.7 1-2.5A6 6 0 0 0 12 3Z" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

function QuickTrialPresets({ onPick }: { onPick: (preset: QuickPreset) => void }) {
  return (
    <div style={{
      padding: '12px 16px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(180deg, rgba(167,139,250,0.06), transparent)',
    }}>
      <div style={{
        fontSize: 10, letterSpacing: '0.2em',
        color: '#FBBF24', fontWeight: 800,
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 8-10c1.5 1.5 3 4 3 6a22 22 0 0 1-8 8zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
        お試し で 1 タップ で 始める
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPick(p)}
            aria-label={`${p.name} ペルソナ を 1 タップで 作成`}
            style={{
              padding: '12px 10px',
              borderRadius: 12,
              background: p.accentColorLight,
              border: `1px solid ${p.accentColor}55`,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 8px 18px ${p.accentColor}33`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <PresetGlyph k={p.key} color={p.accentColor} />
            <span style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.3, textAlign: 'center' }}>{p.name}</span>
            <span style={{ fontSize: 9, color: p.accentColor, fontWeight: 700, lineHeight: 1.2, textAlign: 'center' }}>{p.tagline}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
