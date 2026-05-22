// ============================================================
// ExtensionCaptureToast — Chrome 拡張から ?capture=… で取り込んだ内容を
// ダッシュボードに「届きました」とお知らせする小さなトースト。
//
// kind に応じて次のアクションを誘導:
//  - deal-capture: 「DM スクショから案件登録」を開く合図
//  - profile-import: 「Instagram を取り込み」のヒント
//  - consult: 13 CXO に相談する
//  - page / note: ただ表示 + メモ追加
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ExternalLink, Image as ImageIcon, User2, Lightbulb } from 'lucide-react';

const STORAGE_KEY = 'core_extension_capture_v1';

interface CapturePayload {
  title?: string;
  url?: string;
  selection?: string;
  source?: string;
  kind?: string;
  receivedAt?: number;
}

export default function ExtensionCaptureToast({ brand = 'prism' }: { brand?: 'prism' | 'iris' }) {
  const [payload, setPayload] = useState<CapturePayload | null>(null);
  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';

  useEffect(() => {
    // 起動時に保留があれば吸い上げ
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as CapturePayload;
        // 受信から 60 秒以内のものだけ
        if (p.receivedAt && Date.now() - p.receivedAt < 60_000) {
          setPayload(p);
        }
      }
    } catch { /* */ }

    const onCap = (e: Event) => {
      const detail = (e as CustomEvent<CapturePayload>).detail;
      if (detail) setPayload(detail);
    };
    window.addEventListener('core:extension-capture', onCap);
    return () => window.removeEventListener('core:extension-capture', onCap);
  }, []);

  if (!payload) return null;

  const dismiss = () => {
    setPayload(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const kind = payload.kind || 'note';
  const meta = getKindMeta(kind, brand);

  return (
    <AnimatePresence>
      {payload && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
            left: 'max(14px, calc(env(safe-area-inset-left, 0px) + 14px))',
            width: 'min(360px, calc(100vw - 28px))',
            zIndex: 70,
            background: 'linear-gradient(180deg, rgba(18,18,30,0.96) 0%, rgba(10,10,20,0.98) 100%)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: `1px solid ${accent}44`,
            borderRadius: 16,
            boxShadow: `0 12px 36px rgba(0,0,0,0.45), 0 0 28px ${accent}33`,
            padding: 14,
            color: '#fff',
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {meta.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', color: accent, textTransform: 'uppercase' }}>
                Chrome 拡張から
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{meta.label}</div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="閉じる"
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            ><X size={14} /></button>
          </div>

          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.78)',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 10, padding: '8px 10px',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {payload.title || payload.url || '(無題)'}
          </div>
          {payload.selection && (
            <div style={{
              marginTop: 6, fontSize: 11.5, color: 'rgba(255,255,255,0.6)',
              borderLeft: `2px solid ${accent}88`, paddingLeft: 8,
              maxHeight: 60, overflow: 'hidden',
            }}>
              {payload.selection.slice(0, 200)}
              {payload.selection.length > 200 ? '…' : ''}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {payload.url && (
              <a
                href={payload.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, padding: '8px 10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#fff', fontSize: 11.5, fontWeight: 600,
                  textAlign: 'center', textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              ><ExternalLink size={12} /> 元ページ</a>
            )}
            <button
              type="button"
              onClick={() => {
                // 次のアクションを誘導 (kind に応じた custom event を fire)
                window.dispatchEvent(new CustomEvent(`core:capture-${kind}`, { detail: payload }));
                dismiss();
              }}
              style={{
                flex: 1, padding: '8px 10px',
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                border: 'none', borderRadius: 10,
                color: '#fff', fontSize: 11.5, fontWeight: 700,
                cursor: 'pointer',
              }}
            >{meta.cta}</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function getKindMeta(kind: string, brand: 'prism' | 'iris') {
  if (brand === 'iris') {
    switch (kind) {
      case 'deal-capture':
        return { icon: <ImageIcon size={14} />, label: 'DM 案件として取り込む？', cta: '案件登録 →' };
      case 'profile-import':
        return { icon: <User2 size={14} />, label: 'プロフィールを Iris に？', cta: '取り込む →' };
      case 'post-snapshot':
        return { icon: <Sparkles size={14} />, label: '投稿として保存', cta: 'メモする →' };
      case 'note':
      default:
        return { icon: <Sparkles size={14} />, label: 'メモとして保存', cta: 'メモする →' };
    }
  }
  // Prism
  switch (kind) {
    case 'consult':
      return { icon: <Lightbulb size={14} />, label: '13 CXO に相談する？', cta: '相談する →' };
    case 'page':
    default:
      return { icon: <Sparkles size={14} />, label: 'Prism にメモとして保存', cta: 'メモする →' };
  }
}
