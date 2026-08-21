// ============================================================
// SierContactForm — /corp/sier のSIer専用相談フォーム
//
// CorpContactForm.tsx と同じ送信経路・同じ罠回避を踏襲しつつ、
// SIer担当者に合わせて項目を差し替える（会社規模ではなく案件の状況）。
//
// 送信先は既存の /api/feedback (kind=contact)。新しい経路は作らない
// ＝ Resend / Gmail フォールバックの二重化がそのまま効く。
//
// 罠の回避（CorpContactForm.tsx と同じ）:
//   ・res.ok を見ないまま「送信しました」を出さない
//   ・結果表示はボタンの真上に置き、送信後にその位置まで戻す
//   ・入力欄は 16px 未満にしない（iOS が勝手に拡大するため）
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchWithTimeout, isAbort } from '../lib/fetchWithTimeout';
import { logEvent } from '../lib/onboardingAnalytics';
import {
  FONT_DISPLAY, FONT_SERIF_JA, GOLD, GOLD_LIGHT, TEXT_BODY, TEXT_MUTED,
} from './corpTheme';
import { SIER_STATUS_OPTIONS, SIER_BUDGET_OPTIONS, SIER_TIMELINE_OPTIONS } from './sierData';

type Phase = 'idle' | 'sending' | 'done' | 'partial' | 'error';

/** /api/feedback は comment を先頭4000文字で切るため、結合後がそこを超えないように各欄で止める。 */
const MAX = { company: 100, name: 60, email: 200, message: 3000 };

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
  fontSize: '16px', // iOS は 16px 未満の入力欄で画面を勝手に拡大する
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

export default function SierContactForm() {
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const markStarted = () => {
    if (started) return;
    setStarted(true);
    logEvent('sier_form_start');
  };

  // 結果を画面の外に置き去りにしない（CorpContactForm.tsx と同じ実測に基づく対処）。
  useEffect(() => {
    if (phase !== 'error' && phase !== 'done' && phase !== 'partial') return;
    const el = resultRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return;
    window.scrollTo({
      top: Math.max(0, r.top + window.scrollY - window.innerHeight / 2 + r.height / 2),
      behavior: 'instant',
    });
  }, [phase]);

  const valid = name.trim().length > 0 && email.includes('@') && message.trim().length >= 5;

  const buildBody = () => [
    `会社名: ${company || '(未記入)'}`,
    `氏名: ${name}`,
    `メール: ${email}`,
    `案件の状況: ${status || '(未選択)'}`,
    `想定予算: ${budget || '(未選択)'}`,
    `希望時期: ${timeline || '(未選択)'}`,
    '',
    '── 相談内容 ──',
    message,
  ].join('\n');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || phase === 'sending') return;
    setPhase('sending');
    setErr(null);
    logEvent('sier_form_submit');

    const body = buildBody();

    try {
      const res = await fetchWithTimeout('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'prism',
          kind: 'contact',
          comment: `[CORP / SIer協業 相談]\n${body}`,
          email,
          url: window.location.href,
          userAgent: navigator.userAgent,
          ts: Date.now(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json().catch(() => null)) as { delivered?: boolean } | null;
      const delivered = data?.delivered === true;
      setPhase(delivered ? 'done' : 'partial');
      logEvent(delivered ? 'sier_contact_conversion' : 'sier_form_partial');
    } catch (e2) {
      setErr(isAbort(e2) ? '電波が弱いようです。もう一度お試しください。' : (e2 as Error)?.message || 'ネットワークエラー');
      setPhase('error');
    }
  };

  if (phase === 'partial') {
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
          href={`mailto:core.inc.guild@gmail.com?subject=${encodeURIComponent('AI案件のご相談（SIer協業）')}&body=${encodeURIComponent(buildBody())}`}
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
    <form onSubmit={submit} onFocus={markStarted} style={{ maxWidth: 760, margin: '0 auto', textAlign: 'left' }}>
      <div className="corp-form-grid">
        <div>
          <label style={labelStyle} htmlFor="sier-company">会社名</label>
          <input id="sier-company" maxLength={MAX.company} style={fieldStyle} value={company} onChange={e => setCompany(e.target.value)} autoComplete="organization" placeholder="株式会社〇〇" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="sier-name">お名前 <span style={{ color: GOLD_LIGHT }}>*</span></label>
          <input id="sier-name" maxLength={MAX.name} style={fieldStyle} value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="山田 太郎" required />
        </div>
        <div>
          <label style={labelStyle} htmlFor="sier-email">メールアドレス <span style={{ color: GOLD_LIGHT }}>*</span></label>
          <input id="sier-email" type="email" inputMode="email" maxLength={MAX.email} style={fieldStyle} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="name@company.co.jp" required />
        </div>
      </div>

      <div style={{ marginTop: '1.8rem' }}>
        <span style={labelStyle}>案件の状況</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {SIER_STATUS_OPTIONS.map(s => (
            <Chip key={s} on={status === s} onClick={() => setStatus(status === s ? '' : s)}>{s}</Chip>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1.8rem' }}>
        <span style={labelStyle}>想定予算（任意）</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {SIER_BUDGET_OPTIONS.map(s => (
            <Chip key={s} on={budget === s} onClick={() => setBudget(budget === s ? '' : s)}>{s}</Chip>
          ))}
        </div>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.76rem', color: TEXT_MUTED, marginTop: '0.7rem', lineHeight: 1.8 }}>
          未定のままで構いません。予算が決まっていないご相談も承っています。
        </p>
      </div>

      <div style={{ marginTop: '1.8rem' }}>
        <span style={labelStyle}>希望時期（任意）</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {SIER_TIMELINE_OPTIONS.map(s => (
            <Chip key={s} on={timeline === s} onClick={() => setTimeline(timeline === s ? '' : s)}>{s}</Chip>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1.8rem' }}>
        <label style={labelStyle} htmlFor="sier-message">ご相談内容 <span style={{ color: GOLD_LIGHT }}>*</span></label>
        <textarea
          id="sier-message"
          maxLength={MAX.message}
          style={{ ...fieldStyle, minHeight: 150, resize: 'vertical', lineHeight: 1.9 }}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="お客様からの相談内容を、そのままの言葉でお書きください。&#10;（例：既存の基幹システムに問い合わせ自動応答を足したいという相談が来ている。予算・期限は未定）"
          required
        />
      </div>

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
            <br />
            <a
              href={`mailto:core.inc.guild@gmail.com?subject=${encodeURIComponent('AI案件のご相談（SIer協業）')}&body=${encodeURIComponent(buildBody())}`}
              style={{ color: GOLD_LIGHT, textDecoration: 'underline', display: 'inline-block', marginTop: '0.5rem' }}
            >
              入力した内容をメールで送る
            </a>
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
