// ============================================================
// QuickAskFab — 全画面右下に常駐する「いま AI に質問」FAB
//
// オーナー指示 (2026-06-03 第 12 波 ZZ):
//   LP / Pricing / Billing 等、ダッシュボード以外でも気軽に AI へ質問
//   できる窓口。FAB タップで小さなチャットが開き、1 往復だけ会話できる。
//
// 振る舞い:
//   - 右下 (safe-area 配慮) に 円形 FAB
//   - タップで下からせり上がるパネル (高さ ~340px)
//   - スコープに応じた事前 prompt を sprinkle (LP=製品Q&A / Pricing=料金Q&A / Billing=請求Q&A)
//   - 送信先は callAiWithFallback (Haiku → Sonnet → Gemini Flash)
//   - 会話履歴は localStorage に 直近 20 件まで
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react';
import { callAiWithFallback } from '../lib/aiFallbackChain';

type Msg = { id: string; role: 'user' | 'assistant'; text: string; ts: number };

const STORAGE_KEY = 'core_quick_ask_history_v1';
const HISTORY_LIMIT = 20;

function detectScope(): 'lp' | 'pricing' | 'billing' | 'dashboard' | 'other' {
  if (typeof window === 'undefined') return 'other';
  const p = window.location.pathname;
  if (p === '/' || p.startsWith('/lp/') || p.startsWith('/industry')) return 'lp';
  if (p.startsWith('/pricing')) return 'pricing';
  if (p.startsWith('/billing')) return 'billing';
  if (p.startsWith('/master')) return 'other'; // master では出さない
  if (p === '/dashboard' || p.startsWith('/dashboard')) return 'dashboard';
  return 'other';
}

const SCOPE_SYSTEM_PROMPT: Record<string, string> = {
  lp: 'あなたは CORE Prism (BtoC ¥3,000〜 / BtoB ¥20,000〜 / 7 日間無料) の窓口エージェントです。LP に来た見込み顧客の質問に「導入の不安を取り除く」答えを 3〜5 行で返してください。料金や機能の事実を聞かれたら正確に。営業感を出しすぎず、誠実に。最後に「もっと知りたいことがあれば聞いてください」で締める。',
  pricing: 'あなたは CORE Prism の料金担当エージェントです。BtoC v2: Light ¥3,000 / Standard ¥5,000 / Pro ¥15,000。BtoB v2: Entry ¥20,000 / Standard ¥30,000 / Pro ¥50,000。Enterprise は 200-400 万/年 で営業相談。7 日間無料 / クレカ登録不要。質問には 3 行以内で正確に答えてください。',
  billing: 'あなたは CORE Prism の請求サポートエージェントです。決済 / 解約 / 返金 / プラン変更 等の質問に短く丁寧に答えてください。具体的な決済操作は「設定 → 請求」から行えること、解約は 1 タップであることを伝えてください。',
  dashboard: 'あなたは CORE Prism のサポート エージェントです。ユーザーが現在ダッシュボードを使っています。短く実用的に答えてください。',
  other: 'あなたは CORE Prism のサポート エージェントです。短く誠実に答えてください。',
};

const SCOPE_LABEL: Record<string, string> = {
  lp: '気軽に質問',
  pricing: '料金について聞く',
  billing: '請求について聞く',
  dashboard: 'いま AI に質問',
  other: 'AI に質問',
};

const SCOPE_PLACEHOLDER: Record<string, string> = {
  lp: '例: 飲食店でも使えますか?',
  pricing: '例: 月額の途中変更はできますか?',
  billing: '例: クレカを変更したい',
  dashboard: '例: いまの数字をまとめて',
  other: 'なんでも聞いてください',
};

function loadHistory(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(-HISTORY_LIMIT) : [];
  } catch { return []; }
}

function saveHistory(m: Msg[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m.slice(-HISTORY_LIMIT))); } catch { /* */ }
}

export default function QuickAskFab() {
  const scope = useMemo(() => detectScope(), []);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => loadHistory());
  const scrollRef = useRef<HTMLDivElement>(null);

  // master / 不明 scope では FAB 自体出さない
  if (scope === 'other') return null;

  useEffect(() => {
    saveHistory(msgs);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const send = async (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setInput('');
    const userMsg: Msg = { id: `u_${Date.now()}`, role: 'user', text: t, ts: Date.now() };
    setMsgs(prev => [...prev, userMsg]);
    setBusy(true);
    try {
      const data = await callAiWithFallback({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        system: SCOPE_SYSTEM_PROMPT[scope],
        messages: msgs.slice(-6).map(m => ({ role: m.role, content: m.text })).concat({ role: 'user', content: t }),
      });
      const reply = data.content?.[0]?.text ?? '';
      const aiMsg: Msg = { id: `a_${Date.now()}`, role: 'assistant', text: reply || '応答が空でした。もう一度試してください。', ts: Date.now() };
      setMsgs(prev => [...prev, aiMsg]);
    } catch (e) {
      const aiMsg: Msg = {
        id: `e_${Date.now()}`, role: 'assistant',
        text: `AI への接続でエラーが起きました。少し待ってもう一度試してください。\n(${(e as Error).message})`,
        ts: Date.now(),
      };
      setMsgs(prev => [...prev, aiMsg]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpen(true)}
            aria-label="AI に質問する"
            data-tour-id="quick-ask"
            style={{
              position: 'fixed',
              right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
              // モーダル (z=50) より下 — モーダル中は隠れる
              zIndex: 40,
              width: 56, height: 56,
              borderRadius: 28,
              background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 12px 28px rgba(167,139,250,0.45)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <MessageCircle size={22} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* チャットパネル */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
              left: 'auto',
              zIndex: 70,
              width: 'min(380px, calc(100vw - 24px))',
              maxHeight: '70vh',
              borderRadius: 18,
              background: 'rgba(15, 14, 27, 0.96)',
              border: '1px solid rgba(167,139,250,0.3)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'linear-gradient(180deg, rgba(167,139,250,0.12), transparent)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={16} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{SCOPE_LABEL[scope]}</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>Powered by CORE AI</div>
              </div>
              <button
                aria-label="閉じる"
                onClick={() => setOpen(false)}
                style={{
                  width: 30, height: 30, borderRadius: 15,
                  background: 'rgba(255,255,255,0.08)', border: 'none',
                  color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
              {msgs.length === 0 && (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', padding: '24px 8px', lineHeight: 1.7 }}>
                  なんでも気軽に聞いてください。<br />
                  3 行以内で短く答えます。
                </div>
              )}
              {msgs.map(m => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 8,
                  }}
                >
                  <div style={{
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: 12,
                    background: m.role === 'user'
                      ? 'linear-gradient(135deg, #a78bfa, #f472b6)'
                      : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {busy && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', padding: '6px 4px' }}>
                  <Loader2 size={12} className="" style={{ animation: 'core-spin 1s linear infinite' }} />
                  考えています…
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              style={{
                display: 'flex', gap: 6,
                padding: '10px 12px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={SCOPE_PLACEHOLDER[scope]}
                disabled={busy}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: busy || !input.trim()
                    ? 'rgba(255,255,255,0.1)'
                    : 'linear-gradient(135deg, #a78bfa, #f472b6)',
                  border: 'none', color: '#fff',
                  cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-label="送信"
              >
                <Send size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
@keyframes core-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
      `}</style>
    </>
  );
}
