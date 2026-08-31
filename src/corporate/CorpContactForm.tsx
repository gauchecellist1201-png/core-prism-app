// ============================================================
// CorpContactForm — /corp の法人相談フォーム
//
// 2026-08-21 オーナー指示 §16:
//   すべての章の CTA を、最終的にここへ集める。
//   取得する項目: 会社名 / 氏名 / メール / 電話(任意) / 相談内容 /
//                 会社規模 / 希望内容 / 予算感
//
// 送信先は既存の /api/feedback (kind=contact)。新しい経路は作らない
// ＝ Resend / Gmail フォールバックの二重化がそのまま効く。
//
// 罠の回避:
//   ・res.ok を見ないまま「送信しました」を出さない
//     （[[env_ui_claims_success_without_checking_write]]）
//   ・結果表示はボタンの真上に置き、送信後にその位置まで戻す
//     （[[env_modal_error_appears_below_the_fold]]）
//   ・入力欄は 16px 未満にしない（iOS が勝手に拡大するため）
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchWithTimeout, isAbort } from '../lib/fetchWithTimeout';
import {
  FONT_DISPLAY, FONT_SERIF_JA, GOLD, GOLD_LIGHT, TEXT_BODY, TEXT_MUTED,
  sectionLabel, sectionLabelMain, sectionLabelSub, sectionH2, sectionLead, reveal,
} from './corpTheme';
import { CONTACT_INTERESTS, CONTACT_BUDGETS, CONTACT_SIZES } from './transformData';

/**
 * partial = サーバーは受け取って記録したが、オーナーへの通知メールが1通も出なかった状態。
 * /api/feedback は Resend も Gmail も失敗したとき HTTP 200 + delivered:false を返すので、
 * res.ok だけを見ると「お預かりしました」と嘘をつくことになる。
 */
type Phase = 'idle' | 'sending' | 'done' | 'partial' | 'error';

/** 送信本文の上限。/api/feedback は comment を先頭4000文字で切るため、
 *  結合後がそこを超えないように各欄で止める（黙って消えるのを防ぐ）。 */
const MAX = { company: 100, name: 60, email: 200, tel: 30, message: 3000 };

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: FONT_SERIF_JA,
  fontSize: '0.82rem',
  letterSpacing: '0.1em',
  color: 'rgba(240,233,216,0.86)',
  marginBottom: '0.5rem',
  fontWeight: 600,
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '0.8rem 1rem',
  borderRadius: 12,
  border: '1px solid rgba(201,169,110,0.28)',
  background: 'rgba(255,255,255,0.035)',
  color: '#F1E9D8',
  /* iOS は 16px 未満の入力欄で画面を勝手に拡大する */
  fontSize: '16px',
  fontFamily: FONT_SERIF_JA,
  outline: 'none',
  boxSizing: 'border-box',
};

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        minHeight: 44,
        padding: '0 1.05rem',
        borderRadius: 999,
        cursor: 'pointer',
        fontFamily: FONT_SERIF_JA,
        fontSize: '0.86rem',
        letterSpacing: '0.06em',
        fontWeight: on ? 700 : 500,
        color: on ? '#14100a' : 'rgba(240,233,216,0.82)',
        background: on ? 'linear-gradient(135deg,#F1DCA7,#E7C987 45%,#C9A96E)' : 'rgba(255,255,255,0.035)',
        border: on ? '1px solid rgba(201,169,110,0.9)' : '1px solid rgba(201,169,110,0.28)',
        transition: 'background 0.22s, color 0.22s, border-color 0.22s',
      }}
    >
      {children}
    </button>
  );
}

