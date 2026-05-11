// ============================================================
// CORE Prism OS — 公開ランディングページ (LP)
// コンセプト: ひとつの白光が 7 つの人格に分散する「人格統合 OS」
// 各人格には専属エージェント AI が付き、商談・財務・創作まで実行する
// ============================================================
import { motion } from 'framer-motion';
import { PrismLogo } from './Logo';
import { useLocale } from '../hooks/useLocale';
import type { Locale } from '../lib/i18n';
import {
  Compass, Briefcase, TrendingUp, Sparkles, BookOpen, Users, Heart,
  FileText, FileSpreadsheet, ScrollText, Target, Mail, Receipt, Palette, Mic,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  onEnterApp: () => void;
  onOpenLegal: (kind: 'terms' | 'privacy' | 'tokushou') => void;
}

// ─── PRISM 7色 (虹のスペクトル) — Lucide アイコン化済み ─────────────────
type AgentSpec = {
  key: string; color: string; name: string;
  Icon: LucideIcon; role: string; desc: string;
};
const SPECTRUM: AgentSpec[] = [
  { key: 'red',    color: '#ff5757', name: '経営', Icon: Compass,    role: 'CEO Agent',       desc: '戦略立案・KPI 自動モニタリング・意思決定メモ生成' },
  { key: 'orange', color: '#ff9842', name: '営業', Icon: Briefcase,  role: 'Sales Agent',     desc: 'リード探索・商談スクリプト・提案書ドラフト・反論対応' },
  { key: 'yellow', color: '#fbbf24', name: '財務', Icon: TrendingUp, role: 'CFO Agent',       desc: 'P&L 自動生成・経費OCR・予算配分・キャッシュ予測' },
  { key: 'green',  color: '#4ade80', name: '創造', Icon: Sparkles,   role: 'Creative Agent',  desc: '画像生成・キャプション・ブランド設計・スライド自動化' },
  { key: 'blue',   color: '#60a5fa', name: '学び', Icon: BookOpen,   role: 'Knowledge Agent', desc: 'YouTube 要約・読書ノート・知識グラフ・横断検索' },
  { key: 'indigo', color: '#a78bfa', name: '人材', Icon: Users,      role: 'People Agent',    desc: '1on1 履歴・センチメント分析・採用面接・チームケア' },
  { key: 'violet', color: '#f472b6', name: '生活', Icon: Heart,      role: 'Life Agent',      desc: '健康・スケジュール・家族の予定・心の整え' },
];

const BG_DARK = '#070712';
const sectionPad = '5.5rem 1.25rem';

