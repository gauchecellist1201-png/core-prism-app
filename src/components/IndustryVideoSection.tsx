// ============================================================
// IndustryVideoSection — 業界別 LP の「説明動画 (2 分)」セクション
//
// オーナー指示 (2026-06-04 第 22 波 DDDD):
//   YouTube 埋め込み + プライバシー強化 (nocookie ドメイン)
//   サムネ ローディング遅延対策 (lite-vimeo-embed 風 lazy iframe)
// ============================================================

import { useState } from 'react';
import { Play } from 'lucide-react';
import type { IndustryConfig } from '../lp/industries';

interface Props {
  config: IndustryConfig;
  accentLeft: string;
  accentRight: string;
}

export default function IndustryVideoSection({ config, accentLeft, accentRight }: Props) {
  const v = config.video;
  const [active, setActive] = useState(false);
  if (!v?.youtubeId) return null;

  // クリック前は サムネ (img) のみ。クリック後に iframe を差し替え (Lazy Load = LCP に効く)
  const thumb = `https://img.youtube.com/vi/${v.youtubeId}/maxresdefault.jpg`;
  const embed = `https://www.youtube-nocookie.com/embed/${v.youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <section style={{
      padding: '5rem 1.5rem',
      background: `linear-gradient(180deg, rgba(0,0,0,0.18), transparent)`,
    }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{
          fontFamily: '"Inter","Hiragino Kaku Gothic ProN",sans-serif',
          fontSize: 11, letterSpacing: '0.3em', color: accentLeft,
          textAlign: 'center', fontWeight: 700, marginBottom: 8,
        }}>
          WATCH IN 2 MIN
        </div>
        <h2 style={{
          fontSize: 'clamp(1.6rem, 3.2vw, 2.3rem)',
          fontWeight: 800, textAlign: 'center',
          marginBottom: '0.5rem', color: '#fff',
        }}>
          <span style={{
            background: `linear-gradient(120deg, ${accentLeft}, ${accentRight})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>{v.title || '2 分で分かる CORE'}</span>
        </h2>
        <p style={{
          fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)',
          textAlign: 'center', marginBottom: '2.5rem', lineHeight: 1.7,
        }}>
          14 役員がどんな仕事を進めるか、実際の画面で見せています。
        </p>

        <div style={{
          position: 'relative',
          maxWidth: 880, margin: '0 auto',
          aspectRatio: '16 / 9',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: `0 18px 40px rgba(0,0,0,0.5), 0 0 0 1px ${accentLeft}33`,
          background: '#000',
        }}>
          {!active ? (
            <button
              onClick={() => setActive(true)}
              aria-label={`${v.title || '動画'} を再生`}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                border: 'none', padding: 0, cursor: 'pointer',
                background: `url(${thumb}) center / cover #000`,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 100%)',
                }}
              />
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 76, height: 76, borderRadius: 38,
                  background: `linear-gradient(135deg, ${accentLeft}, ${accentRight})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 16px 36px ${accentLeft}66`,
                }}
              >
                <Play size={32} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
              </div>
              {v.duration && (
                <div style={{
                  position: 'absolute',
                  bottom: 14, right: 14,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  fontFamily: 'Menlo, monospace',
                }}>{v.duration}</div>
              )}
            </button>
          ) : (
            <iframe
              src={embed}
              title={v.title || 'CORE 説明動画'}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          )}
        </div>

        <p style={{
          marginTop: 14,
          fontSize: 11, color: 'rgba(255,255,255,0.45)',
          textAlign: 'center',
        }}>
          ※ サムネタップで再生。Cookie 配慮のため youtube-nocookie ドメインを使用しています。
        </p>
      </div>
    </section>
  );
}
