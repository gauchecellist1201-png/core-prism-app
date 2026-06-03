// ============================================================
// SvgFromConceptDemo — Claude で 概念 → SVG を生成するデモ
//
// オーナー指示 (2026-06-04 第 19 波 TTT):
//   ContentEngineStudio や任意の Studio で「概念から SVG 自動生成」を
//   試せるダイアログ。
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Download, Copy, Check, Loader2 } from 'lucide-react';
import { aiSvgFromConcept } from '../lib/aiSvgFromConcept';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SvgFromConceptDemo({ open, onClose }: Props) {
  const [concept, setConcept] = useState('夜明けの海と小さな船');
  const [style, setStyle] = useState<'flat' | 'line' | 'soft' | 'bold'>('flat');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    setSvg(null);
    try {
      const r = await aiSvgFromConcept({ concept, style, viewBox: '0 0 600 400' });
      setSvg(r.svg);
    } catch (e) {
      setErr((e as Error)?.message || 'AI 生成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const copySvg = () => {
    if (!svg) return;
    navigator.clipboard?.writeText(svg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `concept_${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,12,0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 12px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(720px, 100%)',
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
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 18px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(180deg, rgba(167,139,250,0.12), transparent)',
            }}>
              <Sparkles size={16} color="#a78bfa" />
              <div style={{ flex: 1, fontWeight: 800, fontSize: '0.95rem' }}>概念 → SVG (AI お絵描き)</div>
              <button onClick={onClose} aria-label="閉じる" style={{
                width: 30, height: 30, borderRadius: 15,
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><X size={14} /></button>
            </div>

            <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>
                何を描いてほしい?
              </label>
              <input
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="例: 夜明けの海と小さな船 / シンプルな炎 / 抽象的な脳"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none',
                  marginBottom: 12,
                  boxSizing: 'border-box',
                }}
              />

              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>スタイル</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {(['flat', 'line', 'soft', 'bold'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    style={{
                      padding: '6px 12px', borderRadius: 999,
                      background: style === s ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${style === s ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                      color: style === s ? '#fff' : 'rgba(255,255,255,0.7)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button
                onClick={generate}
                disabled={busy || !concept.trim()}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  borderRadius: 12,
                  background: busy || !concept.trim()
                    ? 'rgba(255,255,255,0.1)'
                    : 'linear-gradient(135deg, #a78bfa, #f472b6)',
                  color: '#fff', border: 'none',
                  fontSize: '0.92rem', fontWeight: 800,
                  cursor: busy || !concept.trim() ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {busy ? <><Loader2 size={14} style={{ animation: 'core-spin 1s linear infinite' }} /> AI が描いています…</> : <><Sparkles size={14} /> 生成する</>}
              </button>

              {err && (
                <div style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  background: 'rgba(220,38,38,0.1)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  borderRadius: 8,
                  fontSize: '0.78rem', color: '#fca5a5',
                }}>{err}</div>
              )}

              {svg && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', fontWeight: 800, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    PREVIEW
                  </div>
                  <div
                    style={{
                      background: 'repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%) 50% / 20px 20px',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={copySvg}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 10,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff', cursor: 'pointer',
                        fontSize: 12, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      {copied ? <><Check size={12} /> コピー済</> : <><Copy size={12} /> SVG コピー</>}
                    </button>
                    <button
                      onClick={downloadSvg}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 10,
                        background: 'rgba(167,139,250,0.25)',
                        border: '1px solid rgba(167,139,250,0.5)',
                        color: '#fff', cursor: 'pointer',
                        fontSize: 12, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      <Download size={12} /> .svg をダウンロード
                    </button>
                  </div>
                </div>
              )}
            </div>
            <style>{`@keyframes core-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