export default function LandingPage({ onEnterApp, onOpenLegal }: Props) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div style={{ background: BG_DARK, color: '#fff', minHeight: '100vh', fontFamily: '"Inter","游ゴシック","Hiragino Kaku Gothic ProN",sans-serif', overflowX: 'hidden' }}>
      {/* ── ベータ公開告知バー ────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #FFB347, #FF6FA9, #B07BD9)',
        color: '#fff',
        textAlign: 'center',
        padding: '0.5rem 1rem',
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        position: 'relative',
        zIndex: 60,
      }}>
        ✦ 2026/05/12 ベータ公開 — 14 日間無料 / クレカ不要 / 先着で 30 日延長
      </div>

      {/* ── ヘッダ ────────────────────────────── */}
      <header className="lp-safe" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,20,0.7)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <PrismLogo size={28} withWordmark />
          <nav style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <a href="#agents" style={navLink} className="lp-nav-link">{t('lp.nav.agents')}</a>
            <a href="#exec" style={navLink} className="lp-nav-link">{t('lp.nav.exec')}</a>
            <a href="#pricing" style={navLink} className="lp-nav-link">{t('lp.nav.pricing')}</a>
            <LocaleToggle locale={locale} setLocale={setLocale} />
            <button onClick={onEnterApp} style={ctaBtnSmall}>{t('lp.nav.cta')}</button>
          </nav>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="lp-hero-pad lp-safe" style={{ position: 'relative', padding: '8rem 1.25rem 7rem', overflow: 'hidden' }}>
        <PrismHeroBackdrop />

        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ fontSize: '0.75rem', letterSpacing: '0.4em', fontWeight: 700, marginBottom: '1.25rem', background: 'linear-gradient(90deg,#ff5757,#ff9842,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {t('lp.hero.eyebrow')}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            style={{ fontSize: 'clamp(2.5rem, 6.5vw, 5.6rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}
          >
            {t('lp.hero.h1.line1')}
            <br />
            <span style={{ background: 'linear-gradient(90deg,#ff5757,#ff9842,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t('lp.hero.h1.line2')}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            style={{ fontSize: 'clamp(1rem, 1.7vw, 1.25rem)', color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, marginBottom: '0.75rem' }}
          >
            {t('lp.hero.sub1')}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            style={{ fontSize: 'clamp(1rem, 1.7vw, 1.2rem)', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: 720, margin: '0 auto 2.5rem' }}
          >
            {t('lp.hero.sub2')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <button onClick={onEnterApp} style={ctaBtnHero}>
              {t('lp.hero.cta')}
            </button>
            <a href="#agents" style={ctaBtnGhost}>
              {t('lp.hero.cta2')}
            </a>
          </motion.div>

          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '1.5rem' }}>
            {t('lp.hero.free')}
          </p>
        </div>

        {/* 7色プリズム可視化 */}
        <div style={{ maxWidth: 980, margin: '4rem auto 0', position: 'relative', zIndex: 2 }}>
          <PrismFanVisualization />
        </div>
      </section>

      {/* ── セクション: 7 つのエージェント ──────────────────────────────────────────────────── */}
      <section id="agents" className="lp-section-pad" style={{ padding: sectionPad, background: 'linear-gradient(180deg,#070712 0%,#0d0d1c 100%)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: '#a78bfa', fontWeight: 700, marginBottom: '0.75rem' }}>
              7 AGENTS, 1 OS
            </p>
            <h2 style={{ fontSize: 'clamp(1.85rem, 3.5vw, 2.75rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem' }}>
              7 つのあなたに、
              <br />
              <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                7 つのエージェント。
              </span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 700, margin: '0 auto', fontSize: '1rem', lineHeight: 1.7 }}>
              役割ごとに専属の AI エージェントが伴走し、考え・書き・調べ・整える。
              <br />
              提案で終わらない、<strong style={{ color: '#fff' }}>実行までやりきる</strong> 7 つの脳。
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
            {SPECTRUM.map((s, i) => (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                style={{ position: 'relative', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '1.5rem 1.25rem', overflow: 'hidden' }}
              >
                <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: s.color, opacity: 0.18, filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', position: 'relative', zIndex: 2 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${s.color}55, inset 0 1px 0 rgba(255,255,255,0.2)` }}>
                    <s.Icon size={22} color="#FFFFFF" strokeWidth={2.2} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: s.color, fontWeight: 700, marginBottom: 2 }}>{s.role.toUpperCase()}</p>
                    <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{s.name}エージェント</p>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, position: 'relative', zIndex: 2 }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── セクション: 実行する AI ──────────────────────────────────────────────────── */}
      <section id="exec" className="lp-section-pad" style={{ padding: sectionPad, background: '#0d0d1c' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: '#fbbf24', fontWeight: 700, marginBottom: '0.75rem' }}>EXECUTION, NOT JUST SUGGESTIONS</p>
            <h2 style={{ fontSize: 'clamp(1.85rem, 3.5vw, 2.75rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem' }}>
              提案で終わらない。
              <br />
              <span style={{ background: 'linear-gradient(90deg,#fbbf24,#ff9842,#ff5757)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>書く、整える、提出する。</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 700, margin: '0 auto', fontSize: '1rem', lineHeight: 1.7 }}>
              議事録・スライド・契約書・営業メール・商談ロールプレイ ──
              <br />
              エージェントが <strong style={{ color: '#fff' }}>仕事そのもの</strong> をやってくれる。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              { Icon: FileText, color: '#60a5fa', label: '議事録 AI', desc: '会話を録音 → 要約・タスク抽出・送付メール' },
              { Icon: FileSpreadsheet, color: '#a78bfa', label: 'スライド AI', desc: '構成・原稿・デザインまでワンコマンドで' },
              { Icon: ScrollText, color: '#f472b6', label: '契約書 AI', desc: 'NDA・業務委託・購貸 — 雛形+リスク確認' },
              { Icon: Target, color: '#ff5757', label: '商談 AI', desc: '反論ロープレ・刺さるトーク・次の一手' },
              { Icon: Mail, color: '#ff9842', label: 'メール AI', desc: '受信トレイを 30 分間隔で巡回・下書き済' },
              { Icon: Receipt, color: '#fbbf24', label: '請求 AI', desc: '見積→発注→納品→請求の一気通貫' },
              { Icon: Palette, color: '#4ade80', label: '画像 AI', desc: 'ブランドに沿った投稿・サムネ・OG画像' },
              { Icon: Mic, color: '#60a5fa', label: '音声入力', desc: '思考をしゃべるだけで自動分類・整理' },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.4, delay: (i % 4) * 0.05 }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '1.25rem' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `linear-gradient(135deg, ${f.color}, ${f.color}cc)`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '0.75rem',
                  boxShadow: `0 6px 16px ${f.color}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
                }}>
                  <f.Icon size={20} color="#fff" strokeWidth={2.2} />
                </div>
                <p style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>{f.label}</p>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ONE PRISM ──────────────────────────────────────────── */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: 'linear-gradient(180deg,#0d0d1c 0%,#070712 100%)' }}>
        <div className="lp-two-col" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: '#60a5fa', fontWeight: 700, marginBottom: '0.75rem' }}>ONE PRISM, ALL LIGHT</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.2vw, 2.5rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: '1.25rem' }}>SaaS を切替える時代は、<br />もう終わった。</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>CRM、議事録、画像生成、スライド、メール、健康記録 ──<br />ぜんぶ、<strong style={{ color: '#fff' }}>ひとつの PRISM の中</strong> に。</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', lineHeight: 1.7 }}>⌘+K で 7 つのエージェントを横断検索、人格を切替えれば文脈ごと一新。入力は文字でも、音声でも、画像でも。</p>
          </div>
          <PrismDashboardMock />
        </div>
      </section>

      {/* ── 価格 ──────────────────────────────────────────── */}
      <section id="pricing" className="lp-section-pad" style={{ padding: sectionPad, background: '#070712' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: '#f472b6', fontWeight: 700, marginBottom: '0.75rem' }}>PRICING</p>
            <h2 style={{ fontSize: 'clamp(1.85rem, 3.5vw, 2.5rem)', fontWeight: 800, marginBottom: '0.5rem' }}>使うだけ広がる、<span style={{ background: 'linear-gradient(90deg,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>あなたの可能性</span></h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>すべてのプランで Claude / Gemini / Stable Diffusion を内蔵。API キー不要。</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <PriceCard name="Starter" tag="個人事業 / 副業" price="¥4,800" suffix="/ 月" features={['3 つの人格 (経営/営業/+1)', '商談・議事録・スライド AI', 'Cmd+K 横断検索', 'PWA / オフライン対応']} cta="14 日無料で試す" onClick={onEnterApp} />
            <PriceCard name="Standard" tag="フリーランス / 小規模" price="¥9,800" suffix="/ 月" features={['7 つの人格 (全エージェント)', '提案書・契約書・財務AI', 'Gmail シャドー秘書 (返信下書き)', 'YouTube 取込 → ナレッジ', 'CRM 案件・見積→請求一気通㛧']} highlight cta="14 日無料で試す" onClick={onEnterApp} />
            <PriceCard name="Exclusive" tag="経営者 / チーム" price="¥29,800" suffix="/ 月" features={['Standard 全機能', '人物ケア (1on1 + センチメント)', 'API アクセス + Webhook', 'チーム共有 (5名まで)', '優先サポート + 戦略コーチ']} cta="今すぐ申し込む" onClick={onEnterApp} />
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '1.75rem' }}>年払いで 2 ヶ月分割引 · 法人は別途お問い合わせください</p>
        </div>
      </section>

      {/* ── 最終 CTA ──────────────────────────────────────────── */}
      <section style={{ padding: '5rem 1.25rem', background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.18) 0%, #070712 70%)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 50%, rgba(255,87,87,0.1) 0%, transparent 40%), radial-gradient(circle at 70% 50%, rgba(96,165,250,0.1) 0%, transparent 40%)' }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 900, lineHeight: 1.2, marginBottom: '1.25rem' }}>
            あなたの中の <span style={{ background: 'linear-gradient(90deg,#ff5757,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>7 つの可能性</span> に、
            <br />
            エージェント AI を。
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.7 }}>14 日間、すべてのエージェントを無料でお試しできます。</p>
          <button onClick={onEnterApp} style={{ ...ctaBtnHero, display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
            <Sparkles size={18} strokeWidth={2.4} />
            いますぐ解き放つ
          </button>
        </div>
      </section>

      {/* ── フッタ ──────────────────────────────────────────── */}
      <footer id="contact" style={{ background: '#040408', padding: '3rem 1.25rem 2rem', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          <div>
            <PrismLogo size={28} withWordmark />
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.75rem', lineHeight: 1.7 }}>すべての事業家に、<br />エージェント AI を。</p>
          </div>
          <div>
            <p style={footHead}>PRODUCT</p>
            <a href="#agents" style={footLink}>7 つのエージェント</a>
            <a href="#exec" style={footLink}>実行する AI</a>
            <a href="#pricing" style={footLink}>料金</a>
            <a href="/iris" style={footLink}>姉妹ブランド · CORE Iris</a>
          </div>
          <div>
            <p style={footHead}>COMPANY</p>
            <button onClick={() => onOpenLegal('terms')} style={footLinkBtn}>利用規約</button>
            <button onClick={() => onOpenLegal('privacy')} style={footLinkBtn}>プライバシーポリシー</button>
            <button onClick={() => onOpenLegal('tokushou')} style={footLinkBtn}>特定商取引法表記</button>
          </div>
          <div>
            <p style={footHead}>CONTACT</p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>法人契約・カスタム導入のご相談は<br /><a href="mailto:hello@coreprism.app" style={{ color: '#a78bfa', textDecoration: 'none' }}>hello@coreprism.app</a></p>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
          © {new Date().getFullYear()} CORE Prism · Built with care
        </div>
      </footer>
    </div>
  );
}

function PrismHeroBackdrop() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      <motion.div animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.1, 1] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', left: '50%', top: '38%', width: 380, height: 380, marginLeft: -190, marginTop: -190, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 60%)', filter: 'blur(40px)' }} />
      {SPECTRUM.map((s, i) => {
        const angle = -75 + i * 25;
        return <motion.div key={s.key} initial={{ opacity: 0 }} animate={{ opacity: [0.18, 0.35, 0.18] }} transition={{ duration: 4 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }} style={{ position: 'absolute', left: '50%', top: '38%', width: 4, height: '70vh', transformOrigin: 'top center', transform: `translateX(-50%) rotate(${angle}deg)`, background: `linear-gradient(180deg, ${s.color}cc 0%, ${s.color}00 80%)`, filter: 'blur(8px)' }} />;
      })}
      <div style={{ position: 'absolute', top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: '#a78bfa', opacity: 0.12, filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: -200, left: -200, width: 600, height: 600, borderRadius: '50%', background: '#60a5fa', opacity: 0.12, filter: 'blur(80px)' }} />
    </div>
  );
}

function PrismFanVisualization() {
  return (
    <div className="lp-prism-fan" style={{ position: 'relative', width: '100%', height: 320, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, #fff 0%, rgba(255,255,255,0.4) 50%, transparent 100%)', boxShadow: '0 0 60px rgba(255,255,255,0.5)', zIndex: 5 }} />
      <div className="lp-prism-fan-cards" style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', width: '100%', maxWidth: 880 }}>
        {SPECTRUM.map((s, i) => {
          const offset = i - 3;
          const rotateBase = offset * 8;
          return <motion.div key={s.key} className="lp-prism-fan-card-min" initial={{ opacity: 0, y: 20, rotate: 0 }} animate={{ opacity: 1, y: 0, rotate: rotateBase }} transition={{ duration: 0.7, delay: 0.4 + i * 0.08, ease: 'easeOut' }} style={{ flex: '1 1 0', minWidth: 70, maxWidth: 130, aspectRatio: '3 / 5', borderRadius: 14, background: `linear-gradient(180deg, ${s.color} 0%, ${s.color}88 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0.6rem 0.4rem', color: '#fff', fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', boxShadow: `0 12px 32px ${s.color}55`, transformOrigin: 'bottom center' }}><div style={{ marginBottom: 6, display: 'flex' }}><s.Icon size={22} color="#FFFFFF" strokeWidth={2.2} /></div><div style={{ opacity: 0.95 }}>{s.name}</div><div style={{ fontSize: '0.55rem', opacity: 0.75, marginTop: 2, letterSpacing: '0.05em' }}>{s.role}</div></motion.div>;
        })}
      </div>
    </div>
  );
}

