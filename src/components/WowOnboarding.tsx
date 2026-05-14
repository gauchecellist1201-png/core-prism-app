// ============================================================
// CORE Wow Onboarding
// チュートリアル直後に「最初の質問」を 1 つだけ出して、
// 5 秒以内に AI が「最初の一手」を 3 つ提案 → 1 タップで実行。
// ・Prism: 「今、一番の悩みは?」 → メール下書き / 予定登録 / メモ生成
// ・Iris : 「今、伸ばしたい SNS は?」 → DM 下書き / 予定登録 / リール台本
// ・localStorage で 1 回だけ表示
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Mail, Calendar, FileText, Sparkles, ArrowRight, Check, Copy } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { buildGcalDeeplink } from '../lib/googleCalendar';

const TUTORIAL_KEYS = {
  prism: 'core_tutorial_seen_prism_v1',
  iris:  'core_tutorial_seen_iris_v1',
};
const WOW_KEYS = {
  prism: 'core_wow_seen_prism_v1',
  iris:  'core_wow_seen_iris_v1',
};

type ActionType = 'email_draft' | 'calendar' | 'text_artifact';

interface Proposal {
  title: string;
  summary: string;
  actionType: ActionType;
  actionLabel: string;
  payload: {
    // email_draft
    to?: string;
    subject?: string;
    body?: string;
    // calendar
    eventTitle?: string;
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    minutes?: number;
    details?: string;
    // text_artifact
    kind?: 'reel_script' | 'memo' | 'pitch';
    brief?: string;
  };
}

interface Props {
  brand: 'prism' | 'iris';
  /** 親側で TutorialOverlay の onClose を受けたら bump するカウンタ */
  trigger?: number;
  /** 設定からの再表示 */
  force?: boolean;
  onClose?: () => void;
}

