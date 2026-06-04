// ============================================================
// OnboardingVideoEmbed — IndustryLanding hero下 オンボ動画 (任意)
//
// オーナー指示 (2026-06-04 第 34 波 NNNNN):
//   /onboarding-video.mp4 が public に存在する場合のみ 表示。
//   存在チェックは onError で 隠す方式 (HEAD リクエスト不要)。
//   poster は同名の .jpg / .png をフォールバック検索。
// ============================================================

import { useState } from 'react';
import { PlayCircle } from 'lucide-react';

interface Props {
  /** カスタム URL を渡せる (例: 業界別動画) — 未指定なら /onboarding-video.mp4 */
  src?: string;
  /** 業界別 LP の アクセント色 (左) */
  accentLeft?: string;
  /** 業界別 LP の アクセント色 (右) */
  accentRight?: string;
}

const DEFAULT_SRC = '/onboarding-video.mp4';

export default function OnboardingVideoEmbed({ src, accentLeft = '#A78BFA', accentRight = '#F472B6' }: Props) {
  const url = src || DEFAULT_SRC;
  const [hidden, setHidden] = useState(false);
  const [started, setStarted] = useState(false);

  // mp4 が無い (404 / Vercel 0-byte) → onError で 自動非表示
  if (hidden) return null;

  return (
    <section id="video" aria-label="公式 動画 75 秒" style={{
      padding: '3rem 1.25rem 2rem',
      background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.02) 100%)',
      scrollMarginTop: 24,
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 11, letterSpacing: '0.25em', fontWeight: 800, color: accentLeft }}>
          <PlayCircle size={14} />
          75 秒 で わかる
        </div>
        <h2 style={{
          fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
          fontWeight: 900, margin: '0 0 14px', color: '#fff', letterSpacing: '-0.01em',
        }}>
          動画 で「中身」を見る
        </h2>
        <div style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          background: '#0c0c1c',
          boxShadow: `0 24px 60px ${accentLeft}33, 0 0 0 1px ${accentLeft}22`,
          aspectRatio: '16 / 10',
        }}>
          {/* 未再生時に「再生」CTA をオーバーレイ */}
          {!started && (
            <button
              onClick={() => setStarted(true)}
              style={{
                position: 'absolute', inset: 0, zIndex: 2,
                background: `linear-gradient(135deg, ${accentLeft}22, ${accentRight}22)`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, color: '#fff', cursor: 'pointer',
                border: 'none',
              }}
            >
              <div style={{
                width: 72, height: 72, borderRadius: 36,
                background: `linear-gradient(135deg, ${accentLeft}, ${accentRight})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 12px 30px ${accentLeft}66`,
              }}>
                <PlayCircle size={36} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '0.05em' }}>
                再生 (75 秒)
              </span>
            </button>
          )}
          <video
            controls={started}
            playsInline
            preload="metadata"
            autoPlay={started}
            poster="/onboarding-poster.jpg"
            onError={() => setHidden(true)}
            style={{
              width: '100%', height: '100%',
              display: 'block',
              backgroundColor: '#0c0c1c',
              objectFit: 'cover',
            }}
          >
            <source src={url.replace(/\.mp4$/, '.webm')} type="video/webm" />
            <source src={url} type="video/mp4" />
            {/* PPPPPP (2026-06-04): WebVTT 字幕 (デフォルトで ON) */}
            <track
              kind="captions"
              srcLang="ja"
              label="日本語 字幕"
              src="/onboarding-video.vtt"
              default
            />
          </video>
        </div>
        <p style={{ marginTop: 12, fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          PRISM / Iris の 5 シーン (LP → 料金 → ダッシュ → CXO チャット → Iris) を 75 秒 で。
        </p>
      </div>
    </section>
  );
}
