// ============================================================
// Invite & Share Card — 1 紹介 = 両者に +7 日トライアル延長
// LINE / X (Twitter) / メール / Instagram / 共有シート / コピーに対応
// Iris と Prism 両ダッシュボードから利用
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { Copy, Share2, Check, Gift, Users as UsersIcon, Sparkles, Mail, QrCode } from 'lucide-react';
import { type Brand } from '../lib/billing';
import { getReferralData, getReferralUrl, REFERRAL_BONUS_DAYS } from '../lib/referral';
import { shareToInstagram } from '../iris/instagramShare';

type Palette = {
  /** 主アクセント色 (hex) */
  accent: string;
  /** 文字主色 */
  ink: string;
  /** 薄い文字色 */
  inkSoft: string;
  /** カード背景 */
  card: string;
  /** カード罫線 */
  border: string;
};

const DEFAULT_PALETTE: Palette = {
  accent: '#7C5CFF',
  ink: '#1F1A2E',
  inkSoft: '#5A4570',
  card: '#FFFFFF',
  border: 'rgba(31,26,46,0.08)',
};

interface Props {
  brand: Brand;
  palette?: Partial<Palette>;
  /** カードを compact 表示 (Prism サイドバー等) */
  compact?: boolean;
}

const SHARE_TEMPLATE = (url: string, brand: Brand) => {
  const product = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const tagline = brand === 'iris'
    ? 'クリエイター向け AI 戦略パートナー'
    : 'AI が経営判断を補助する人格 OS';
  return `${product} (${tagline}) を試してます。
このリンクから登録すると 7 日間の無料トライアル + さらに +${REFERRAL_BONUS_DAYS} 日延長 (合計 ${7 + REFERRAL_BONUS_DAYS} 日無料)。
${url}`;
};

const EMAIL_SUBJECT = (brand: Brand) =>
  brand === 'iris'
    ? 'CORE Iris に招待します — 14 日間 無料で試せます'
    : 'CORE Prism に招待します — 14 日間 無料で試せます';

