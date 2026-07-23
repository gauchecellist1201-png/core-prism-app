// ============================================================
// CORE Iris — Landing (2026-07-24 全面再作成)
// 新ポジション: 「リールが、誰でも簡単に作れる」Instagram AI
// 骨格: ヒーロー(課題言い当て+実物モック+CTA) → 課題あるある3 →
//       できること4(Before/After) → 使い方3ステップ → 料金 → FAQ → 最終CTA
// ルール: 絵文字UI禁止 / 375px見切れゼロ / コントラスト遵守 / 数字の嘘禁止
// ============================================================
import { motion } from 'framer-motion';
import {
  Clapperboard, Wand2, MessageSquare, CalendarClock, Check, ArrowRight,
  Sparkles as SparklesIcon, Film, Mic, Captions, LayoutGrid, Upload,
  PenLine, Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useMasterTap } from '../lib/masterTap';
import { IRIS_COLORS, IRIS_FONTS } from './irisStyle';
import { IrisLogo } from '../components/Logo';
import { seedDemoData, setDemoActive, clearDemoData } from '../lib/onboarding';
import { REFERRAL_BONUS_DAYS, TRIAL_BASE_DAYS } from '../lib/referral';

interface Props {
  onEnter: () => void;
  onSelectPlan?: (planId: string) => void;
}

const INK = '#1F1A2E';
const G_GOLD = IRIS_COLORS.gold;       // #FCB045
const G_PINK = IRIS_COLORS.hotPink;    // #E1306C
const G_PURPLE = IRIS_COLORS.purpleLt; // #B07BD9
const GOLD_TEXT = '#B8730A';           // 白背景で読めるゴールド文字
const GRAD = `linear-gradient(120deg, ${G_GOLD} 0%, ${G_PINK} 50%, ${G_PURPLE} 100%)`;
const sectionPad = '4.5rem 1.25rem';

// ─── 課題あるある (共感・自分ごと化) ───────────────────────
const PAINS: { Icon: LucideIcon; title: string; body: string; color: string }[] = [
  {
    Icon: Film,
    title: '編集が、大変すぎる',
    body: '編集アプリを開いて2時間。字幕を打って、音に合わせて切って…気づけば1本も完成していない。',
    color: G_PINK,
  },
  {
    Icon: Clock,
    title: '時間が、足りない',
    body: 'せっかく撮った動画が、カメラロールに眠ったまま。「編集する時間がない」で今週も投稿ゼロ。',
    color: G_GOLD,
  },
  {
    Icon: PenLine,
    title: '何を作ればいいか、わからない',
    body: '企画も台本も投稿文も、ぜんぶ自分で考えるのは限界。伸びてる人のマネも、正解がわからない。',
    color: G_PURPLE,
  },
];

// ─── できること (Before → After) ───────────────────────────
const SOLUTIONS: {
  Icon: LucideIcon; tag: string; title: string; before: string; after: string; color: string;
}[] = [
  {
    Icon: Wand2,
    tag: 'おまかせ3タップ',
    title: '素材を入れるだけで、リールが完成',
    before: '編集アプリとにらめっこで2時間。並び順も字幕も投稿文も、ぜんぶ手作業',
    after: '動画・写真を選ぶだけ。AIが並べ替え・字幕・投稿文まで3タップで仕上げる',
    color: G_PINK,
  },
  {
    Icon: MessageSquare,
    tag: 'ことばで編集',
    title: '「暖かい感じで15秒にして」で直る',
    before: 'タイムラインをつまんで伸ばして、色味を1つずつ調整…修正のたびにやり直し',
    after: 'チャットや音声でひとこと指示するだけ。AIが字幕・長さ・雰囲気を整え直す',
    color: G_GOLD,
  },
  {
    Icon: LayoutGrid,
    tag: 'こだわり編集',
    title: 'こだわりたい日は、とことん',
    before: '凝った編集はPCの専用ソフト頼み。テロップのデザインだけで日が暮れる',
    after: 'ドラッグで並べ替え、カラー6種・繋ぎ5種・字幕3スタイル・16テーマから選ぶだけ',
    color: G_PURPLE,
  },
  {
    Icon: CalendarClock,
    tag: '企画・台本 → 予約投稿',
    title: '「何を作るか」から「投稿」まで',
    before: '企画を考え、台本を書き、投稿時間にスマホを握りしめて待機',
    after: 'AIが企画・台本を提案。できたリールは予約投稿で、決めた時間に自動で出る',
    color: G_PINK,
  },
];

