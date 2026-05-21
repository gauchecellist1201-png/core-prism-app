// ============================================================
// StreakShareModal — 連続日数を 1080×1080 の画像にして SNS で見せびらかすモーダル
// 画像は端末内 Canvas で生成 (お金ゼロ・サーバ不要)
// X (Twitter) / Instagram / 画像ダウンロード の 3 経路を提供
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download, Share2, Check, AlertCircle } from 'lucide-react';
import { shareToInstagram } from '../iris/instagramShare';
import { notifyInApp } from '../lib/inAppNotify';

interface Props {
  streak: number;
  best: number;
  brand: 'prism' | 'iris';
  accent: string;
  onClose: () => void;
}

const APP_URL = 'https://core-prism-app.vercel.app/';

function drawStreakCard(canvas: HTMLCanvasElement, streak: number, best: number, brand: 'prism' | 'iris', accent: string) {
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 背景: ブランドに合うグラデ
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  if (brand === 'iris') {
    bgGrad.addColorStop(0, '#1a0420');
    bgGrad.addColorStop(0.5, '#3a0a3e');
    bgGrad.addColorStop(1, '#E1306C');
  } else {
    bgGrad.addColorStop(0, '#08081a');
    bgGrad.addColorStop(0.5, '#1a1442');
    bgGrad.addColorStop(1, '#5824a8');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 大きなぼかし円 (装飾)
  const blob = ctx.createRadialGradient(W / 2, H * 0.65, 50, W / 2, H * 0.65, 600);
  blob.addColorStop(0, accent + '88');
  blob.addColorStop(1, accent + '00');
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, W, H);

  // 上端 BRAND ラベル
  ctx.fillStyle = '#FFFFFFCC';
  ctx.font = '600 28px "Inter", "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(brand === 'iris' ? 'CORE  IRIS' : 'CORE  PRISM', W / 2, 110);

  // メイン: 大きな数字
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 380px "Inter", "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillText(String(streak), W / 2, H / 2 + 70);

  // 「日連続」サブテキスト
  ctx.fillStyle = '#FFFFFFEE';
  ctx.font = '700 64px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillText('日連続', W / 2, H / 2 + 170);

  // 🔥 アイコン (絵文字)
  ctx.font = '120px "Apple Color Emoji", sans-serif';
  ctx.fillText('🔥', W / 2, H / 2 - 220);

  // ベスト記録 (右下)
  if (best > 0) {
    ctx.fillStyle = '#FFFFFFAA';
    ctx.font = '500 28px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`過去最高 ${best} 日`, W - 70, H - 90);
  }

  // 下端: タグライン + URL
  ctx.fillStyle = '#FFFFFFCC';
  ctx.font = '600 32px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(brand === 'iris' ? 'すべての光に、毎日。' : 'すべての事業家の核を、毎日。', W / 2, H - 200);

  ctx.fillStyle = '#FFFFFF88';
  ctx.font = '500 24px "Inter", sans-serif';
  ctx.fillText('core-prism-app.vercel.app', W / 2, H - 150);
}

export default function StreakShareModal({ streak, best, brand, accent, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sharing' | 'shared' | 'failed'>('idle');

  useEffect(() => {
    const canvas = document.createElement('canvas');
    drawStreakCard(canvas, streak, best, brand, accent);
    canvasRef.current = canvas;
    canvas.toBlob((blob) => {
      if (!blob) return;
      setImageBlob(blob);
      setImageUrl(URL.createObjectURL(blob));
    }, 'image/png');
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak, best, brand, accent]);

  const caption = brand === 'iris'
    ? `🔥 CORE Iris で ${streak} 日連続。\nクリエイターの毎日が積み上がっていく。\n#CORE_Iris #毎日続ける`
    : `🔥 CORE Prism で ${streak} 日連続。\n人格を分けて、AI と一緒に毎日。\n#CORE_Prism #事業家のOS`;

  const shareX = () => {
    const text = caption + '\n' + APP_URL;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareInstagram = async () => {
    if (!imageBlob) return;
    setStatus('sharing');
    try {
      const res = await shareToInstagram({
        caption: caption + '\n\n' + APP_URL,
        image: imageBlob,
        filename: `core-${brand}-streak-${streak}.png`,
        asStory: false,
      });
      if (res.method === 'failed') {
        setStatus('failed');
        notifyInApp({ kind: 'warn', title: '共有に失敗しました', body: res.message, duration: 6000 });
      } else {
        setStatus('shared');
        notifyInApp({ kind: 'success', title: 'Instagram へ送りました', body: res.message, duration: 5000 });
      }
      window.setTimeout(() => setStatus('idle'), 2400);
    } catch {
      setStatus('failed');
      window.setTimeout(() => setStatus('idle'), 2400);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `core-${brand}-streak-${streak}.png`;
    a.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(8,8,18,0.82)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.94, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 18 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#12121E', borderRadius: 18,
          maxWidth: 420, width: '100%', maxHeight: 'calc(100dvh - 2rem)',
          color: '#fff', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.2rem 0.5rem' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', fontWeight: 800, color: accent }}>SHARE</div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '4px 0 0' }}>連続日数を見せる</h2>
          </div>
          <button onClick={onClose} aria-label="閉じる"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '50%',
              width: 44, height: 44, cursor: 'pointer', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}><X size={18} /></button>
        </div>

        {/* プレビュー */}
        <div style={{ padding: '0 1.2rem' }}>
          {imageUrl ? (
            <img src={imageUrl} alt={`${streak} 日連続`} style={{
              width: '100%', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: `0 12px 32px ${accent}44`,
            }} />
          ) : (
            <div style={{
              aspectRatio: '1 / 1', borderRadius: 14,
              background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.4)', fontSize: 13,
            }}>カードを準備しています…</div>
          )}
        </div>

        <div style={{ padding: '1rem 1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={shareInstagram}
            disabled={!imageBlob || status === 'sharing'}
            style={btnPri('#E1306C')}
          >
            {status === 'sharing' ? <>送信中…</>
              : status === 'shared' ? <><Check size={16} /> 送れました</>
              : status === 'failed' ? <><AlertCircle size={16} /> もう一度</>
              : <><Share2 size={16} /> Instagram で共有</>}
          </button>
          <button type="button" onClick={shareX} style={btnSec('#000000')}>
            <Share2 size={16} /> X (旧 Twitter) で共有
          </button>
          <button type="button" onClick={downloadImage} disabled={!imageUrl} style={btnSec(accent)}>
            <Download size={16} /> 画像をダウンロード
          </button>
        </div>

        <div style={{ padding: '0 1.2rem 1.4rem', fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
          画像はあなたの端末内で作っています。CORE のサーバーには送られません。
        </div>
      </motion.div>
    </motion.div>
  );
}

function btnPri(color: string): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
    color: '#fff', border: 'none', borderRadius: 14,
    padding: '12px 16px', fontSize: 13, fontWeight: 800,
    cursor: 'pointer', minHeight: 48,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: `0 8px 22px ${color}55`,
  };
}

function btnSec(color: string): React.CSSProperties {
  return {
    background: `${color}22`, border: `1px solid ${color}55`,
    color: '#fff', borderRadius: 14,
    padding: '12px 16px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', minHeight: 48,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };
}