function PrismDashboardMock() {
  return (
    <div style={{ borderRadius: 18, background: 'linear-gradient(135deg, #15152a 0%, #0a0a18 100%)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: '#a78bfa', opacity: 0.18, filter: 'blur(50px)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5757' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
        <div style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>coreprism.app</div>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {SPECTRUM.map(s => <div key={s.key} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', background: `${s.color}25`, color: s.color, border: `1px solid ${s.color}50`, borderRadius: 999, padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 700 }}><s.Icon size={12} strokeWidth={2.4} /><span>{s.name}</span></div>)}
      </div>
      <div style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(96,165,250,0.1))', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '0.75rem' }}>
        <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: '#c4b5fd', fontWeight: 700, marginBottom: 4 }}>今日のブリーフ</p>
        <p style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600, lineHeight: 1.4 }}>午前は新規開拓、午後は提案書をエージェントが下書き済みです。</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        {['＋ 株式会社○○ への提案書', '＋ 経費 OCR (3件)', '＋ Gmail 返信下書き 5件', '＋ 来週の P&L レビュー'].map((t, i) => <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '0.6rem 0.75rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)' }}>{t}</div>)}
      </div>
    </div>
  );
}

function PriceCard({ name, tag, price, suffix, features, highlight, cta, onClick }: { name: string; tag: string; price: string; suffix: string; features: string[]; highlight?: boolean; cta: string; onClick: () => void }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} style={{ background: highlight ? 'linear-gradient(180deg, rgba(167,139,250,0.18), rgba(244,114,182,0.08))' : 'rgba(255,255,255,0.025)', border: highlight ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '1.75rem 1.5rem', position: 'relative', boxShadow: highlight ? '0 16px 48px rgba(167,139,250,0.15)' : 'none' }}>
      {highlight && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #a78bfa, #f472b6)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: 999, letterSpacing: '0.1em' }}>人気</div>}
      <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '0.5rem' }}>{tag.toUpperCase()}</p>
      <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>{name}</h3>
      <p style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>{price}<span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{suffix}</span></p>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '1rem 0' }} />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '1.5rem' }}>
        {features.map((f, i) => <li key={i} style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, marginBottom: '0.4rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}><span style={{ color: highlight ? '#a78bfa' : '#4ade80', flexShrink: 0 }}>✓</span><span>{f}</span></li>)}
      </ul>
      <button onClick={onClick} style={{ width: '100%', background: highlight ? 'linear-gradient(135deg, #a78bfa, #f472b6)' : 'rgba(255,255,255,0.06)', color: '#fff', border: highlight ? 'none' : '1px solid rgba(255,255,255,0.15)', padding: '0.85rem 1rem', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: highlight ? '0 8px 24px rgba(167,139,250,0.4)' : 'none' }}>{cta}</button>
    </motion.div>
  );
}

