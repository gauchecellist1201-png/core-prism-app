// ============================================================
// ConciergePage — /concierge ショーケース
//
// 上半分: 高級不動産サイト風のデモ背景 (CSS のみ・実写不使用) に
//         ウィジェットが浮かぶライブデモ (実際に AI と話せる)
// 下半分: 「あなたのサイトに1行で設置」— 設定フォーム → その場プレビュー →
//         埋め込みタグ生成 + コピー → 価格 2 プラン + 導入相談 CTA
//
// ?embed=1 のときは全画面透過でフローティングバブルのみ描画し、
// 開閉を parent へ postMessage (public/prism-concierge.js が受けて iframe を伸縮)
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import ConciergeWidget from './ConciergeWidget';
import {
  type ConciergeConfig,
  DEFAULT_CONCIERGE_CONFIG,
  encodeConciergeConfig,
  readConciergeConfigFromUrl,
  isConciergeEmbed,
} from './conciergeConfig';

const SERIF = `'Bodoni 72', 'Didot', 'Hiragino Mincho ProN', 'Yu Mincho', Georgia, serif`;
const SANS = `-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;

// ページ専用トークン (App の theme に依存しない自己完結ページ)
const P = {
  bg: '#06070D',
  fg: '#F2EFE6',
  fgMuted: 'rgba(242,239,230,0.68)',
  fgSubtle: 'rgba(242,239,230,0.45)',
  gold: '#C9A96E',
  goldSoft: 'rgba(201,169,110,0.35)',
  surface: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.12)',
};

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E")`;

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

  return <ConciergeWidget config={config} variant="floating" onOpenChange={onOpenChange} />;
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
  borderRadius: 12, border: `1px solid ${P.border}`, outline: 'none',
  background: 'rgba(255,255,255,0.05)', color: P.fg, fontSize: 16, fontFamily: SANS,
};

function GoldLine() {
  return <div aria-hidden style={{ height: 1, background: `linear-gradient(90deg, transparent, ${P.goldSoft}, transparent)` }} />;
}

