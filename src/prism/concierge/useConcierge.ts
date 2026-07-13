// ============================================================
// useConcierge — コンシェルジュ会話フック
//
// useSupportChat と同じ /api/ai 呼び出しパターン (enqueue / エラー整形) を踏襲し、
// さらに:
//   - タイムアウト (40秒) + ワンタップ再試行 (silent fail 禁止)
//   - 受信後の typewriter 表示 (1文字あたり約5ms) で「打っている」臨場感
//   - リード検出: 会話にメールが出る or 「日程を希望」→ リードカード → /api/feedback へ送信
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { enqueueClaudeCall } from '../../lib/apiQueue';
import { conciergeSiteId, type ConciergeConfig } from './conciergeConfig';
import { buildConciergePrompt, summarizeConversation } from './conciergePrompt';
import { addReservation } from './reservations';

/** 会話中に受け取る予約カードの入力（お客様が埋める最小項目） */
export interface ReservationInput {
  name: string;
  whenText: string;   // ご希望日時
  contact: string;    // 連絡先（電話/メール/LINE名）
  note?: string;
}

export interface ConciergeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  /** AI の [action:booking] で付く予約ページ (メッセージ直下に予約ボタンを出す) */
  bookingUrl?: string;
}

export type ConciergeState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface LeadDraft {
  name: string;
  email: string;
  note: string;
}

const TIMEOUT_MS = 40_000;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// AI が応答に埋め込むアクション記号 (お客様には見せず、UI 側で実行する)
const ACTION_RE = /\s*\[action:(lead|booking)\]\s*/g;

function extractActions(raw: string): { text: string; lead: boolean; booking: boolean } {
  let lead = false;
  let booking = false;
  const text = raw.replace(ACTION_RE, (_m, a: string) => {
    if (a === 'lead') lead = true;
    else booking = true;
    return '\n';
  }).trim();
  return { text: text || raw.trim(), lead, booking };
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// 「答えに詰まった」応答の目印 (プロンプトが指示する定型句 + 多言語の近縁)
const UNANSWERED_HINTS = [
  '確認のうえ', '担当より改めて', '分かりかね', 'わかりかね',
  'お答えできかね', 'お答えいたしかね', '存じ上げません', '把握しておりません',
  "don't have that information", 'not able to answer', 'check with our team', 'get back to you',
];

function looksUnanswered(reply: string): boolean {
  return UNANSWERED_HINTS.some(h => reply.includes(h));
}

/** 会話インサイトへの記録 (fire-and-forget — 訪問者の体験は一切妨げない) */
function logInsight(cfg: ConciergeConfig, question: string, reply: string, first: boolean): void {
  try {
    void fetch('/api/crystal-insights', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        site: conciergeSiteId(cfg),
        question: question.slice(0, 120),
        answered: !looksUnanswered(reply),
        first,
      }),
      keepalive: true,
    }).catch(() => { /* 集計は本体機能ではないため訪問者側では黙って続行 */ });
  } catch { /* 同上 */ }
}