function LocaleToggle({ locale, setLocale }: { locale: Locale; setLocale: (l: Locale) => void }) {
  const locales: Locale[] = ['ja', 'en', 'zh'];
  const labels: Record<Locale, string> = { ja: '日', en: 'EN', zh: '中' };
  return (
    <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 2 }}>
      {locales.map(l => (
        <button key={l} onClick={() => setLocale(l)} style={{ background: locale === l ? 'rgba(255,255,255,0.18)' : 'transparent', color: locale === l ? '#fff' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}>{labels[l]}</button>
      ))}
    </div>
  );
}

const navLink: React.CSSProperties = { fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontWeight: 500 };
const ctaBtnSmall: React.CSSProperties = { background: 'linear-gradient(135deg, #a78bfa, #f472b6)', color: '#fff', padding: '0.55rem 1.1rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(167,139,250,0.35)' };
const ctaBtnHero: React.CSSProperties = { background: 'linear-gradient(135deg, #ff5757, #fbbf24, #4ade80, #60a5fa, #a78bfa, #f472b6)', backgroundSize: '300% 100%', color: '#fff', padding: '1.05rem 2.25rem', borderRadius: 14, fontSize: '1.05rem', fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 12px 36px rgba(167,139,250,0.45)', letterSpacing: '0.02em' };
const ctaBtnGhost: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '1.05rem 2rem', borderRadius: 14, fontSize: '1rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.15)', textDecoration: 'none', display: 'inline-block' };
const footHead: React.CSSProperties = { fontSize: '0.7rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', marginBottom: '0.75rem', fontWeight: 700 };
const footLink: React.CSSProperties = { display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '0.5rem' };
const footLinkBtn: React.CSSProperties = { display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', background: 'transparent', border: 'none', padding: 0, marginBottom: '0.5rem', cursor: 'pointer', textAlign: 'left' };
