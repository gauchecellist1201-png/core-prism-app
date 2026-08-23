// ============================================================
// Invite & Share Card — 1 紹介 = 両者に +REFERRAL_BONUS_DAYS 日トライアル延長
//   (実際の日数は src/lib/referral.ts の定数が正本。
//    ここに数字を直書きすると、また画面と食い違うので書かない)
// Day 2 upgrade:
//   - 巨大ヒーロー (「友だちが登録すると、あなたも友だちも無料期間が追加」)
//   - 3 連スタッツ (紹介人数 / 累計獲得日数 / 現在の無料期間の残り日数)
//   - 5 シェア導線 (LINE / X / メール / リンクコピー / QR コード)
//   - コピー成功スナックバー
//   - 共有テキストの強化 (LINE / X / メールごとに最適化)
// 触らない: CheckoutModal / billing.ts / StripeFailureBanner
// ============================================================
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Copy, Share2, Check, Gift, QrCode, Mail,
  Calendar, MessageCircle, Users, Sparkles, Download,
} from 'lucide-react';
import { onAccentInk } from '../lib/contrast';

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
import { type Brand, loadBillingUser, isTrialActive, extendTrial } from '../lib/billing';
import {
  applyPendingBonusDays,
  getReferralData, getReferralUrl, REFERRAL_BONUS_DAYS,
  getInviterName, saveInviterName, INVITER_NAME_MAX, sanitizeInviterName,
  getInviterMessage, saveInviterMessage, INVITER_MESSAGE_MAX, sanitizeInviterMessage,
  getShareCount, recordShare, syncReferralStatus,
  TRIAL_BASE_DAYS, TRIAL_WITH_REFERRAL_DAYS,
} from '../lib/referral';
import { shareToInstagram } from '../iris/instagramShare';
// 招待でおくる文章は別ファイル (回帰テストから読めるようにするため)
import { shareTextLine, shareTextX, shareTextMail, shareTextGeneric } from './inviteShareText';

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
  // 残日数は「今のばした分」を足した後の値を出すため state で持つ (mount 時の値で固定しない)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(() => getTrialDaysLeft());

  const [copied, setCopied] = useState<'url' | 'text' | null>(null);
  // スナックバーは「うまくいった時」だけ緑。
  // 以前は色が緑で固定されていたので、「コピーに失敗しました」も
  // 「共有をキャンセルしました」も、成功と同じ緑の帯で出ていた。
  const [snack, setSnack] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const [showQr, setShowQr] = useState(false);
  // QR は外部 API (qrserver) 生成。読み込み失敗時に壊れた画像を黙って出さないためのフラグ
  const [qrError, setQrError] = useState(false);
  const [shareCount, setShareCount] = useState<number>(() => getShareCount());

  // あなたの紹介の「実績」(登録した友達の人数 / 累計獲得日数) — 開いた瞬間にサーバへ同期して最新化
  const [referredCount, setReferredCount] = useState<number>(() => referral.referredCount);
  const [earnedDays, setEarnedDays] = useState<number>(() => referral.bonusDays);
  // 今この場でトライアル期限へ足せた日数 (0 なら何も出さない)
  const [justApplied, setJustApplied] = useState<number>(0);
  useEffect(() => {
    let alive = true;
    syncReferralStatus()
      .then((r) => {
        if (!alive) return;
        setReferredCount(r.referredCount);
        setEarnedDays(r.bonusDays);
        // ★ここで実際に trialEndsAt をのばす。
        //   Iris はこのカードしか紹介の入口が無く、以前は日数が画面に出るだけで
        //   本物のトライアルは 1 日ものびていなかった。
        const applied = applyPendingBonusDays(extendTrial);
        if (applied > 0) {
          setJustApplied(applied);
          setTrialDaysLeft(getTrialDaysLeft()); // のびた後の残日数へ差し替え
        }
      })
      .catch(() => { /* オフライン等は現状維持 — 嘘の数字は出さない */ });
    return () => { alive = false; };
  }, []);

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
  // URL が変われば QR を作り直すのでエラー状態もリセット
  useEffect(() => { setQrError(false); }, [qrUrl]);

  const flashSnack = useCallback((message: string, tone: 'ok' | 'warn' = 'ok') => {
    setSnack({ text: message, tone });
    setTimeout(() => setSnack(null), tone === 'warn' ? 3600 : 2200);
  }, []);

  // QR 画像を端末に保存 (対面・名刺・ポスター用)。CORS 不可なら新規タブで開いて長押し保存に逃がす
  const downloadQr = useCallback(async () => {
    try {
      const resp = await fetch(qrUrl);
      if (!resp.ok) throw new Error('qr fetch failed');
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `core-${brand}-invite-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
      flashSnack('QR 画像を保存しました');
      bumpShare();
    } catch {
      window.open(qrUrl, '_blank', 'noopener,noreferrer');
      flashSnack('QR を新しいタブで開きました (長押しで保存)');
    }
  }, [qrUrl, brand, flashSnack, bumpShare]);

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
    else flashSnack('コピーできませんでした。上の URL を長押しして、手でコピーしてください', 'warn');
  }, [url, copyText, flashCopied, flashSnack, bumpShare]);

  const copyInviteText = useCallback(async () => {
    const ok = await copyText(text);
    if (ok) { flashCopied('text', '✓ 招待文をコピーしました!'); bumpShare(); }
    else flashSnack('コピーできませんでした。上の URL を長押しして、手でコピーしてください', 'warn');
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
        // AbortError = 本人が共有シートを閉じただけ。何も知らせない。
        if (e?.name !== 'AbortError') flashSnack('共有できませんでした。下の「コピー」でリンクを送ってください', 'warn');
      }
    } else {
      const ok = await copyText(text);
      flashSnack(
        ok ? '✓ 招待文をコピーしました (この端末は共有シートに対応していません)'
           : 'コピーできませんでした。上の URL を長押しして、手でコピーしてください',
        ok ? 'ok' : 'warn',
      );
      if (ok) bumpShare();
    }
  }, [text, url, brand, copyText, flashSnack, bumpShare]);

  // Instagram: 画像は渡していないので、実際に起きるのは
  //   スマホ → 招待文をコピーして Instagram アプリを開く
  //   パソコン → 招待文をコピーするだけ
  // どちらもストーリーズの投稿画面までは行かない。ボタンの文言もそれに合わせてある。
  const shareInstagram = useCallback(async () => {
    const r = await shareToInstagram({ caption: text });
    const failed = r.method === 'failed' || r.message.includes('失敗');
    flashSnack(r.message, failed ? 'warn' : 'ok');
    if (!failed) bumpShare();
  }, [text, flashSnack, bumpShare]);

  const sectionPad = compact ? '1rem' : '1.5rem 1.25rem';
  const radius = 20;

  // ヒーローのバナー色 (緑系で「無料」訴求)
  const heroGradient = `linear-gradient(135deg, ${p.accent}, ${p.accent}aa)`;

  // アクセントの上に乗る文字色。呼び出し側が persona.accentColor
  // (#FBBF24 など明るい色もある) を渡すため、白固定だと読めなくなる
  const accentInk = onAccentInk(p.accent);

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
      {/* ─── 実績バナー — 実際に登録した友達がいる時だけ正直に祝う (0 は出さない) ─── */}
      {referredCount > 0 && (
        <div
          data-testid="referral-success-banner"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #22C55E)',
            borderRadius: 14,
            padding: '0.8rem 0.95rem',
            color: '#fff',
            display: 'flex', alignItems: 'center', gap: '0.65rem',
            boxShadow: '0 8px 22px rgba(22,163,74,0.32)',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.22)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Sparkles size={19} strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, lineHeight: 1.3 }}>
              あなたの紹介で {referredCount} 人が登録
            </p>
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.92)', lineHeight: 1.4 }}>
              これまでに合計 <strong>+{earnedDays} 日</strong> のトライアル延長を獲得しました。
            </p>
            {/* 今この場で本当に期限がのびた時だけ出す (のびていない時は黙る) */}
            {justApplied > 0 && (
              <p
                data-testid="referral-just-applied"
                style={{ margin: '0.3rem 0 0', fontSize: '0.76rem', fontWeight: 800, lineHeight: 1.4 }}
              >
                いま <strong>+{justApplied} 日</strong> を無料期間に追加しました
                {trialDaysLeft !== null && `（残り ${trialDaysLeft} 日）`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── ヒーロー (巨大訴求) ─── */}
      <div style={{
        background: heroGradient,
        borderRadius: 16,
        padding: compact ? '1rem 1rem 1.1rem' : '1.35rem 1.2rem 1.5rem',
        color: accentInk,
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
          <Gift size={12} strokeWidth={2.5} /> 友達を招待すると無料期間がのびます
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
            あなたも友だちも {REFERRAL_BONUS_DAYS} 日無料追加
          </span>
        </h2>
        <p style={{
          margin: '0.7rem 0 0', fontSize: '0.82rem',
          color: 'rgba(255,255,255,0.92)',
          lineHeight: 1.55,
        }}>
          通常 {TRIAL_BASE_DAYS} 日 → 合計 <strong>{TRIAL_WITH_REFERRAL_DAYS} 日無料</strong>。
          カード登録は Stripe の画面で行い、期限前に止めれば請求は 0 円です。
        </p>

        {/* 3 秒で分かる手順 — 「この画面で自分は何をすればいいのか」。
            上のヒーローは「もらえるもの」しか書いていなかったので、
            初めて開いた人は次に何を押せばいいか分からなかった。 */}
        <ol style={{
          margin: '0.85rem 0 0', padding: 0, listStyle: 'none',
          display: 'grid', gap: '0.3rem',
          fontSize: '0.78rem', lineHeight: 1.5,
          color: 'rgba(255,255,255,0.95)',
        }}>
          {[
            'あなた専用のリンクが、この下にもう出ています',
            'LINE・X・メールのどれかを押して、友達に送る',
            '友達がそのリンクから登録したら、2 人とも無料期間が ' + REFERRAL_BONUS_DAYS + ' 日のびます',
          ].map((step, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <span style={{
                flexShrink: 0,
                width: 17, height: 17, borderRadius: '50%',
                background: 'rgba(255,255,255,0.26)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.62rem', fontWeight: 900, marginTop: 2,
              }}>{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ─── 3 連スタッツ ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.5rem',
      }}>
        {/* 紹介実績がある人には実数を、まだ 0 の人には「シェア回数 + 1人あたり報酬」を見せる */}
        {referredCount > 0 ? (
          <>
            <Stat icon={<Users size={13} />} label="登録した友達" value={`${referredCount}`} suffix="人" palette={p} />
            <Stat icon={<Gift size={13} />} label="のびた無料期間" value={`+${earnedDays}`} suffix="日" palette={p} />
          </>
        ) : (
          <>
            {/* 「シェア回数」は友達の人数ではなく、この端末で送るボタンを押した回数。
                そう書かないと「5 回シェアしたのに 0 人」に見えて壊れていると思われる。 */}
            <Stat icon={<Share2 size={13} />} label="送った回数" value={`${shareCount}`} suffix="回" palette={p} />
            <Stat icon={<Gift size={13} />} label="友達1人につき" value={`+${REFERRAL_BONUS_DAYS}`} suffix="日" palette={p} />
          </>
        )}
        <Stat
          icon={<Calendar size={13} />}
          label="無料期間の残り"
          value={trialDaysLeft === null ? '—' : `${trialDaysLeft}`}
          suffix={trialDaysLeft === null ? '' : '日'}
          palette={p}
        />
      </div>

      {/* 「—」を説明せずに置くと、壊れているのか自分が損しているのか分からない */}
      {trialDaysLeft === null && (
        <p style={{ margin: '-0.4rem 0 0', fontSize: '0.7rem', color: p.inkSoft, lineHeight: 1.55 }}>
          「無料期間の残り」が <strong>—</strong> なのは、いま無料期間の中にいないからです
          （有料プランを使っている、または無料期間が終わっている）。招待は今でも送れます。
        </p>
      )}

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
        {/* ★minWidth: 0 が無いと、iPhone 幅でカード全体が右に切れる。
            この行は「カード (display:grid) の子」なので、既定の min-width:auto では
            中の紹介 URL (whiteSpace:nowrap) の全長より細くなれない。
            結果、カードの列が 508px に膨らみ、390px の画面では
            「無料期間の残り」「QR」と、すべての文の右端が画面の外に出て
            しかも横スクロールもできない (親が overflow-x:clip) 状態だった。
            実測: 列幅 507.875px → 308px。 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: '#fff', borderRadius: 10,
          border: `1px solid ${p.border}`, padding: '0.55rem 0.7rem',
          minWidth: 0,
        }}>
          <code style={{
            flex: 1, minWidth: 0, fontSize: '0.78rem', color: p.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>{url}</code>
          <button
            onClick={copyUrl}
            aria-label="紹介 URL をコピー"
            style={{
              background: copied === 'url' ? '#16A34A' : p.accent,
              color: copied === 'url' ? '#fff' : accentInk,
              border: 'none', borderRadius: 'var(--cp-radius-sm)',
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
            ink={showQr ? accentInk : '#fff'}
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
          ほかのアプリを選んで送る
        </button>

        {/* Instagram ボタン。
            以前の文言は「Instagram ストーリーズに貼り付ける」だったが、
            画像を渡していないので実際にストーリーズの投稿画面までは行かない。
            起きるのは「招待文をコピー → アプリを開く」だけなので、そう書く。 */}
        <button onClick={shareInstagram}
          style={{
            background: 'linear-gradient(135deg,#FEDA75,#FA7E1E 30%,#D62976 60%,#962FBF 80%,#4F5BD5)',
            color: '#fff', border: 'none', borderRadius: 12,
            padding: '0.6rem', fontSize: '0.82rem', fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
          }}>
          招待文をコピーして Instagram を開く
        </button>
        <p style={{ margin: '-0.2rem 0 0', fontSize: '0.68rem', color: p.inkSoft, lineHeight: 1.5 }}>
          貼り付ける場所（ストーリーズ・プロフィール・DM）は、Instagram を開いてからご自身で選んでください。
          パソコンでは、文字をコピーするところまでになります。
        </p>

        {showQr && (
          <div
            data-testid="referral-qr-panel"
            style={{
              display: 'grid', justifyItems: 'center', gap: '0.55rem',
              background: '#fff', border: `1px dashed ${p.accent}55`,
              borderRadius: 14, padding: '1rem',
            }}>
            {qrError ? (
              /* 外部 QR API が失敗しても壊れた画像を出さない — リンクコピーへ逃がす */
              <div style={{
                width: 200, height: 200, borderRadius: 8,
                background: `${p.accent}0a`, border: `1px solid ${p.border}`,
                display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1rem',
              }}>
                <p style={{ margin: 0, fontSize: '0.76rem', color: p.inkSoft, lineHeight: 1.6 }}>
                  QR を表示できませんでした。<br />下の「リンクをコピー」で共有してください。
                </p>
              </div>
            ) : (
              <img
                src={qrUrl}
                alt="紹介リンクの QR コード"
                width={200}
                height={200}
                loading="lazy"
                onError={() => setQrError(true)}
                style={{ borderRadius: 8, display: 'block' }}
              />
            )}
            <p style={{ margin: 0, fontSize: '0.72rem', color: p.inkSoft, textAlign: 'center', lineHeight: 1.55 }}>
              友達のスマホで読み込むだけ。<br />
              対面・カフェ・名刺裏にも貼れます
            </p>
            {!qrError && (
              <button
                onClick={downloadQr}
                aria-label="QR 画像を保存"
                style={{
                  background: p.accent, color: accentInk, border: 'none', borderRadius: 10,
                  padding: '0.5rem 0.9rem', fontSize: '0.78rem', fontWeight: 700,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                <Download size={14} strokeWidth={2.3} /> QR 画像を保存
              </button>
            )}
            <button
              onClick={copyUrl}
              style={{
                background: 'transparent', color: p.accent, border: `1px solid ${p.accent}55`,
                borderRadius: 10, padding: '0.45rem 0.9rem', fontSize: '0.74rem', fontWeight: 700,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
              <Copy size={13} /> リンクをコピー
            </button>
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
            background: snack.tone === 'ok' ? '#16A34A' : '#B45309',
            color: '#fff',
            padding: '0.55rem 1rem',
            borderRadius: 999,
            fontSize: '0.82rem',
            fontWeight: 700,
            boxShadow: snack.tone === 'ok'
              ? '0 8px 24px rgba(22,163,74,0.45)'
              : '0 8px 24px rgba(180,83,9,0.45)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            // nowrap のままだと、長いほうの文 (失敗の説明) が
            // 画面の横幅からはみ出して読めなくなるので折り返す
            maxWidth: 'calc(100% - 1.5rem)',
            textAlign: 'center',
            lineHeight: 1.45,
            zIndex: 5,
            animation: 'inviteSnack 0.25s ease-out',
          }}
        >
          {snack.text}
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

// ink: 既定は白。LINE/X などブランド色のボタンは白のままが正なので、
// アクセント色を背景に敷く時だけ読める文字色を渡す
function ShareIconBtn({ label, bg, icon, onClick, ink = '#fff' }: {
  label: string;
  bg: string;
  icon: React.ReactNode;
  onClick: () => void;
  ink?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        background: bg, color: ink, border: 'none', borderRadius: 12,
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