export default function CorpContactForm() {
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const [size, setSize] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [err, setErr] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const toggleInterest = (v: string) =>
    setInterests(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));

  /**
   * 送信の結果を、画面の外に置き去りにしない。
   *
   * 実測(375px): 失敗の赤い枠はボタンの真上にあるのに、押した時点の
   * スクロール位置だと 972px 下＝一度も目に入らないまま「反応が無い」に見えた。
   * 注意: behavior:'auto' も2引数形式も「CSS の scroll-behavior に従う」。
   * このサイトは html{scroll-behavior:smooth} なので、どちらもなめらか移動になり、
   * 実測ではその移動が走らずに 0px のまま終わる環境があった。
   * 結果を見せるのに演出は要らないので behavior:'instant' で必ず飛ばす。
   * 描画が終わってから測るため rAF ではなく effect で行う。
   */
  useEffect(() => {
    if (phase !== 'error' && phase !== 'done' && phase !== 'partial') return;
    const el = resultRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return; // すでに見えているなら動かさない
    window.scrollTo({
      top: Math.max(0, r.top + window.scrollY - window.innerHeight / 2 + r.height / 2),
      behavior: 'instant',
    });
  }, [phase]);

  const valid = name.trim().length > 0 && email.includes('@') && message.trim().length >= 5;

  /** 送信本文。届かなかったときに mailto へそのまま渡せるよう関数にしておく。 */
  const buildBody = () => [
    `会社名: ${company || '(未記入)'}`,
    `氏名: ${name}`,
    `メール: ${email}`,
    `電話: ${tel || '(未記入)'}`,
    `会社規模: ${size || '(未選択)'}`,
    `希望内容: ${interests.length ? interests.join(' / ') : '(未選択)'}`,
    `予算感: ${budget || '(未選択)'}`,
    '',
    '── 相談内容 ──',
    message,
  ].join('\n');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || phase === 'sending') return;
    setPhase('sending');
    setErr(null);

    const body = buildBody();

    try {
      const res = await fetchWithTimeout('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'prism',
          kind: 'contact',
          comment: `[CORP / AI Transformation 相談]\n${body}`,
          email,
          url: window.location.href,
          userAgent: navigator.userAgent,
          ts: Date.now(),
        }),
      });
      // 書き込み結果を見ないまま「送信しました」を出さない。
      // /api/feedback は Resend と Gmail の両方が落ちても HTTP 200 を返し、
      // 届いたかどうかは本文の delivered にしか出ない（reason: mail_failed 等）。
      // res.ok だけで成功にすると、いちばん失いたくない相談が黙って消える。
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json().catch(() => null)) as { delivered?: boolean } | null;
      setPhase(data?.delivered === true ? 'done' : 'partial');
    } catch (e2) {
      setErr(isAbort(e2) ? '電波が弱いようです。もう一度お試しください。' : (e2 as Error)?.message || 'ネットワークエラー');
      setPhase('error');
    }
  };

  if (phase === 'partial') {
    // 記録は残っているが通知が出ていない。届いたことにはしない。
    return (
      <motion.div
        ref={resultRef}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          maxWidth: 640, margin: '0 auto', textAlign: 'center',
          padding: 'clamp(2.4rem, 5vw, 3.6rem)', borderRadius: 22,
          border: '1px solid rgba(231,180,120,0.5)',
          background: 'radial-gradient(140% 120% at 50% -20%, #1a1206 0%, #070707 65%)',
        }}
      >
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.72rem', letterSpacing: '0.3em', color: GOLD, marginBottom: '1.2rem' }}>
          NOT DELIVERED
        </p>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.15rem, 2.3vw, 1.5rem)', fontWeight: 700, color: '#F5EAD4', lineHeight: 1.9, marginBottom: '1rem' }}>
          内容は記録しましたが、
          <br />
          通知メールが送れませんでした。
        </p>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.92rem', color: TEXT_BODY, lineHeight: 2.1, marginBottom: '1.6rem' }}>
          こちらから気づけない可能性があります。
          <br />
          お手数ですが、下のメールアドレスへ直接お送りください。
        </p>
        <a
          href={`mailto:info@core-ai.jp?subject=${encodeURIComponent('AI・DXのご相談')}&body=${encodeURIComponent(buildBody())}`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 52,
            padding: '0 1.8rem', borderRadius: 999, textDecoration: 'none',
            background: 'linear-gradient(135deg,#F1DCA7,#E7C987 45%,#C9A96E)', color: '#14100a',
            fontFamily: FONT_SERIF_JA, fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.06em',
          }}
        >
          入力した内容をメールで送る
        </a>
      </motion.div>
    );
  }

  if (phase === 'done') {
    return (
      <motion.div
        ref={resultRef}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          maxWidth: 640, margin: '0 auto', textAlign: 'center',
          padding: 'clamp(2.4rem, 5vw, 3.6rem)', borderRadius: 22,
          border: '1px solid rgba(201,169,110,0.45)',
          background: 'radial-gradient(140% 120% at 50% -20%, #17120a 0%, #070707 65%)',
        }}
      >
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.72rem', letterSpacing: '0.3em', color: GOLD, marginBottom: '1.2rem' }}>
          RECEIVED
        </p>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.2rem, 2.4vw, 1.6rem)', fontWeight: 700, color: '#F5EAD4', lineHeight: 1.9, marginBottom: '1rem' }}>
          お預かりしました。
        </p>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.92rem', color: TEXT_BODY, lineHeight: 2.1 }}>
          通常24時間以内（土日祝は翌営業日）に、{email} 宛にご返信します。
          <br />
          お急ぎの場合は、下の直通メールへお願いします。
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 760, margin: '0 auto', textAlign: 'left' }}>
      <div className="corp-form-grid">
        <div>
          <label style={labelStyle} htmlFor="corp-company">会社名</label>
          <input id="corp-company" maxLength={MAX.company} style={fieldStyle} value={company} onChange={e => setCompany(e.target.value)} autoComplete="organization" placeholder="株式会社CORE" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="corp-name">お名前 <span style={{ color: GOLD_LIGHT }}>*</span></label>
          <input id="corp-name" maxLength={MAX.name} style={fieldStyle} value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="井出 直毅" required />
        </div>
        <div>
          <label style={labelStyle} htmlFor="corp-email">メールアドレス <span style={{ color: GOLD_LIGHT }}>*</span></label>
          <input id="corp-email" type="email" inputMode="email" maxLength={MAX.email} style={fieldStyle} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="name@company.co.jp" required />
        </div>
        <div>
          <label style={labelStyle} htmlFor="corp-tel">電話番号（任意）</label>
          <input id="corp-tel" type="tel" inputMode="tel" maxLength={MAX.tel} style={fieldStyle} value={tel} onChange={e => setTel(e.target.value)} autoComplete="tel" placeholder="090-0000-0000" />
        </div>
      </div>

      <div style={{ marginTop: '1.8rem' }}>
        <span style={labelStyle}>会社規模</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {CONTACT_SIZES.map(s => (
            <Chip key={s} on={size === s} onClick={() => setSize(size === s ? '' : s)}>{s}</Chip>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1.8rem' }}>
        <span style={labelStyle}>ご希望の内容（複数選べます）</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {CONTACT_INTERESTS.map(s => (
            <Chip key={s} on={interests.includes(s)} onClick={() => toggleInterest(s)}>{s}</Chip>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1.8rem' }}>
        <span style={labelStyle}>ご予算の目安</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {CONTACT_BUDGETS.map(s => (
            <Chip key={s} on={budget === s} onClick={() => setBudget(budget === s ? '' : s)}>{s}</Chip>
          ))}
        </div>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.76rem', color: TEXT_MUTED, marginTop: '0.7rem', lineHeight: 1.8 }}>
          未定のままで構いません。診断だけのご依頼も承っています。
        </p>
      </div>

      <div style={{ marginTop: '1.8rem' }}>
        <label style={labelStyle} htmlFor="corp-message">ご相談内容 <span style={{ color: GOLD_LIGHT }}>*</span></label>
        <textarea
          id="corp-message"
          maxLength={MAX.message}
          style={{ ...fieldStyle, minHeight: 150, resize: 'vertical', lineHeight: 1.9 }}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="いま困っていること、変えたいことを、そのままの言葉でお書きください。&#10;（例：営業の記録と請求が二重入力になっていて、月末に3日とられている）"
          required
        />
      </div>

      {/* 結果はボタンの真上。押した指の近くで分かるように。 */}
      <div ref={resultRef} style={{ minHeight: phase === 'error' ? undefined : 0, marginTop: phase === 'error' ? '1.4rem' : 0 }}>
        {phase === 'error' && (
          <p role="alert" style={{
            fontFamily: FONT_SERIF_JA, fontSize: '0.86rem', color: '#FFD2C4', lineHeight: 1.9,
            border: '1px solid rgba(255,120,90,0.45)', background: 'rgba(255,90,60,0.08)',
            borderRadius: 12, padding: '0.9rem 1rem',
          }}>
            送信できませんでした（{err}）。
            <br />
            お手数ですが、もう一度お試しいただくか、下の直通メールへお送りください。
          </p>
        )}
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button
          type="submit"
          disabled={!valid || phase === 'sending'}
          style={{
            width: '100%', maxWidth: 420, minHeight: 56, borderRadius: 999, border: 'none',
            cursor: valid && phase !== 'sending' ? 'pointer' : 'not-allowed',
            background: valid ? 'linear-gradient(135deg,#F1DCA7,#E7C987 45%,#C9A96E)' : 'rgba(201,169,110,0.18)',
            color: valid ? '#14100a' : 'rgba(240,233,216,0.5)',
            fontFamily: FONT_SERIF_JA, fontSize: '1rem', fontWeight: 800, letterSpacing: '0.1em',
            boxShadow: valid ? '0 14px 42px -8px rgba(201,169,110,0.55)' : 'none',
            transition: 'background 0.25s, color 0.25s',
          }}
        >
          {phase === 'sending' ? '送信しています…' : 'この内容で相談する'}
        </button>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.76rem', color: TEXT_MUTED, marginTop: '0.9rem', lineHeight: 1.9 }}>
          お名前・メール・ご相談内容の3つでお送りいただけます。
          <br />
          しつこい営業はいたしません。
        </p>
      </div>
    </form>
  );
}

/** 相談の章まるごと（見出し＋フォーム）。CoreSite から差し込む。 */
export function ContactSection({ children }: { children?: React.ReactNode }) {
  return (
    <section
      id="contact"
      className="lp-section-pad"
      style={{
        padding: '7rem 1.5rem',
        background: 'radial-gradient(ellipse at center, rgba(201,169,110,0.10) 0%, #050505 72%)',
        position: 'relative',
        scrollMarginTop: 70,
      }}
    >
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p style={sectionLabel}>
            <span style={sectionLabelMain}>ご&nbsp;相&nbsp;談</span>
            <span style={sectionLabelSub}>CONTACT</span>
          </p>
          <motion.h2 {...reveal} style={sectionH2}>
            自分の会社を、AIでどう変えられるか。
          </motion.h2>
          <p style={sectionLead}>
            まだ何をすればいいか決まっていない段階で構いません。
            <br />
            現状をうかがって、変えるべき場所からお話しします。
            <span style={{ display: 'block', fontSize: '0.85rem', color: TEXT_MUTED, marginTop: '0.8rem' }}>
              通常24時間以内にご返信（土日祝は翌営業日）
            </span>
          </p>
        </div>
        <CorpContactForm />
        {children}
      </div>
    </section>
  );
}
