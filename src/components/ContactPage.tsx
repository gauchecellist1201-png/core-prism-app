// ============================================================
// ContactPage — /contact 公開窓口
//
// オーナー指示 (2026-06-04 第 16 波 KKK):
//   LP / dashboard どこからでも問い合わせできる /contact ページ。
//   /api/feedback (kind=contact) に POST + 自動返信メールはサーバ側で処理。
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, CheckCircle2, ArrowLeft, Send, AlertCircle } from 'lucide-react';

type Phase = 'idle' | 'sending' | 'done' | 'error';

const TOPICS = [
  { id: 'product',   label: '製品について',     icon: '✨' },
  { id: 'billing',   label: '請求 / 解約',      icon: '💳' },
  { id: 'tech',      label: '不具合 / 技術',    icon: '🔧' },
  { id: 'business',  label: '法人 / 提携',      icon: '🤝' },
  { id: 'press',     label: '取材 / メディア',  icon: '📣' },
  { id: 'other',     label: 'その他',           icon: '💬' },
];

export default function ContactPage() {
  const [topic, setTopic] = useState<string>('product');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [err, setErr] = useState<string | null>(null);

  const valid = email.includes('@') && message.trim().length >= 5;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!valid || phase === 'sending') return;
    setPhase('sending');
    setErr(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: window.location.pathname.startsWith('/iris') ? 'iris' : 'prism',
          kind: 'contact',
          comment: `[${TOPICS.find(t => t.id === topic)?.label || topic}] ${name ? `(${name}) ` : ''}\n\n${message}`,
          email,
          url: window.location.href,
          userAgent: navigator.userAgent,
          ts: Date.now(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPhase('done');
    } catch (e2) {
      setErr((e2 as Error)?.message || 'ネットワークエラー');
      setPhase('error');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #070712 0%, #0d0d1c 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
      padding: '2rem 1rem 4rem',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <a
          href="/"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: 'rgba(255,255,255,0.6)',
            fontSize: '0.85rem',
            textDecoration: 'none',
            marginBottom: 24,
          }}
        >
          <ArrowLeft size={14} /> ホームへ戻る
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={20} color="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.65rem', letterSpacing: '0.3em', color: '#a78bfa', fontWeight: 700 }}>CONTACT</p>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>お問い合わせ</h1>
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: 28 }}>
          何でも気軽に。返信は通常 1-3 営業日以内です。<br />
          営業時間外 / 週末 / 祝日 のお問い合わせは翌営業日にお返事します。
        </p>

        <AnimatePresence mode="wait">
          {phase === 'done' ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: 'rgba(52,211,153,0.1)',
                border: '1px solid rgba(52,211,153,0.4)',
                borderRadius: 16,
                padding: '2rem 1.5rem',
                textAlign: 'center',
              }}
            >
              <CheckCircle2 size={48} color="#34D399" />
              <h2 style={{ margin: '12px 0 6px', fontSize: '1.15rem', fontWeight: 800 }}>送信しました</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                ご連絡ありがとうございます。<br />
                自動返信メールを {email} にお送りしました。<br />
                内容を確認の上、近日中にお返事いたします。
              </p>
              <a
                href="/"
                style={{
                  display: 'inline-block', marginTop: 18,
                  padding: '10px 24px',
                  borderRadius: 999,
                  background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  textDecoration: 'none',
                }}
              >
                ホームへ戻る
              </a>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={submit}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '20px',
              }}
            >
              {/* トピック選択 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                  お問い合わせ種別
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
                  {TOPICS.map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setTopic(t.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: topic === t.id ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${topic === t.id ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        color: topic === t.id ? '#fff' : 'rgba(255,255,255,0.7)',
                        fontSize: '0.82rem',
                        fontWeight: topic === t.id ? 700 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* お名前 (任意) */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  お名前 <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(任意)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: 井出 直毅"
                  disabled={phase === 'sending'}
                  style={inputStyle}
                />
              </div>

              {/* メール */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  返信用メールアドレス <span style={{ color: '#f472b6' }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  disabled={phase === 'sending'}
                  style={inputStyle}
                />
              </div>

              {/* 本文 */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  お問い合わせ内容 <span style={{ color: '#f472b6' }}>*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={6}
                  placeholder="お気軽にどうぞ。具体的な機能名や現象、エラーメッセージなどがあれば助かります。"
                  disabled={phase === 'sending'}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                />
                <div style={{ marginTop: 4, fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                  {message.length} 文字
                </div>
              </div>

              {err && (
                <div style={{
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: 'rgba(220,38,38,0.1)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  color: '#fca5a5',
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                  <AlertCircle size={13} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>送信に失敗しました ({err})。少し待ってもう一度試してください。</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!valid || phase === 'sending'}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  borderRadius: 12,
                  background: !valid || phase === 'sending'
                    ? 'rgba(255,255,255,0.1)'
                    : 'linear-gradient(135deg, #a78bfa, #f472b6)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: !valid || phase === 'sending' ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Send size={14} />
                {phase === 'sending' ? '送信中…' : '送信する'}
              </button>

              <p style={{ marginTop: 14, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                プライバシーポリシーに同意の上、送信ボタンを押してください。<br />
                個人情報は本お問い合わせの対応のみに利用します。
              </p>
            </motion.form>
          )}
        </AnimatePresence>

        <div style={{ marginTop: 32, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          直接メール: <a href="mailto:gauche.cellist1201@gmail.com" style={{ color: '#a78bfa' }}>gauche.cellist1201@gmail.com</a>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#fff',
  fontSize: '0.88rem',
  outline: 'none',
  boxSizing: 'border-box',
};
