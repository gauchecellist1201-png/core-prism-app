// ============================================================
// /pricing — 公開価格ページ + ROI 計算機 + 業種別ユースケース
// 検討フェーズの背中を押すために設計
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PrismLogo, IrisLogo } from '../components/Logo';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';
const FONT_SERIF_EN = '"EB Garamond", "Noto Serif JP", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", sans-serif';

// ─── Prism プラン ─────────────────
const PRISM_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    nameJa: 'スターター',
    tag: '個人事業主・副業',
    price: 4800,
    yearly: 48000, // 2 ヶ月分割引
    features: [
      '3 つの人格 (経営/営業/+1)',
      '商談・議事録・スライド AI',
      'Cmd+K 横断検索',
      'PWA / オフライン対応',
      '14 日間 無料トライアル',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    nameJa: 'スタンダード',
    tag: 'フリーランス・小規模法人',
    price: 9800,
    yearly: 98000,
    highlight: true,
    features: [
      '7 つの人格 (全エージェント)',
      '提案書・契約書・財務 AI',
      'Gmail シャドー秘書',
      'YouTube 取込 → ナレッジ',
      '見積→請求の一気通貫',
      '14 日間 無料トライアル',
    ],
  },
  {
    id: 'exclusive',
    name: 'Exclusive',
    nameJa: 'エクスクルーシブ',
    tag: '経営者・チーム',
    price: 29800,
    yearly: 298000,
    features: [
      'Standard 全機能',
      '人物ケア (1on1 + センチメント)',
      'API アクセス + Webhook',
      'チーム共有 (5名まで)',
      '優先サポート + 戦略コーチ',
      '専任カスタマー成功担当',
    ],
  },
];

// ─── Iris プラン ─────────────────
const IRIS_PLANS = [
  { id: 'lite', name: 'Lite', tag: '創作のはじめに', price: 2800, features: ['AI キャプション 30回/月', '案件管理 3件まで', '基本フィルター', 'コミュニティ閲覧'] },
  { id: 'standard', name: 'Standard', tag: '伸びる時期に', price: 6800, highlight: true, features: ['AI キャプション 無制限', 'IG 分析 月10回', 'ストーリー設計 5本', 'コミュニティ投稿'] },
  { id: 'pro', name: 'Pro', tag: '事業として', price: 9800, features: ['Standard 全機能', 'チーム 5名', 'ブランドマッチ無制限', 'メディアキット'] },
  { id: 'studio', name: 'Studio', tag: 'プロチーム/法人', price: 29800, features: ['Pro 全機能', 'API + Webhook', 'ホワイトラベル', '無制限チーム', '専任コンサル'] },
];

// ─── 業種別ユースケース ─────────────────
const USECASES = [
  {
    industry: '経営者 / CEO',
    icon: '🧭',
    color: '#a78bfa',
    pain: 'やることが多すぎて、戦略に時間が割けない',
    solution: 'Prism の経営エージェントが KPI 自動モニタリング + 議事録 → 意思決定メモ',
    saved: '週 8 時間',
    yearly: 416,
  },
  {
    industry: '営業 / セールス',
    icon: '💼',
    color: '#ff9842',
    pain: 'リード探し・スクリプト作成・提案書で半日が消える',
    solution: 'Prism の営業エージェントがリード探索→提案書ドラフトまで自動',
    saved: '週 12 時間',
    yearly: 624,
  },
  {
    industry: '財務 / 経理',
    icon: '📊',
    color: '#fbbf24',
    pain: '経費精算・P&L 作成・予算配分の事務作業に追われる',
    solution: 'Prism の財務エージェントが経費 OCR + P&L 自動 + 予算予測',
    saved: '週 6 時間',
    yearly: 312,
  },
  {
    industry: 'インフルエンサー',
    icon: '🌸',
    color: '#E1306C',
    pain: '案件管理・キャプション作成・分析に追われ、創作時間が減る',
    solution: 'Iris が案件交渉・キャプション・IG 分析・コミュニティ運営まで',
    saved: '週 10 時間',
    yearly: 520,
  },
  // ── 典型 3 ペルソナ (個人事業主 / 副業ワーカー / 小規模法人) ──
  {
    industry: '個人事業主 (カフェ・サロン・教室)',
    icon: '☕',
    color: '#fb923c',
    pain: '一人で全部こなす毎日 ── 接客しながら経理も SNS も追えない',
    solution: 'Prism のスターターで売上記録 + SNS 投稿 + 顧客カードを 1 つに',
    saved: '週 6 時間',
    yearly: 312,
  },
  {
    industry: '副業ワーカー (会社員 + 副業)',
    icon: '🌙',
    color: '#60a5fa',
    pain: '本業の隙間でしか動けず、副業は提案書 1 本書くだけで終わる',
    solution: 'Prism が夜 30 分で提案書・請求書・進捗まとめを片付け、休みは創造に',
    saved: '週 5 時間',
    yearly: 260,
  },
  {
    industry: '小規模法人代表 (1〜10 名)',
    icon: '🏛',
    color: '#a78bfa',
    pain: '採用するほどではない雑務に毎日追われ、戦略を考える時間がない',
    solution: 'Prism スタンダードで議事録 + 契約書 + 商談ロープレ + 財務を一気に',
    saved: '週 14 時間',
    yearly: 728,
  },
];