export default function InviteShareCard({ brand, palette, compact = false }: Props) {
  const p = { ...DEFAULT_PALETTE, ...(palette || {}) };
  const referral = useMemo(() => getReferralData(), []);
  const url = useMemo(() => getReferralUrl(brand, referral.myCode), [brand, referral.myCode]);
  const text = useMemo(() => SHARE_TEMPLATE(url, brand), [url, brand]);

  const [copied, setCopied] = useState<'url' | 'text' | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  // 紹介 URL の QR コード (qrserver.com の無料 API、認証なし)
  const qrUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(url)}`,
    [url],
  );

  const flashCopied = useCallback((kind: 'url' | 'text') => {
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }, []);

  const copy = useCallback(async (value: string, kind: 'url' | 'text') => {
    try {
      await navigator.clipboard.writeText(value);
      flashCopied(kind);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      flashCopied(kind);
    }
  }, [flashCopied]);

  const shareNative = useCallback(async () => {
    const navAny = navigator as any;
    if (navAny.share) {
      try {
        await navAny.share({
          title: brand === 'iris' ? 'CORE Iris' : 'CORE Prism',
          text,
          url,
        });
        setShareMsg('✓ 共有しました');
      } catch (e: any) {
        if (e?.name !== 'AbortError') setShareMsg('共有がキャンセルされました');
      }
    } else {
      copy(text, 'text');
      setShareMsg('共有 API 非対応。本文をコピーしました');
    }
    setTimeout(() => setShareMsg(null), 2400);
  }, [text, url, brand, copy]);

  const shareLine = useCallback(() => {
    // LINE 共有 URL — テキスト + URL を渡す
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(lineUrl, '_blank', 'noopener,noreferrer');
  }, [text]);

  const shareX = useCallback(() => {
    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(xUrl, '_blank', 'noopener,noreferrer');
  }, [text]);

  const shareEmail = useCallback(() => {
    const subject = EMAIL_SUBJECT(brand);
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailto;
  }, [text, brand]);

  const shareInstagram = useCallback(async () => {
    // Instagram は URL 共有が公式に無いので、URL+text をクリップボードに入れて
    // アプリを起動 → ストーリーズかフィードに貼る前提
    const r = await shareToInstagram({ caption: text });
    setShareMsg(r.message);
    setTimeout(() => setShareMsg(null), 3000);
  }, [text]);

  const sectionPad = compact ? '1rem' : '1.5rem 1.25rem';
  const radius = 20;

  return (
    <div style={{
      background: p.card,
      borderRadius: radius,
      border: `1px solid ${p.border}`,
      padding: sectionPad,
      boxShadow: '0 4px 16px rgba(31,26,46,0.05)',
      display: 'grid',
      gap: '1rem',
      color: p.ink,
    }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${p.accent}18`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Gift size={20} color={p.accent} strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: 0, fontSize: compact ? '0.95rem' : '1.05rem',
            fontWeight: 800, color: p.ink, letterSpacing: '0.01em',
          }}>
            友達を招待してトライアル +{REFERRAL_BONUS_DAYS} 日
          </h3>
          <p style={{
            margin: '0.15rem 0 0', fontSize: '0.78rem', color: p.inkSoft,
            lineHeight: 1.45,
          }}>
            1 人紹介すると、あなたも相手も <strong>+{REFERRAL_BONUS_DAYS} 日</strong> 無料利用
          </p>
        </div>
      </div>

      {/* スタッツ */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem',
      }}>
        <Stat icon={<UsersIcon size={14} />} label="紹介人数" value={`${referral.referredCount} 人`} palette={p} />
        <Stat icon={<Sparkles size={14} />} label="累計延長" value={`+${referral.bonusDays} 日`} palette={p} />
      </div>

      {/* 紹介 URL ボックス */}
      <div style={{
        background: `${p.accent}0a`,
        border: `1px dashed ${p.accent}44`,
        borderRadius: 14,
        padding: '0.8rem 0.85rem',
        display: 'grid', gap: '0.55rem',
      }}>
        <p style={{
          margin: 0, fontSize: '0.68rem', letterSpacing: '0.18em',
          color: p.inkSoft, fontWeight: 700, textTransform: 'uppercase',
        }}>
          あなたの紹介 URL
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: '#fff', borderRadius: 10,
          border: `1px solid ${p.border}`, padding: '0.55rem 0.7rem',
        }}>
          <code style={{
            flex: 1, fontSize: '0.78rem', color: p.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>{url}</code>
          <button onClick={() => copy(url, 'url')}
            aria-label="紹介 URL をコピー"
            style={{
              background: copied === 'url' ? '#16A34A' : p.accent,
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '0.4rem 0.65rem', fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              whiteSpace: 'nowrap',
            }}>
            {copied === 'url' ? <><Check size={13} />コピー済</> : <><Copy size={13} />コピー</>}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.7rem', color: p.inkSoft }}>
          紹介コード <strong style={{ color: p.accent, letterSpacing: '0.1em' }}>{referral.myCode}</strong>
        </p>
      </div>

      {/* 共有ボタン群 */}
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <button onClick={shareNative}
          style={{
            background: `linear-gradient(135deg, ${p.accent}, ${p.accent}cc)`,
            color: '#fff', border: 'none', borderRadius: 14,
            padding: '0.9rem', fontSize: '0.92rem', fontWeight: 800,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            boxShadow: `0 8px 22px ${p.accent}45`,
          }}>
          <Share2 size={16} />
          共有シートを開く
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
          <SocialBtn label="LINE" bg="#06C755" onClick={shareLine} />
          <SocialBtn label="X" bg="#000000" onClick={shareX} />
          <SocialBtn label={<><Mail size={13} style={{ marginRight: 4 }} />メール</>} bg="#5A4570" onClick={shareEmail} />
          <SocialBtn label="Insta" bg="linear-gradient(135deg,#FEDA75,#FA7E1E 30%,#D62976 60%,#962FBF 80%,#4F5BD5)" onClick={shareInstagram} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button onClick={() => copy(text, 'text')}
            style={{
              background: 'transparent', color: p.inkSoft,
              border: `1px solid ${p.border}`, borderRadius: 12,
              padding: '0.75rem', fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', gap: 6,
            }}>
            {copied === 'text' ? <><Check size={13} />本文コピー済</> : <><Copy size={13} />招待文をコピー</>}
          </button>
          <button onClick={() => setShowQr(v => !v)}
            aria-pressed={showQr}
            style={{
              background: showQr ? p.accent : 'transparent',
              color: showQr ? '#fff' : p.inkSoft,
              border: showQr ? 'none' : `1px solid ${p.border}`,
              borderRadius: 12,
              padding: '0.75rem', fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', gap: 6,
            }}>
            <QrCode size={13} />{showQr ? 'QR を隠す' : 'QR コード表示'}
          </button>
        </div>

        {showQr && (
          <div
            data-testid="referral-qr-panel"
            style={{
              display: 'grid', justifyItems: 'center', gap: '0.55rem',
              background: '#fff', border: `1px dashed ${p.accent}55`,
              borderRadius: 14, padding: '1rem',
            }}>
            <img
              src={qrUrl}
              alt="紹介リンクの QR コード"
              width={200}
              height={200}
              loading="lazy"
              style={{ borderRadius: 8, display: 'block' }}
            />
            <p style={{ margin: 0, fontSize: '0.72rem', color: p.inkSoft, textAlign: 'center', lineHeight: 1.55 }}>
              友達のスマホで読み込むだけ。<br />
              対面・カフェ・名刺裏にも貼れます
            </p>
          </div>
        )}
      </div>

      {shareMsg && (
        <p style={{
          margin: 0, fontSize: '0.78rem', color: p.accent,
          textAlign: 'center', fontWeight: 700,
        }}>
          {shareMsg}
        </p>
      )}

      {/* フッター */}
      <p style={{
        margin: 0, fontSize: '0.7rem', color: p.inkSoft, lineHeight: 1.55,
      }}>
        ※ 招待されたユーザーが新規登録した時点で両者にトライアル +{REFERRAL_BONUS_DAYS} 日が自動付与されます。
        既存ユーザーへの再付与はありません。
      </p>
    </div>
  );
}

function Stat({ icon, label, value, palette }: {
  icon: React.ReactNode; label: string; value: string; palette: Palette;
}) {
  return (
    <div style={{
      background: `${palette.accent}08`, borderRadius: 12,
      padding: '0.65rem 0.75rem', border: `1px solid ${palette.border}`,
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: '0.7rem', color: palette.inkSoft, fontWeight: 700,
        letterSpacing: '0.04em',
      }}>
        <span style={{ color: palette.accent }}>{icon}</span>{label}
      </div>
      <div style={{
        marginTop: 2, fontSize: '1.15rem', fontWeight: 800,
        color: palette.ink, letterSpacing: '-0.02em',
      }}>{value}</div>
    </div>
  );
}

function SocialBtn({ label, bg, onClick }: { label: React.ReactNode; bg: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        background: bg, color: '#fff', border: 'none', borderRadius: 12,
        padding: '0.7rem 0.4rem', fontSize: '0.78rem', fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
      {label}
    </button>
  );
}
