// ============================================================
// Invite & Share Card — 1 紹介 = 両者に +7 日トライアル延長
// Day 2 upgrade:
//   - 巨大ヒーロー (「友だちが登録すると、あなたも友だちも 7 日無料追加」)
//   - 3 連スタッツ (紹介人数 / 累計獲得日数 / 現在の trial 残日数)
//   - 5 シェア導線 (LINE / X / メール / リンクコピー / QR コード)
//   - コピー成功スナックバー
//   - 共有テキストの強化 (LINE / X / メールごとに最適化)
// 触らない: CheckoutModal / billing.ts / StripeFailureBanner
// ============================================================
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Copy, Share2, Check, Gift, QrCode, Mail,
  Calendar, MessageCircle,
} from 'lucide-react';

// lucide-react から Twitter アイコンは削除されたため X glyph を inline SVG で実装
function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2H21.5l-7.5 8.575L22.5 22h-6.844l-5.36-6.99L4.16 22H.9l8.025-9.17L1 2h6.95l4.85 6.41L18.244 2Zm-1.2 18h1.78L7.045 4H5.158l11.886 16Z" />
    </svg>
  );
}
import { type Brand, loadBillingUser, isTrialActive } from '../lib/billing';
import {
  getReferralData, getReferralUrl, REFERRAL_BONUS_DAYS,
  getInviterName, saveInviterName, INVITER_NAME_MAX, sanitizeInviterName,
  getInviterMessage, saveInviterMessage, INVITER_MESSAGE_MAX, sanitizeInviterMessage,
  getShareCount, recordShare,
} from '../lib/referral';
import { shareToInstagram } from '../iris/instagramShare';