// ─── FAQ ─────────────────
const FAQS = [
  { q: '解約はいつでもできますか?', a: 'はい。マイページから 1 タップで解約できます。日割り計算で当月分のみ請求されます。' },
  { q: '14 日間のトライアル中に料金は発生しますか?', a: '発生しません。トライアル期間中はクレジットカード登録も不要です。' },
  { q: 'AI の API キーは自分で用意する必要がありますか?', a: '不要です。すべてのプランで Claude / Gemini / 画像生成 AI を内蔵しています。' },
  { q: 'プランを途中でアップグレード・ダウングレードできますか?', a: 'いつでも変更できます。差額は次回請求で日割り計算されます。' },
  { q: '法人契約・カスタム導入は可能ですか?', a: 'はい。10 名以上のチームには専用プランを用意しています。お問い合わせください。' },
  { q: 'データは他社に渡されますか?', a: '渡しません。あなたのデータは localStorage と暗号化された専用領域にのみ保存されます。' },
  { q: '日本語以外の言語に対応していますか?', a: '今後対応予定です (日英中 順次)。AI への質問はすべての主要言語で可能です。' },
];

const fmt = (n: number) => '¥' + n.toLocaleString('ja-JP');

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const [hours, setHours] = useState(20); // 1週間あたりの自動化したい時間
  const [hourly, setHourly] = useState(5000); // 時給 (円)

  useEffect(() => {
    document.title = '価格 — CORE Prism / Iris';
  }, []);

  const monthlySaved = useMemo(() => hours * 4 * hourly, [hours, hourly]);
  const yearlySaved = monthlySaved * 12;
  const breakeven = useMemo(() => Math.ceil(9800 / (hours * hourly)), [hours, hourly]); // Standard を回収するまでの週数

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100dvh', fontFamily: FONT_SANS, overflowX: 'hidden' }}>
      {/* ヘッダ */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="lp-safe" style={{ maxWidth: 1320, margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/corp" style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.4em', color: '#fff', textDecoration: 'none' }}>CORE</a>
          <nav style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <a href="/" style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }} className="lp-nav-link">Prism</a>
            <a href="/iris" style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }} className="lp-nav-link">Iris</a>
            <a href="/corp" style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }} className="lp-nav-link">会社概要</a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-section-pad" style={{ padding: '5rem 1.5rem 3rem', textAlign: 'center', background: 'linear-gradient(180deg,#000 0%,#070712 100%)' }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.45em', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '1.25rem' }}>PRICING</p>
        <h1 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, lineHeight: 1.4, letterSpacing: '0.04em', marginBottom: '1.25rem' }}>
          人を雇うより、<span style={{ background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>圧倒的に安い。</span>
        </h1>
        <p style={{ fontFamily: FONT_SERIF_EN, fontSize: '0.9rem', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', letterSpacing: '0.15em', marginBottom: '1.25rem' }}>
          Cheaper than hiring. Smarter than alone.
        </p>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', color: 'rgba(255,255,255,0.7)', lineHeight: 2, maxWidth: 700, margin: '0 auto 2rem' }}>
          月額 ¥4,800 から、7 つの専属 AI エージェントが 24 時間あなたの代わりに動きます。
          <br />試算してみてください ── 元が取れるのは、たいてい 1 週間以内です。
        </p>

        {/* 月払い / 年払い切替 */}
        <div style={{ display: 'inline-flex', gap: 0, padding: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999 }}>
          <button onClick={() => setYearly(false)} style={{ padding: '0.55rem 1.25rem', borderRadius: 999, background: !yearly ? 'linear-gradient(135deg,#a78bfa,#f472b6)' : 'transparent', border: 'none', color: '#fff', fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>月払い</button>
          <button onClick={() => setYearly(true)} style={{ padding: '0.55rem 1.25rem', borderRadius: 999, background: yearly ? 'linear-gradient(135deg,#a78bfa,#f472b6)' : 'transparent', border: 'none', color: '#fff', fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>年払い <span style={{ background: '#fbbf24', color: '#000', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', marginLeft: 4 }}>-17%</span></button>
        </div>
      </section>

      {/* PRISM プラン */}
      <section className="lp-section-pad" style={{ padding: '3rem 1.5rem 4rem', background: '#070712' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '2.5rem' }}>
            <PrismLogo size={36} withWordmark={false} />
            <div>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.4em', color: '#a78bfa', fontWeight: 700, textAlign: 'center' }}>CORE PRISM</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.1rem', fontWeight: 700, marginTop: 4 }}>事業家・経営者向け</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {PRISM_PLANS.map(p => <PlanCard key={p.id} plan={p} yearly={yearly} brand="prism" />)}
          </div>
        </div>
      </section>

      {/* IRIS プラン */}
      <section className="lp-section-pad" style={{ padding: '3rem 1.5rem 4rem', background: '#070712' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '2.5rem' }}>
            <IrisLogo size={36} withWordmark={false} />
            <div>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.4em', color: '#E1306C', fontWeight: 700, textAlign: 'center' }}>CORE IRIS</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.1rem', fontWeight: 700, marginTop: 4 }}>クリエイター・インフルエンサー向け</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {IRIS_PLANS.map(p => <PlanCard key={p.id} plan={p} yearly={yearly} brand="iris" />)}
          </div>
        </div>
      </section>

      {/* ROI 計算機 */}
      <section className="lp-section-pad" style={{ padding: '5rem 1.5rem', background: 'linear-gradient(180deg,#070712 0%,#000 100%)' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>ROI CALCULATOR</p>
            <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.85rem, 3.5vw, 2.5rem)', fontWeight: 700, marginTop: 8, letterSpacing: '0.05em' }}>あなたの ROI を計算</h2>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginTop: 12, lineHeight: 1.9 }}>
              Standard プラン (¥9,800/月) で何日で元が取れるか、すぐ分かります。
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="lp-roi-grid">
              <SliderInput label="週に AI に任せたい時間" value={hours} setValue={setHours} min={1} max={60} unit="時間/週" />
              <SliderInput label="あなたの時間単価" value={hourly} setValue={setHourly} min={1000} max={20000} step={500} unit="円/時間" />
            </div>

            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', textAlign: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>月の節約価値</p>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, marginTop: 8, color: '#fbbf24' }}>{fmt(monthlySaved)}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>年間の節約価値</p>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, marginTop: 8, color: '#a78bfa' }}>{fmt(yearlySaved)}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>元が取れるまで</p>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, marginTop: 8, color: '#86efac' }}>{breakeven} <span style={{ fontSize: '0.9rem' }}>時間</span></p>
                </div>
              </div>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: '1rem', lineHeight: 1.8 }}>
                Standard プラン (¥9,800) は<strong style={{ color: '#fff' }}>約 {breakeven} 時間の節約で元が取れます</strong>。
                {breakeven < hours && <> ──設定どおりの利用なら<strong style={{ color: '#86efac' }}>初週で回収</strong>です。</>}
              </p>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <a href="/" style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg,#a78bfa,#f472b6)',
                color: '#fff',
                padding: '1rem 2.5rem',
                borderRadius: 12,
                fontFamily: FONT_SERIF_JA,
                fontSize: '1rem',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 12px 32px rgba(167,139,250,0.45)',
                letterSpacing: '0.1em',
              }}>
                14 日間 無料で試す →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 業種別ユースケース */}
      <section className="lp-section-pad" style={{ padding: '5rem 1.5rem', background: '#000' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>USE CASES</p>
            <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.85rem, 3.5vw, 2.5rem)', fontWeight: 700, marginTop: 8, letterSpacing: '0.05em' }}>役割別の使い方</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {USECASES.map((u, i) => (
              <div key={i} style={{ position: 'relative', padding: '1.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                <div aria-hidden style={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: u.color, opacity: 0.18, filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${u.color}, ${u.color}aa)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>{u.icon}</div>
                    <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700 }}>{u.industry}</p>
                  </div>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>悩み</p>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.85, marginBottom: '1rem' }}>{u.pain}</p>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: u.color, marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>解決</p>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.85, marginBottom: '1.25rem', fontWeight: 500 }}>{u.solution}</p>
                  <div style={{ padding: '0.75rem 1rem', background: `${u.color}15`, border: `1px solid ${u.color}40`, borderRadius: 10 }}>
                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.1em' }}>節約時間</p>
                    <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 800, color: u.color, marginTop: 2 }}>{u.saved} <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>(年間 {u.yearly} 時間)</span></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 課金してよかったと思える理由 — 競合比較 + ROI */}
      <section className="lp-section-pad" style={{ padding: '5rem 1.5rem', background: 'linear-gradient(180deg, #000 0%, #0a0420 100%)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.4em', color: '#fbbf24', fontWeight: 700 }}>WHY ¥9,800</p>
            <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.85rem, 3.5vw, 2.5rem)', fontWeight: 700, marginTop: 8, letterSpacing: '0.05em' }}>
              月 1 万円で<span style={{ background: 'linear-gradient(90deg,#fbbf24,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>元が取れる根拠</span>
            </h2>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginTop: 12, lineHeight: 1.85 }}>
              ChatGPT も Notion も Linear も Hootsuite も、それぞれが部分を解いています。<br />
              CORE はそれら全部を 1 つにして、AI が連動して「実行」まで進めます。
            </p>
          </div>

          {/* Prism vs 個別ツール */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div style={{
              padding: '2rem 1.75rem',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.10) 0%, rgba(96,165,250,0.06) 100%)',
              border: '1px solid rgba(167,139,250,0.30)',
              borderRadius: 18,
            }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.3em', color: '#a78bfa', fontWeight: 700, marginBottom: 10 }}>CORE Prism</p>
              <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.4rem', fontWeight: 800, marginBottom: 18, lineHeight: 1.45 }}>
                雑務に消える週 12 時間を、AI が引き受けます
              </h3>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', marginBottom: 16 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.7)' }}>ChatGPT Plus</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>$20</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>万能 AI のみ</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.7)' }}>Notion AI</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>$10</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>文章のみ</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.7)' }}>Linear</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>$10</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>タスク管理のみ</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.7)' }}>freee 会計</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>¥1,980</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>会計のみ</td>
                  </tr>
                  <tr style={{ background: 'rgba(167,139,250,0.10)' }}>
                    <td style={{ padding: '12px 0 12px 8px', color: '#fff', fontWeight: 800 }}>合計 (4 ツール)</td>
                    <td style={{ padding: '12px 0', textAlign: 'right', color: '#fff', fontWeight: 800 }}>≒ ¥7,920</td>
                    <td style={{ padding: '12px 8px 12px 0', textAlign: 'right', color: '#a78bfa', fontSize: '0.75rem', fontWeight: 700 }}>各々バラバラ</td>
                  </tr>
                  <tr style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.18), rgba(244,114,182,0.12))' }}>
                    <td style={{ padding: '14px 0 14px 8px', color: '#fff', fontWeight: 900, fontSize: '0.95rem' }}>✨ CORE Prism Standard</td>
                    <td style={{ padding: '14px 0', textAlign: 'right', color: '#fff', fontWeight: 900, fontSize: '0.95rem' }}>¥9,800</td>
                    <td style={{ padding: '14px 8px 14px 0', textAlign: 'right', color: '#f472b6', fontSize: '0.78rem', fontWeight: 800 }}>7 つの AI が連動 / 24h 自律実行</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.85 }}>
                ほぼ同じ価格で、AI が <strong style={{ color: '#fff' }}>営業・議事録・提案・財務・案件管理</strong> を連動して動かします。
                <br />
                <strong style={{ color: '#a78bfa' }}>週 12 時間 × 時給 ¥5,000 = ¥240,000</strong> 相当の時間コストを<strong style={{ color: '#f472b6' }}> ¥9,800 に</strong>。
              </p>
            </div>

            <div style={{
              padding: '2rem 1.75rem',
              background: 'linear-gradient(135deg, rgba(225,48,108,0.10) 0%, rgba(252,176,69,0.06) 100%)',
              border: '1px solid rgba(225,48,108,0.30)',
              borderRadius: 18,
            }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.3em', color: '#E1306C', fontWeight: 700, marginBottom: 10 }}>CORE Iris</p>
              <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.4rem', fontWeight: 800, marginBottom: 18, lineHeight: 1.45 }}>
                PR 案件 1 件取れれば、もう元が取れます
              </h3>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', marginBottom: 16 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.7)' }}>Hootsuite</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>$99</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>予約・分析のみ</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.7)' }}>Later</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>$25</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>予約のみ</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.7)' }}>Canva Pro</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>$13</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>画像のみ</td>
                  </tr>
                  <tr style={{ background: 'rgba(225,48,108,0.10)' }}>
                    <td style={{ padding: '12px 0 12px 8px', color: '#fff', fontWeight: 800 }}>合計 (3 ツール)</td>
                    <td style={{ padding: '12px 0', textAlign: 'right', color: '#fff', fontWeight: 800 }}>≒ ¥20,500</td>
                    <td style={{ padding: '12px 8px 12px 0', textAlign: 'right', color: '#FCB045', fontSize: '0.75rem', fontWeight: 700 }}>案件は別途</td>
                  </tr>
                  <tr style={{ background: 'linear-gradient(90deg, rgba(225,48,108,0.18), rgba(252,176,69,0.12))' }}>
                    <td style={{ padding: '14px 0 14px 8px', color: '#fff', fontWeight: 900, fontSize: '0.95rem' }}>✨ CORE Iris Pro</td>
                    <td style={{ padding: '14px 0', textAlign: 'right', color: '#fff', fontWeight: 900, fontSize: '0.95rem' }}>¥9,800</td>
                    <td style={{ padding: '14px 8px 14px 0', textAlign: 'right', color: '#FCB045', fontSize: '0.78rem', fontWeight: 800 }}>案件マッチ + AI 交渉文</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.85 }}>
                Hootsuite は数字を見せます。Later は予約します。Canva は画像を作ります。
                <br />
                <strong style={{ color: '#fff' }}>Iris は、それを 1 つにして、AI があなたのフォロワー実データから「次の打ち手」と「マッチする案件」を出します</strong>。
                <br />
                平均 PR 案件報酬 <strong style={{ color: '#E1306C' }}>¥30,000〜100,000</strong>。<strong style={{ color: '#FCB045' }}>月 1 件取れれば 3〜10 ヶ月分の元が取れます</strong>。
              </p>
            </div>
          </div>

          {/* CORE が他社にできないこと */}
          <div style={{
            padding: '2rem 1.75rem',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 18,
            textAlign: 'center',
          }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 14 }}>
              CORE ONLY
            </p>
            <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.2rem, 2.4vw, 1.6rem)', fontWeight: 800, marginBottom: 22, lineHeight: 1.55 }}>
              CORE が、他社のどのツールにもできないこと
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { icon: '🌈', title: '人格別 AI OS', desc: 'ChatGPT は文脈を混ぜる。Prism は人格別に AI を分離' },
                { icon: '🌙', title: '24h 自律実行', desc: '夜中に AI がリサーチ → 朝レポート。対話だけで終わらない' },
                { icon: '🎯', title: '案件マッチ + 交渉文', desc: 'IG 実データから次の案件を発見 → AI が初回 DM を下書き' },
                { icon: '🔗', title: '一気通貫の連動', desc: '議事録 → 意思決定 → 提案書 → 請求書 → 入金確認' },
              ].map((c, i) => (
                <div key={i} style={{ padding: '1rem 0.85rem' }}>
                  <div style={{ fontSize: '1.85rem', marginBottom: 8 }}>{c.icon}</div>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', fontWeight: 800, color: '#fff', marginBottom: 6 }}>{c.title}</p>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section-pad" style={{ padding: '5rem 1.5rem', background: '#070712' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>FAQ</p>
            <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.85rem, 3.5vw, 2.5rem)', fontWeight: 700, marginTop: 8, letterSpacing: '0.05em' }}>よくあるご質問</h2>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {FAQS.map((f, i) => (
              <details key={i} style={{ padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, cursor: 'pointer' }}>
                <summary style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', fontWeight: 700, listStyle: 'none', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span style={{ color: '#a78bfa', flexShrink: 0 }}>Q.</span><span>{f.q}</span>
                </summary>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', lineHeight: 2, marginTop: 12, paddingLeft: '1.4rem' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 最終 CTA */}
      <section style={{ padding: '5rem 1.5rem', background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.18) 0%, #000 70%)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.85rem, 4vw, 2.85rem)', fontWeight: 700, marginBottom: '1.5rem', lineHeight: 1.5, letterSpacing: '0.05em' }}>
          14 日間、<span style={{ background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>無料で。</span>
        </h2>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', color: 'rgba(255,255,255,0.65)', marginBottom: '2rem', lineHeight: 2 }}>
          クレカ登録不要。いつでも 1 タップで解約できます。
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg,#a78bfa,#f472b6)',
            color: '#fff', padding: '1.1rem 2.4rem', borderRadius: 14,
            fontFamily: FONT_SERIF_JA, fontSize: '1rem', fontWeight: 800,
            textDecoration: 'none', boxShadow: '0 12px 36px rgba(167,139,250,0.45)', letterSpacing: '0.1em',
          }}>Prism を試す</a>
          <a href="/iris" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg,#FCB045,#E1306C)',
            color: '#fff', padding: '1.1rem 2.4rem', borderRadius: 14,
            fontFamily: FONT_SERIF_JA, fontSize: '1rem', fontWeight: 800,
            textDecoration: 'none', boxShadow: '0 12px 36px rgba(225,48,108,0.45)', letterSpacing: '0.1em',
          }}>Iris を試す</a>
        </div>
      </section>

      {/* フッタ */}
      <footer style={{ background: '#000', padding: '2.5rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)' }}>
          © {new Date().getFullYear()} CORE INC.
        </p>
      </footer>
    </div>
  );
}