export function useConcierge(cfg: ConciergeConfig) {
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 送信に失敗した本文 — 再試行ボタン用 */
  const [failedText, setFailedText] = useState<string | null>(null);
  /** typewriter 中のメッセージ id と表示済み文字数 */
  const [typing, setTyping] = useState<{ id: string; shown: number } | null>(null);
  /** 入力欄フォーカス中 (アバターの listening 演出用) */
  const [listening, setListening] = useState(false);

  // ── リード (ご案内希望) ──────────────────────────
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSending, setLeadSending] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  // 予約捕捉（会話中に「予約したい」→ カードでお名前・希望日時・連絡先を受け取り保存）
  const [reservationOpen, setReservationOpen] = useState(false);
  const [reservationSending, setReservationSending] = useState(false);
  const [reservationSent, setReservationSent] = useState(false);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const reservationSentRef = useRef(false);

  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  /** 送信済みなら [action:lead] でカードを開き直さない */
  const leadSentRef = useRef(false);

  // ── typewriter: 受信済み全文を少しずつ見せる ──────────
  useEffect(() => {
    if (!typing) return;
    const msg = messages.find(m => m.id === typing.id);
    if (!msg) { setTyping(null); return; }
    if (typing.shown >= msg.content.length) { setTyping(null); return; }
    // 16ms ごとに 3 文字 ≒ 5.3ms/文字 (指定レンジ 4-8ms 内)
    const t = window.setInterval(() => {
      setTyping(prev => {
        if (!prev) return prev;
        const next = Math.min(prev.shown + 3, msg.content.length);
        return next >= msg.content.length ? null : { ...prev, shown: next };
      });
    }, 16);
    return () => window.clearInterval(t);
  }, [typing?.id, messages]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 画面表示用: typewriter 途中のものは途中まで */
  const displayMessages = useMemo(() => {
    if (!typing) return messages;
    return messages.map(m => (m.id === typing.id ? { ...m, content: m.content.slice(0, typing.shown) } : m));
  }, [messages, typing]);

  /** アバターの状態 */
  const state: ConciergeState = isLoading ? 'thinking' : typing ? 'speaking' : listening ? 'listening' : 'idle';

  /** 会話から検出した来訪者メール (リードカードの初期値に使う) */
  const detectedEmail = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== 'user') continue;
      const m = messages[i].content.match(EMAIL_RE);
      if (m) return m[0];
    }
    return '';
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setError(null);
    setFailedText(null);

    const userMsg: ConciergeMessage = { id: makeId('u'), role: 'user', content: trimmed, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setIsLoading(true);

    try {
      const reply = await enqueueClaudeCall(async () => {
        const history = next.slice(-14).map(m => ({ role: m.role, content: m.content }));
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5',
              max_tokens: 500,
              system: buildConciergePrompt(cfgRef.current),
              messages: history,
            }),
            signal: ctrl.signal,
          });
        } catch (e) {
          if (ctrl.signal.aborted) throw new Error('応答に時間がかかっています。通信環境をご確認のうえ、もう一度お試しください。');
          throw e;
        } finally {
          window.clearTimeout(timer);
        }
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const data = await res.json();
            // /api/ai は { error: { message } } 形式 — [object Object] 化を防いで拾う
            const fromObj = (v: unknown): string | null => {
              if (!v) return null;
              if (typeof v === 'string') return v;
              if (typeof v === 'object' && v !== null) {
                const o = v as { message?: unknown; userMessage?: unknown };
                if (typeof o.message === 'string') return o.message;
                if (typeof o.userMessage === 'string') return o.userMessage;
              }
              return null;
            };
            msg = fromObj((data as { userMessage?: unknown })?.userMessage)
              || fromObj((data as { error?: unknown })?.error)
              || fromObj((data as { message?: unknown })?.message)
              || msg;
          } catch { /* ignore */ }
          throw new Error(msg);
        }
        const data = await res.json();
        const t = data?.content?.[0]?.text || data?.message || '';
        if (!t) throw new Error('応答を取得できませんでした。');
        return t as string;
      });

      const parsed = extractActions(reply);
      // 会話インサイト: 質問と「答えられたか」を集計へ (訪問者の待ち時間ゼロ)
      logInsight(cfgRef.current, trimmed, parsed.text, next.filter(m => m.role === 'user').length === 1);
      const aMsg: ConciergeMessage = { id: makeId('a'), role: 'assistant', content: parsed.text, ts: Date.now() };
      if (parsed.booking && cfgRef.current.bookingUrl) aMsg.bookingUrl = cfgRef.current.bookingUrl;
      setMessages(prev => [...prev, aMsg]);
      setTyping({ id: aMsg.id, shown: 0 });
      // AI がお客様の同意を確認 → 連絡先カードをそっと自動で開く (会話中アクション)
      if (parsed.lead && !leadSentRef.current) {
        window.setTimeout(() => {
          setLeadError(null);
          setLeadOpen(true);
        }, 900);
      }
      // 予約の意思 → 予約カードをそっと開いて、お名前・希望日時・連絡先を受け取る（→予約管理へ保存）
      if (parsed.booking && !reservationSentRef.current) {
        window.setTimeout(() => {
          setReservationError(null);
          setReservationOpen(true);
        }, 900);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラー';
      setError(msg);
      setFailedText(trimmed);
      // 送れなかったユーザー発言は履歴から外す (再試行で二重にならないように)
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  /** 直近の失敗メッセージをもう一度送る */
  const retry = useCallback(() => {
    if (failedText) void send(failedText);
  }, [failedText, send]);

  /** リードカードを開く (「日程を希望」ボタン等から) */
  const openLead = useCallback(() => {
    setLeadError(null);
    setLeadOpen(true);
  }, []);

  const closeLead = useCallback(() => setLeadOpen(false), []);

  /** リード送信: 会話サマリ + 連絡先を /api/feedback へ */
  const submitLead = useCallback(async (draft: LeadDraft): Promise<boolean> => {
    const email = draft.email.trim();
    const name = draft.name.trim();
    if (!EMAIL_RE.test(email)) {
      setLeadError('メールアドレスの形式をご確認ください。');
      return false;
    }
    setLeadSending(true);
    setLeadError(null);
    const c = cfgRef.current;
    const comment = [
      `[Crystal] ご案内希望リード`,
      `ブランド: ${c.brandName} (${c.industry})`,
      `お名前: ${name || '(未記入)'}`,
      `ご希望・メモ: ${draft.note.trim() || '(なし)'}`,
      c.qualify ? `有望条件 (設定): ${c.qualify}` : '',
      '--- 会話の全文 ---',
      summarizeConversation(messages, 24),
    ].filter(Boolean).join('\n');
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 20_000);
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brand: 'crystal-concierge',
          kind: 'contact',
          comment,
          email,
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          ts: Date.now(),
        }),
        signal: ctrl.signal,
      }).finally(() => window.clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLeadSent(true);
      leadSentRef.current = true;
      setLeadOpen(false);
      // 会話上でも上品にお礼を返す (通信不要のローカルメッセージ)
      setMessages(prev => [...prev, {
        id: makeId('a'),
        role: 'assistant',
        content: `${name ? `${name} 様、` : ''}承りました。担当より ${email} 宛にご連絡いたします。この度はありがとうございます。`,
        ts: Date.now(),
      }]);
      return true;
    } catch {
      setLeadError('送信できませんでした。通信環境をご確認のうえ、もう一度お試しください。');
      return false;
    } finally {
      setLeadSending(false);
    }
  }, [messages]);

  /** 予約カードを開く（「予約する」ボタン等から） */
  const openReservation = useCallback(() => { setReservationError(null); setReservationOpen(true); }, []);
  const closeReservation = useCallback(() => setReservationOpen(false), []);

  /** 予約送信: お名前・希望日時・連絡先を /api/crystal-reservations へ（source=chat）。予約管理に届く。 */
  const submitReservation = useCallback(async (input: ReservationInput): Promise<boolean> => {
    const name = input.name.trim();
    const whenText = input.whenText.trim();
    const contact = input.contact.trim();
    if (!name && !contact && !whenText) {
      setReservationError('お名前・ご希望日時・連絡先のいずれかをご入力ください。');
      return false;
    }
    setReservationSending(true);
    setReservationError(null);
    const c = cfgRef.current;
    const ctype = /@/.test(contact) ? 'email' : /^[0-9+\-() ]{8,}$/.test(contact) ? 'phone' : 'other';
    try {
      const created = await addReservation(conciergeSiteId(c), {
        name, whenText, contact, contactType: ctype as 'email' | 'phone' | 'other',
        note: input.note?.trim() || undefined, source: 'chat',
      });
      if (!created) throw new Error('failed');
      setReservationSent(true);
      reservationSentRef.current = true;
      setReservationOpen(false);
      setMessages(prev => [...prev, {
        id: makeId('a'),
        role: 'assistant',
        content: `${name ? `${name} 様、` : ''}ご予約を承りました。${whenText ? `【${whenText}】で` : ''}お手続きを進めます。確定のご連絡を差し上げますので、少々お待ちくださいませ。`,
        ts: Date.now(),
      }]);
      return true;
    } catch {
      setReservationError('送信できませんでした。通信環境をご確認のうえ、もう一度お試しください。');
      return false;
    } finally {
      setReservationSending(false);
    }
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    setFailedText(null);
    setTyping(null);
    setLeadSent(false);
    leadSentRef.current = false;
    setReservationSent(false);
    reservationSentRef.current = false;
  }, []);

  return {
    messages: displayMessages,
    rawMessages: messages,
    state,
    isLoading,
    error,
    canRetry: !!failedText,
    send,
    retry,
    clear,
    setListening,
    // リード
    detectedEmail,
    leadOpen,
    leadSending,
    leadSent,
    leadError,
    openLead,
    closeLead,
    submitLead,
    // 予約
    reservationOpen,
    reservationSending,
    reservationSent,
    reservationError,
    openReservation,
    closeReservation,
    submitReservation,
  };
}