// ─── ショーケース本体 ────────────────────────────
function Showcase() {
  const [config, setConfig] = useState<ConciergeConfig>(() => readConciergeConfigFromUrl());
  const [servicesText, setServicesText] = useState(() => config.services.join('\n'));
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof ConciergeConfig>(key: K, value: ConciergeConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://core-prism-app.vercel.app';
  const encoded = useMemo(() => encodeConciergeConfig(config), [config]);
  const embedCode = `<script src="${origin}/prism-concierge.js" data-config="${encoded}" async></script>`;

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

  const mailtoCta = (plan: string) =>
    `mailto:core.guild.inc@gmail.com?subject=${encodeURIComponent(`【コンシェルジュ導入相談】${plan}`)}&body=${encodeURIComponent(
      `ブランド名: ${config.brandName}\n業種: ${config.industry}\nご希望プラン: ${plan}\nサイトURL: \nご相談内容: `,
    )}`;

  return (
    <div style={{ minHeight: '100svh', background: P.bg, color: P.fg, fontFamily: SANS }}>
      {/* ── 上部バー ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px clamp(16px, 4vw, 40px)', borderBottom: `1px solid ${P.border}`,
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(6,7,13,0.8)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      }}>
        <a href="/" style={{ textDecoration: 'none', color: P.fg, fontWeight: 800, fontSize: 14, letterSpacing: '0.12em' }}>
          CORE PRISM
        </a>
        <a
          href={mailtoCta('未定 (まず相談)')}
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '8px 18px',
            borderRadius: 999, border: `1px solid ${P.gold}`, color: P.gold,
            textDecoration: 'none', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
          }}
        >
          導入相談
        </a>
      </header>

      {/* ── ヒーロー: 高級不動産サイト風デモ + ライブウィジェット ── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        background: `radial-gradient(140% 90% at 70% -10%, #131A33 0%, #0A0E1E 45%, #06070D 100%)`,
        padding: 'clamp(28px, 6vw, 72px) clamp(16px, 4vw, 40px) clamp(40px, 6vw, 80px)',
      }}>
        {/* 微細ノイズ + 金の細線 */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: NOISE, pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: 1, background: `linear-gradient(90deg, transparent, ${P.goldSoft}, transparent)` }} />
        <div aria-hidden style={{ position: 'absolute', top: 90, left: 0, width: 1, height: '55%', background: `linear-gradient(180deg, transparent, ${P.goldSoft}, transparent)`, marginLeft: 'clamp(16px, 6vw, 64px)' }} />

        <div style={{
          position: 'relative', maxWidth: 1080, margin: '0 auto',
          display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px, 4vw, 56px)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {/* 左: デモサイトの顔 (CSS だけの高級不動産風) */}
          <div style={{ flex: '1 1 320px', minWidth: 0, maxWidth: 560 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999,
              border: `1px solid ${P.border}`, background: P.surface, marginBottom: 18,
              fontSize: 11, letterSpacing: '0.1em', color: P.fgMuted,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: P.gold, boxShadow: `0 0 8px ${P.gold}` }} />
              ライブデモ — 実際に話しかけられます
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(13px, 1.6vw, 15px)', letterSpacing: '0.35em', color: P.gold, marginBottom: 10 }}>
              {config.brandName}
            </div>
            <h1 style={{
              margin: '0 0 16px', fontFamily: SERIF, fontWeight: 500,
              fontSize: 'clamp(30px, 5.6vw, 52px)', lineHeight: 1.25, letterSpacing: '0.04em', color: '#FFFFFF',
            }}>
              24時間、ブランドを
              <br />
              体現するコンシェルジュ
            </h1>
            <p style={{ margin: '0 0 22px', fontSize: 'clamp(14px, 1.8vw, 16px)', lineHeight: 1.9, color: P.fgMuted, maxWidth: 460 }}>
              高級不動産・ラグジュアリーブランド・高単価コンサルのサイトに、
              深夜でも同じ品格でお客様を迎える AI コンシェルジュを。
              ご相談の日程とご連絡先まで、そっとお預かりします。
            </p>
            {/* 物件カード風スケルトン (実写不使用の "高級サイトの気配") */}
            <div aria-hidden style={{ display: 'flex', gap: 12, maxWidth: 460 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  flex: 1, minWidth: 0, borderRadius: 14, overflow: 'hidden',
                  border: `1px solid ${P.border}`, background: 'rgba(255,255,255,0.03)',
                }}>
                  <div style={{ height: 54, background: `linear-gradient(135deg, rgba(201,169,110,${0.16 + i * 0.05}), rgba(20,26,50,0.6))` }} />
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ height: 6, width: '70%', borderRadius: 3, background: 'rgba(255,255,255,0.16)', marginBottom: 6 }} />
                    <div style={{ height: 6, width: '45%', borderRadius: 3, background: `rgba(201,169,110,0.4)` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右: 生きているウィジェット */}
          <div style={{ flex: '0 1 400px', width: 'min(400px, 100%)', height: 'min(600px, 76svh)', minHeight: 480 }}>
            <ConciergeWidget config={config} variant="inline" />
          </div>
        </div>
      </section>

      <GoldLine />

      {/* ── 設置セクション ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(36px, 6vw, 72px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ fontFamily: SERIF, fontSize: 12, letterSpacing: '0.3em', color: P.gold, marginBottom: 10 }}>SETUP</div>
        <h2 style={{ margin: '0 0 10px', fontSize: 'clamp(22px, 3.4vw, 32px)', fontWeight: 700, letterSpacing: '0.02em' }}>
          あなたのサイトに、1行で設置
        </h2>
        <p style={{ margin: '0 0 28px', fontSize: 14, lineHeight: 1.9, color: P.fgMuted, maxWidth: 620 }}>
          下のフォームでブランドに合わせて調整すると、上のデモがその場で変わります。
          仕上がったら、生成されたタグをサイトの HTML に貼るだけ。プログラミングの知識は要りません。
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          {/* 設定フォーム */}
          <div style={{
            flex: '1 1 320px', minWidth: 0, borderRadius: 20, padding: 'clamp(16px, 3vw, 24px)',
            border: `1px solid ${P.border}`, background: P.surface,
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
            <Field label="ご案内できること (1行に1つ)" hint="チャットの最初に「ご用件ボタン」として表示されます">
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 96, lineHeight: 1.6 }}
                value={servicesText}
                onChange={e => {
                  setServicesText(e.target.value);
                  set('services', e.target.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8));
                }}
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
                      border: config.accentColor === p.hex ? '2px solid #FFFFFF' : `1px solid ${P.border}`,
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={config.accentColor}
                  onChange={e => set('accentColor', e.target.value)}
                  aria-label="アクセント色を自由に選ぶ"
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${P.border}`, background: 'transparent', padding: 4, cursor: 'pointer' }}
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
                  <div key={i} style={{ border: `1px solid ${P.border}`, borderRadius: 12, padding: 10 }}>
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
                      style={{ marginTop: 6, minHeight: 40, padding: '8px 12px', borderRadius: 10, border: `1px solid ${P.border}`, background: 'transparent', color: P.fgMuted, fontSize: 12, cursor: 'pointer' }}
                    >
                      この質問を削除
                    </button>
                  </div>
                ))}
                {config.faq.length < 12 && (
                  <button
                    onClick={() => set('faq', [...config.faq, { q: '', a: '' }])}
                    style={{ minHeight: 44, borderRadius: 12, border: `1px dashed ${P.goldSoft}`, background: 'transparent', color: P.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
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
              style={{ minHeight: 40, padding: '8px 14px', borderRadius: 10, border: `1px solid ${P.border}`, background: 'transparent', color: P.fgSubtle, fontSize: 12, cursor: 'pointer' }}
            >
              はじめの設定に戻す
            </button>
          </div>

          {/* 埋め込みタグ */}
          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ borderRadius: 20, padding: 'clamp(16px, 3vw, 24px)', border: `1px solid ${P.goldSoft}`, background: 'linear-gradient(160deg, rgba(201,169,110,0.08), rgba(255,255,255,0.02))' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>設置タグ (この1行だけ)</div>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.8, color: P.fgMuted }}>
                サイトの HTML の <code style={{ color: P.gold }}>&lt;/body&gt;</code> の直前に貼ると、
                右下にコンシェルジュのバブルが現れます。上の設定を変えるたびに、このタグも自動で更新されます。
              </p>
              <div style={{
                borderRadius: 12, border: `1px solid ${P.border}`, background: 'rgba(0,0,0,0.45)',
                padding: '12px 14px', fontSize: 11.5, lineHeight: 1.6, color: '#D9E2C8',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                wordBreak: 'break-all', maxHeight: 140, overflowY: 'auto',
              }}>
                {embedCode}
              </div>
              <button
                onClick={() => void copyEmbed()}
                style={{
                  marginTop: 12, width: '100%', minHeight: 48, borderRadius: 13, border: 'none',
                  background: copied ? '#4E9E82' : P.gold, color: '#141414', fontSize: 14, fontWeight: 800,
                  letterSpacing: '0.04em', cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                {copied ? 'コピーしました' : 'タグをコピー'}
              </button>
            </div>

            <div style={{ borderRadius: 20, padding: 'clamp(16px, 3vw, 24px)', border: `1px solid ${P.border}`, background: P.surface }}>
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

      <GoldLine />

      {/* ── 価格 ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(36px, 6vw, 72px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ fontFamily: SERIF, fontSize: 12, letterSpacing: '0.3em', color: P.gold, marginBottom: 10 }}>PRICING</div>
        <h2 style={{ margin: '0 0 28px', fontSize: 'clamp(22px, 3.4vw, 32px)', fontWeight: 700 }}>料金プラン</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {[
            {
              name: 'Standard',
              monthly: '¥29,800',
              setup: '¥98,000',
              desc: 'まず1サイトに導入して、夜間・休日の取りこぼしを無くしたい方へ。',
              features: ['ブランド設定 (色・言葉づかい・FAQ)', '24時間の自動応対', 'ご希望 (リード) のメール通知', 'メールサポート'],
              highlight: false,
            },
            {
              name: 'Luxury',
              monthly: '¥49,800',
              setup: '¥298,000',
              desc: '応対品質そのものをブランド資産にしたい方へ。専任で言葉を磨き込みます。',
              features: ['Standard の全て', '専任チューニング (応対文の磨き込み)', '実写風アバター (準備中・優先案内)', '複数サイト・優先サポート'],
              highlight: true,
            },
          ].map(plan => (
            <div key={plan.name} style={{
              flex: '1 1 300px', minWidth: 0, borderRadius: 22, padding: 'clamp(20px, 3vw, 28px)',
              border: plan.highlight ? `1.5px solid ${P.gold}` : `1px solid ${P.border}`,
              background: plan.highlight
                ? 'linear-gradient(165deg, rgba(201,169,110,0.12), rgba(255,255,255,0.02))'
                : P.surface,
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
              <div style={{ fontFamily: SERIF, fontSize: 18, letterSpacing: '0.14em', color: plan.highlight ? P.gold : P.fg, marginBottom: 12 }}>
                {plan.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, letterSpacing: '0.01em' }}>{plan.monthly}</span>
                <span style={{ fontSize: 13, color: P.fgMuted }}>/月 (税込)</span>
              </div>
              <div style={{ fontSize: 12.5, color: P.fgMuted, marginBottom: 14 }}>初期費用 {plan.setup} (設定代行つき)</div>
              <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.8, color: P.fgMuted }}>{plan.desc}</p>
              <ul style={{ listStyle: 'none', margin: '0 0 20px', padding: 0 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={P.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }}>
                      <path d="M2.5 7.5l3 3 6-7" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={mailtoCta(plan.name)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 50,
                  borderRadius: 14, textDecoration: 'none', fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
                  background: plan.highlight ? P.gold : 'transparent',
                  color: plan.highlight ? '#141414' : P.fg,
                  border: plan.highlight ? 'none' : `1px solid ${P.border}`,
                }}
              >
                導入を相談する
              </a>
            </div>
          ))}
        </div>
        <p style={{ margin: '20px 0 0', fontSize: 12, lineHeight: 1.8, color: P.fgSubtle }}>
          お支払い前に、上のライブデモであなたのブランド設定をそのまま試せます。
          導入相談はメール1通から — 24時間以内にご返信します。
        </p>
      </section>

      {/* ── フッタ ── */}
      <footer style={{ borderTop: `1px solid ${P.border}`, padding: '24px clamp(16px, 4vw, 40px)', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: P.fgSubtle, letterSpacing: '0.08em' }}>
          CORE Prism Concierge — 株式会社CORE ·{' '}
          <a href="/" style={{ color: P.fgMuted, textDecoration: 'none' }}>CORE Prism を見る</a>
        </div>
      </footer>
    </div>
  );
}

export default function ConciergePage() {
  if (isConciergeEmbed()) return <EmbedMode />;
  return <Showcase />;
}