// ============================================================
//  PlanCard
// ============================================================
function PlanCard({ plan, yearly, brand }: { plan: any; yearly: boolean; brand: 'prism' | 'iris' }) {
  const accent = brand === 'iris' ? '#E1306C' : '#a78bfa';
  const accentGrad = brand === 'iris' ? 'linear-gradient(135deg,#FCB045,#E1306C)' : 'linear-gradient(135deg,#a78bfa,#f472b6)';
  const price = yearly ? plan.yearly || plan.price * 10 : plan.price;
  const suffix = yearly ? '/ 年' : '/ 月';

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} style={{
      position: 'relative',
      padding: '1.85rem 1.5rem',
      background: plan.highlight ? `linear-gradient(180deg, ${accent}25, ${accent}08)` : 'rgba(255,255,255,0.025)',
      border: plan.highlight ? `1px solid ${accent}60` : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 18,
      boxShadow: plan.highlight ? `0 16px 48px ${accent}25` : 'none',
    }}>
      {plan.highlight && (
        <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: accentGrad, color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.3rem 0.85rem', borderRadius: 999, letterSpacing: '0.15em', fontFamily: FONT_SERIF_JA }}>人気</div>
      )}
      <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.75rem', color: accent, marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' }}>{plan.tag}</p>
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '0.1em' }}>{plan.name}</h3>
      <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '2rem', fontWeight: 800 }}>
        {fmt(price)}<span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginLeft: 4 }}>{suffix}</span>
      </p>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '1.1rem 0' }} />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '1.5rem' }}>
        {plan.features.map((f: string, i: number) => (
          <li key={i} style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.85, marginBottom: '0.4rem', display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: accent, flexShrink: 0 }}>✓</span><span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href={brand === 'iris' ? '/iris' : '/'}
        style={{
          display: 'block',
          textAlign: 'center',
          width: '100%',
          background: plan.highlight ? accentGrad : 'rgba(255,255,255,0.06)',
          color: '#fff',
          border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.15)',
          padding: '0.85rem 1rem',
          borderRadius: 12,
          fontFamily: FONT_SERIF_JA,
          fontSize: '0.9rem', fontWeight: 700,
          textDecoration: 'none',
          boxShadow: plan.highlight ? `0 8px 24px ${accent}50` : 'none',
        }}
      >
        14 日 無料で試す
      </a>
    </motion.div>
  );
}

// ============================================================
//  SliderInput
// ============================================================
function SliderInput({ label, value, setValue, min, max, step = 1, unit }: { label: string; value: number; setValue: (n: number) => void; min: number; max: number; step?: number; unit: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{label}</p>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
          {value.toLocaleString('ja-JP')}<span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginLeft: 4, fontWeight: 500 }}>{unit}</span>
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#a78bfa' }}
      />
    </div>
  );
}