// ─── 使い方3ステップ ───────────────────────────────────────
const STEPS: { Icon: LucideIcon; n: string; title: string; body: string }[] = [
  { Icon: Upload, n: '1', title: '素材を入れる', body: '撮った動画や写真を選ぶだけ。撮り直しも台本も、なくていい。' },
  { Icon: Wand2, n: '2', title: 'AIにおまかせ', body: '並べ替え・字幕・投稿文をAIが自動で。直したければ「もっと明るく」とひとこと。' },
  { Icon: CalendarClock, n: '3', title: '予約して、投稿', body: '仕上がったら日時を選んで予約。あとはIrisが投稿まで見届ける。' },
];

// ─── 料金 (明快な2プラン・無料体験前面) ─────────────────────
const PLANS = [
  {
    id: 'lite',
    name: 'Lite',
    tag: 'まずはリールを作りたい',
    price: '¥2,980',
    suffix: '/ 月',
    features: ['おまかせ3タップのリール作成', '字幕3スタイル・16テーマ', 'AI投稿文・ハッシュタグ', '予約投稿'],
  },
  {
    id: 'standard',
    name: 'Standard',
    tag: '毎週ちゃんと伸ばしたい',
    price: '¥6,980',
    suffix: '/ 月',
    features: ['Lite の全機能', 'チャット・音声での編集指示 無制限', 'AI企画・台本スタジオ', 'アカウント分析と改善提案', '優先サポート'],
    highlight: true,
  },
];

// ─── FAQ ───────────────────────────────────────────────────
const FAQS: { q: string; a: string }[] = [
  {
    q: '動画編集の経験がなくても使えますか？',
    a: 'はい。素材を選んで「おまかせ」を押すだけでリールが仕上がります。編集ソフトの知識は一切いりません。直したいところは「もっと短く」のようにことばで伝えるだけです。',
  },
  {
    q: 'スマホだけで完結しますか？',
    a: 'スマホのブラウザだけで、素材の取り込みから編集・予約投稿まで完結します。アプリのインストールも、PCも不要です。',
  },
  {
    q: '無料体験のあと、勝手に課金されませんか？',
    a: `されません。無料体験（${TRIAL_BASE_DAYS}日間）はクレジットカード登録なしで始まるため、体験が終わっても自動で請求されることはありません。続けたい場合にだけプランをお選びください。`,
  },
  {
    q: '作ったリールは自分のものになりますか？',
    a: 'はい。書き出したリール・字幕・投稿文はすべてあなたのものです。商用利用にも制限はありません。',
  },
];