// ─── time utils ───────────────────────────────────────────
function nextSlotISO(timeOfDay: 'morning' | 'afternoon' | 'evening' = 'morning'): string {
  const d = new Date();
  const hour = timeOfDay === 'morning' ? 9 : timeOfDay === 'afternoon' ? 14 : 20;
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function addMinutesISO(iso: string, mins: number): string {
  const d = new Date(iso); d.setMinutes(d.getMinutes() + mins); return d.toISOString();
}
function formatJP(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ─── AI prompts ───────────────────────────────────────────
function systemPrompt(brand: 'prism' | 'iris'): string {
  const common = `あなたは「初日のユーザー」を 5 秒で感動させる AI コンシェルジュ。
ユーザーが書いた一行を読んで、「明日からやれる、具体的で気持ちいい一手」を **ちょうど 3 つ** 提案します。

# 重要なルール
- JSON 配列のみを返す。前置き・後書き・コードフェンス禁止。
- 提案は具体的で実行可能。「がんばりましょう」のような精神論は禁止。
- それぞれ違う actionType を使う (3 つとも違う種類)。
- 文体はやさしく、専門用語は使わない。
- "title" は 22 文字以内のキャッチー一行。
- "summary" は 60 文字以内、なぜそれが効くかを 1 文で。
- "actionLabel" は「ボタンに書く言葉」。10 文字以内、動詞で終わる。

# actionType と payload (必ずこの形式で)
1) "email_draft"   → payload: { to?: "(任意)", subject: "...", body: "..." }
   → メール / DM の下書きを 1 通そのまま書く。本文は 6-12 行で完結。
2) "calendar"      → payload: { eventTitle: "...", timeOfDay: "morning"|"afternoon"|"evening", minutes: 30, details: "" }
   → 「明日のこの時間に X 分」という形で、Google カレンダーに登録する想定。
3) "text_artifact" → payload: { kind: "reel_script"|"memo"|"pitch", brief: "..." }
   → AI が後で生成するときの「お題 (brief)」だけ書く。本文は不要。`;

  const brandLine = brand === 'prism'
    ? `\n\n# 文脈\nユーザーは事業家・経営者。CORE Prism (経営の右腕 AI) の初回画面にいる。kind は "memo" か "pitch" を選ぶ。`
    : `\n\n# 文脈\nユーザーはクリエイター/インフルエンサー。CORE Iris (SNS 運用の右腕 AI) の初回画面にいる。kind は "reel_script" を最低 1 つ含める。`;

  return common + brandLine;
}

function artifactSystem(brand: 'prism' | 'iris', kind?: string): string {
  if (kind === 'reel_script') {
    return `あなたは 2026 年最新トレンドに精通したリール構成作家。
9-15 秒、3 シーンで完結するリール台本を書く。
形式:
- フック (0-2 秒): 続きが気になる一言
- 中盤 (3-9 秒): 視覚的に映る要素 + 字幕案 2-3 行
- 締め (10-15 秒): フォロー or 保存を促す一言
- キャプション (3 行)
- ハッシュタグ (5 個)
専門用語禁止、すぐ撮れる粒度で。`;
  }
  if (kind === 'pitch') {
    return `あなたは事業家の右腕。${brand === 'prism' ? '経営者' : 'クリエイター'} に向けて、
「明日の一手」を 1 ページのピッチメモにまとめる。
形式: ① 状況 1 行  ② やること 3 行  ③ 期待される変化 1 行  ④ 想定リスク 1 行
専門用語禁止、200-280 字。`;
  }
  // memo (default)
  return `あなたは事業家の右腕。1 ページのメモを返す。
形式: ① 結論 1 行  ② 背景 2 行  ③ 次のアクション 3 つ (箇条書き、誰がいつまでに)
専門用語禁止、200-300 字。`;
}

// ─── fallback (AI が応答しなかったとき) ─────────────────────
function fallbackProposals(brand: 'prism' | 'iris', answer: string): Proposal[] {
  if (brand === 'iris') {
    return [
      {
        title: '今夜、リールを 1 本撮る',
        summary: `「${answer}」で伸びる 9 秒構成の台本を AI が用意します。`,
        actionType: 'text_artifact',
        actionLabel: '台本を作る',
        payload: { kind: 'reel_script', brief: `テーマ: ${answer}。フォロワーが思わず保存したくなる構成で。` },
      },
      {
        title: '撮影を予定に入れる',
        summary: '撮ろうと思った日が「いつか」になる前に、明日 20 時を抑えます。',
        actionType: 'calendar',
        actionLabel: '予定に入れる',
        payload: { eventTitle: 'リール撮影 (CORE Iris で計画)', timeOfDay: 'evening', minutes: 30, details: `テーマ: ${answer}` },
      },
      {
        title: 'コラボ DM の下書き',
        summary: '同ジャンルの相手に送るコラボ打診メッセージを用意します。',
        actionType: 'email_draft',
        actionLabel: 'DM を開く',
        payload: { subject: 'コラボのご相談', body: `はじめまして、いつも投稿楽しく拝見しています!\n\n${answer} の発信を伸ばしていきたく、もしよければコラボ企画を一緒にできないかと思いご連絡しました。\n\nお忙しい中恐縮ですが、ご検討いただけたら嬉しいです。\n\nよろしくお願いします。` },
      },
    ];
  }
  return [
    {
      title: '頭の中を 1 ページに',
      summary: `「${answer}」を、結論 → 背景 → アクションで整理します。`,
      actionType: 'text_artifact',
      actionLabel: 'メモを作る',
      payload: { kind: 'memo', brief: `相談内容: ${answer}` },
    },
    {
      title: '考える時間を 30 分確保',
      summary: '「いつかやる」を防ぐため、明日の朝 9 時に集中タイムを置きます。',
      actionType: 'calendar',
      actionLabel: '予定に入れる',
      payload: { eventTitle: '深く考える時間 (CORE Prism)', timeOfDay: 'morning', minutes: 30, details: `テーマ: ${answer}` },
    },
    {
      title: '相談メールの下書き',
      summary: 'チームや顧問に投げる「相談メール」を 1 通用意します。',
      actionType: 'email_draft',
      actionLabel: 'メールを開く',
      payload: { subject: '【相談】今後の進め方について', body: `お疲れさまです。\n\n以下の件について、ご意見を伺えたらと思いご連絡しました。\n\n■ 内容\n${answer}\n\n■ 私の今の考え\n(ここに今の見立てを 2-3 行)\n\n■ お聞きしたいこと\n・優先順位の付け方\n・想定リスク\n・他にやれること\n\nお時間あるときで結構です。よろしくお願いします。` },
    },
  ];
}

// ─── main component ───────────────────────────────────────
export default function WowOnboarding({ brand, trigger, force = false, onClose }: Props) {
  const { settings } = useSettings();
  const TUTORIAL_KEY = TUTORIAL_KEYS[brand];
  const WOW_KEY = WOW_KEYS[brand];

  const accent = brand === 'prism'
    ? 'linear-gradient(135deg, #2E6FFF 0%, #8E5CFF 50%, #E84B97 100%)'
    : 'linear-gradient(135deg, #E1306C 0%, #F77737 50%, #FBBF24 100%)';
  const accentSolid = brand === 'prism' ? '#8E5CFF' : '#E1306C';

  const question = brand === 'prism'
    ? '今、一番の悩みは?'
    : '今、伸ばしたい SNS は?';
  const subtitle = brand === 'prism'
    ? '一行で OK。AI が 5 秒で「最初の一手」を 3 つ用意します。'
    : '一行で OK。AI が 5 秒で「明日からやれる動き」を 3 つ用意します。';
  const placeholder = brand === 'prism'
    ? '例: 来月の売上が読めない / 採用が進まない / SNS が手付かず'
    : '例: Instagram のリール / TikTok / YouTube ショート';
  const quickChips = brand === 'iris'
    ? ['Instagram のリール', 'TikTok', 'YouTube ショート', 'X (Twitter)']
    : ['売上の作り方', '採用が進まない', '時間が足りない', 'SNS が手付かず'];

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'ask' | 'thinking' | 'show'>('ask');
  const [answer, setAnswer] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<{ title: string; body: string } | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const shouldShow = useCallback(() => {
    if (force) return true;
    try {
      return !!localStorage.getItem(TUTORIAL_KEY) && !localStorage.getItem(WOW_KEY);
    } catch { return false; }
  }, [TUTORIAL_KEY, WOW_KEY, force]);

  useEffect(() => {
    if (shouldShow()) {
      // tutorial overlay の close アニメ (250ms) を待つ
      const t = setTimeout(() => setOpen(true), 320);
      return () => clearTimeout(t);
    }
  }, [trigger, force, shouldShow]);

  const dismiss = () => {
    try { localStorage.setItem(WOW_KEY, '1'); } catch {/* */}
    setOpen(false);
    setStep('ask');
    setAnswer('');
    setProposals([]);
    setActiveResult(null);
    setDone(new Set());
    onClose?.();
  };

  const submit = async (overrideAnswer?: string) => {
    const a = (overrideAnswer ?? answer).trim();
    if (!a) return;
    setAnswer(a);
    setStep('thinking');
    setError(null);
    try {
      const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'x-ai-weight': 'light',
        },
        body: JSON.stringify({
          model: settings.preferredModel || 'claude-haiku-4-5',
          max_tokens: 1400,
          system: systemPrompt(brand),
          messages: [{ role: 'user', content: a }],
        }),
      });
      if (!res.ok) throw new Error(`AI ${res.status}`);
      const data = await res.json();
      const text = data.content?.[0]?.text ?? '';
      const m = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(m ? m[0] : text) as Proposal[];
      const valid = (parsed || []).filter(p => p && p.actionType && p.title).slice(0, 3);
      if (valid.length === 0) throw new Error('AI のレスポンスが解釈できませんでした');
      setProposals(valid);
      setStep('show');
    } catch (e: any) {
      setError(e?.message || 'AI が応答しませんでした');
      setProposals(fallbackProposals(brand, a));
      setStep('show');
    }
  };

  const runAction = async (i: number) => {
    const p = proposals[i];
    if (!p) return;
    setRunning(i);
    setActiveResult(null);
    try {
      if (p.actionType === 'email_draft') {
        const subject = p.payload.subject || '';
        const body = p.payload.body || '';
        const to = p.payload.to || '';
        const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        try { window.open(url); } catch {/* */}
        setActiveResult({
          title: '✉️ 下書きを用意しました',
          body: `宛先: ${to || '(あなたが選んでください)'}\n件名: ${subject}\n\n${body}\n\n— メールアプリが自動で開かない場合は、上の文章をそのままコピーしてお使いください。`,
        });
      } else if (p.actionType === 'calendar') {
        const startISO = nextSlotISO(p.payload.timeOfDay || 'morning');
        const minutes = p.payload.minutes || 30;
        const endISO = addMinutesISO(startISO, minutes);
        const url = buildGcalDeeplink({
          title: p.payload.eventTitle || p.title,
          startISO, endISO,
          details: p.payload.details || p.summary,
        });
        try { window.open(url, '_blank', 'noopener'); } catch {/* */}
        setActiveResult({
          title: '📅 Google カレンダーを開きました',
          body: `予定: ${p.payload.eventTitle || p.title}\n開始: ${formatJP(startISO)}\n所要: ${minutes} 分\n\n新しいタブで Google カレンダーが開きました。「保存」を押すと登録完了です。\n\n(タブが開かない場合は、ブラウザのポップアップを許可してください)`,
        });
      } else if (p.actionType === 'text_artifact') {
        const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';
        const r = await fetch('/api/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'x-ai-weight': 'light',
          },
          body: JSON.stringify({
            model: settings.preferredModel || 'claude-haiku-4-5',
            max_tokens: 1500,
            system: artifactSystem(brand, p.payload.kind),
            messages: [{ role: 'user', content: `お題:\n${p.payload.brief || p.summary || answer}` }],
          }),
        });
        if (!r.ok) throw new Error(`AI ${r.status}`);
        const d = await r.json();
        const out = (d?.content?.[0]?.text ?? '').trim();
        if (!out) throw new Error('AI のレスポンスが空でした');
        const heading = p.payload.kind === 'reel_script' ? '🎬 リール台本ができました'
          : p.payload.kind === 'pitch' ? '📌 ピッチメモができました'
          : '📝 メモができました';
        setActiveResult({ title: heading, body: out });
      }
      setDone(prev => new Set(prev).add(i));
    } catch (e: any) {
      setActiveResult({
        title: '⚠️ うまく動かせませんでした',
        body: `${e?.message || '不明なエラー'}\n\nもう一度試すか、別の提案を選んでみてください。`,
      });
    } finally {
      setRunning(null);
    }
  };

  const copyResult = async () => {
    if (!activeResult) return;
    try {
      await navigator.clipboard.writeText(activeResult.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {/* */}
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="wow-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 99997,
          background: 'rgba(8, 6, 16, 0.82)',
          backdropFilter: 'blur(18px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          fontFamily: '"Noto Sans JP", system-ui, sans-serif',
        }}
        onClick={() => { if (step !== 'thinking') dismiss(); }}
      >
        {/* スキップ */}
        <button
          onClick={dismiss}
          style={{
            position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            right: 16, zIndex: 1,
            padding: '0.5rem 0.95rem',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 999,
            fontSize: 12, fontWeight: 700,
            color: 'rgba(255,255,255,0.85)',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
          あとで <X size={11} />
        </button>

        <motion.div
          key={step}
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.99 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          style={{
            width: '100%', maxWidth: 520,
            maxHeight: 'calc(100dvh - 80px)',
            padding: '1.8rem 1.5rem 1.4rem',
            background: 'linear-gradient(180deg, rgba(30,20,50,0.96) 0%, rgba(15,10,25,0.96) 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 24,
            boxShadow: `0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px ${accentSolid}33`,
            color: '#fff',
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto',
          }}>

          {/* ヘッダ */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '0.35rem 0.7rem',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 999,
            fontSize: 11, fontWeight: 700,
            color: 'rgba(255,255,255,0.78)',
            alignSelf: 'flex-start',
            marginBottom: '0.85rem',
            letterSpacing: '0.04em',
          }}>
            <Sparkles size={12} /> 最初の 3 分で「Wow」
          </div>

          {/* === STEP 1: ASK === */}
          {step === 'ask' && (
            <>
              <h2 style={{
                margin: 0,
                fontFamily: '"Cinzel", "Noto Serif JP", serif', fontStyle: 'italic',
                fontSize: 'clamp(1.5rem, 5.4vw, 2rem)',
                fontWeight: 500, lineHeight: 1.3,
                letterSpacing: '-0.01em',
                marginBottom: '0.55rem',
                background: accent, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {question}
              </h2>
              <p style={{
                margin: 0, fontSize: 13.5, lineHeight: 1.7,
                color: 'rgba(255,255,255,0.78)',
                marginBottom: '1.2rem',
              }}>
                {subtitle}
              </p>

              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
                placeholder={placeholder}
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '0.9rem 1rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 14,
                  color: '#fff', fontSize: 15, lineHeight: 1.6,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  marginBottom: '0.7rem',
                }}
                autoFocus
              />

              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6,
                marginBottom: '1.2rem',
              }}>
                {quickChips.map(c => (
                  <button key={c}
                    onClick={() => { setAnswer(c); submit(c); }}
                    style={{
                      padding: '0.4rem 0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.16)',
                      borderRadius: 999,
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: 11.5, fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}>
                    {c}
                  </button>
                ))}
              </div>

              <button
                onClick={() => submit()}
                disabled={!answer.trim()}
                style={{
                  width: '100%', padding: '0.95rem 1.2rem',
                  background: answer.trim() ? accent : 'rgba(255,255,255,0.08)',
                  color: '#fff', border: 'none', borderRadius: 999,
                  fontSize: 14.5, fontWeight: 800,
                  cursor: answer.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: answer.trim() ? `0 8px 24px ${accentSolid}40` : 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'inherit',
                  opacity: answer.trim() ? 1 : 0.55,
                }}>
                AI に 3 つ提案してもらう <ArrowRight size={15} />
              </button>
              <p style={{
                margin: '0.7rem 0 0',
                fontSize: 10.5, color: 'rgba(255,255,255,0.42)',
                textAlign: 'center', fontStyle: 'italic',
              }}>
                ⌘ + Enter でも送信できます
              </p>
            </>
          )}

          {/* === STEP 2: THINKING === */}
          {step === 'thinking' && (
            <div style={{
              padding: '2.4rem 1rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 size={42} color={accentSolid} strokeWidth={1.6} />
              </motion.div>
              <p style={{
                margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)',
                fontWeight: 600, textAlign: 'center', lineHeight: 1.7,
              }}>
                AI が 3 つ考えています…
              </p>
              <p style={{
                margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.5)',
                textAlign: 'center',
              }}>
                通常 5 秒以内で返ってきます
              </p>
            </div>
          )}

          {/* === STEP 3: SHOW PROPOSALS === */}
          {step === 'show' && (
            <>
              <h2 style={{
                margin: 0,
                fontFamily: '"Cinzel", "Noto Serif JP", serif', fontStyle: 'italic',
                fontSize: 'clamp(1.3rem, 4.5vw, 1.7rem)',
                fontWeight: 500, lineHeight: 1.3,
                marginBottom: '0.4rem',
              }}>
                3 つ用意できました
              </h2>
              <p style={{
                margin: 0, fontSize: 12.5, lineHeight: 1.6,
                color: 'rgba(255,255,255,0.65)',
                marginBottom: '1rem',
              }}>
                「これ、私が動かします」を押すと、AI が実際にその場で動きます。
              </p>

              {error && (
                <div style={{
                  padding: '0.55rem 0.8rem',
                  background: 'rgba(255,180,80,0.10)',
                  border: '1px solid rgba(255,180,80,0.30)',
                  borderRadius: 10,
                  fontSize: 11, lineHeight: 1.55,
                  color: 'rgba(255,210,140,0.9)',
                  marginBottom: '0.8rem',
                }}>
                  ⚠️ AI 接続が不安定だったため、定番の 3 つを表示しています。
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {proposals.map((p, i) => {
                  const Icon = p.actionType === 'email_draft' ? Mail
                            : p.actionType === 'calendar' ? Calendar
                            : FileText;
                  const isDone = done.has(i);
                  const isRunning = running === i;
                  return (
                    <div key={i} style={{
                      padding: '0.95rem 1rem',
                      background: isDone ? 'rgba(80,200,140,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isDone ? 'rgba(80,200,140,0.32)' : 'rgba(255,255,255,0.10)'}`,
                      borderRadius: 14,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{
                          flexShrink: 0,
                          width: 32, height: 32, borderRadius: 10,
                          background: accent,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: `0 4px 14px ${accentSolid}40`,
                        }}>
                          <Icon size={16} color="#fff" strokeWidth={1.8} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 800, lineHeight: 1.4,
                            color: '#fff',
                            marginBottom: 3,
                          }}>
                            {p.title}
                          </div>
                          <div style={{
                            fontSize: 12, lineHeight: 1.6,
                            color: 'rgba(255,255,255,0.68)',
                          }}>
                            {p.summary}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => runAction(i)}
                        disabled={isRunning}
                        style={{
                          alignSelf: 'flex-end',
                          padding: '0.55rem 1rem',
                          background: isDone ? 'rgba(80,200,140,0.18)' : accent,
                          color: '#fff', border: 'none', borderRadius: 999,
                          fontSize: 12.5, fontWeight: 800,
                          cursor: isRunning ? 'wait' : 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontFamily: 'inherit',
                          boxShadow: isDone ? 'none' : `0 6px 18px ${accentSolid}40`,
                          opacity: isRunning ? 0.7 : 1,
                        }}>
                        {isRunning
                          ? <><Loader2 size={13} className="anim-spin" /> 動いています…</>
                          : isDone
                            ? <><Check size={13} /> もう一度</>
                            : <>これ、私が動かします <ArrowRight size={13} /></>
                        }
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={dismiss}
                style={{
                  marginTop: '1rem',
                  padding: '0.7rem 1rem',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: 999,
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: 12, fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                とりあえず、自分で触ってみる
              </button>
            </>
          )}
        </motion.div>

        {/* 結果モーダル (action 実行後) */}
        <AnimatePresence>
          {activeResult && (
            <motion.div
              key="wow-result"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setActiveResult(null)}
              style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
              }}>
              <motion.div
                initial={{ y: 20, scale: 0.96, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.26, ease: 'easeOut' }}
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%', maxWidth: 520, maxHeight: '80dvh',
                  padding: '1.4rem 1.3rem 1.1rem',
                  background: 'linear-gradient(180deg, #1a1330 0%, #0e0820 100%)',
                  border: `1px solid ${accentSolid}50`,
                  borderRadius: 20,
                  boxShadow: `0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px ${accentSolid}20`,
                  color: '#fff',
                  display: 'flex', flexDirection: 'column',
                }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
                  marginBottom: '0.8rem',
                }}>
                  <h3 style={{
                    margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.4,
                  }}>{activeResult.title}</h3>
                  <button onClick={() => setActiveResult(null)} style={{
                    flexShrink: 0,
                    width: 28, height: 28, borderRadius: 999,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.16)',
                    color: '#fff', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <X size={13} />
                  </button>
                </div>
                <div style={{
                  flex: 1, overflowY: 'auto',
                  padding: '0.95rem 1rem',
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  fontSize: 13, lineHeight: 1.75,
                  color: 'rgba(255,255,255,0.92)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: '"Noto Sans JP", system-ui',
                }}>
                  {activeResult.body}
                </div>
                <button
                  onClick={copyResult}
                  style={{
                    marginTop: '0.8rem',
                    padding: '0.7rem 1rem',
                    background: copied ? 'rgba(80,200,140,0.18)' : accent,
                    color: '#fff', border: 'none', borderRadius: 999,
                    fontSize: 13, fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'inherit',
                    boxShadow: copied ? 'none' : `0 6px 18px ${accentSolid}40`,
                  }}>
                  {copied ? <><Check size={14} /> コピーしました</> : <><Copy size={14} /> 全文コピー</>}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
