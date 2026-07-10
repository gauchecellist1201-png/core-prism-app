// ============================================================
// CORE Prism OS — 公開ランディングページ (LP)
// コンセプト: ひとつの白光が 7 つの人格に分散する「人格統合 OS」
// 各人格には専属エージェント AI が付き、商談・財務・創作まで実行する
// ============================================================
import { motion } from 'framer-motion';
import { PrismLogo } from './Logo';
import { useT, type Lang, type Dictionary } from '../i18n';
import {
  Compass, Briefcase, TrendingUp, Sparkles, BookOpen, Users, Heart,
  FileText, FileSpreadsheet, ScrollText, Target, Mail, Receipt, Palette, Mic,
  Mic2, Handshake, Receipt as ReceiptIcon, ArrowRight, Sparkles as SparklesIcon,
  Gift, MessageSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { REFERRAL_BONUS_DAYS, getPendingReferralInviter, getPendingReferralMessage } from '../lib/referral';
import PrismApproveDemo from './PrismApproveDemo';
import AnimatedExecStage from './AnimatedExecStage';
import CxoProfileModal from './CxoProfileModal';
import type { CxoRole } from '../hooks/useAgentTaskQueue';
import HeroExecLoop from './HeroExecLoop';
import PrismBloomHero from './PrismBloomHero';
import { seedDemoData, setDemoActive } from '../lib/onboarding';
import LaunchCountdownBanner from './LaunchCountdownBanner';
import PwaInstallNudge from './PwaInstallNudge';

interface Props {
  onEnterApp: () => void;
  onOpenLegal: (kind: 'terms' | 'privacy' | 'tokushou') => void;
}

// ─── PRISM 7色 (虹のスペクトル) — 色とアイコンのみここで定義、文字は i18n から ───────
type AgentKey = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'violet';
const SPECTRUM: { key: AgentKey; color: string; Icon: LucideIcon }[] = [
  { key: 'red',    color: '#ff5757', Icon: Compass    },
  { key: 'orange', color: '#ff9842', Icon: Briefcase  },
  { key: 'yellow', color: '#fbbf24', Icon: TrendingUp },
  { key: 'green',  color: '#4ade80', Icon: Sparkles   },
  { key: 'blue',   color: '#60a5fa', Icon: BookOpen   },
  { key: 'indigo', color: '#a78bfa', Icon: Users      },
  { key: 'violet', color: '#f472b6', Icon: Heart      },
];

const EXEC_ICONS: { key: keyof Dictionary['exec']['items']; color: string; Icon: LucideIcon }[] = [
  { key: 'minutes',  color: '#60a5fa', Icon: FileText },
  { key: 'slides',   color: '#a78bfa', Icon: FileSpreadsheet },
  { key: 'contract', color: '#f472b6', Icon: ScrollText },
  { key: 'deal',     color: '#ff5757', Icon: Target },
  { key: 'email',    color: '#ff9842', Icon: Mail },
  { key: 'invoice',  color: '#fbbf24', Icon: Receipt },
  { key: 'image',    color: '#4ade80', Icon: Palette },
  { key: 'voice',    color: '#60a5fa', Icon: Mic },
];

const BG_DARK = '#F6F7FB';
const sectionPad = '5.5rem 1.25rem';

export default function LandingPage({ onEnterApp }: Props) {
  const { lang, setLang, t } = useT();
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [pendingInviter, setPendingInviter] = useState<string>('');
  const [pendingMsg, setPendingMsg] = useState<string>('');
  // LLLLLL (2026-06-04): CXO ピル を タップで プロフィール モーダル
  const [openCxo, setOpenCxo] = useState<CxoRole | null>(null);
  useEffect(() => {
    try { setPendingRef(sessionStorage.getItem('pending_ref')); } catch { /* */ }
    setPendingInviter(getPendingReferralInviter());
    setPendingMsg(getPendingReferralMessage());
  }, []);

  // 「サンプルで触ってみる」: 実物品質のデモデータを localStorage に投入してから入室
  const handleSampleEnter = () => {
    try {
      seedDemoData();
      setDemoActive(true);
    } catch { /* quota — そのまま入室 */ }
    onEnterApp();
  };

  return (
    <div style={{ background: BG_DARK, color: '#16162A', minHeight: '100dvh', fontFamily: '"Inter","游ゴシック","Hiragino Kaku Gothic ProN",sans-serif', overflowX: 'hidden' }}>
      {/* ── 紹介リンク経由バナー (?ref=XXX 検出時のみ) ───────────────
          招待された友達は全画面ヒーローで +N 日プレゼントを見落とすため、
          ヒーローより上 (=ファーストビュー最上部) に固定して必ず目に入るようにする。 */}
      {pendingRef && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'linear-gradient(90deg, #16A34A, #22C55E, #84CC16)',
            color: '#fff', textAlign: 'center',
            padding: '0.85rem 1rem',
            fontSize: '0.92rem', fontWeight: 800,
            letterSpacing: '0.02em',
            position: 'sticky', top: 0, zIndex: 70,
            boxShadow: '0 4px 18px rgba(22,163,74,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.55rem', flexWrap: 'wrap',
          }}
          data-testid="referral-welcome-banner"
        >
          <span className="inline-flex" style={{ alignItems: 'center' }}><Gift size={19} strokeWidth={2.2} /></span>
          <span>
            {pendingInviter ? (
              <><strong style={{ background: 'rgba(0,0,0,0.22)', padding: '0.1rem 0.55rem', borderRadius: 8 }}>{pendingInviter} さん</strong>からの招待で </>
            ) : (
              <>友達からの招待で </>
            )}
            <strong style={{ background: 'rgba(0,0,0,0.22)', padding: '0.1rem 0.55rem', borderRadius: 8, letterSpacing: '0.06em' }}>+{REFERRAL_BONUS_DAYS} 日</strong> プレゼント中。
            通常 7 日 → <strong>合計 {7 + REFERRAL_BONUS_DAYS} 日</strong> 無料でお試しできます
          </span>
          <button
            onClick={onEnterApp}
            style={{
              background: '#fff', color: '#16A34A',
              border: 'none', borderRadius: 999,
              padding: '0.32rem 0.95rem', fontSize: '0.82rem', fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap',
            }}
          >
            登録して受け取る →
          </button>
          {pendingMsg && (
            <p
              data-testid="referral-inviter-message"
              style={{
                flexBasis: '100%', margin: '0.15rem 0 0', textAlign: 'center',
                fontSize: '0.84rem', fontWeight: 600, fontStyle: 'italic',
                color: 'rgba(0,0,0,0.96)', lineHeight: 1.5,
              }}
            >
              <span className="inline-flex" style={{ verticalAlign: 'middle', marginRight: '0.3rem' }}><MessageSquare size={15} strokeWidth={2.2} /></span>「{pendingMsg}」{pendingInviter ? ` — ${pendingInviter} さん` : ''}
            </p>
          )}
        </motion.div>
      )}

      {/* ── 1画面目: 全画面プリズム開花ヒーロー (Crystal級・2026-07-02) ── */}
      <PrismBloomHero onStart={onEnterApp} />
      {/* ── 6/1 一般公開カウントダウン ───────────── */}
      <LaunchCountdownBanner kind="prism" />
      {/* WW (2026-06-03): PWA インストール促進 (3 訪問目以降に 1 日 1 回) */}
      <PwaInstallNudge />

      {/* ── ベータ公開告知バー ────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #FFB347, #FF6FA9, #B07BD9)',
        color: '#16162A',
        textAlign: 'center',
        padding: '0.5rem 1rem',
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        position: 'relative',
        zIndex: 60,
      }}>
        {t.banner}
      </div>

      {/* ── ヘッダ ────────────────────────────── */}
      <header className="lp-safe" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,20,0.92)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <PrismLogo size={28} withWordmark />
          <nav style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <a href="#agents" style={navLink} className="lp-nav-link">{t.nav.agents}</a>
            <a href="#exec" style={navLink} className="lp-nav-link">{t.nav.exec}</a>
            <a href="#pricing" style={navLink} className="lp-nav-link">{t.nav.pricing}</a>
            <a href="#faq" style={navLink} className="lp-nav-link">{t.nav.faq}</a>
            <LangToggle lang={lang} setLang={setLang} />
            <button onClick={onEnterApp} style={ctaBtnSmall}>{t.nav.cta}</button>
          </nav>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="lp-hero-pad lp-safe" style={{ position: 'relative', padding: '6.5rem 1.25rem 5.5rem', overflow: 'hidden' }}>
        {/* YY (2026-06-03): Hero 背景に CXO 14 名がうっすら浮遊する 8 秒ループ */}
        <HeroExecLoop density="normal" />
        <PrismHeroBackdrop />

        <div className="lp-hero-grid" style={{ maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '3rem', alignItems: 'center' }}>
          {/* ── 左: 文言 + CTA ───────── */}
          <div className="lp-hero-copy">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              style={{ fontSize: '0.72rem', letterSpacing: '0.35em', fontWeight: 700, marginBottom: '1.1rem', background: 'linear-gradient(90deg,#ff5757,#ff9842,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              {t.hero.eyebrow}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              style={{ fontSize: 'clamp(2.2rem, 4.8vw, 4.4rem)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}
            >
              <span style={{ background: 'linear-gradient(90deg,#fbbf24,#f472b6,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t.hero.h1Line1}</span>
              <br />
              <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t.hero.h1Line2}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              style={{ fontSize: 'clamp(1rem, 1.55vw, 1.18rem)', color: 'rgba(0,0,0,0.8)', lineHeight: 1.75, marginBottom: '2rem', maxWidth: 560 }}
            >
              <strong style={{ color: '#16162A' }}>{t.hero.sub1}</strong>
              <br />
              {t.hero.sub2}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}
            >
              <button onClick={onEnterApp} style={ctaBtnHero} className="lp-hero-cta-primary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  {t.hero.cta} <ArrowRight size={18} strokeWidth={2.6} />
                </span>
              </button>
              <a href="/pricing" style={ctaBtnGhost} className="lp-hero-cta-secondary">
                {t.hero.cta2}
              </a>
            </motion.div>

            <p style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.5)', marginTop: '1.1rem', lineHeight: 1.6 }}>
              {t.hero.free}
            </p>

            <button
              type="button"
              onClick={handleSampleEnter}
              style={{
                marginTop: '0.85rem',
                background: 'transparent',
                color: 'rgba(0,0,0,0.78)',
                border: '1px dashed rgba(167,139,250,0.55)',
                borderRadius: 10,
                padding: '0.55rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <SparklesIcon size={14} color="#a78bfa" />
              <span>{t.hero.sample}</span>
              <span style={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.5)' }}>{t.hero.sampleNote}</span>
            </button>
          </div>

          {/* ── 右: Live AgentTeamMonitor 風モック ───────── */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
            className="lp-hero-mock"
          >
            <PrismApproveDemo onEnter={onEnterApp} />
          </motion.div>
        </div>

        {/* ── ヒーロー直下: Before → After 3 実例カード ───────── */}
        <BeforeAfterShowcase />

        {/* 7色プリズム可視化 (元のまま、下に移動) */}
        <div style={{ maxWidth: 980, margin: '4rem auto 0', position: 'relative', zIndex: 2 }}>
          <PrismFanVisualization dict={t} />
        </div>
      </section>

      {/* ── 14 役員 リアルタイム稼働ステージ (FF) ───────────────────────────── */}
      {/* LLLLLL (2026-06-04): CXO タップ で プロフィール モーダル */}
      <AnimatedExecStage onCta={onEnterApp} ctaLabel={t.hero.cta} onCxoClick={(c) => setOpenCxo(c)} />
      <CxoProfileModal role={openCxo} onClose={() => setOpenCxo(null)} />

      {/* ── セクション: 7 つのエージェント ──────────────────────────────────────────────────── */}
      <section id="agents" className="lp-section-pad" style={{ padding: sectionPad, background: 'linear-gradient(180deg,#F6F7FB 0%,#ECEEF6 100%)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: '#a78bfa', fontWeight: 700, marginBottom: '0.75rem' }}>
              {t.agents.eyebrow}
            </p>
            <h2 style={{ fontSize: 'clamp(1.85rem, 3.5vw, 2.75rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem' }}>
              {t.agents.h2Line1}
              <br />
              <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {t.agents.h2Line2}
              </span>
            </h2>
            <p style={{ color: 'rgba(0,0,0,0.6)', maxWidth: 700, margin: '0 auto', fontSize: '1rem', lineHeight: 1.7 }}>
              {t.agents.sub}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
            {SPECTRUM.map((s, i) => {
              const item = t.agents.items[s.key];
              return (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  style={{ position: 'relative', background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 18, padding: '1.5rem 1.25rem', overflow: 'hidden' }}
                >
                  <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: s.color, opacity: 0.18, filter: 'blur(40px)', pointerEvents: 'none' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', position: 'relative', zIndex: 2 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${s.color}55, inset 0 1px 0 rgba(0,0,0,0.2)` }}>
                      <s.Icon size={22} color="#FFFFFF" strokeWidth={2.2} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: s.color, fontWeight: 700, marginBottom: 2 }}>{item.role.toUpperCase()}</p>
                      <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16162A' }}>{item.name}{t.agents.suffix}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(0,0,0,0.7)', lineHeight: 1.7, position: 'relative', zIndex: 2 }}>{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── セクション: 実行する AI ──────────────────────────────────────────────────── */}
      <section id="exec" className="lp-section-pad" style={{ padding: sectionPad, background: '#ECEEF6' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: '#fbbf24', fontWeight: 700, marginBottom: '0.75rem' }}>{t.exec.eyebrow}</p>
            <h2 style={{ fontSize: 'clamp(1.85rem, 3.5vw, 2.75rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem' }}>
              {t.exec.h2Line1}
              <br />
              <span style={{ background: 'linear-gradient(90deg,#fbbf24,#ff9842,#ff5757)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t.exec.h2Line2}</span>
            </h2>
            <p style={{ color: 'rgba(0,0,0,0.6)', maxWidth: 700, margin: '0 auto', fontSize: '1rem', lineHeight: 1.7 }}>
              {t.exec.sub}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {EXEC_ICONS.map((f, i) => {
              const item = t.exec.items[f.key];
              return (
                <motion.div key={f.key} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.4, delay: (i % 4) * 0.05 }} style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: '1.25rem' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `linear-gradient(135deg, ${f.color}, ${f.color}cc)`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '0.75rem',
                    boxShadow: `0 6px 16px ${f.color}44, inset 0 1px 0 rgba(0,0,0,0.2)`,
                  }}>
                    <f.Icon size={20} color="#fff" strokeWidth={2.2} />
                  </div>
                  <p style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>{item.label}</p>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', lineHeight: 1.6 }}>{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ONE PRISM ──────────────────────────────────────────── */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: 'linear-gradient(180deg,#ECEEF6 0%,#F6F7FB 100%)' }}>
        <div className="lp-two-col" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: '#60a5fa', fontWeight: 700, marginBottom: '0.75rem' }}>{t.prism.eyebrow}</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.2vw, 2.5rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: '1.25rem' }}>{t.prism.h2Line1}<br />{t.prism.h2Line2}</h2>
            <p style={{ color: 'rgba(0,0,0,0.7)', fontSize: '1rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>{t.prism.body}<strong style={{ color: '#16162A' }}>{t.prism.bodyEm}</strong>{t.prism.bodyTail}</p>
            <p style={{ color: 'rgba(0,0,0,0.55)', fontSize: '0.9rem', lineHeight: 1.7 }}>{t.prism.sub}</p>
          </div>
          <PrismDashboardMock dict={t} />
        </div>
      </section>

      {/* ── 価格 ──────────────────────────────────────────── */}
      <section id="pricing" className="lp-section-pad" style={{ padding: sectionPad, background: '#F6F7FB' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: '#f472b6', fontWeight: 700, marginBottom: '0.75rem' }}>{t.pricing.eyebrow}</p>
            <h2 style={{ fontSize: 'clamp(1.85rem, 3.5vw, 2.5rem)', fontWeight: 800, marginBottom: '0.5rem' }}>{t.pricing.h2Lead}<span style={{ background: 'linear-gradient(90deg,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t.pricing.h2Accent}</span></h2>
            <p style={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.95rem' }}>{t.pricing.sub}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <PriceCard plan={t.pricing.plans.starter} suffix={t.pricing.suffixMonth} cta={t.pricing.ctaTrial} popularLabel={t.pricing.popular} onClick={onEnterApp} />
            <PriceCard plan={t.pricing.plans.standard} suffix={t.pricing.suffixMonth} cta={t.pricing.ctaTrial} popularLabel={t.pricing.popular} highlight onClick={onEnterApp} />
            <PriceCard plan={t.pricing.plans.exclusive} suffix={t.pricing.suffixMonth} cta={t.pricing.ctaApply} popularLabel={t.pricing.popular} onClick={onEnterApp} />
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(0,0,0,0.5)', marginTop: '1.75rem' }}>{t.pricing.annual}</p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section id="faq" className="lp-section-pad" style={{ padding: sectionPad, background: 'linear-gradient(180deg,#F6F7FB 0%,#F1F2F9 100%)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: '#4ade80', fontWeight: 700, marginBottom: '0.75rem' }}>{t.faq.eyebrow}</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.2vw, 2.4rem)', fontWeight: 800, marginBottom: '0.75rem' }}>{t.faq.h2}</h2>
            <p style={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.95rem' }}>{t.faq.sub}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {t.faq.items.map((item, i) => (
              <FaqItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 最終 CTA ──────────────────────────────────────────── */}
      <section style={{ padding: '5rem 1.25rem', background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.18) 0%, #F6F7FB 70%)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 50%, rgba(255,87,87,0.1) 0%, transparent 40%), radial-gradient(circle at 70% 50%, rgba(96,165,250,0.1) 0%, transparent 40%)' }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 900, lineHeight: 1.2, marginBottom: '1.25rem' }}>
            {t.final.h2Lead} <span style={{ background: 'linear-gradient(90deg,#ff5757,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t.final.h2Accent}</span> {t.final.h2Tail}
          </h2>
          <p style={{ color: 'rgba(0,0,0,0.65)', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.7 }}>{t.final.sub}</p>
          <button onClick={onEnterApp} style={{ ...ctaBtnHero, display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
            {t.final.cta}
          </button>
        </div>
      </section>

      {/* ── フッタ ──────────────────────────────────────────── */}
      <footer id="contact" style={{ background: '#FFFFFF', padding: '3rem 1.25rem 2rem', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          <div>
            <PrismLogo size={28} withWordmark />
            <p style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.45)', marginTop: '0.75rem', lineHeight: 1.7 }}>{t.footer.tagline}</p>
          </div>
          <div>
            <p style={footHead}>{t.footer.product}</p>
            <a href="#agents" style={footLink}>{t.footer.agents}</a>
            <a href="#exec" style={footLink}>{t.footer.exec}</a>
            <a href="#pricing" style={footLink}>{t.footer.pricing}</a>
            <a href="/iris" style={footLink}>{t.footer.iris}</a>
          </div>
          <div>
            <p style={footHead}>{t.footer.company}</p>
            <a href="/faq" style={footLink}>よくある質問</a>
            <a href="/terms" style={footLink}>{t.footer.terms}</a>
            <a href="/privacy" style={footLink}>{t.footer.privacy}</a>
            <a href="/tokushoho" style={footLink}>{t.footer.tokushou}</a>
          </div>
          <div>
            <p style={footHead}>{t.footer.contact}</p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.55)', lineHeight: 1.7 }}>{t.footer.contactText}<br /><a href="mailto:hello@coreprism.app" style={{ color: '#a78bfa', textDecoration: 'none' }}>hello@coreprism.app</a></p>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(0,0,0,0.35)' }}>
          {t.footer.copyright.replace('{year}', String(new Date().getFullYear()))}
        </div>
      </footer>
    </div>
  );
}

// ─── Before → After 3 実例ショーケース ──────────────────────────
// オーナー指示: 動く例 + 数字 + 計算式の明示で「触らなくても伝わる」LP
// 単価¥3,000/h ベースで節約金額を計算 (¥50/分 = ¥3,000/60)
function BeforeAfterShowcase() {
  const items: {
    Icon: LucideIcon;
    tag: string;
    color: string;
    before: { label: string; body: string };
    after: { label: string; body: string };
    save: { minutes: number; calcNote: string; monthlyHint?: string };
  }[] = [
    {
      Icon: Mic2,
      tag: '議事録',
      color: '#60a5fa',
      before: { label: '1 時間の会議録音 + 殴り書きメモ', body: '聞き直し → 整形 → 共有まで 60 分かかる' },
      after:  { label: '3 分で章立て + アクション + 担当者付き', body: 'COO 役員 AI が要点・決定・宿題を自動構造化' },
      save:   { minutes: 57, calcNote: '60 分 → 3 分 = 節約 57 分 (¥3,000/h 換算で約 ¥2,850 相当)' },
    },
    {
      Icon: Handshake,
      tag: 'DM 案件 (Iris)',
      color: '#f472b6',
      before: { label: 'ブランドからの DM スクショ 1 枚', body: '条件・希望ギャラ・締切を読み直し → 表に転記で 5 分' },
      after:  { label: '30 秒で案件カード (ブランド/報酬/締切/1 文要約)', body: 'CSO 役員 AI が文面を読み取り、CRM に自動登録' },
      save:   { minutes: 4.5, calcNote: '5 分 → 30 秒 = 節約 4.5 分 (¥3,000/h で約 ¥225/件)', monthlyHint: '月 10 件で ¥2,250 / 月' },
    },
    {
      Icon: ReceiptIcon,
      tag: '経費レシート',
      color: '#4ade80',
      before: { label: 'レシート 1 枚撮影 → 手で入力', body: '日付・店舗・科目・税率を手打ちで 3 分' },
      after:  { label: '日付・店舗・科目・税率を自動入力', body: 'CFO 役員 AI が OCR + 仕訳 + freee/弥生 連携まで' },
      save:   { minutes: 2.5, calcNote: '3 分 → 30 秒 = 節約 2.5 分 (¥3,000/h で約 ¥125/枚)', monthlyHint: '月 30 枚で ¥3,750 / 月' },
    },
  ];

  return (
    <div className="lp-hero-examples" style={{ maxWidth: 1100, margin: '3.5rem auto 0', position: 'relative', zIndex: 2 }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: '#a78bfa', fontWeight: 700, marginBottom: '0.55rem' }}>
          3 EXAMPLES · BEFORE / AFTER
        </p>
        <h2 style={{ fontSize: 'clamp(1.4rem, 2.6vw, 1.95rem)', fontWeight: 800, lineHeight: 1.35, margin: 0 }}>
          触らなくても伝わる、<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>3 つの実例</span>。
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
        {items.map((ex, i) => (
          <motion.div
            key={ex.tag}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            style={{
              position: 'relative',
              background: 'rgba(0,0,0,0.035)',
              border: `1px solid ${ex.color}38`,
              borderRadius: 18,
              padding: '1.2rem 1.2rem 1.3rem',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div aria-hidden style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: ex.color, opacity: 0.18, filter: 'blur(50px)', pointerEvents: 'none' }} />

            {/* タグ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem', position: 'relative', zIndex: 2 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${ex.color}, ${ex.color}cc)`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 6px 14px ${ex.color}55, inset 0 1px 0 rgba(0,0,0,0.2)`,
              }}>
                <ex.Icon size={19} color="#fff" strokeWidth={2.3} />
              </div>
              <span style={{ fontSize: '0.66rem', letterSpacing: '0.22em', fontWeight: 700, color: ex.color, textTransform: 'uppercase' }}>{ex.tag}</span>
            </div>

            {/* Before */}
            <div style={{ position: 'relative', zIndex: 2, marginBottom: '0.7rem' }}>
              <p style={{ fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700, color: 'rgba(0,0,0,0.42)', marginBottom: '0.35rem' }}>
                BEFORE · いま
              </p>
              <p style={{ fontSize: '0.88rem', color: 'rgba(0,0,0,0.65)', lineHeight: 1.55, margin: 0 }}>
                <strong style={{ color: 'rgba(0,0,0,0.85)' }}>{ex.before.label}</strong>
              </p>
              <p style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, margin: '0.25rem 0 0' }}>
                {ex.before.body}
              </p>
            </div>

            {/* 矢印 */}
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.2rem 0 0.7rem' }}>
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.7rem', fontWeight: 700, color: ex.color, letterSpacing: '0.1em',
                }}
              >
                ↓ AI が引き受ける ↓
              </motion.div>
            </div>

            {/* After */}
            <div style={{ position: 'relative', zIndex: 2, marginBottom: '0.85rem' }}>
              <p style={{ fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700, color: ex.color, marginBottom: '0.35rem' }}>
                AFTER · Prism なら
              </p>
              <p style={{ fontSize: '0.95rem', color: '#16162A', lineHeight: 1.5, margin: 0, fontWeight: 700 }}>
                {ex.after.label}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.72)', lineHeight: 1.65, margin: '0.3rem 0 0' }}>
                {ex.after.body}
              </p>
            </div>

            {/* 節約バッジ (計算式付き) */}
            <div style={{
              position: 'relative', zIndex: 2,
              marginTop: 'auto',
              background: `${ex.color}1a`,
              border: `1px solid ${ex.color}40`,
              borderRadius: 12,
              padding: '0.6rem 0.75rem',
            }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 800, color: ex.color, margin: 0, lineHeight: 1.35 }}>
                {ex.save.calcNote}
              </p>
              {ex.save.monthlyHint && (
                <p style={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.7)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
                  → {ex.save.monthlyHint}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgba(0,0,0,0.42)', marginTop: '0.95rem', lineHeight: 1.6 }}>
        ※ 時間単価 ¥3,000/h で試算した目安です。業種・スキルにより個人差があります。
      </p>
    </div>
  );
}

function PrismHeroBackdrop() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      <motion.div animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.1, 1] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', left: '50%', top: '38%', width: 380, height: 380, marginLeft: -190, marginTop: -190, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 60%)', filter: 'blur(40px)' }} />
      {SPECTRUM.map((s, i) => {
        const angle = -75 + i * 25;
        return <motion.div key={s.key} initial={{ opacity: 0 }} animate={{ opacity: [0.18, 0.35, 0.18] }} transition={{ duration: 4 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }} style={{ position: 'absolute', left: '50%', top: '38%', width: 4, height: '70vh', transformOrigin: 'top center', transform: `translateX(-50%) rotate(${angle}deg)`, background: `linear-gradient(180deg, ${s.color}cc 0%, ${s.color}00 80%)`, filter: 'blur(8px)' }} />;
      })}
      <div style={{ position: 'absolute', top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: '#a78bfa', opacity: 0.12, filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: -200, left: -200, width: 600, height: 600, borderRadius: '50%', background: '#60a5fa', opacity: 0.12, filter: 'blur(80px)' }} />
    </div>
  );
}

function PrismFanVisualization({ dict }: { dict: Dictionary }) {
  return (
    <div className="lp-prism-fan" style={{ position: 'relative', width: '100%', height: 320, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, #fff 0%, rgba(0,0,0,0.4) 50%, transparent 100%)', boxShadow: '0 0 60px rgba(0,0,0,0.5)', zIndex: 5 }} />
      <div className="lp-prism-fan-cards" style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', width: '100%', maxWidth: 880 }}>
        {SPECTRUM.map((s, i) => {
          const offset = i - 3;
          const rotateBase = offset * 8;
          const item = dict.agents.items[s.key];
          return <motion.div key={s.key} className="lp-prism-fan-card-min" initial={{ opacity: 0, y: 20, rotate: 0 }} animate={{ opacity: 1, y: 0, rotate: rotateBase }} transition={{ duration: 0.7, delay: 0.4 + i * 0.08, ease: 'easeOut' }} style={{ flex: '1 1 0', minWidth: 70, maxWidth: 130, aspectRatio: '3 / 5', borderRadius: 14, background: `linear-gradient(180deg, ${s.color} 0%, ${s.color}88 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0.6rem 0.4rem', color: '#16162A', fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', boxShadow: `0 12px 32px ${s.color}55`, transformOrigin: 'bottom center' }}><div style={{ marginBottom: 6, display: 'flex' }}><s.Icon size={22} color="#FFFFFF" strokeWidth={2.2} /></div><div style={{ opacity: 0.95 }}>{item.name}</div><div style={{ fontSize: '0.55rem', opacity: 0.75, marginTop: 2, letterSpacing: '0.05em' }}>{item.role}</div></motion.div>;
        })}
      </div>
    </div>
  );
}

function PrismDashboardMock({ dict }: { dict: Dictionary }) {
  return (
    <div style={{ borderRadius: 18, background: 'linear-gradient(135deg, #15152a 0%, #F1F2F9 100%)', border: '1px solid rgba(0,0,0,0.08)', padding: '1.25rem', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: '#a78bfa', opacity: 0.18, filter: 'blur(50px)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5757' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
        <div style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(0,0,0,0.4)', fontFamily: 'monospace' }}>coreprism.app</div>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {SPECTRUM.map(s => {
          const item = dict.agents.items[s.key];
          return <div key={s.key} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', background: `${s.color}25`, color: s.color, border: `1px solid ${s.color}50`, borderRadius: 999, padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 700 }}><s.Icon size={12} strokeWidth={2.4} /><span>{item.name}</span></div>;
        })}
      </div>
      <div style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(96,165,250,0.1))', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '0.75rem' }}>
        <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: '#c4b5fd', fontWeight: 700, marginBottom: 4 }}>{dict.prism.briefLabel}</p>
        <p style={{ fontSize: '0.85rem', color: '#16162A', fontWeight: 600, lineHeight: 1.4 }}>{dict.prism.briefBody}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        {dict.prism.todoItems.map((tt, i) => <div key={i} style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10, padding: '0.6rem 0.75rem', fontSize: '0.7rem', color: 'rgba(0,0,0,0.85)' }}>{tt}</div>)}
      </div>
    </div>
  );
}

type PlanT = { name: string; tag: string; price: string; features: readonly string[] };
function PriceCard({ plan, suffix, cta, popularLabel, highlight, onClick }: { plan: PlanT; suffix: string; cta: string; popularLabel: string; highlight?: boolean; onClick: () => void }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} style={{ background: highlight ? 'linear-gradient(180deg, rgba(167,139,250,0.18), rgba(244,114,182,0.08))' : 'rgba(0,0,0,0.025)', border: highlight ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(0,0,0,0.07)', borderRadius: 18, padding: '1.75rem 1.5rem', position: 'relative', boxShadow: highlight ? '0 16px 48px rgba(167,139,250,0.15)' : 'none' }}>
      {highlight && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #a78bfa, #f472b6)', color: '#16162A', fontSize: '0.65rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: 999, letterSpacing: '0.1em' }}>{popularLabel}</div>}
      <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: 'rgba(0,0,0,0.5)', fontWeight: 700, marginBottom: '0.5rem' }}>{plan.tag.toUpperCase()}</p>
      <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>{plan.name}</h3>
      <p style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>{plan.price}<span style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}>{suffix}</span></p>
      <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '1rem 0' }} />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '1.5rem' }}>
        {plan.features.map((f, i) => <li key={i} style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.78)', lineHeight: 1.7, marginBottom: '0.4rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}><span style={{ color: highlight ? '#a78bfa' : '#4ade80', flexShrink: 0 }}>✓</span><span>{f}</span></li>)}
      </ul>
      <button onClick={onClick} style={{ width: '100%', background: highlight ? 'linear-gradient(135deg, #a78bfa, #f472b6)' : 'rgba(0,0,0,0.06)', color: '#16162A', border: highlight ? 'none' : '1px solid rgba(0,0,0,0.15)', padding: '0.85rem 1rem', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: highlight ? '0 8px 24px rgba(167,139,250,0.4)' : 'none' }}>{cta}</button>
    </motion.div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'transparent', border: 'none', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', color: '#16162A', fontSize: '0.95rem', fontWeight: 600, gap: '1rem' }}
      >
        <span>{question}</span>
        <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 1.25rem 1.1rem', color: 'rgba(0,0,0,0.7)', fontSize: '0.875rem', lineHeight: 1.75 }}>
          {answer}
        </div>
      )}
    </div>
  );
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const opts: { key: Lang; label: string }[] = [
    { key: 'ja', label: '日本語' },
    { key: 'en', label: 'EN' },
  ];
  return (
    <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 2 }}>
      {opts.map(o => (
        <button
          key={o.key}
          onClick={() => setLang(o.key)}
          aria-label={o.key === 'ja' ? 'Switch to Japanese' : 'Switch to English'}
          style={{ background: lang === o.key ? 'rgba(0,0,0,0.18)' : 'transparent', color: lang === o.key ? '#fff' : 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 8, padding: '0.45rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s, color 0.15s', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const navLink: React.CSSProperties = { fontSize: '0.85rem', color: 'rgba(0,0,0,0.7)', textDecoration: 'none', fontWeight: 500 };
const ctaBtnSmall: React.CSSProperties = { background: 'linear-gradient(135deg, #a78bfa, #f472b6)', color: '#16162A', padding: '0.55rem 1.1rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(167,139,250,0.35)' };
const ctaBtnHero: React.CSSProperties = { background: 'linear-gradient(135deg, #ff5757, #fbbf24, #4ade80, #60a5fa, #a78bfa, #f472b6)', backgroundSize: '300% 100%', color: '#16162A', padding: '1.05rem 2.25rem', borderRadius: 14, fontSize: '1.05rem', fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 12px 36px rgba(167,139,250,0.45)', letterSpacing: '0.02em' };
const ctaBtnGhost: React.CSSProperties = { background: 'rgba(0,0,0,0.05)', color: '#16162A', padding: '1.05rem 2rem', borderRadius: 14, fontSize: '1rem', fontWeight: 700, border: '1px solid rgba(0,0,0,0.15)', textDecoration: 'none', display: 'inline-block' };
const footHead: React.CSSProperties = { fontSize: '0.7rem', letterSpacing: '0.2em', color: 'rgba(0,0,0,0.45)', marginBottom: '0.75rem', fontWeight: 700 };
const footLink: React.CSSProperties = { display: 'block', color: 'rgba(0,0,0,0.7)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '0.5rem' };