type Palette = {
  accent: string;
  ink: string;
  inkSoft: string;
  card: string;
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

// ─────────────────────────────────────────────────────────────
// 共有テキストテンプレ — チャネルごとに最適化
// ─────────────────────────────────────────────────────────────
function shareTextLine(url: string, brand: Brand, inviterName: string): string {
  const product = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const who = inviterName ? `${inviterName}です。` : '';
  return `【共有】${who}${product} めっちゃ便利。これで AI 13 役員が代わりに働いてくれる。
あなたも 7 日無料、さらに僕からの招待で +${REFERRAL_BONUS_DAYS} 日 (合計 ${7 + REFERRAL_BONUS_DAYS} 日無料) →
${url}`;
}

function shareTextX(url: string, brand: Brand, inviterName: string): string {
  const product = brand === 'iris' ? '@core_iris' : '@core_prism';
  const who = inviterName ? `(${inviterName} の紹介) ` : '';
  return `13 人の AI 役員が代わりに働く ${product}、めちゃ良い。${who}リンクから登録すると 7 日無料 +${REFERRAL_BONUS_DAYS} 日 →
${url}`;
}

function shareTextMail(url: string, brand: Brand, inviterName: string): { subject: string; body: string } {
  const product = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const tagline = brand === 'iris'
    ? 'クリエイター向けの AI 戦略パートナー'
    : 'AI が経営判断を補助する人格 OS';
  const sender = inviterName || 'わたし';
  return {
    subject: `${product} を試してみてほしい (${7 + REFERRAL_BONUS_DAYS} 日無料)`,
    body: `こんにちは、

最近使っている ${product} (${tagline}) がとても便利で、
${sender} からの招待リンクから登録すると 7 日無料に +${REFERRAL_BONUS_DAYS} 日 (合計 ${7 + REFERRAL_BONUS_DAYS} 日) 無料で試せます。

▼ 登録リンク
${url}

クレジットカードは不要、合わなければそのまま放置で OK です。
よければ触ってみてください。

— ${sender}`,
  };
}

function shareTextGeneric(url: string, brand: Brand, inviterName: string): string {
  const product = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const opener = inviterName
    ? `${inviterName} です。${product} を試してます。`
    : `${product} を試してます。`;
  return `${opener}
このリンクから登録すると 7 日間無料トライアル + さらに +${REFERRAL_BONUS_DAYS} 日延長 (合計 ${7 + REFERRAL_BONUS_DAYS} 日無料)。
${url}`;
}

// 現在のトライアル残日数 (free プランの時のみ。それ以外は null)
function getTrialDaysLeft(): number | null {
  const u = loadBillingUser();
  if (!u || !isTrialActive(u) || !u.trialEndsAt) return null;
  const ms = new Date(u.trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86400000);
}

export default function InviteShareCard({ brand, palette, compact = false }: Props) {
  const p = { ...DEFAULT_PALETTE, ...(palette || {}) };
  const referral = useMemo(() => getReferralData(), []);
  const [inviterName, setInviterName] = useState<string>(() => getInviterName());
  const cleanName = useMemo(() => sanitizeInviterName(inviterName), [inviterName]);
  const [inviterMsg, setInviterMsg] = useState<string>(() => getInviterMessage());
  const cleanMsg = useMemo(() => sanitizeInviterMessage(inviterMsg), [inviterMsg]);
  const url = useMemo(
    () => getReferralUrl(brand, referral.myCode, { from: cleanName, msg: cleanMsg }),
    [brand, referral.myCode, cleanName, cleanMsg],
  );
  // 汎用 (Web Share API / Insta / 互換用) のテキスト
  const text = useMemo(() => shareTextGeneric(url, brand, cleanName), [url, brand, cleanName]);
  const trialDaysLeft = useMemo(() => getTrialDaysLeft(), []);

  const [copied, setCopied] = useState<'url' | 'text' | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [shareCount, setShareCount] = useState<number>(() => getShareCount());

  // シェアアクションのたびに端末ローカルの実カウントを +1 (正直な数値)
  const bumpShare = useCallback(() => setShareCount(recordShare()), []);

  // 名前を 600ms デバウンスで localStorage に保存
  useEffect(() => {
    const id = setTimeout(() => saveInviterName(inviterName), 600);
    return () => clearTimeout(id);
  }, [inviterName]);

  // 一言メッセージを 600ms デバウンスで localStorage に保存
  useEffect(() => {
    const id = setTimeout(() => saveInviterMessage(inviterMsg), 600);
    return () => clearTimeout(id);
  }, [inviterMsg]);

  // 紹介 URL の QR コード (qrserver.com の無料 API、認証なし)
  const qrUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(url)}`,
    [url],
  );

  const flashSnack = useCallback((message: string) => {
    setSnack(message);
    setTimeout(() => setSnack(null), 2200);
  }, []);

  const flashCopied = useCallback((kind: 'url' | 'text', message: string) => {
    setCopied(kind);
    flashSnack(message);
    setTimeout(() => setCopied(null), 1800);
  }, [flashSnack]);

  const copyText = useCallback(async (value: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  const copyUrl = useCallback(async () => {
    const ok = await copyText(url);
    if (ok) { flashCopied('url', '✓ リンクをコピーしました!'); bumpShare(); }
    else flashSnack('コピーに失敗しました');
  }, [url, copyText, flashCopied, flashSnack, bumpShare]);

  const copyInviteText = useCallback(async () => {
    const ok = await copyText(text);
    if (ok) { flashCopied('text', '✓ 招待文をコピーしました!'); bumpShare(); }
    else flashSnack('コピーに失敗しました');
  }, [text, copyText, flashCopied, flashSnack, bumpShare]);

  const shareLine = useCallback(() => {
    const lineText = shareTextLine(url, brand, cleanName);
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`;
    window.open(lineUrl, '_blank', 'noopener,noreferrer');
    flashSnack('LINE を開きました');
    bumpShare();
  }, [url, brand, cleanName, flashSnack, bumpShare]);

  const shareX = useCallback(() => {
    const xText = shareTextX(url, brand, cleanName);
    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}`;
    window.open(xUrl, '_blank', 'noopener,noreferrer');
    flashSnack('X を開きました');
    bumpShare();
  }, [url, brand, cleanName, flashSnack, bumpShare]);

  const shareMail = useCallback(() => {
    const { subject, body } = shareTextMail(url, brand, cleanName);
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // PWA / iOS では mailto 起動を window.location に流すと標準クライアントが開く
    window.location.href = mailto;
    flashSnack('メールクライアントを開きました');
    bumpShare();
  }, [url, brand, cleanName, flashSnack, bumpShare]);

  const shareNative = useCallback(async () => {
    const navAny = navigator as any;
    if (navAny.share) {
      try {
        await navAny.share({
          title: brand === 'iris' ? 'CORE Iris' : 'CORE Prism',
          text,
          url,
        });
        flashSnack('✓ 共有しました');
        bumpShare();
      } catch (e: any) {
        if (e?.name !== 'AbortError') flashSnack('共有がキャンセルされました');
      }
    } else {
      const ok = await copyText(text);
      flashSnack(ok ? '✓ 本文をコピーしました (共有 API 非対応)' : 'コピーに失敗しました');
      if (ok) bumpShare();
    }
  }, [text, url, brand, copyText, flashSnack, bumpShare]);

  const shareInstagram = useCallback(async () => {
    const r = await shareToInstagram({ caption: text });
    flashSnack(r.message);
    bumpShare();
  }, [text, flashSnack, bumpShare]);

  const sectionPad = compact ? '1rem' : '1.5rem 1.25rem';
  const radius = 20;

  // ヒーローのバナー色 (緑系で「無料」訴求)
  const heroGradient = `linear-gradient(135deg, ${p.accent}, ${p.accent}aa)`;

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
      position: 'relative',
    }}>
      {/* ─── ヒーロー (巨大訴求) ─── */}
      <div style={{
        background: heroGradient,
        borderRadius: 16,
        padding: compact ? '1rem 1rem 1.1rem' : '1.35rem 1.2rem 1.5rem',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
        }} />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase',
          background: 'rgba(255,255,255,0.18)',
          padding: '0.25rem 0.65rem', borderRadius: 999,
          marginBottom: '0.65rem',
        }}>
          <Gift size={12} strokeWidth={2.5} /> 友達招待プログラム
        </div>
        <h2 style={{
          margin: 0,
          fontSize: compact ? '1.15rem' : '1.45rem',
          fontWeight: 900,
          lineHeight: 1.3,
          letterSpacing: '-0.01em',
        }}>
          友だちが登録すると、<br />
          <span style={{
            background: 'rgba(255,255,255,0.22)',
            padding: '0.05rem 0.5rem',
            borderRadius: 8,
            display: 'inline-block',
            marginTop: '0.2rem',
          }}>
            あなたも友だちも 7 日無料追加
          </span>
        </h2>
        <p style={{
          margin: '0.7rem 0 0', fontSize: '0.82rem',
          color: 'rgba(255,255,255,0.92)',
          lineHeight: 1.55,
        }}>
          通常 7 日 → 合計 <strong>{7 + REFERRAL_BONUS_DAYS} 日無料</strong>。
          クレジットカード登録なしで試せます。
        </p>
      </div>

      {/* ─── 3 連スタッツ ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.5rem',
      }}>
        <Stat icon={<Share2 size={13} />} label="シェア回数" value={`${shareCount}`} suffix="回" palette={p} />
        <Stat icon={<Gift size={13} />} label="友達1人につき" value={`+${REFERRAL_BONUS_DAYS}`} suffix="日" palette={p} />
        <Stat
          icon={<Calendar size={13} />}
          label="trial 残"
          value={trialDaysLeft === null ? '—' : `${trialDaysLeft}`}
          suffix={trialDaysLeft === null ? '' : '日'}
          palette={p}
        />
      </div>

      {/* ─── あなたの名前 (任意) ─── */}
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <label style={{
          fontSize: '0.7rem', letterSpacing: '0.06em', color: p.inkSoft,
          fontWeight: 700,
        }}>
          あなたの名前 (任意 — 招待された人に表示されます)
        </label>
        <input
          type="text"
          value={inviterName}
          onChange={(e) => setInviterName(e.target.value)}
          placeholder="例: 直毅 / Naoki / なお"
          maxLength={INVITER_NAME_MAX * 2}
          autoComplete="nickname"
          style={{
            background: '#fff', color: p.ink,
            border: `1px solid ${p.border}`, borderRadius: 10,
            padding: '0.6rem 0.7rem', fontSize: '0.88rem',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        {cleanName && (
          <p style={{ margin: 0, fontSize: '0.7rem', color: p.inkSoft }}>
            招待された人は「<strong style={{ color: p.accent }}>{cleanName} さんからの招待</strong>」と見えます
          </p>
        )}
      </div>

      {/* ─── 一言メッセージ (任意) ─── */}
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <label style={{
          fontSize: '0.7rem', letterSpacing: '0.06em', color: p.inkSoft,
          fontWeight: 700,
        }}>
          ひとことメッセージ (任意 — 招待された人に表示されます)
        </label>
        <input
          type="text"
          value={inviterMsg}
          onChange={(e) => setInviterMsg(e.target.value)}
          placeholder="例: これ本当に便利だから一回触ってみて!"
          maxLength={INVITER_MESSAGE_MAX}
          style={{
            background: '#fff', color: p.ink,
            border: `1px solid ${p.border}`, borderRadius: 10,
            padding: '0.6rem 0.7rem', fontSize: '0.88rem',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        {cleanMsg && (
          <p style={{
            margin: 0, fontSize: '0.7rem', color: p.inkSoft,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Gift size={11} style={{ color: p.accent, flexShrink: 0 }} />
            <span>登録画面に「<strong style={{ color: p.accent }}>{cleanMsg}</strong>」と表示されます</span>
          </p>
        )}
      </div>

      {/* ─── 紹介 URL ボックス ─── */}
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
          <button
            onClick={copyUrl}
            aria-label="紹介 URL をコピー"
            style={{
              background: copied === 'url' ? '#16A34A' : p.accent,
              color: '#fff', border: 'none', borderRadius: 'var(--cp-radius-sm)',
              padding: '0.55rem 0.75rem', fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              whiteSpace: 'nowrap',
              transition: 'transform var(--cp-duration-fast) var(--cp-ease-out), background var(--cp-duration-fast) var(--cp-ease-smooth)',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = '')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = '')}>
            {copied === 'url' ? <><Check size={13} />OK</> : <><Copy size={13} />コピー</>}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.7rem', color: p.inkSoft }}>
          紹介コード <strong style={{ color: p.accent, letterSpacing: '0.1em' }}>{referral.myCode}</strong>
        </p>
      </div>

      {/* ─── 5 シェア導線 (LINE / X / メール / リンクコピー / QR) ─── */}
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <p style={{
          margin: 0, fontSize: '0.7rem', letterSpacing: '0.08em',
          color: p.inkSoft, fontWeight: 700, textTransform: 'uppercase',
        }}>
          シェアして招待する
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '0.4rem',
        }}>
          <ShareIconBtn
            label="LINE"
            bg="#06C755"
            icon={<MessageCircle size={18} strokeWidth={2.2} />}
            onClick={shareLine}
          />
          <ShareIconBtn
            label="X"
            bg="#000000"
            icon={<XIcon size={18} />}
            onClick={shareX}
          />
          <ShareIconBtn
            label="メール"
            bg="#0EA5E9"
            icon={<Mail size={18} strokeWidth={2.2} />}
            onClick={shareMail}
          />
          <ShareIconBtn
            label={copied === 'text' ? 'コピー済' : 'コピー'}
            bg={copied === 'text' ? '#16A34A' : '#5A4570'}
            icon={copied === 'text' ? <Check size={18} strokeWidth={2.5} /> : <Copy size={18} strokeWidth={2.2} />}
            onClick={copyInviteText}
          />
          <ShareIconBtn
            label={showQr ? 'QR 閉' : 'QR'}
            bg={showQr ? p.accent : '#475569'}
            icon={<QrCode size={18} strokeWidth={2.2} />}
            onClick={() => setShowQr(v => !v)}
          />
        </div>

        {/* 共有シート (ネイティブ) — モバイルでさらに広く配れる */}
        <button onClick={shareNative}
          style={{
            background: 'transparent',
            color: p.accent,
            border: `1px solid ${p.accent}55`,
            borderRadius: 12,
            padding: '0.6rem',
            fontSize: '0.82rem', fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
          }}>
          <Share2 size={14} />
          その他のアプリで共有 (Instagram, Slack 他)
        </button>

        {/* Instagram は別ボタン (ストーリーズへ貼り付け前提) */}
        <button onClick={shareInstagram}
          style={{
            background: 'linear-gradient(135deg,#FEDA75,#FA7E1E 30%,#D62976 60%,#962FBF 80%,#4F5BD5)',
            color: '#fff', border: 'none', borderRadius: 12,
            padding: '0.6rem', fontSize: '0.82rem', fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
          }}>
          Instagram ストーリーズに貼り付ける
        </button>

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

      {/* ─── スナックバー (コピー成功時のマイクロインタラクション) ─── */}
      {snack && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            bottom: 12, left: '50%',
            transform: 'translateX(-50%)',
            background: '#16A34A',
            color: '#fff',
            padding: '0.55rem 1rem',
            borderRadius: 999,
            fontSize: '0.82rem',
            fontWeight: 700,
            boxShadow: '0 8px 24px rgba(22,163,74,0.45)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            zIndex: 5,
            animation: 'inviteSnack 0.25s ease-out',
          }}
        >
          {snack}
        </div>
      )}

      {/* ─── フッター ─── */}
      <p style={{
        margin: 0, fontSize: '0.7rem', color: p.inkSoft, lineHeight: 1.55,
      }}>
        ※ 招待されたユーザーが新規登録した時点で両者にトライアル +{REFERRAL_BONUS_DAYS} 日が自動付与されます。
        既存ユーザーへの再付与はありません。
      </p>

      <style>{`
        @keyframes inviteSnack {
          from { opacity: 0; transform: translate(-50%, 6px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}

function Stat({ icon, label, value, suffix, palette }: {
  icon: React.ReactNode; label: string; value: string; suffix?: string; palette: Palette;
}) {
  return (
    <div style={{
      background: `${palette.accent}08`, borderRadius: 12,
      padding: '0.6rem 0.55rem', border: `1px solid ${palette.border}`,
      textAlign: 'center',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: '0.62rem', color: palette.inkSoft, fontWeight: 700,
        letterSpacing: '0.04em',
      }}>
        <span style={{ color: palette.accent }}>{icon}</span>{label}
      </div>
      <div style={{
        marginTop: 2,
        fontSize: '1.25rem', fontWeight: 900,
        color: palette.ink, letterSpacing: '-0.02em',
        lineHeight: 1.1,
      }}>
        {value}
        {suffix && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, marginLeft: 2,
            color: palette.inkSoft,
          }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

function ShareIconBtn({ label, bg, icon, onClick }: {
  label: string;
  bg: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        background: bg, color: '#fff', border: 'none', borderRadius: 12,
        padding: '0.7rem 0.3rem',
        fontSize: '0.7rem', fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 4,
        transition: 'transform var(--cp-duration-fast) var(--cp-ease-out), opacity var(--cp-duration-fast) var(--cp-ease-smooth)',
        minHeight: 60,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = '')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
