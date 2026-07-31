// ============================================================
// CORE Iris — Landing (2026-07-30 黒ベースで全面刷新)
//
// オーナー指示 2026-07-30:
//   「白ベースじゃなくて黒ベースでいい。もっともっと顧客が買いたくなるLPに
//     抜本的に改善してほしい。言葉選びも重要」
//
// 設計:
//   ・夜の暗がり(#0A0610)にオーロラが差す構成。リールの画面そのものが暗いので、
//     LP を黒にすると「作ったものが主役」になる。
//   ・売る順: 痛み → 変化 → 決め手 → 手順 → 価格 → やめるときの安心 → FAQ。
//
// ルール: 絵文字UI禁止 / 375px見切れゼロ / 暗背景の文字は明るい側の色 /
//         実装済みの機能しか書かない
// ============================================================
import { motion } from 'framer-motion';
import {
  Clapperboard, Wand2, MessageSquare, CalendarClock, Check, ArrowRight,
  Sparkles as SparklesIcon, Film, Mic, Captions, LayoutGrid, Upload,
  PenLine, Clock, Repeat, Unlock, Download,
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

// ─── 黒ベースの色設計 ────────────────────────────────────────
const BG_DEEP = '#0A0610';   // 紫みを帯びた漆黒
const BG_SOFT = '#130C1C';   // 一段明るい面
const SURFACE = 'rgba(255,255,255,0.045)';
const SURFACE_HI = 'rgba(255,255,255,0.075)';
const LINE = 'rgba(255,255,255,0.10)';
const TXT = '#F6F0FA';
const TXT_SUB = 'rgba(246,240,250,0.70)';
const TXT_MUTE = 'rgba(246,240,250,0.58)'; // 0.46だと黒地で4.22:1と基準未達だった

const G_GOLD = IRIS_COLORS.gold;       // #FCB045 — 暗背景でそのまま文字に使える明るさ
const G_PINK = IRIS_COLORS.hotPink;    // #E1306C — 面・枠用
const PINK_TXT = '#FF6B9D';            // 暗背景で読めるピンク文字
const G_PURPLE = IRIS_COLORS.purpleLt; // #B07BD9
const GRAD = `linear-gradient(120deg, ${G_GOLD} 0%, ${G_PINK} 50%, ${G_PURPLE} 100%)`;
const sectionPad = '4.75rem 1.25rem';

// ─── 痛み ────────────────────────────────────────────────────
const PAINS: { Icon: LucideIcon; title: string; body: string; color: string }[] = [
  {
    Icon: Film,
    title: '1本に、2時間かかる',
    body: '編集アプリを開いて、字幕を打って、音に合わせて切って。気づけば夜中で、まだ1本も終わっていない。',
    color: G_PINK,
  },
  {
    Icon: Clock,
    title: '撮った素材が、眠ったまま',
    body: 'せっかく撮った動画がカメラロールに溜まっていく。「編集する時間がない」で、今週も投稿ゼロ。',
    color: G_GOLD,
  },
  {
    Icon: PenLine,
    title: '何を出せばいいのか、わからない',
    body: '企画も台本も投稿文も、ぜんぶ自分で考えるのは限界。伸びている人を真似ても、どこが効いているのか見えない。',
    color: G_PURPLE,
  },
];

// ─── 変化 (Before → After) ───────────────────────────────────
const SOLUTIONS: {
  Icon: LucideIcon; tag: string; title: string; before: string; after: string; color: string; textColor: string;
}[] = [
  {
    Icon: Wand2,
    tag: 'おまかせ3タップ',
    title: '素材を入れるだけで、1本できあがる',
    before: '編集アプリとにらめっこで2時間。並び順も字幕も投稿文も、ぜんぶ手作業',
    after: '動画・写真を選ぶだけ。AIが並べ替え・字幕・投稿文まで3タップで仕上げる',
    color: G_PINK, textColor: PINK_TXT,
  },
  {
    Icon: MessageSquare,
    tag: 'ことばで編集',
    title: '「暖かい感じで15秒にして」で、直る',
    before: 'タイムラインをつまんで伸ばして、色味を1つずつ調整。修正のたびにやり直し',
    after: 'チャットや音声でひとこと言うだけ。AIが字幕・長さ・雰囲気を整え直す',
    color: G_GOLD, textColor: G_GOLD,
  },
  {
    Icon: LayoutGrid,
    tag: 'こだわり編集',
    title: 'こだわりたい日は、とことん',
    before: '凝った編集はPCの専用ソフト頼み。テロップのデザインだけで日が暮れる',
    after: 'ドラッグで並べ替え、カラー6種・繋ぎ5種・字幕3スタイル・16テーマから選ぶだけ',
    color: G_PURPLE, textColor: G_PURPLE,
  },
  {
    Icon: CalendarClock,
    tag: '企画・台本 → 予約投稿',
    title: '「何を作るか」から「投稿」まで',
    before: '企画を考え、台本を書き、投稿時間にスマホを握りしめて待機',
    after: 'AIが企画・台本を提案。できたリールは予約投稿で、決めた時間に自動で出る',
    color: G_PINK, textColor: PINK_TXT,
  },
];

// ─── 決め手 (他の編集アプリと何が違うか) ─────────────────────
const EDGES: { Icon: LucideIcon; head: string; body: string; color: string }[] = [
  {
    Icon: Repeat,
    head: '「作れない」ではなく、「続かない」を解く',
    body: '編集アプリはもう十分あります。足りていないのは、来週も再来週も出し続けられる速さのほう。1本が3タップで終わるから、週3本が現実になります。',
    color: PINK_TXT,
  },
  {
    Icon: Mic,
    head: 'タイムラインを、もう触らない',
    body: '「もっと短く」「明るい感じで」。声か文字でひとこと伝えるだけで直ります。編集ソフトの操作を覚える時間が、まるごと要らなくなります。',
    color: G_GOLD,
  },
  {
    Icon: Clapperboard,
    head: '企画から投稿まで、これ1つ',
    body: '企画・台本・字幕・投稿文・ハッシュタグ・予約投稿。バラバラのアプリを行き来していた工程が、ひとつの画面で終わります。',
    color: G_PURPLE,
  },
];

// ─── 使い方3ステップ ───────────────────────────────────────
const STEPS: { Icon: LucideIcon; n: string; title: string; body: string }[] = [
  { Icon: Upload, n: '1', title: '素材を入れる', body: '撮った動画や写真を選ぶだけ。撮り直しも台本も、なくていい。' },
  { Icon: Wand2, n: '2', title: 'AIにおまかせ', body: '並べ替え・字幕・投稿文をAIが自動で。直したければ「もっと明るく」とひとこと。' },
  { Icon: CalendarClock, n: '3', title: '予約して、投稿', body: '仕上がったら日時を選んで予約。あとはIrisが投稿まで見届ける。' },
];

// ─── やめるときの安心 ────────────────────────────────────────
const SAFETY: { Icon: LucideIcon; head: string; body: string }[] = [
  { Icon: Unlock, head: 'クレジットカードは、はじめに要りません', body: `${TRIAL_BASE_DAYS}日間の無料体験はカード登録なしで始まります。体験が終わっても、請求は発生しません。` },
  { Icon: Check, head: '解約は1タップ。引き止めはしません', body: '電話も、理由の入力も、面談もありません。画面の中で完結します。' },
  { Icon: Download, head: '作ったリールは、ぜんぶあなたのもの', body: '書き出した動画・字幕・投稿文の権利はあなたに残ります。商用利用にも制限はありません。' },
];

// ─── 料金 ───────────────────────────────────────────────────
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
    q: 'いま使っている編集アプリは、やめないといけませんか？',
    a: 'いいえ。書き出した動画は普通のファイルなので、これまでのアプリで仕上げ直すこともできます。Iris は「速く1本出す」ところだけを引き受けます。',
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
  //
  // 2026-07-27 修正: ここは onEnter() を呼んでいたが、未契約の人に対して
  //   onEnter は料金プランの画面を開く。つまり「架空データで体験」と書いてある
  //   ボタンを押すと、体験ではなく申し込み画面が出ていた (375px 実測で確認)。
  //   デモを入れたあとは読み込み直して入る (いま入れた架空データを確実に拾うため)。
  const handleSampleEnter = () => {
    try {
      clearDemoData();
      seedDemoData({ profile: 'creator' });
      setDemoActive(true);
      window.location.assign('/iris');
      return;
    } catch { /* 保存できなかった時だけ、これまでどおりの入口に戻す */ }
    onEnter();
  };

  return (
    <div style={{ background: BG_DEEP, color: TXT, fontFamily: IRIS_FONTS.body, minHeight: '100dvh', overflowX: 'hidden' }}>
      {/* ── 告知バー (黒地に金の細線。1行で収める) ── */}
      <div style={{
        background: '#060309', color: 'rgba(255,255,255,0.92)', textAlign: 'center',
        padding: '0.5rem 1rem', fontSize: '0.74rem', fontWeight: 600,
        letterSpacing: '0.04em', lineHeight: 1.5,
        borderBottom: `1px solid ${G_GOLD}44`,
        position: 'relative', zIndex: 60,
      }}>
        <span style={{ whiteSpace: 'nowrap', color: G_GOLD, fontWeight: 800 }}>{TRIAL_BASE_DAYS}日間 完全無料</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{' / '}</span>
        <span style={{ whiteSpace: 'nowrap' }}>クレカ登録不要</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{' / '}</span>
        <span style={{ whiteSpace: 'nowrap' }}>招待で +{REFERRAL_BONUS_DAYS}日</span>
      </div>

      {/* ── ヘッダ ── */}
      <header className="lp-safe" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,6,16,0.82)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${LINE}`,
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
      <section className="lp-hero-pad lp-safe" style={{ position: 'relative', padding: '4.25rem 1.25rem 4rem', overflow: 'hidden', background: BG_DEEP }}>
        {/* オーロラ背景 — 黒の上でだけ成立する発色 */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -150, right: -110, width: 440, height: 440, borderRadius: '50%', background: G_PINK, opacity: 0.22, filter: 'blur(110px)' }} />
          <div style={{ position: 'absolute', top: 180, left: -170, width: 420, height: 420, borderRadius: '50%', background: G_GOLD, opacity: 0.16, filter: 'blur(110px)' }} />
          <div style={{ position: 'absolute', bottom: -140, right: '18%', width: 390, height: 390, borderRadius: '50%', background: G_PURPLE, opacity: 0.18, filter: 'blur(110px)' }} />
        </div>

        <div className="iris-hero-grid" style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '3rem', alignItems: 'center' }}>
          {/* 左: コピー + CTA */}
          <div>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              style={{ fontSize: '0.68rem', letterSpacing: '0.4em', fontWeight: 700, marginBottom: '1.2rem', color: G_GOLD }}>
              CORE IRIS — REEL STUDIO AI
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1 }}
              style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(2.15rem, 5.6vw, 4.3rem)', fontWeight: 500, lineHeight: 1.16, letterSpacing: '-0.01em', marginBottom: '1.25rem', color: TXT }}>
              編集で夜をつぶすのは、
              <br />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>今日でおしまい。</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.28 }}
              style={{ fontFamily: IRIS_FONTS.serif, fontSize: 'clamp(1rem, 1.7vw, 1.2rem)', color: TXT_SUB, lineHeight: 1.9, marginBottom: '1.9rem', maxWidth: 545 }}>
              カメラロールの素材を入れるだけ。<strong style={{ color: TXT, fontWeight: 700 }}>並べ替え・字幕・投稿文</strong>まで、AIが仕上げます。
              直したいところは<strong style={{ color: PINK_TXT, fontWeight: 700 }}>「暖かい感じで15秒にして」</strong>のひとことで。
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.42 }}
              style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={onEnter} style={ctaBtnHero}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  {TRIAL_BASE_DAYS}日間 無料ではじめる <ArrowRight size={18} strokeWidth={2.6} />
                </span>
              </button>
              <a href="#pricing" style={ctaBtnGhost}>料金を見る</a>
            </motion.div>
            <p style={{ fontSize: '0.8rem', color: TXT_MUTE, marginTop: '1rem', lineHeight: 1.7 }}>
              クレジットカード登録なし · 解約は1タップ · 作ったリールはあなたのもの
            </p>
            <button type="button" onClick={handleSampleEnter} style={{
              marginTop: '0.85rem', background: 'transparent', color: 'rgba(246,240,250,0.88)',
              border: `1px dashed ${G_GOLD}90`, borderRadius: 10, padding: '0.6rem 1rem',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontFamily: IRIS_FONTS.body, minHeight: 44,
            }}>
              <SparklesIcon size={14} color={G_GOLD} />
              <span>登録せずに、中を見る</span>
              <span style={{ fontSize: '0.7rem', color: TXT_MUTE }}>(架空データで体験)</span>
            </button>
          </div>

          {/* 右: リールスタジオ実物モック */}
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}>
            <ReelStudioMock />
          </motion.div>
        </div>
      </section>

      {/* ══ 2. 痛み ══════════════════════════════════════════ */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={eyebrow(PINK_TXT)}>SOUND FAMILIAR?</p>
            <h2 style={h2Style}>
              リール、こんなふうに<br className="iris-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>止まっていませんか。</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
            {PAINS.map((p, i) => (
              <motion.div key={p.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{ position: 'relative', background: SURFACE, border: `1px solid ${p.color}3A`, borderRadius: 18, padding: '1.55rem 1.35rem', overflow: 'hidden' }}>
                <div aria-hidden style={{ position: 'absolute', top: -60, right: -60, width: 170, height: 170, borderRadius: '50%', background: p.color, opacity: 0.18, filter: 'blur(60px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${p.color}26`, border: `1px solid ${p.color}5C`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.9rem',
                  }}>
                    <p.Icon size={21} color={p.color === G_PINK ? PINK_TXT : p.color} strokeWidth={2.1} />
                  </div>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 800, marginBottom: '0.55rem', color: TXT, lineHeight: 1.5 }}>{p.title}</h3>
                  <p style={{ fontSize: '0.89rem', color: TXT_SUB, lineHeight: 1.8, margin: 0 }}>{p.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '2.4rem', fontFamily: IRIS_FONTS.serif, fontSize: 'clamp(1.02rem, 2vw, 1.22rem)', color: TXT, lineHeight: 1.9 }}>
            その全部を、<span style={{ color: PINK_TXT }}>Iris が引き受けます。</span>
          </p>
        </div>
      </section>

      {/* ══ 3. 変化 (Before → After) ═════════════════════════ */}
      <section id="solutions" className="lp-section-pad" style={{ padding: sectionPad, background: BG_DEEP }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={eyebrow(G_GOLD)}>WHAT CHANGES</p>
            <h2 style={h2Style}>
              素材を入れてから、<br className="iris-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>投稿されるまで。</span>
            </h2>
            <p style={leadStyle}>
              「編集」だけではありません。企画から投稿まで、リールづくりの全工程がここで終わります。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
            {SOLUTIONS.map((s, i) => (
              <motion.div key={s.tag} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.07 }}
                style={{ position: 'relative', background: SURFACE, border: `1px solid ${s.color}3A`, borderRadius: 20, padding: '1.55rem 1.35rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div aria-hidden style={{ position: 'absolute', top: -70, right: -70, width: 190, height: 190, borderRadius: '50%', background: s.color, opacity: 0.16, filter: 'blur(65px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}26`, border: `1px solid ${s.color}5C`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <s.Icon size={18} color={s.textColor} strokeWidth={2.2} />
                  </div>
                  <span style={{ fontSize: '0.64rem', letterSpacing: '0.2em', fontWeight: 800, color: s.textColor, textTransform: 'uppercase' }}>{s.tag}</span>
                </div>
                <h3 style={{ position: 'relative', zIndex: 2, fontSize: '1.06rem', fontWeight: 800, color: TXT, lineHeight: 1.55, margin: '0 0 0.95rem' }}>{s.title}</h3>
                <div style={{ position: 'relative', zIndex: 2, marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 700, color: TXT_MUTE, margin: '0 0 0.32rem' }}>いま</p>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(246,240,250,0.55)', lineHeight: 1.7, margin: 0 }}>{s.before}</p>
                </div>
                <div aria-hidden style={{ height: 1, background: `linear-gradient(90deg, transparent, ${s.color}88, transparent)`, margin: '0.25rem 0 0.85rem' }} />
                <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
                  <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 800, color: s.textColor, margin: '0 0 0.32rem' }}>IRIS なら</p>
                  <p style={{ fontSize: '0.93rem', color: TXT, lineHeight: 1.75, fontWeight: 600, margin: 0 }}>{s.after}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4. 決め手 ════════════════════════════════════════ */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={eyebrow(G_PURPLE)}>WHY IRIS</p>
            <h2 style={h2Style}>
              編集アプリは、<br className="iris-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>もう足りています。</span>
            </h2>
            <p style={leadStyle}>
              それでも投稿が止まるのは、腕の問題ではありません。埋まっていなかったのは、この3つでした。
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {EDGES.map((e, i) => (
              <motion.div key={e.head} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{ display: 'flex', gap: '1.05rem', alignItems: 'flex-start', background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: '1.45rem 1.35rem' }}>
                <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, background: `${e.color}22`, border: `1px solid ${e.color}5C`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <e.Icon size={22} color={e.color} strokeWidth={2.1} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.06rem', fontWeight: 800, color: TXT, margin: '0 0 0.45rem', lineHeight: 1.5 }}>{e.head}</h3>
                  <p style={{ fontSize: '0.89rem', color: TXT_SUB, lineHeight: 1.85, margin: 0 }}>{e.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. 使い方3ステップ ═══════════════════════════════ */}
      <section id="steps" className="lp-section-pad" style={{ padding: sectionPad, background: BG_DEEP }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={eyebrow(G_PURPLE)}>HOW IT WORKS</p>
            <h2 style={h2Style}>
              やることは、<span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>3つだけ。</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
            {STEPS.map((st, i) => (
              <motion.div key={st.n} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{ position: 'relative', background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: '1.7rem 1.35rem 1.55rem', textAlign: 'center' }}>
                <div style={{
                  width: 54, height: 54, borderRadius: '50%', margin: '0 auto 0.95rem',
                  background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 10px 30px ${G_PINK}55`,
                }}>
                  <st.Icon size={24} color="#fff" strokeWidth={2.2} />
                </div>
                <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '0.88rem', color: G_GOLD, margin: '0 0 0.4rem', fontWeight: 600 }}>STEP {st.n}</p>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: TXT, margin: '0 0 0.5rem' }}>{st.title}</h3>
                <p style={{ fontSize: '0.86rem', color: TXT_SUB, lineHeight: 1.8, margin: 0 }}>{st.body}</p>
              </motion.div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2.4rem' }}>
            <button onClick={onEnter} style={{ ...ctaBtnHero, fontSize: '0.96rem', padding: '0.95rem 1.9rem' }}>
              いま、1本つくってみる
            </button>
            <p style={{ fontSize: '0.76rem', color: TXT_MUTE, marginTop: '0.85rem' }}>{TRIAL_BASE_DAYS}日間無料 · クレカ不要</p>
          </div>
        </div>
      </section>

      {/* ══ 6. 料金 ══════════════════════════════════════════ */}
      <section id="pricing" className="lp-section-pad" style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.6rem' }}>
            <p style={eyebrow(PINK_TXT)}>PRICING</p>
            <h2 style={h2Style}>
              まず{TRIAL_BASE_DAYS}日間、<span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>無料でぜんぶ。</span>
            </h2>
            <p style={leadStyle}>
              クレジットカードの登録はいりません。気に入ったら、そのとき選べば大丈夫です。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
            {PLANS.map((p) => (
              <motion.div key={p.id} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}
                style={{
                  position: 'relative',
                  background: p.highlight ? SURFACE_HI : SURFACE,
                  border: p.highlight ? `1.5px solid ${G_PINK}` : `1px solid ${LINE}`,
                  borderRadius: 20, padding: '1.9rem 1.5rem 1.7rem',
                  boxShadow: p.highlight ? `0 22px 60px ${G_PINK}33` : 'none',
                }}>
                {p.highlight && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: GRAD, color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '0.32rem 0.95rem', borderRadius: 999, letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>人気</div>
                )}
                <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.85rem', color: G_GOLD, margin: '0 0 0.4rem' }}>— {p.tag}</p>
                <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.7rem', fontWeight: 500, margin: '0 0 0.3rem', color: TXT }}>{p.name}</h3>
                <p style={{ margin: '0 0 0.4rem' }}>
                  <span style={{ fontSize: '2.15rem', fontWeight: 800, color: TXT }}>{p.price}</span>
                  <span style={{ fontSize: '0.85rem', color: TXT_MUTE, fontWeight: 500 }}> {p.suffix}</span>
                </p>
                <div aria-hidden style={{ height: 1, background: LINE, margin: '0.95rem 0' }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem' }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ fontSize: '0.875rem', color: TXT_SUB, lineHeight: 1.7, marginBottom: '0.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <Check size={15} color={PINK_TXT} strokeWidth={2.6} style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => handlePlan(p.id)} style={{
                  width: '100%',
                  background: p.highlight ? GRAD : 'rgba(255,255,255,0.07)',
                  color: '#fff',
                  border: p.highlight ? 'none' : `1px solid ${LINE}`,
                  padding: '1rem', borderRadius: 12,
                  fontSize: '0.92rem', fontWeight: 800, cursor: 'pointer',
                  boxShadow: p.highlight ? `0 12px 32px ${G_PINK}55` : 'none',
                  letterSpacing: '0.02em', minHeight: 44,
                }}>
                  {p.name} を{TRIAL_BASE_DAYS}日間 無料でためす
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.71rem', color: TXT_MUTE, margin: '0.6rem 0 0' }}>クレカ不要 · いつでも解約</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 7. やめるときの安心 ══════════════════════════════ */}
      <section className="lp-section-pad" style={{ padding: '3.75rem 1.25rem', background: BG_DEEP, borderTop: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <p style={eyebrow(G_GOLD)}>NO LOCK-IN</p>
            <h2 style={{ ...h2Style, fontSize: 'clamp(1.5rem, 3.4vw, 2.2rem)' }}>
              やめるときの心配も、<span style={{ color: G_GOLD }}>先に消しておきました。</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: '1rem' }}>
            {SAFETY.map((s) => (
              <div key={s.head} style={{ background: SURFACE, border: `1px solid ${G_GOLD}2E`, borderRadius: 16, padding: '1.3rem 1.25rem' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${G_GOLD}1F`, border: `1px solid ${G_GOLD}4D`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.8rem' }}>
                  <s.Icon size={18} color={G_GOLD} strokeWidth={2.2} />
                </div>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: TXT, margin: '0 0 0.45rem', lineHeight: 1.55 }}>{s.head}</h3>
                <p style={{ fontSize: '0.86rem', color: TXT_SUB, lineHeight: 1.8, margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 8. FAQ ═══════════════════════════════════════════ */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={eyebrow(G_PURPLE)}>FAQ</p>
            <h2 style={h2Style}>よくあるご質問</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FAQS.map((f) => <IrisFaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ══ 9. 最終CTA ═══════════════════════════════════════ */}
      <section style={{ padding: '5rem 1.25rem 5.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden', background: BG_DEEP, borderTop: `1px solid ${LINE}` }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 28% 38%, ${G_PINK}2E 0%, transparent 48%), radial-gradient(circle at 72% 62%, ${G_GOLD}26 0%, transparent 48%)` }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.9rem, 4.6vw, 3rem)', fontWeight: 500, lineHeight: 1.32, marginBottom: '1.15rem', color: TXT }}>
            今夜は編集のかわりに、
            <br />
            <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>投稿ボタンを押そう。</span>
          </h2>
          <p style={{ color: TXT_SUB, fontSize: '0.98rem', marginBottom: '1.9rem', lineHeight: 1.9, fontFamily: IRIS_FONTS.serif }}>
            {TRIAL_BASE_DAYS}日間、すべての機能を無料で。<br className="iris-sp-br" />
            カメラロールに眠っている素材が、今日リールになります。
          </p>
          <button onClick={onEnter} style={ctaBtnHero}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              {TRIAL_BASE_DAYS}日間 無料ではじめる <ArrowRight size={18} strokeWidth={2.6} />
            </span>
          </button>
          <p style={{ fontSize: '0.78rem', color: TXT_MUTE, marginTop: '1rem' }}>
            クレジットカード登録なし · 解約は1タップ
          </p>
        </div>
      </section>

      {/* ── フッタ ── */}
      <footer style={{ background: '#060309', padding: '3rem 1.25rem 2rem', borderTop: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          <div>
            <IrisLogo size={28} withWordmark />
            <p style={{ fontSize: '0.8rem', color: TXT_MUTE, marginTop: '0.75rem', lineHeight: 1.7, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
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
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: TXT_MUTE }}>
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
        background: 'linear-gradient(170deg, #241530, #120720)',
        border: `1px solid ${G_PINK}66`,
        boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 70px ${G_PINK}2E`,
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
      <p style={{ textAlign: 'center', fontSize: '0.72rem', color: TXT_MUTE, marginTop: '0.8rem', lineHeight: 1.6 }}>
        素材を入れる → AIが字幕・並べ替え・投稿文 → ことばで微調整
      </p>
    </div>
  );
}

function IrisFaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: '100%', background: 'transparent', border: 'none', padding: '1.05rem 1.2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        cursor: 'pointer', textAlign: 'left', color: TXT, fontSize: '0.93rem', fontWeight: 700,
        fontFamily: IRIS_FONTS.body, minHeight: 44,
      }}>
        <span>{q}</span>
        <span aria-hidden style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: `${G_PINK}2E`, color: PINK_TXT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 1.2rem 1.05rem', color: TXT_SUB, fontSize: '0.87rem', lineHeight: 1.85 }}>{a}</div>
      )}
    </div>
  );
}

// ─── 共有スタイル ───────────────────────────────────────────
const h2Style: React.CSSProperties = {
  fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
  fontSize: 'clamp(1.7rem, 4vw, 2.65rem)', fontWeight: 500, lineHeight: 1.35,
  margin: 0, color: TXT,
};
const leadStyle: React.CSSProperties = {
  color: TXT_SUB, maxWidth: 640, margin: '0.95rem auto 0', fontSize: '0.95rem',
  lineHeight: 1.9, fontFamily: IRIS_FONTS.serif,
};
const eyebrow = (color: string): React.CSSProperties => ({
  fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color, marginBottom: '0.85rem',
});
const navLink: React.CSSProperties = { fontSize: '0.85rem', color: 'rgba(246,240,250,0.72)', textDecoration: 'none', fontWeight: 600 };
const ctaBtnSmall: React.CSSProperties = {
  background: GRAD, color: '#fff', padding: '0.6rem 1.1rem', borderRadius: 10,
  fontSize: '0.85rem', fontWeight: 800, border: 'none', cursor: 'pointer',
  boxShadow: `0 4px 16px ${G_PINK}55`, whiteSpace: 'nowrap',
};
const ctaBtnHero: React.CSSProperties = {
  background: GRAD, color: '#fff', padding: '1.05rem 2.1rem', borderRadius: 14,
  fontSize: '1.02rem', fontWeight: 800, border: 'none', cursor: 'pointer',
  boxShadow: `0 14px 40px ${G_PINK}66`, letterSpacing: '0.02em', minHeight: 44,
};
const ctaBtnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)', color: TXT, padding: '1.05rem 1.8rem', borderRadius: 14,
  fontSize: '0.98rem', fontWeight: 700, border: `1px solid ${LINE}`,
  textDecoration: 'none', display: 'inline-block',
};
const footHead: React.CSSProperties = { fontSize: '0.7rem', letterSpacing: '0.25em', color: G_GOLD, marginBottom: '0.75rem', fontWeight: 800 };
const footLink: React.CSSProperties = { display: 'block', color: 'rgba(246,240,250,0.7)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '0.5rem' };
