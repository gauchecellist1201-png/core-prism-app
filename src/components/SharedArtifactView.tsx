// ============================================================
// SharedArtifactView — 共有リンクで開いたときに表示するプレビュー画面
// 成果物 + 「あなたも CORE で作ってみる」CTA
// ============================================================
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, ImageOff } from 'lucide-react';
import type { SharedArtifact } from '../lib/shareLink';

interface Props {
  artifact: SharedArtifact;
  onEnterApp: () => void;
}

const KIND_LABEL: Record<string, string> = {
  text: '記事',
  image: '画像',
  reel: 'リール動画',
  post: 'SNS 投稿',
  invoice: '請求書',
  slide: 'スライド',
};

export default function SharedArtifactView({ artifact, onEnterApp }: Props) {
  const author = artifact.createdBy || '';
  const kind = KIND_LABEL[artifact.kind] || '成果物';
  const isIris = artifact.source === 'iris';
  const accent = isIris ? '#E1306C' : '#635BFF';

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0A0A14',
        color: '#fff',
        fontFamily: '"Inter","Hiragino Kaku Gothic ProN",sans-serif',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* ヘッダ */}
      <header
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} color={accent} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em' }}>
            CORE {isIris ? 'Iris' : 'Prism'}
          </span>
        </div>
        <span
          style={{
            fontSize: 10.5, fontWeight: 700,
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.7)',
            padding: '4px 9px', borderRadius: 999,
          }}
        >
          シェアされた{kind}
        </span>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '1.4rem 1.1rem 3rem' }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.35, margin: 0 }}>
            {artifact.title || `${kind}が届きました`}
          </h1>
          {author && (
            <p style={{ marginTop: 6, fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>
              {author} さんが {kind} を共有しました
            </p>
          )}

          {artifact.imageUrl ? (
            <img
              src={artifact.imageUrl}
              alt={artifact.title}
              style={{
                width: '100%', borderRadius: 14, marginTop: 16,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}

          {artifact.body && (
            <div
              style={{
                marginTop: 16,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: '1.1rem 1.1rem',
                whiteSpace: 'pre-wrap',
                fontSize: 14,
                lineHeight: 1.75,
                color: 'rgba(255,255,255,0.92)',
              }}
            >
              {artifact.body}
            </div>
          )}

          {!artifact.imageUrl && !artifact.body && (
            <div
              style={{
                marginTop: 16, padding: '1.4rem 1.1rem',
                background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)',
                borderRadius: 14, color: 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13,
              }}
            >
              <ImageOff size={16} />
              プレビューは省略されています。続きはアプリでご覧ください。
            </div>
          )}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            marginTop: 26,
            padding: '1.4rem 1.2rem',
            borderRadius: 16,
            background: `linear-gradient(135deg, ${accent}33, ${accent}11)`,
            border: `1px solid ${accent}55`,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 800, color: accent, letterSpacing: '0.08em', margin: 0 }}>
            あなたも作ってみませんか
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: '8px 0 4px' }}>
            CORE {isIris ? 'Iris' : 'Prism'} なら 5 分で同じものが作れます
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 16px' }}>
            14 日間無料・クレジットカード不要・いつでも解約可
          </p>
          <button
            type="button"
            onClick={onEnterApp}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              color: '#fff', border: 'none', borderRadius: 999,
              padding: '12px 26px',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              boxShadow: `0 10px 30px ${accent}55`,
              minHeight: 44,
            }}
          >
            無料ではじめる <ArrowRight size={15} />
          </button>
        </motion.div>

        <p style={{ marginTop: 22, fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          このリンクは送り主のブラウザ内で作られたものです。<br />
          CORE はあなたの情報を勝手に集めません。
        </p>
      </main>
    </div>
  );
}