export default function IrisLanding({ onEnter, onSelectPlan }: Props) {
  const tapMaster = useMasterTap();

  const handlePlan = (id: string) => {
    if (onSelectPlan) onSelectPlan(id);
    else onEnter();
  };

  // サンプル入場: 実物品質のデモデータを投入してから入室
  const handleSampleEnter = () => {
    try {
      clearDemoData();
      seedDemoData({ profile: 'creator' });
      setDemoActive(true);
    } catch { /* quota — そのまま入室 */ }
    onEnter();
  };

  return (
    <div style={{ background: '#FFFFFF', color: INK, fontFamily: IRIS_FONTS.body, minHeight: '100dvh', overflowX: 'hidden' }}>
      {/* ── 告知バー ── */}
      <div style={{
        background: `linear-gradient(90deg, ${G_GOLD}, ${G_PINK}, ${G_PURPLE})`,
        color: '#fff', textAlign: 'center', padding: '0.5rem 1rem',
        fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.6,
        position: 'relative', zIndex: 60,
      }}>
        <span style={{ whiteSpace: 'nowrap' }}>{TRIAL_BASE_DAYS}日間 完全無料</span>{' · '}
        <span style={{ whiteSpace: 'nowrap' }}>クレカ登録不要</span>{' · '}
        <span style={{ whiteSpace: 'nowrap' }}>招待リンクでお互い +{REFERRAL_BONUS_DAYS}日</span>
      </div>

      {/* ── ヘッダ ── */}
      <header className="lp-safe" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          {/* ロゴ5回タップ = オーナー専用の隠しマスターログイン */}
          <span onClick={tapMaster} style={{ cursor: 'default', display: 'inline-flex' }}>
            <IrisLogo size={28} withWordmark />
          </span>
          <nav style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
            <a href="#solutions" style={navLink} className="lp-nav-link iris-lp-nav-link">できること</a>
            <a href="#steps" style={navLink} className="lp-nav-link iris-lp-nav-link">使い方</a>
            <a href="#pricing" style={navLink} className="lp-nav-link iris-lp-nav-link">料金</a>
            <button onClick={onEnter} style={ctaBtnSmall}>無料でためす</button>
          </nav>
        </div>
      </header>

      {/* ══ 1. ヒーロー ══════════════════════════════════════ */}
      <section className="lp-hero-pad lp-safe" style={{ position: 'relative', padding: '4.5rem 1.25rem 4rem', overflow: 'hidden' }}>
        {/* オーロラ背景 */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -140, right: -120, width: 420, height: 420, borderRadius: '50%', background: G_PINK, opacity: 0.13, filter: 'blur(90px)' }} />
          <div style={{ position: 'absolute', top: 160, left: -160, width: 400, height: 400, borderRadius: '50%', background: G_GOLD, opacity: 0.13, filter: 'blur(90px)' }} />
          <div style={{ position: 'absolute', bottom: -120, right: '20%', width: 360, height: 360, borderRadius: '50%', background: G_PURPLE, opacity: 0.12, filter: 'blur(90px)' }} />
        </div>

        <div className="iris-hero-grid" style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '3rem', alignItems: 'center' }}>
          {/* 左: コピー + CTA */}
          <div>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              style={{ fontSize: '0.68rem', letterSpacing: '0.4em', fontWeight: 700, marginBottom: '1.2rem', background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CORE IRIS — REEL STUDIO AI
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1 }}
              style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(2.05rem, 5.4vw, 4.2rem)', fontWeight: 500, lineHeight: 1.18, letterSpacing: '-0.01em', marginBottom: '1.2rem' }}>
              リール編集で、
              <br />
              夜をつぶすのは
              <br />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>今日でおしまい。</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.28 }}
              style={{ fontFamily: IRIS_FONTS.serif, fontSize: 'clamp(1rem, 1.7vw, 1.2rem)', color: 'rgba(31,26,46,0.75)', lineHeight: 1.9, marginBottom: '1.8rem', maxWidth: 540 }}>
              素材を入れるだけ。AIが<strong style={{ color: INK }}>並べ替え・字幕・投稿文</strong>まで仕上げる、
              誰でも使えるInstagramリールAI。直したいところは
              <strong style={{ color: G_PINK }}>「暖かい感じで15秒にして」</strong>とひとことで。
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.42 }}
              style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={onEnter} style={ctaBtnHero}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  無料でためす <ArrowRight size={18} strokeWidth={2.6} />
                </span>
              </button>
              <a href="#pricing" style={ctaBtnGhost}>料金を見る</a>
            </motion.div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.55)', marginTop: '1rem', lineHeight: 1.6 }}>
              {TRIAL_BASE_DAYS}日間ぜんぶ無料 · クレカ登録不要 · 解約は1タップ
            </p>
            <button type="button" onClick={handleSampleEnter} style={{
              marginTop: '0.8rem', background: 'transparent', color: 'rgba(0,0,0,0.85)',
              border: `1px dashed ${G_GOLD}90`, borderRadius: 10, padding: '0.55rem 1rem',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontFamily: IRIS_FONTS.body,
            }}>
              <SparklesIcon size={14} color={GOLD_TEXT} />
              <span>サンプルで触ってみる</span>
              <span style={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.55)' }}>(架空データで体験)</span>
            </button>
          </div>

          {/* 右: リールスタジオ実物モック */}
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}>
            <ReelStudioMock />
          </motion.div>
        </div>
      </section>

      {/* ══ 2. 課題ブロック ══════════════════════════════════ */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: 'linear-gradient(180deg, #FFFFFF 0%, #FBF4FA 100%)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color: G_PINK, marginBottom: '0.8rem' }}>SOUND FAMILIAR?</p>
            <h2 style={h2Style}>
              リール、こんなふうに<br className="iris-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>止まっていませんか。</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
            {PAINS.map((p, i) => (
              <motion.div key={p.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{ position: 'relative', background: '#FFFFFF', border: `1px solid ${p.color}30`, borderRadius: 18, padding: '1.5rem 1.35rem', overflow: 'hidden', boxShadow: '0 8px 28px rgba(31,26,46,0.06)' }}>
                <div aria-hidden style={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: p.color, opacity: 0.14, filter: 'blur(50px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
                    boxShadow: `0 6px 16px ${p.color}50`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.85rem',
                  }}>
                    <p.Icon size={22} color="#fff" strokeWidth={2.2} />
                  </div>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 800, marginBottom: '0.5rem', color: INK }}>{p.title}</h3>
                  <p style={{ fontSize: '0.88rem', color: 'rgba(0,0,0,0.68)', lineHeight: 1.75, margin: 0 }}>{p.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '2.25rem', fontFamily: IRIS_FONTS.serif, fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'rgba(31,26,46,0.8)', lineHeight: 1.9 }}>
            その全部を、Irisが引き受けます。
          </p>
        </div>
      </section>

      {/* ══ 3. 解決ブロック (Before → After) ═════════════════ */}
      <section id="solutions" className="lp-section-pad" style={{ padding: sectionPad, background: '#FBF4FA' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color: GOLD_TEXT, marginBottom: '0.8rem' }}>WHAT IRIS DOES</p>
            <h2 style={h2Style}>
              素材を入れてから、<br className="iris-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>投稿されるまで。</span>
            </h2>
            <p style={{ color: 'rgba(0,0,0,0.62)', maxWidth: 640, margin: '0.9rem auto 0', fontSize: '0.95rem', lineHeight: 1.85, fontFamily: IRIS_FONTS.serif }}>
              「編集」だけじゃない。企画から投稿まで、リールづくりの全工程がこの1つで終わる。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
            {SOLUTIONS.map((s, i) => (
              <motion.div key={s.tag} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.07 }}
                style={{ position: 'relative', background: '#FFFFFF', border: `1px solid ${s.color}30`, borderRadius: 20, padding: '1.5rem 1.35rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 32px rgba(31,26,46,0.07)' }}>
                <div aria-hidden style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', background: s.color, opacity: 0.13, filter: 'blur(55px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`, boxShadow: `0 6px 14px ${s.color}50`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <s.Icon size={19} color="#fff" strokeWidth={2.3} />
                  </div>
                  <span style={{ fontSize: '0.64rem', letterSpacing: '0.2em', fontWeight: 800, color: s.color === G_GOLD ? GOLD_TEXT : s.color, textTransform: 'uppercase' }}>{s.tag}</span>
                </div>
                <h3 style={{ position: 'relative', zIndex: 2, fontSize: '1.05rem', fontWeight: 800, color: INK, lineHeight: 1.5, margin: '0 0 0.85rem' }}>{s.title}</h3>
                <div style={{ position: 'relative', zIndex: 2, marginBottom: '0.7rem' }}>
                  <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 700, color: 'rgba(0,0,0,0.42)', margin: '0 0 0.3rem' }}>BEFORE</p>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.6)', lineHeight: 1.65, margin: 0 }}>{s.before}</p>
                </div>
                <div aria-hidden style={{ height: 1, background: `linear-gradient(90deg, transparent, ${s.color}66, transparent)`, margin: '0.2rem 0 0.8rem' }} />
                <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
                  <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 800, color: s.color === G_GOLD ? GOLD_TEXT : s.color, margin: '0 0 0.3rem' }}>WITH IRIS</p>
                  <p style={{ fontSize: '0.92rem', color: INK, lineHeight: 1.7, fontWeight: 600, margin: 0 }}>{s.after}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4. 使い方3ステップ ═══════════════════════════════ */}
      <section id="steps" className="lp-section-pad" style={{ padding: sectionPad, background: '#FFFFFF' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color: G_PURPLE, marginBottom: '0.8rem' }}>HOW IT WORKS</p>
            <h2 style={h2Style}>
              やることは、<span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>3つだけ。</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
            {STEPS.map((st, i) => (
              <motion.div key={st.n} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{ position: 'relative', background: 'linear-gradient(180deg, #FBF4FA, #FFFFFF)', border: '1px solid rgba(31,26,46,0.08)', borderRadius: 18, padding: '1.6rem 1.35rem 1.5rem', textAlign: 'center' }}>
                <div style={{
                  width: 54, height: 54, borderRadius: '50%', margin: '0 auto 0.9rem',
                  background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 10px 24px ${G_PINK}45`,
                }}>
                  <st.Icon size={24} color="#fff" strokeWidth={2.2} />
                </div>
                <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '0.85rem', color: GOLD_TEXT, margin: '0 0 0.35rem', fontWeight: 600 }}>STEP {st.n}</p>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: INK, margin: '0 0 0.5rem' }}>{st.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.66)', lineHeight: 1.75, margin: 0 }}>{st.body}</p>
              </motion.div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2.25rem' }}>
            <button onClick={onEnter} style={{ ...ctaBtnHero, fontSize: '0.95rem', padding: '0.9rem 1.85rem' }}>
              いま、1本作ってみる
            </button>
            <p style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.5)', marginTop: '0.8rem' }}>{TRIAL_BASE_DAYS}日間無料 · クレカ不要</p>
          </div>
        </div>
      </section>

      {/* ══ 5. 料金 ══════════════════════════════════════════ */}
      <section id="pricing" className="lp-section-pad" style={{ padding: sectionPad, background: 'linear-gradient(180deg, #FFFFFF 0%, #FBF4FA 100%)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color: G_PINK, marginBottom: '0.8rem' }}>PRICING</p>
            <h2 style={h2Style}>
              まず{TRIAL_BASE_DAYS}日間、<span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>無料でぜんぶ。</span>
            </h2>
            <p style={{ color: 'rgba(0,0,0,0.62)', fontSize: '0.92rem', marginTop: '0.8rem', lineHeight: 1.8 }}>
              クレジットカード登録は不要。気に入ったら、そのとき選べばいい。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
            {PLANS.map((p) => (
              <motion.div key={p.id} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}
                style={{
                  position: 'relative',
                  background: p.highlight ? `linear-gradient(180deg, ${G_PINK}14, #FFFFFF 55%)` : '#FFFFFF',
                  border: p.highlight ? `1.5px solid ${G_PINK}` : '1px solid rgba(31,26,46,0.12)',
                  borderRadius: 20, padding: '1.8rem 1.5rem',
                  boxShadow: p.highlight ? `0 18px 48px ${G_PINK}28` : '0 6px 20px rgba(31,26,46,0.05)',
                }}>
                {p.highlight && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: GRAD, color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '0.3rem 0.9rem', borderRadius: 999, letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>人気</div>
                )}
                <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.85rem', color: GOLD_TEXT, margin: '0 0 0.4rem' }}>— {p.tag}</p>
                <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.7rem', fontWeight: 500, margin: '0 0 0.3rem' }}>{p.name}</h3>
                <p style={{ margin: '0 0 0.4rem' }}>
                  <span style={{ fontSize: '2.1rem', fontWeight: 800 }}>{p.price}</span>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}> {p.suffix}</span>
                </p>
                <div aria-hidden style={{ height: 1, background: 'rgba(31,26,46,0.1)', margin: '0.9rem 0' }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.4rem' }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ fontSize: '0.87rem', color: 'rgba(0,0,0,0.78)', lineHeight: 1.7, marginBottom: '0.45rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <Check size={15} color={G_PINK} strokeWidth={2.6} style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => handlePlan(p.id)} style={{
                  width: '100%',
                  background: p.highlight ? GRAD : 'rgba(31,26,46,0.05)',
                  color: p.highlight ? '#fff' : INK,
                  border: p.highlight ? 'none' : '1px solid rgba(31,26,46,0.18)',
                  padding: '0.95rem 1rem', borderRadius: 12,
                  fontSize: '0.92rem', fontWeight: 800, cursor: 'pointer',
                  boxShadow: p.highlight ? `0 10px 28px ${G_PINK}50` : 'none',
                  letterSpacing: '0.02em',
                }}>
                  {p.name} を{TRIAL_BASE_DAYS}日間 無料でためす
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(0,0,0,0.5)', margin: '0.55rem 0 0' }}>クレカ不要 · いつでも解約</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 6. FAQ ═══════════════════════════════════════════ */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: '#FBF4FA' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color: G_PURPLE, marginBottom: '0.8rem' }}>FAQ</p>
            <h2 style={h2Style}>よくあるご質問</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FAQS.map((f) => <IrisFaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ══ 7. 最終CTA ═══════════════════════════════════════ */}
      <section style={{ padding: '4.5rem 1.25rem 5rem', textAlign: 'center', position: 'relative', overflow: 'hidden', background: '#FFFFFF' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 30% 40%, ${G_PINK}18 0%, transparent 45%), radial-gradient(circle at 70% 60%, ${G_GOLD}16 0%, transparent 45%)` }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.8rem, 4.5vw, 2.9rem)', fontWeight: 500, lineHeight: 1.35, marginBottom: '1.1rem' }}>
            今夜は編集のかわりに、
            <br />
            <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>投稿ボタンを押そう。</span>
          </h2>
          <p style={{ color: 'rgba(0,0,0,0.62)', fontSize: '0.95rem', marginBottom: '1.8rem', lineHeight: 1.85, fontFamily: IRIS_FONTS.serif }}>
            {TRIAL_BASE_DAYS}日間、すべての機能を無料で。カメラロールの素材が、今日リールになる。
          </p>
          <button onClick={onEnter} style={ctaBtnHero}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              無料でためす <ArrowRight size={18} strokeWidth={2.6} />
            </span>
          </button>
        </div>
      </section>

      {/* ── フッタ ── */}
      <footer style={{ background: '#FFFFFF', padding: '3rem 1.25rem 2rem', borderTop: '1px solid rgba(31,26,46,0.1)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          <div>
            <IrisLogo size={28} withWordmark />
            <p style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.5)', marginTop: '0.75rem', lineHeight: 1.7, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
              リールが、誰でも<br />簡単に作れるように。
            </p>
          </div>
          <div>
            <p style={footHead}>PRODUCT</p>
            <a href="#solutions" style={footLink} className="lp-tap-link">できること</a>
            <a href="#pricing" style={footLink} className="lp-tap-link">料金</a>
            <a href="/" style={footLink} className="lp-tap-link">姉妹ブランド · CORE Prism</a>
          </div>
          <div>
            <p style={footHead}>COMPANY</p>
            <a href="mailto:hello@coreprism.app" style={footLink} className="lp-tap-link">お問い合わせ</a>
            <a href="/faq" style={footLink} className="lp-tap-link">よくある質問</a>
            <a href="/iris/terms" style={footLink} className="lp-tap-link">利用規約</a>
            <a href="/iris/privacy" style={footLink} className="lp-tap-link">プライバシー</a>
            <a href="/tokushoho" style={footLink} className="lp-tap-link">特商法表記</a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(31,26,46,0.08)', paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(0,0,0,0.4)' }}>
          © {new Date().getFullYear()} CORE Iris — Reel Studio AI
        </div>
      </footer>

      {/* モバイル調整 */}
      <style>{`
        .iris-sp-br { display: none; }
        @media (max-width: 767px) {
          .iris-hero-grid { grid-template-columns: 1fr !important; gap: 2.25rem !important; }
          .iris-sp-br { display: inline; }
        }
      `}</style>
    </div>
  );
}

// ─── ヒーロー: リールスタジオの実物風モック ─────────────────
// 「素材を入れる → AIが字幕付きリールに → ことばで微調整」を1枚の画で伝える。
function ReelStudioMock() {
  return (
    <div style={{ maxWidth: 340, margin: '0 auto', width: '100%' }}>
      <div style={{
        borderRadius: 30, padding: '14px 14px 16px',
        background: 'linear-gradient(170deg, #241530, #14091E)',
        border: `1px solid ${G_PINK}50`,
        boxShadow: `0 26px 70px rgba(31,26,46,0.35), 0 0 60px ${G_PINK}22`,
      }}>
        {/* ヘッダ行 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Clapperboard size={14} color={G_GOLD} strokeWidth={2.2} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>リールスタジオ</span>
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: G_GOLD, letterSpacing: '0.14em', border: `1px solid ${G_GOLD}55`, borderRadius: 999, padding: '2px 8px' }}>おまかせ中</span>
        </div>
        {/* リールプレビュー */}
        <div style={{
          position: 'relative', borderRadius: 18, overflow: 'hidden', aspectRatio: '9 / 13',
          background: `linear-gradient(160deg, ${G_PURPLE}66 0%, ${G_PINK}59 45%, ${G_GOLD}59 100%)`,
        }}>
          {/* 疑似被写体 (抽象) */}
          <div aria-hidden style={{ position: 'absolute', top: '16%', left: '50%', transform: 'translateX(-50%)', width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.28)', filter: 'blur(2px)' }} />
          <div aria-hidden style={{ position: 'absolute', bottom: '30%', left: '12%', width: 70, height: 70, borderRadius: 16, background: 'rgba(255,255,255,0.18)' }} />
          {/* AI字幕 */}
          <div style={{ position: 'absolute', left: '50%', bottom: '18%', transform: 'translateX(-50%)', width: 'max-content', maxWidth: '86%', background: 'rgba(10,5,16,0.72)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>朝5分でできる、カフェ風ラテ</span>
          </div>
          <div style={{ position: 'absolute', left: '50%', bottom: '9%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.12em', background: 'rgba(10,5,16,0.5)', borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>
            AIが字幕を自動生成
          </div>
          {/* 再生時間 */}
          <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9.5, fontWeight: 700, color: '#fff', background: 'rgba(10,5,16,0.55)', borderRadius: 999, padding: '2px 8px' }}>0:15</div>
        </div>
        {/* 素材サムネ行 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {[G_PURPLE, G_PINK, G_GOLD].map((c, i) => (
            <div key={i} style={{ flex: 1, height: 40, borderRadius: 9, background: `linear-gradient(135deg, ${c}59, ${c}26)`, border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Film size={13} color="rgba(255,255,255,0.75)" strokeWidth={2} />
            </div>
          ))}
          <div style={{ flex: 1, height: 40, borderRadius: 9, border: '1px dashed rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={13} color="rgba(255,255,255,0.6)" strokeWidth={2} />
          </div>
        </div>
        {/* チャット指示 */}
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ alignSelf: 'flex-end', maxWidth: '88%', background: `linear-gradient(135deg, ${G_PINK}, ${G_PURPLE})`, borderRadius: '12px 12px 3px 12px', padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mic size={11} color="rgba(255,255,255,0.85)" strokeWidth={2.2} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.5 }}>暖かい感じで15秒にして</span>
          </div>
          <div style={{ alignSelf: 'flex-start', maxWidth: '92%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px 12px 12px 3px', padding: '7px 11px' }}>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.92)', lineHeight: 1.6 }}>
              <Captions size={10} color={G_GOLD} strokeWidth={2.2} style={{ verticalAlign: -1, marginRight: 4 }} />
              字幕を暖色に、全体を15秒に整えました。投稿文もできています。
            </span>
          </div>
        </div>
      </div>
      <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgba(0,0,0,0.55)', marginTop: '0.8rem', lineHeight: 1.6 }}>
        素材を入れる → AIが字幕・並べ替え・投稿文 → ことばで微調整
      </p>
    </div>
  );
}

function IrisFaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(31,26,46,0.1)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 14px rgba(31,26,46,0.04)' }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: '100%', background: 'transparent', border: 'none', padding: '1.05rem 1.2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        cursor: 'pointer', textAlign: 'left', color: INK, fontSize: '0.93rem', fontWeight: 700,
        fontFamily: IRIS_FONTS.body, minHeight: 44,
      }}>
        <span>{q}</span>
        <span aria-hidden style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: `${G_PINK}18`, color: G_PINK, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 1.2rem 1.05rem', color: 'rgba(0,0,0,0.7)', fontSize: '0.87rem', lineHeight: 1.8 }}>{a}</div>
      )}
    </div>
  );
}

// ─── 共有スタイル ───────────────────────────────────────────
const h2Style: React.CSSProperties = {
  fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
  fontSize: 'clamp(1.65rem, 4vw, 2.6rem)', fontWeight: 500, lineHeight: 1.35,
  margin: 0, color: INK,
};
const navLink: React.CSSProperties = { fontSize: '0.85rem', color: 'rgba(0,0,0,0.72)', textDecoration: 'none', fontWeight: 600 };
const ctaBtnSmall: React.CSSProperties = {
  background: GRAD, color: '#fff', padding: '0.55rem 1.1rem', borderRadius: 10,
  fontSize: '0.85rem', fontWeight: 800, border: 'none', cursor: 'pointer',
  boxShadow: `0 4px 14px ${G_PINK}45`, whiteSpace: 'nowrap',
};
const ctaBtnHero: React.CSSProperties = {
  background: GRAD, color: '#fff', padding: '1.05rem 2.2rem', borderRadius: 14,
  fontSize: '1.02rem', fontWeight: 800, border: 'none', cursor: 'pointer',
  boxShadow: `0 12px 36px ${G_PINK}55`, letterSpacing: '0.02em',
};
const ctaBtnGhost: React.CSSProperties = {
  background: 'rgba(31,26,46,0.05)', color: INK, padding: '1.05rem 1.8rem', borderRadius: 14,
  fontSize: '0.98rem', fontWeight: 700, border: '1px solid rgba(31,26,46,0.16)',
  textDecoration: 'none', display: 'inline-block',
};
const footHead: React.CSSProperties = { fontSize: '0.7rem', letterSpacing: '0.25em', color: GOLD_TEXT, marginBottom: '0.75rem', fontWeight: 800 };
const footLink: React.CSSProperties = { display: 'block', color: 'rgba(0,0,0,0.7)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '0.5rem' };
