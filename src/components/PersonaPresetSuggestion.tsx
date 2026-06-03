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
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          }}
        >
          <button
            aria-label="閉じる"
            onClick={() => close('skip')}
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 30, height: 30, borderRadius: 15,
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1,
            }}
          ><X size={14} /></button>

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
