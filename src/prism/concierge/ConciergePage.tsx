// ============================================================
// ConciergePage — /concierge
//
// 1画面目 = ConciergeStage: 画面いっぱいのクリスタル・アバターに
//           話しかけるだけの全画面体験 (開花アニメーション付き)
// スクロール下層 = 02 SETUP (1行設置タグ生成) / 03 PRICING
//
// ?embed=1 のときは全画面透過でフローティングバブルのみ描画し、
// 開閉を parent へ postMessage (public/prism-concierge.js が受けて iframe を伸縮)
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import ConciergeWidget from './ConciergeWidget';
import ConciergeStage from './ConciergeStage';
import {
  type ConciergeConfig,
  DEFAULT_CONCIERGE_CONFIG,
  encodeConciergeConfig,
  readConciergeConfigFromUrl,
  isConciergeEmbed,
} from './conciergeConfig';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout';

const SERIF = `'Didot', 'Bodoni 72', 'Hiragino Mincho ProN', 'Yu Mincho', Georgia, serif`;
const SANS = `-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;

// ページ専用トークン — CRYSTAL (スチールブルーの空気)
const P = {
  bg0: '#1B2333',
  bg1: '#28354C',
  fg: '#F4F7FC',
  fgMuted: 'rgba(244,247,252,0.72)',
  fgSubtle: 'rgba(244,247,252,0.5)',
  line: 'rgba(255,255,255,0.16)',
  lineSoft: 'rgba(255,255,255,0.1)',
  glass: 'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.12)',
  silver: '#D9E4F5',
  gold: '#C9A96E',
};

const ACCENT_PRESETS = [
  { label: '金', hex: '#C9A96E' },
  { label: '白金', hex: '#C8CDD6' },
  { label: '紫', hex: '#A78BFA' },
  { label: '深紅', hex: '#B4485A' },
  { label: '翡翠', hex: '#4E9E82' },
];

// ─── 埋め込みモード ─────────────────────────────
function EmbedMode() {
  const config = useMemo(() => readConciergeConfigFromUrl(), []);

  // iframe の中身を完全透過にする (設置先サイトに馴染ませる)
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.background, body: body.style.background };
    html.style.background = 'transparent';
    body.style.background = 'transparent';
    return () => { html.style.background = prev.html; body.style.background = prev.body; };
  }, []);

  const onOpenChange = useCallback((open: boolean) => {
    try {
      window.parent?.postMessage({ type: 'prism-concierge:resize', open }, '*');
    } catch { /* 埋め込み外で開いた場合は何もしない */ }
  }, []);

  const onPeekChange = useCallback((peek: boolean) => {
    try {
      window.parent?.postMessage({ type: 'prism-concierge:peek', peek }, '*');
    } catch { /* 埋め込み外で開いた場合は何もしない */ }
  }, []);

  return <ConciergeWidget config={config} variant="floating" onOpenChange={onOpenChange} onPeekChange={onPeekChange} />;
}

// ─── 小さな UI 部品 ─────────────────────────────
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: P.fgMuted, letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: P.fgSubtle, marginTop: 5, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 13px',
  borderRadius: 12, border: `1px solid ${P.line}`, outline: 'none',
  background: 'rgba(13,20,34,0.35)', color: P.fg, fontSize: 16, fontFamily: SANS,
};

function HairLine() {
  return <div aria-hidden style={{ height: 1, background: `linear-gradient(90deg, transparent, ${P.line}, transparent)` }} />;
}

// エディトリアル番号 (参照デザインの「01 Frost Dahlia」)
function SectionIndex({ no, label }: { no: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
      <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 400, color: P.silver, letterSpacing: '0.06em' }}>{no}</span>
      <span aria-hidden style={{ width: 44, height: 1, background: P.line }} />
      <span style={{ fontSize: 11, letterSpacing: '0.32em', color: P.fgMuted, textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

// ─── できること (世界で売れている AI エージェントの中核機能) ───
const CAPABILITIES: Array<{ t: string; d: string }> = [
  { t: '24時間・365日の応対', d: '深夜も休日も、ブランドの言葉づかいのまま。お問い合わせの取りこぼしをゼロに。' },
  { t: '声で話す・声で返す', d: 'マイクに話しかけるだけ。美しい字幕と声で、その場でお答えします。' },
  { t: 'ナレッジ貼るだけ学習', d: '会社案内やサービス説明を貼るだけで、その内容を根拠に正確に答えます。' },
  { t: 'FAQ 自動生成', d: '貼り付けた文章から、よくある質問と模範回答を AI が自動で起こします。' },
  { t: '商談・来店の日程獲得', d: '関心が高まった瞬間を逃さず日程を伺い、連絡先カードを自動で開きます。' },
  { t: '見込み客の見極め (AI SDR)', d: '「有望なお客様の条件」を設定すると、会話の流れで自然に確認します。' },
  { t: '会話まるごとメール通知', d: 'お名前・連絡先・会話の全文が、そのままあなたのメールに届きます。' },
  { t: '多言語の自動応対', d: '英語・中国語など、お客様の言語を見分けて同じ言語でお迎えします。' },
  { t: '先に話しかける接客', d: '迷っている訪問者へ、数秒後にそっと一言。声かけから商談が始まります。' },
  { t: 'ブランド人格の調整', d: '正統派・親しみ・簡潔の3人格に、呼び名・一人称・色まで合わせられます。' },
  { t: '予約ページへの橋渡し', d: '予約 URL を設定すると、会話の流れで予約ボタンを自動で差し出します。' },
  { t: '設置は3通り・HTML不要も', d: '専用リンクを貼るだけ / タグ1行 / メール1通で設置代行。最短1分で働き始めます。' },
];

function DiamondIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={P.silver} strokeWidth="1.3" strokeLinejoin="round" aria-hidden>
      <path d="M8 1.5L14.5 8 8 14.5 1.5 8 8 1.5z" />
      <path d="M8 4.5L11.5 8 8 11.5 4.5 8 8 4.5z" opacity="0.55" />
    </svg>
  );
}

// ─── 共創フィードバックカード (Guild連携: このアプリを一緒に良くする) ───
type Tokens = typeof P;

function CrystalCoCreateCard({ tokens: T }: { tokens: Tokens }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ url: string } | null>(null);

  const submit = async () => {
    const idea = body.trim();
    if (!idea) {
      setError('アイデアを入力してください。');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetchWithTimeout('https://guild-hazel.vercel.app/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product: 'crystal',
          contributor: 'ゲスト',
          ...(title.trim() ? { title: title.trim() } : {}),
          body: idea,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok || !j?.url) throw new Error('failed');
      setDone({ url: String(j.url) });
      setTitle('');
      setBody('');
    } catch {
      setError('うまく届きませんでした。少し時間をおいて、もう一度お試しください。');
    } finally {
      setSending(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 24, padding: 'clamp(18px, 3vw, 28px)',
    border: `1px solid ${T.line}`, background: T.glass,
    backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
  };

  if (done) {
    return (
      <div style={cardStyle}>
        <div style={{ fontFamily: SERIF, fontSize: 15, letterSpacing: '0.3em', color: T.gold, marginBottom: 10 }}>THANK YOU</div>
        <h2 style={{ margin: '0 0 8px', fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(19px, 3vw, 24px)' }}>ギルドに届きました</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.9, color: T.fgMuted }}>
          ありがとうございます。あなたのアイデアは共創コミュニティで検討されます。採用されると<strong style={{ color: T.fg }}>トークン(謝礼)</strong>が届きます。
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a href={done.url} target="_blank" rel="noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 18px',
            borderRadius: 999, background: T.gold, color: '#141414', textDecoration: 'none', fontSize: 13, fontWeight: 800,
          }}>
            ギルドで進捗を見る
          </a>
          <button onClick={() => setDone(null)} style={{
            minHeight: 44, padding: '0 18px', borderRadius: 999, border: `1px solid ${T.line}`,
            background: 'transparent', color: T.fgMuted, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            もう一つ送る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <SectionIndex no="05" label="Build it together" />
      <h2 style={{ margin: '0 0 8px', fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(21px, 3.6vw, 28px)' }}>
        このアプリを一緒に良くする
      </h2>
      <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.9, color: T.fgMuted, maxWidth: 620 }}>
        あなたの「こうだったらいいな」をギルドに届けると、<strong style={{ color: T.fg }}>採用された提案にはトークン(謝礼)</strong>が届きます。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="ひとことタイトル (任意)"
          maxLength={60}
          style={inputStyle}
        />
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="例: 応対の会話ログをもっと見やすく振り返りたいです。"
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 96, lineHeight: 1.6 }}
        />
        {error && <p style={{ margin: 0, fontSize: 12.5, color: '#F2B8C6' }}>{error}</p>}
        <button
          onClick={() => void submit()}
          disabled={sending || !body.trim()}
          style={{
            minHeight: 48, borderRadius: 999, border: 'none', cursor: sending ? 'default' : 'pointer',
            background: sending ? 'rgba(217,228,245,0.35)' : T.gold, color: '#141414', fontSize: 14, fontWeight: 800,
            letterSpacing: '0.03em', opacity: sending || !body.trim() ? 0.7 : 1,
          }}
        >
          {sending ? '送っています…' : 'ギルドに改善アイデアを送る'}
        </button>
      </div>
    </div>
  );
}

// ─── ショーケース本体 ────────────────────────────
function Showcase() {
  const [config, setConfig] = useState<ConciergeConfig>(() => readConciergeConfigFromUrl());
  const [servicesText, setServicesText] = useState(() => config.services.join('\n'));
  const [copied, setCopied] = useState(false);

  // 購入後オンボーディング (?welcome=1 — Stripe決済のリダイレクト先)
  const [welcomeOpen, setWelcomeOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('welcome') === '1';
  });
  const closeWelcome = () => {
    setWelcomeOpen(false);
    document.getElementById('setup')?.scrollIntoView({ behavior: 'smooth' });
  };

  // FAQ 自動生成 (貼り付けたナレッジ → Q&A を AI が起こす)
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const generateFaq = async () => {
    const src = (config.knowledge || '').trim();
    if (src.length < 40) {
      setGenMsg({ ok: false, text: 'まず上の欄に、会社やサービスの説明文を貼り付けてください (40文字以上)。' });
      return;
    }
    setGenBusy(true);
    setGenMsg(null);
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 40_000);
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1400,
          system: 'あなたはFAQ設計の専門家。渡された文章から、サイト訪問者が実際に尋ねそうな質問と、文章の内容だけを根拠にした回答を最大6組作る。出力はJSON配列のみ: [{"q":"質問","a":"回答"}]。回答は2文以内。文章にない情報は作らない。',
          messages: [{ role: 'user', content: src.slice(0, 4000) }],
        }),
        signal: ctrl.signal,
      }).finally(() => window.clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text: string = data?.content?.[0]?.text || '';
      const jsonText = text.replace(/^[\s\S]*?(\[)/, '$1').replace(/(\])[\s\S]*$/, '$1');
      const arr = JSON.parse(jsonText) as Array<{ q?: unknown; a?: unknown }>;
      const items = arr
        .filter(x => x && typeof x.q === 'string' && typeof x.a === 'string' && (x.q as string).trim() && (x.a as string).trim())
        .map(x => ({ q: (x.q as string).slice(0, 120), a: (x.a as string).slice(0, 400) }));
      if (items.length === 0) throw new Error('empty');
      setConfig(prev => {
        const merged = [...prev.faq.filter(f => f.q.trim() || f.a.trim())];
        for (const it of items) if (!merged.some(m => m.q === it.q)) merged.push(it);
        return { ...prev, faq: merged.slice(0, 12) };
      });
      setGenMsg({ ok: true, text: `${items.length}件の FAQ を作成し、下の「よくある質問」に追加しました。` });
    } catch {
      setGenMsg({ ok: false, text: '生成できませんでした。通信環境をご確認のうえ、もう一度お試しください。' });
    } finally {
      setGenBusy(false);
    }
  };

  const set = <K extends keyof ConciergeConfig>(key: K, value: ConciergeConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://core-prism-app.vercel.app';
  const encoded = useMemo(() => encodeConciergeConfig(config), [config]);
  const embedCode = `<script src="${origin}/crystal.js" data-config="${encoded}" async></script>`;

  // 方法1: 専用リンク (貼り付け不要)。設定はぜんぶ URL の中に入っている
  const [copiedLink, setCopiedLink] = useState(false);
  const pageUrl = `${origin}/crystal?page=1&c=${encoded}`;
  // ナレッジが大きいと QR の容量を超えるので、そのときは QR を省略してリンクだけにする
  const qrOk = pageUrl.length <= 1500;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(pageUrl)}`;

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // clipboard 不許可環境: 選択できるようにテキストを prompt で提示 (silent fail 禁止)
      window.prompt('このタグをコピーしてください', embedCode);
    }
  };

  const copyPageLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      window.prompt('このリンクをコピーしてください', pageUrl);
    }
  };

  const daikouMailto = `mailto:core.guild.inc@gmail.com?subject=${encodeURIComponent('【Crystal 設置代行】お願いします')}&body=${encodeURIComponent(
    `サイトURL: \nブランド名: ${config.brandName}\nご希望 (あれば): \n\n--- 以下はそのままで大丈夫です (あなたの設定データ) ---\n${pageUrl}`,
  )}`;

  const mailtoCta = (plan: string) =>
    `mailto:core.guild.inc@gmail.com?subject=${encodeURIComponent(`【Crystal 導入相談】${plan}`)}&body=${encodeURIComponent(
      `ブランド名: ${config.brandName}\n業種: ${config.industry}\nご希望プラン: ${plan}\nサイトURL: \nご相談内容: `,
    )}`;

  return (
    <div style={{
      minHeight: '100svh', color: P.fg, fontFamily: SANS,
      background: `linear-gradient(180deg, ${P.bg1} 0%, ${P.bg0} 100%)`,
    }}>
      <style>{`html { scroll-behavior: smooth; }`}</style>

      {/* ── 購入後オンボーディング (Stripe決済 → ?welcome=1 で着地) ── */}
      {welcomeOpen && (
        <div
          role="dialog"
          aria-label="ご導入ありがとうございます"
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(10,16,30,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
          }}
        >
          <div style={{
            width: 'min(560px, 100%)', maxHeight: '86svh', overflowY: 'auto',
            borderRadius: 26, padding: 'clamp(22px, 4vw, 34px)',
            border: `1px solid ${P.glassStrong}`,
            background: 'linear-gradient(165deg, rgba(40,53,76,0.97), rgba(27,35,51,0.99))',
            boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
          }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, letterSpacing: '0.3em', color: P.gold, marginBottom: 10 }}>WELCOME</div>
            <h2 style={{ margin: '0 0 10px', fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(21px, 4vw, 27px)', letterSpacing: '0.05em' }}>
              ご導入、ありがとうございます。
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, lineHeight: 2, color: P.fgMuted }}>
              あと3分で、あなたのコンシェルジュが働き始めます。やることは3つだけです。
            </p>
            {[
              { n: '1', t: 'ブランドを設定する', d: 'この下のフォームに、ブランド名・ご案内できること・ナレッジ (会社案内の貼り付け) を入れると、その場でコンシェルジュが変わります。' },
              { n: '2', t: '専用リンクを置く', d: '「専用リンクをコピー」して、Instagramプロフィール・LINE・サイトのどこかへ。QRコードなら店頭にも。タグ1行の埋め込みも使えます。' },
              { n: '3', t: '困ったら丸投げ', d: '「設置代行をメールで頼む」ボタンから送っていただければ、こちらで設置まで行います (初期費用に含まれています)。' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 34, height: 34, minWidth: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${P.glassStrong}`, fontFamily: SERIF, fontSize: 15, color: P.silver,
                }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{s.t}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.9, color: P.fgMuted }}>{s.d}</div>
                </div>
              </div>
            ))}
            <button
              onClick={closeWelcome}
              style={{
                marginTop: 8, width: '100%', minHeight: 52, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: '#F4F7FC', color: '#1B2333', fontSize: 14.5, fontWeight: 800, letterSpacing: '0.04em',
              }}
            >
              設定をはじめる
            </button>
            <p style={{ margin: '12px 0 0', fontSize: 11.5, lineHeight: 1.8, color: P.fgSubtle, textAlign: 'center' }}>
              ご不明点はメール1通で:{' '}
              <a href="mailto:core.guild.inc@gmail.com" style={{ color: P.gold, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>core.guild.inc@gmail.com</a>{' '}
              — 24時間以内にご返信します。
            </p>
          </div>
        </div>
      )}

      {/* ── 1画面目: 全画面クリスタル・アバター ── */}
      <ConciergeStage config={config} />

      <HairLine />

      {/* ── 02 CAPABILITIES ── */}
      <section id="features" style={{ maxWidth: 1160, margin: '0 auto', padding: 'clamp(40px, 6vw, 80px) clamp(16px, 4vw, 44px)', scrollMarginTop: 16 }}>
        <SectionIndex no="02" label="Everything, in one crystal" />
        <h2 style={{ margin: '0 0 10px', fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(24px, 3.6vw, 36px)', letterSpacing: '0.04em' }}>
          Crystal ができること
        </h2>
        <p style={{ margin: '0 0 30px', fontSize: 14, lineHeight: 2, color: P.fgMuted, maxWidth: 680 }}>
          世界で売れている AI エージェント — Intercom Fin (解決1件 $0.99)、Sierra (Fortune 500 が採用)、
          Qualified の AI 営業担当 (年間約 $68,000〜) — の中核機能を、この一体に集めました。
          応対も、見極めも、日程獲得も、Crystal ひとりで。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
          {CAPABILITIES.map(c => (
            <div key={c.t} style={{
              borderRadius: 18, padding: '18px 18px 16px',
              border: `1px solid ${P.lineSoft}`, background: P.glass,
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                <DiamondIcon />
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>{c.t}</div>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.85, color: P.fgMuted }}>{c.d}</div>
            </div>
          ))}
        </div>
      </section>

      <HairLine />

      {/* ── 03 SETUP ── */}
      <section id="setup" style={{ maxWidth: 1160, margin: '0 auto', padding: 'clamp(40px, 6vw, 80px) clamp(16px, 4vw, 44px)', scrollMarginTop: 16 }}>
        <SectionIndex no="03" label="Crafted in one line" />
        <h2 style={{ margin: '0 0 10px', fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(24px, 3.6vw, 36px)', letterSpacing: '0.04em' }}>
          あなたのサイトに、1行で設置
        </h2>
        <p style={{ margin: '0 0 30px', fontSize: 14, lineHeight: 2, color: P.fgMuted, maxWidth: 680 }}>
          下のフォームでブランドに合わせて調整すると、上のコンシェルジュがその場で変わります。
          設置のしかたは3つ — いちばん簡単なのは<strong style={{ color: P.fg }}>「専用リンクを貼るだけ」</strong>。
          HTML を触る必要はありません。丸ごとおまかせの設置代行もあります。
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          {/* 設定フォーム */}
          <div style={{
            flex: '1 1 320px', minWidth: 0, borderRadius: 24, padding: 'clamp(16px, 3vw, 26px)',
            border: `1px solid ${P.line}`, background: P.glass,
            backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          }}>
            <Field label="ブランド名">
              <input style={inputStyle} value={config.brandName} onChange={e => set('brandName', e.target.value)} placeholder="例: THE RESIDENCE 麻布" />
            </Field>
            <Field label="ひとこと (タグライン)">
              <input style={inputStyle} value={config.tagline} onChange={e => set('tagline', e.target.value)} placeholder="例: 選ばれた方のための、静かな邸宅" />
            </Field>
            <Field label="業種">
              <input style={inputStyle} value={config.industry} onChange={e => set('industry', e.target.value)} placeholder="例: 高級不動産" />
            </Field>
            <Field label="ご案内できること (1行に1つ)" hint="アバターの下に「ご用件ボタン」として表示されます">
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 96, lineHeight: 1.6 }}
                value={servicesText}
                onChange={e => {
                  setServicesText(e.target.value);
                  set('services', e.target.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8));
                }}
              />
            </Field>
            <Field
              label="ナレッジ (貼るだけで AI が学習)"
              hint="会社案内・サービス説明・料金表などをそのまま貼り付けると、AI はこの内容を最優先の根拠に答えます (4,000文字まで)"
            >
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 120, lineHeight: 1.6 }}
                value={config.knowledge || ''}
                onChange={e => set('knowledge', e.target.value || undefined)}
                placeholder="ここに文章を貼り付けるだけ"
              />
              <button
                onClick={() => void generateFaq()}
                disabled={genBusy}
                style={{
                  marginTop: 8, minHeight: 44, width: '100%', borderRadius: 12, cursor: genBusy ? 'default' : 'pointer',
                  border: `1px solid ${P.line}`, background: genBusy ? 'transparent' : 'rgba(217,228,245,0.12)',
                  color: P.silver, fontSize: 13, fontWeight: 700, letterSpacing: '0.03em',
                }}
              >
                {genBusy ? 'AI が文章を読んでいます…' : 'この文章から FAQ を自動生成'}
              </button>
              {genMsg && (
                <div style={{ fontSize: 12, lineHeight: 1.7, marginTop: 6, color: genMsg.ok ? '#9ED3BC' : '#F2B8C6' }}>
                  {genMsg.text}
                </div>
              )}
            </Field>
            <Field label="応対の人格 (トーン)">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {([
                  { v: 'classic', l: '正統派 (高級ホテル)' },
                  { v: 'warm', l: '親しみやすい' },
                  { v: 'sharp', l: '簡潔なプロ' },
                ] as const).map(t => (
                  <button
                    key={t.v}
                    onClick={() => set('tone', t.v)}
                    style={{
                      minHeight: 44, padding: '10px 16px', borderRadius: 999, cursor: 'pointer',
                      border: (config.tone || 'classic') === t.v ? '1.5px solid rgba(217,228,245,0.75)' : `1px solid ${P.line}`,
                      background: (config.tone || 'classic') === t.v ? 'rgba(217,228,245,0.14)' : 'transparent',
                      color: P.fg, fontSize: 13, fontFamily: SANS,
                    }}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
            </Field>
            <Field
              label="有望なお客様の条件 (AI SDR)"
              hint="AI が会話の流れで自然に確認し、条件に合う方を日程のご提案へつなげます"
            >
              <input
                style={inputStyle}
                value={config.qualify || ''}
                onChange={e => set('qualify', e.target.value || undefined)}
                placeholder="例: 予算月3万円以上・導入時期が3ヶ月以内"
              />
            </Field>
            <Field
              label="先に話しかける一言 (空欄で OFF)"
              hint="埋め込み先のサイトで、数秒後にバブルの上からそっと声をかけます"
            >
              <input
                style={inputStyle}
                value={config.proactiveMessage || ''}
                onChange={e => set('proactiveMessage', e.target.value || undefined)}
                placeholder="例: ご覧いただきありがとうございます。ご質問はございますか？"
              />
            </Field>
            <Field label="アクセント色">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {ACCENT_PRESETS.map(p => (
                  <button
                    key={p.hex}
                    onClick={() => set('accentColor', p.hex)}
                    aria-label={`アクセント色を${p.label}にする`}
                    style={{
                      width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
                      background: p.hex,
                      border: config.accentColor === p.hex ? '2px solid #FFFFFF' : `1px solid ${P.line}`,
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={config.accentColor}
                  onChange={e => set('accentColor', e.target.value)}
                  aria-label="アクセント色を自由に選ぶ"
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${P.line}`, background: 'transparent', padding: 4, cursor: 'pointer' }}
                />
              </div>
            </Field>
            <Field label="連絡先メール (リードの通知先ではなく、AI が案内に使う窓口)">
              <input style={inputStyle} type="email" value={config.contactEmail || ''} onChange={e => set('contactEmail', e.target.value || undefined)} placeholder="info@example.com" />
            </Field>
            <Field label="予約ページ URL (任意)">
              <input style={inputStyle} type="url" value={config.bookingUrl || ''} onChange={e => set('bookingUrl', e.target.value || undefined)} placeholder="https://..." />
            </Field>

            {/* FAQ 編集 */}
            <Field label="よくある質問 (AI はこの内容に沿って答えます)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {config.faq.map((f, i) => (
                  <div key={i} style={{ border: `1px solid ${P.line}`, borderRadius: 12, padding: 10 }}>
                    <input
                      style={{ ...inputStyle, minHeight: 40, marginBottom: 6, fontSize: 16 }}
                      value={f.q}
                      onChange={e => set('faq', config.faq.map((x, j) => j === i ? { ...x, q: e.target.value } : x))}
                      placeholder="質問"
                    />
                    <textarea
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 56, lineHeight: 1.6 }}
                      value={f.a}
                      onChange={e => set('faq', config.faq.map((x, j) => j === i ? { ...x, a: e.target.value } : x))}
                      placeholder="答え"
                    />
                    <button
                      onClick={() => set('faq', config.faq.filter((_, j) => j !== i))}
                      style={{ marginTop: 6, minHeight: 40, padding: '8px 12px', borderRadius: 10, border: `1px solid ${P.line}`, background: 'transparent', color: P.fgMuted, fontSize: 12, cursor: 'pointer' }}
                    >
                      この質問を削除
                    </button>
                  </div>
                ))}
                {config.faq.length < 12 && (
                  <button
                    onClick={() => set('faq', [...config.faq, { q: '', a: '' }])}
                    style={{ minHeight: 44, borderRadius: 12, border: `1px dashed ${P.line}`, background: 'transparent', color: P.silver, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ＋ 質問を追加
                  </button>
                )}
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Field label="コンシェルジュの呼び名">
                <input style={{ ...inputStyle, width: 160 }} value={config.conciergeName || ''} onChange={e => set('conciergeName', e.target.value)} placeholder="コンシェルジュ" />
              </Field>
              <Field label="一人称">
                <input style={{ ...inputStyle, width: 120 }} value={config.firstPerson || ''} onChange={e => set('firstPerson', e.target.value)} placeholder="私" />
              </Field>
            </div>

            <button
              onClick={() => {
                setConfig({ ...DEFAULT_CONCIERGE_CONFIG });
                setServicesText(DEFAULT_CONCIERGE_CONFIG.services.join('\n'));
              }}
              style={{ minHeight: 40, padding: '8px 14px', borderRadius: 10, border: `1px solid ${P.line}`, background: 'transparent', color: P.fgSubtle, fontSize: 12, cursor: 'pointer' }}
            >
              はじめの設定に戻す
            </button>
          </div>

          {/* 設置方法 (かんたん順に3つ) */}
          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 方法1: 専用リンク — 貼り付け不要 */}
            <div style={{
              borderRadius: 24, padding: 'clamp(16px, 3vw, 26px)',
              border: `1.5px solid rgba(217,228,245,0.55)`,
              background: 'linear-gradient(160deg, rgba(217,228,245,0.16), rgba(255,255,255,0.04))',
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -11, left: 24, padding: '3px 12px', borderRadius: 999,
                background: P.gold, color: '#141414', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
              }}>
                いちばん簡単
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>方法1 — 専用リンクを貼るだけ (HTML不要)</div>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.8, color: P.fgMuted }}>
                あなた専用のコンシェルジュページが、もうできています。このリンクを
                Instagram のプロフィール・LINE のリッチメニュー・メールの署名・Google ビジネスプロフィールに貼るか、
                QR コードを店頭や名刺に置くだけ。サイトを触る必要はありません。
                iPhone ならリンクを開いて「共有 → ホーム画面に追加」— それだけでアプリとしてフルスクリーンで住み着きます。
              </p>
              <div style={{
                borderRadius: 12, border: `1px solid ${P.line}`, background: 'rgba(10,16,28,0.55)',
                padding: '10px 14px', fontSize: 11.5, lineHeight: 1.6, color: '#CFE0F5',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                wordBreak: 'break-all', maxHeight: 76, overflowY: 'auto',
              }}>
                {pageUrl}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => void copyPageLink()}
                  style={{
                    flex: '1 1 180px', minHeight: 48, borderRadius: 999, border: 'none',
                    background: copiedLink ? '#4E9E82' : '#F4F7FC', color: '#1B2333', fontSize: 14, fontWeight: 800,
                    letterSpacing: '0.04em', cursor: 'pointer', transition: 'background 0.2s',
                  }}
                >
                  {copiedLink ? 'コピーしました' : '専用リンクをコピー'}
                </button>
                <a
                  href={pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 48,
                    padding: '0 18px', borderRadius: 999, border: `1px solid ${P.line}`,
                    color: P.fg, textDecoration: 'none', fontSize: 13, fontWeight: 700,
                  }}
                >
                  開いてみる
                </a>
              </div>
              {qrOk ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
                  <img
                    src={qrUrl}
                    alt="専用ページの QR コード"
                    width={92}
                    height={92}
                    loading="lazy"
                    style={{ borderRadius: 10, background: '#FFFFFF', padding: 4, flexShrink: 0 }}
                  />
                  <div style={{ fontSize: 11.5, lineHeight: 1.8, color: P.fgSubtle }}>
                    QR コード — 店頭のポップ・名刺・チラシに。読み取るとこのコンシェルジュが開きます。
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11.5, lineHeight: 1.8, color: P.fgSubtle, marginTop: 12 }}>
                  ナレッジの文章が長いため QR コードは省略しました。リンクのコピーはそのまま使えます。
                </div>
              )}
            </div>

            {/* 方法2: タグ1行 */}
            <div style={{
              borderRadius: 24, padding: 'clamp(16px, 3vw, 26px)',
              border: `1px solid ${P.glassStrong}`,
              background: 'linear-gradient(160deg, rgba(217,228,245,0.12), rgba(255,255,255,0.03))',
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>方法2 — 自分のサイトに、タグ1行で埋め込み</div>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.8, color: P.fgMuted }}>
                サイトの HTML の <code style={{ color: P.silver }}>&lt;/body&gt;</code> の直前に貼ると、
                右下にコンシェルジュのバブルが現れます。上の設定を変えるたびに、このタグも自動で更新されます。
                WordPress・Wix・STUDIO・ペライチ・Shopify・BASE は、それぞれの「カスタムHTML / コード埋め込み」機能に貼れば動きます。
              </p>
              <div style={{
                borderRadius: 12, border: `1px solid ${P.line}`, background: 'rgba(10,16,28,0.55)',
                padding: '12px 14px', fontSize: 11.5, lineHeight: 1.6, color: '#CFE0D0',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                wordBreak: 'break-all', maxHeight: 140, overflowY: 'auto',
              }}>
                {embedCode}
              </div>
              <button
                onClick={() => void copyEmbed()}
                style={{
                  marginTop: 12, width: '100%', minHeight: 48, borderRadius: 999, border: 'none',
                  background: copied ? '#4E9E82' : '#F4F7FC', color: '#1B2333', fontSize: 14, fontWeight: 800,
                  letterSpacing: '0.04em', cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                {copied ? 'コピーしました' : 'タグをコピー'}
              </button>
            </div>

            {/* 方法3: 設置代行 — メール1通で丸投げ */}
            <div style={{
              borderRadius: 24, padding: 'clamp(16px, 3vw, 26px)', border: `1px solid ${P.line}`, background: P.glass,
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>方法3 — 丸ごとおまかせ (設置代行)</div>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.8, color: P.fgMuted }}>
                下のボタンを押すと、あなたの設定データ入りのメールが用意されます。
                サイトの URL を書いて送るだけで、こちらで設置まで行います (初期費用に含まれます)。
                メールが開かない場合は、上の専用リンクをコピーして core.guild.inc@gmail.com へ送ってください。
              </p>
              <a
                href={daikouMailto}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48,
                  borderRadius: 999, border: `1px solid ${P.line}`, background: 'transparent',
                  color: P.fg, textDecoration: 'none', fontSize: 13.5, fontWeight: 700, letterSpacing: '0.03em',
                }}
              >
                設置代行をメールで頼む
              </a>
            </div>

            <div style={{
              borderRadius: 24, padding: 'clamp(16px, 3vw, 26px)', border: `1px solid ${P.line}`, background: P.glass,
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>届いたご希望 (リード) の受け取り方</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 2, color: P.fgMuted }}>
                <li>お客様が「ご案内の日程を希望」を押す (または会話で連絡先を伝える)</li>
                <li>お名前・メール・会話の要約が CORE Prism に届く</li>
                <li>担当のあなたへメールで通知 — 折り返すだけで商談に</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <HairLine />

      {/* ── 04 PRICING ── */}
      {/* 章扉：引用（雑誌のリズム） */}
      <section style={{ padding: '5rem 1.25rem', textAlign: 'center', background: 'radial-gradient(80% 120% at 50% -20%, rgba(201,162,75,0.22), transparent 60%), linear-gradient(160deg, #0b1020, #101a30)' }}>
        <p style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#C9A24B', fontSize: '0.78rem', margin: 0 }}>Crystal</p>
        <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.3rem)', fontWeight: 700, lineHeight: 1.8, letterSpacing: '0.04em', color: '#fff', margin: '0.9rem auto 0.8rem', maxWidth: 680 }}>
          営業も、案内も、接客も。<br />この一枚の“ガラス”に、住まわせる。
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.92rem', lineHeight: 2.1, maxWidth: 560, margin: '0 auto' }}>
          上のデモは飾りではありません。いまあなたが話しかければ、そのまま答えます。<br />これがそのまま、あなたのお店の入口に立ちます。
        </p>
      </section>

      <section id="pricing" style={{ maxWidth: 1160, margin: '0 auto', padding: 'clamp(40px, 6vw, 80px) clamp(16px, 4vw, 44px)', scrollMarginTop: 16 }}>
        <SectionIndex no="04" label="Pricing" />
        <h2 style={{ margin: '0 0 30px', fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(24px, 3.6vw, 36px)', letterSpacing: '0.04em' }}>
          料金プラン
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {[
            {
              name: 'Standard',
              monthly: '¥29,800',
              setup: '¥98,000',
              desc: 'まず1サイトに導入して、夜間・休日の取りこぼしを無くしたい方へ。',
              stripeUrl: 'https://buy.stripe.com/6oUeVe3HteOT9nt6LfdIA0B',
              features: [
                '上の12機能すべて (ナレッジ学習・FAQ自動生成・AI SDR・多言語・先に話しかける接客)',
                '24時間の自動応対・会話まるごとメール通知',
                'ブランド設定 (色・人格・言葉づかい)',
                'メールサポート',
              ],
              highlight: false,
            },
            {
              name: 'Luxury',
              monthly: '¥49,800',
              setup: '¥298,000',
              desc: '応対品質そのものをブランド資産にしたい方へ。専任で言葉を磨き込みます。',
              stripeUrl: 'https://buy.stripe.com/3cI8wQcdZ9uz8jp1qVdIA0C',
              features: [
                'Standard の全て',
                '専任チューニング (応対文・FAQ・見極め条件の磨き込み)',
                '実写風アバター (準備中・優先案内)',
                '複数サイト・優先サポート',
              ],
              highlight: true,
            },
          ].map(plan => (
            <div key={plan.name} style={{
              flex: '1 1 300px', minWidth: 0, borderRadius: 26, padding: 'clamp(20px, 3vw, 30px)',
              border: plan.highlight ? `1.5px solid rgba(217,228,245,0.55)` : `1px solid ${P.line}`,
              background: plan.highlight
                ? 'linear-gradient(165deg, rgba(217,228,245,0.14), rgba(255,255,255,0.03))'
                : P.glass,
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              position: 'relative',
            }}>
              {plan.highlight && (
                <div style={{
                  position: 'absolute', top: -11, left: 24, padding: '3px 12px', borderRadius: 999,
                  background: P.gold, color: '#141414', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                }}>
                  おすすめ
                </div>
              )}
              <div style={{ fontFamily: SERIF, fontSize: 19, letterSpacing: '0.18em', color: plan.highlight ? P.silver : P.fg, marginBottom: 12, textTransform: 'uppercase' }}>
                {plan.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                <span style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4vw, 40px)', fontWeight: 400, letterSpacing: '0.01em' }}>{plan.monthly}</span>
                <span style={{ fontSize: 13, color: P.fgMuted }}>/月 (税込)</span>
              </div>
              <div style={{ fontSize: 12.5, color: P.fgMuted, marginBottom: 14 }}>初期費用 {plan.setup} (設定代行つき)</div>
              <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.8, color: P.fgMuted }}>{plan.desc}</p>
              <ul style={{ listStyle: 'none', margin: '0 0 20px', padding: 0 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={P.silver} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }}>
                      <path d="M2.5 7.5l3 3 6-7" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={plan.stripeUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 50,
                  borderRadius: 999, textDecoration: 'none', fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
                  background: '#F4F7FC', color: '#1B2333', border: 'none',
                }}
              >
                今すぐ導入する (カード決済)
              </a>
              <a
                href={mailtoCta(plan.name)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 46, marginTop: 10,
                  borderRadius: 999, textDecoration: 'none', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
                  background: 'transparent', color: P.fgMuted, border: `1px solid ${P.line}`,
                }}
              >
                先にメールで相談する
              </a>
            </div>
          ))}
        </div>
        <p style={{ margin: '20px 0 0', fontSize: 12, lineHeight: 1.8, color: P.fgSubtle }}>
          世界の相場 (公開情報): Intercom Fin は解決1件ごとに $0.99 の従量課金、Qualified の AI 営業担当は年間約 $68,000〜。
          Crystal は同じ中核機能を、月額定額・従量課金なしでご提供します。
          お支払い前に、上のコンシェルジュであなたのブランド設定をそのまま試せます。
          導入相談はメール1通から — 24時間以内にご返信します。
        </p>
      </section>

      {/* ── 04.5 導入までの流れ (高額初期費用の不安を手順の見える化でつぶす) ── */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: 'clamp(24px, 4vw, 48px) clamp(16px, 4vw, 44px)' }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 400, margin: '0 0 6px' }}>導入までの流れ</h2>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: P.fgMuted }}>むずかしい作業は、すべてこちらで巻き取ります。</p>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {[
            { n: '1', t: 'お申し込み', d: 'カード決済で今すぐ、または先にメールでご相談。ご質問には24時間以内にお返事します。' },
            { n: '2', t: '初期設定はおまかせ', d: 'ヒアリングのうえ、ナレッジ登録・人格・色までこちらで設定代行（初期費用に含まれます）。' },
            { n: '3', t: '1行で公開', d: 'タグを1行貼るか、専用リンクを置くだけ。あなたのサイトでコンシェルジュが働き始めます。' },
          ].map(s => (
            <div key={s.n} style={{ border: `1px solid ${P.lineSoft}`, background: P.glass, borderRadius: 18, padding: '18px 18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: P.bg0, background: P.gold }}>{s.n}</span>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>{s.t}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: P.fgMuted }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 05 共創 (このアプリを一緒に良くする) ── */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: 'clamp(32px, 5vw, 60px) clamp(16px, 4vw, 44px)' }}>
        <CrystalCoCreateCard tokens={P} />
      </section>

      {/* ── フッタ ── */}
      <footer style={{ borderTop: `1px solid ${P.lineSoft}`, padding: '24px clamp(16px, 4vw, 44px)', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: P.fgSubtle, letterSpacing: '0.08em' }}>
          Crystal — CORE ·{' '}
          <a href="/" style={{ color: P.fgMuted, textDecoration: 'none' }}>CORE Prism を見る</a>
        </div>
      </footer>
    </div>
  );
}

/** 専用ページモード (?page=1) — 貼り付け不要の「リンクだけ設置」。お客様に見せる全画面のみ */
function isCrystalPageMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('page') === '1';
}

function HostedPage() {
  const config = useMemo(() => readConciergeConfigFromUrl(), []);
  return <ConciergeStage config={config} standalone />;
}

import LpStickyCta from '../../components/LpStickyCta';

export default function ConciergePage() {
  if (isConciergeEmbed()) return <EmbedMode />;
  if (isCrystalPageMode()) return <HostedPage />;
  return (
    <>
      <Showcase />
      <LpStickyCta title="AIコンシェルジュを、あなたのお店に" sub="設置3分・初期費用同梱プランあり" cta="料金を見る →" href="#pricing" accent1="#e9cd8a" accent2="#c9a24b" />
    </>
  );
}
