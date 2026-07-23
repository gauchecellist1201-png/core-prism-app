// ============================================================
// CORE Prism — 公開ランディングページ (2026-07-24 全面再作成)
// ポジション: 「経営まるごとおまかせのAI参謀」
// 骨格: ヒーロー(課題言い当て+実物モック+CTA) → 課題あるある3 →
//       できること4(Before/After) → 使い方3ステップ → 料金 → FAQ → 最終CTA
// ルール: 絵文字UI禁止 / 375px見切れゼロ / コントラスト遵守 / 数字の嘘禁止
// ============================================================
import { motion } from 'framer-motion';
import { PrismLogo } from './Logo';
import { useMasterTap } from '../lib/masterTap';
import {
  Camera, MessageSquare, Users, FileText, Check, ArrowRight,
  Sparkles as SparklesIcon, Gift, Receipt, LayoutDashboard, Send,
  Moon, HelpCircle, BookOpen, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { REFERRAL_BONUS_DAYS, TRIAL_BASE_DAYS, TRIAL_WITH_REFERRAL_DAYS, getPendingReferralInviter, getPendingReferralMessage } from '../lib/referral';
import { seedDemoData, setDemoActive } from '../lib/onboarding';

interface Props {
  onEnterApp: () => void;
  onOpenLegal: (kind: 'terms' | 'privacy' | 'tokushou') => void;
}

const INK = '#16162A';
const A_PURPLE = '#7C5CFA'; // 白背景で読める紫 (4.5:1付近の濃さはテキスト用に#6D28D9を使う)
const T_PURPLE = '#6D28D9'; // テキスト用の濃い紫
const A_BLUE = '#3B82F6';
const T_BLUE = '#1D4ED8';
const A_PINK = '#EC4899';
const T_PINK = '#BE185D';
const A_GREEN = '#22C55E';
const T_GREEN = '#15803D';
const A_AMBER = '#F59E0B';
const T_AMBER = '#B45309';
const GRAD = `linear-gradient(120deg, ${A_BLUE} 0%, ${A_PURPLE} 50%, ${A_PINK} 100%)`;
const sectionPad = '4.5rem 1.25rem';

// ─── 課題あるある ───────────────────────────────────────────
const PAINS: { Icon: LucideIcon; title: string; body: string; color: string; textColor: string }[] = [
  {
    Icon: Moon,
    title: '事務作業に、時間が溶ける',
    body: '請求書、帳簿、メール返信…。本業が終わった夜に「もうひとつの仕事」が始まって、1日が終わる。',
    color: A_PURPLE, textColor: T_PURPLE,
  },
  {
    Icon: HelpCircle,
    title: '数字が、よくわからない',
    body: '「今月いくら残るのか」が、いつも税理士待ち。売上・経費・利益が見えないまま、なんとなく不安。',
    color: A_BLUE, textColor: T_BLUE,
  },
  {
    Icon: Users,
    title: '人を雇う余裕は、ない',
    body: '経理も営業も広報も、ぜんぶ自分。手伝ってほしいけど、人件費を払える売上ではまだない。',
    color: A_PINK, textColor: T_PINK,
  },
];

// ─── できること (Before → After) ─────────────────────────────
const SOLUTIONS: {
  Icon: LucideIcon; tag: string; title: string; before: string; after: string; color: string; textColor: string;
}[] = [
  {
    Icon: LayoutDashboard,
    tag: '経営の数字が1画面',
    title: '売上・経費・請求書・決算書を、開いた瞬間に',
    before: '売上はExcel、経費はレシートの山、請求書は別アプリ。全体像は月末までわからない',
    after: '売上・経費・請求書・決算書が1画面に。「今月いくら残るか」が、いつでも見える',
    color: A_BLUE, textColor: T_BLUE,
  },
  {
    Icon: Camera,
    tag: 'レシート撮るだけ帳簿',
    title: '撮影1回で、記帳が終わる',
    before: '日付・店名・金額・科目を1枚ずつ手入力。溜めた月末に半日かかる',
    after: 'レシートを撮るだけ。AIが日付・店舗・科目まで読み取って帳簿に載せる',
    color: A_GREEN, textColor: T_GREEN,
  },
  {
    Icon: MessageSquare,
    tag: 'チャットで指令',
    title: '「Prism、請求書開いて」で実行される',
    before: 'メニューを探し、画面を行き来し、やり方を思い出すところから始まる',
    after: '話しかけるだけ。請求書作成もSNS・メールの下書きも、AIがその場で実行',
    color: A_PURPLE, textColor: T_PURPLE,
  },
  {
    Icon: Users,
    tag: '13名のAI役員',
    title: '営業も財務も広報も、専門AIが参謀に',
    before: '判断も相談もぜんぶひとり。壁打ち相手がいない',
    after: 'CFO・CMOなど13名のAI役員に相談。人格ごとの指示書とナレッジで、あなたの事業を覚えて動く',
    color: A_PINK, textColor: T_PINK,
  },
];

// ─── 使い方3ステップ ─────────────────────────────────────────
const STEPS: { Icon: LucideIcon; n: string; title: string; body: string }[] = [
  { Icon: SparklesIcon, n: '1', title: '無料ではじめる', body: '登録は1分。クレジットカードはいりません。サンプルデータで先に触ることもできます。' },
  { Icon: Camera, n: '2', title: '撮る・話しかける', body: 'レシートを撮る。「請求書開いて」と話しかける。それだけで数字が集まりはじめます。' },
  { Icon: Send, n: '3', title: 'AI役員が実行', body: '帳簿づけ、請求書、メールやSNSの下書きまで。あなたは確認して、承認するだけ。' },
];

// ─── 料金 (明快な2プラン) ────────────────────────────────────
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tag: '個人事業・ひとり社長',
    price: '¥2,980',
    features: ['売上・経費・請求書・決算書 1画面', 'レシート撮るだけ帳簿', 'チャット指令 (音声つき)', 'SNS・メール下書きAI'],
    highlight: true,
  },
  {
    id: 'standard',
    name: 'Standard',
    tag: 'もっと任せたい人に',
    price: '¥9,800',
    features: ['Starter の全機能', '13名のAI役員 フル解放', '人格ごと指示書 + ナレッジ学習', '見積→請求の一気通貫', '優先サポート'],
  },
];

// ─── FAQ ─────────────────────────────────────────────────────
const FAQS: { q: string; a: string }[] = [
  {
    q: 'AIの知識やAPIキーの設定は必要ですか？',
    a: '不要です。AIはすべて内蔵されているので、登録した瞬間から使えます。設定画面と格闘する時間はありません。',
  },
  {
    q: '簿記や経理の知識がなくても使えますか？',
    a: 'はい。レシートを撮れば科目までAIが判断します。わからないことは「これって経費になる？」とチャットで聞けば、AI役員が答えます。',
  },
  {
    q: 'スマホだけで使えますか？',
    a: '使えます。スマホのブラウザでそのまま動き、ホーム画面に追加すればアプリのように使えます。PCでも同じデータが開けます。',
  },
  {
    q: '無料体験のあと、勝手に課金されませんか？',
    a: `されません。無料体験（${TRIAL_BASE_DAYS}日間）はクレジットカード登録なしで始まります。体験が終わっても請求は発生せず、続けたい場合にだけプランを選びます。`,
  },
];

export default function LandingPage({ onEnterApp }: Props) {
  const tapMaster = useMasterTap();
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [pendingInviter, setPendingInviter] = useState<string>('');
  const [pendingMsg, setPendingMsg] = useState<string>('');
  useEffect(() => {
    try { setPendingRef(sessionStorage.getItem('pending_ref')); } catch { /* */ }
    setPendingInviter(getPendingReferralInviter());
    setPendingMsg(getPendingReferralMessage());
  }, []);

  // 「サンプルで触ってみる」: 実物品質のデモデータを投入してから入室
  const handleSampleEnter = () => {
    try {
      seedDemoData();
      setDemoActive(true);
    } catch { /* quota — そのまま入室 */ }
    onEnterApp();
  };

  return (
    <div style={{ background: '#FFFFFF', color: INK, minHeight: '100dvh', fontFamily: '"Inter","游ゴシック","Hiragino Kaku Gothic ProN",sans-serif', overflowX: 'hidden' }}>
      {/* ── 紹介リンク経由バナー (?ref=XXX 検出時のみ) ── */}
      {pendingRef && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'linear-gradient(90deg, #16A34A, #22C55E, #84CC16)',
            color: '#fff', textAlign: 'center', padding: '0.85rem 1rem',
            fontSize: '0.92rem', fontWeight: 800, letterSpacing: '0.02em',
            position: 'sticky', top: 0, zIndex: 70,
            boxShadow: '0 4px 18px rgba(22,163,74,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.55rem', flexWrap: 'wrap',
          }}
          data-testid="referral-welcome-banner"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Gift size={19} strokeWidth={2.2} /></span>
          <span>
            {pendingInviter ? (
              <><strong style={{ background: 'rgba(0,0,0,0.22)', padding: '0.1rem 0.55rem', borderRadius: 8 }}>{pendingInviter} さん</strong>からの招待で </>
            ) : (
              <>友達からの招待で </>
            )}
            <strong style={{ background: 'rgba(0,0,0,0.22)', padding: '0.1rem 0.55rem', borderRadius: 8, letterSpacing: '0.06em' }}>+{REFERRAL_BONUS_DAYS} 日</strong> プレゼント中。
            通常 {TRIAL_BASE_DAYS} 日 → <strong>合計 {TRIAL_WITH_REFERRAL_DAYS} 日</strong> 無料でお試しできます
          </span>
          <button
            onClick={onEnterApp}
            style={{
              background: '#fff', color: '#16A34A', border: 'none', borderRadius: 999,
              padding: '0.32rem 0.95rem', fontSize: '0.82rem', fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
            }}
          >
            登録して受け取る →
          </button>
          {pendingMsg && (
            <p data-testid="referral-inviter-message" style={{ flexBasis: '100%', margin: '0.15rem 0 0', textAlign: 'center', fontSize: '0.84rem', fontWeight: 600, fontStyle: 'italic', color: 'rgba(0,0,0,0.96)', lineHeight: 1.5 }}>
              <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: '0.3rem' }}><MessageSquare size={15} strokeWidth={2.2} /></span>「{pendingMsg}」{pendingInviter ? ` — ${pendingInviter} さん` : ''}
            </p>
          )}
        </motion.div>
      )}

      {/* ── 告知バー ── */}
      <div style={{
        background: GRAD, color: '#fff', textAlign: 'center', padding: '0.5rem 1rem',
        fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.6,
        position: 'relative', zIndex: 60,
      }}>
        <span style={{ whiteSpace: 'nowrap' }}>{TRIAL_BASE_DAYS}日間 完全無料</span>{' · '}
        <span style={{ whiteSpace: 'nowrap' }}>クレカ登録不要</span>{' · '}
        <span style={{ whiteSpace: 'nowrap' }}>招待リンクでお互い +{REFERRAL_BONUS_DAYS}日</span>
      </div>

      {/* ── ヘッダ ── */}
      <header className="lp-safe" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          {/* ロゴ5回タップ = オーナー専用の隠しマスターログイン */}
          <span onClick={tapMaster} style={{ cursor: 'default', display: 'inline-flex' }}>
            <PrismLogo size={28} withWordmark />
          </span>
          <nav style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
            <a href="#solutions" style={navLink} className="lp-nav-link">できること</a>
            <a href="#steps" style={navLink} className="lp-nav-link">使い方</a>
            <a href="#pricing" style={navLink} className="lp-nav-link">料金</a>
            <a href="#faq" style={navLink} className="lp-nav-link">FAQ</a>
            <button onClick={onEnterApp} style={ctaBtnSmall}>無料でためす</button>
          </nav>
        </div>
      </header>

      {/* ══ 1. ヒーロー ══════════════════════════════════════ */}
      <section className="lp-hero-pad lp-safe" style={{ position: 'relative', padding: '4.5rem 1.25rem 4rem', overflow: 'hidden' }}>
        {/* プリズム光背景 */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -140, right: -120, width: 430, height: 430, borderRadius: '50%', background: A_PURPLE, opacity: 0.12, filter: 'blur(90px)' }} />
          <div style={{ position: 'absolute', top: 180, left: -160, width: 400, height: 400, borderRadius: '50%', background: A_BLUE, opacity: 0.12, filter: 'blur(90px)' }} />
          <div style={{ position: 'absolute', bottom: -140, right: '22%', width: 380, height: 380, borderRadius: '50%', background: A_PINK, opacity: 0.1, filter: 'blur(90px)' }} />
        </div>

        <div className="lp-hero-grid" style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '3rem', alignItems: 'center' }}>
          {/* 左: コピー + CTA */}
          <div className="lp-hero-copy">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, marginBottom: '1.2rem', background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CORE PRISM — AI CHIEF OF STAFF
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1 }}
              style={{ fontSize: 'clamp(2.05rem, 5vw, 4rem)', fontWeight: 900, lineHeight: 1.22, letterSpacing: '-0.02em', marginBottom: '1.2rem' }}>
              夜の事務作業は、
              <br />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AIの役員たち</span>に。
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.28 }}
              style={{ fontSize: 'clamp(1rem, 1.6vw, 1.18rem)', color: 'rgba(0,0,0,0.75)', lineHeight: 1.9, marginBottom: '1.8rem', maxWidth: 540 }}>
              売上・経費・請求書・決算書を<strong style={{ color: INK }}>1画面</strong>に。
              レシートは<strong style={{ color: T_GREEN }}>撮るだけ</strong>、指示は
              <strong style={{ color: T_PURPLE }}>「Prism、請求書開いて」</strong>のひとこと。
              経営まるごとおまかせのAI参謀です。
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.42 }}
              style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={onEnterApp} style={ctaBtnHero} className="lp-hero-cta-primary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  無料でためす <ArrowRight size={18} strokeWidth={2.6} />
                </span>
              </button>
              <a href="#pricing" style={ctaBtnGhost} className="lp-hero-cta-secondary">料金を見る</a>
            </motion.div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.55)', marginTop: '1rem', lineHeight: 1.6 }}>
              {TRIAL_BASE_DAYS}日間ぜんぶ無料 · クレカ登録不要 · 解約は1タップ
            </p>
            <button type="button" onClick={handleSampleEnter} style={{
              marginTop: '0.8rem', background: 'transparent', color: 'rgba(0,0,0,0.82)',
              border: `1px dashed ${A_PURPLE}80`, borderRadius: 10, padding: '0.55rem 1rem',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <SparklesIcon size={14} color={T_PURPLE} />
              <span>サンプルで触ってみる</span>
              <span style={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.55)' }}>(架空の会社データで体験)</span>
            </button>
          </div>

          {/* 右: 経営ダッシュボード実物風モック */}
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }} className="lp-hero-mock">
            <PrismDashboardMock />
          </motion.div>
        </div>
      </section>

      {/* ══ 2. 課題ブロック ══════════════════════════════════ */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: 'linear-gradient(180deg, #FFFFFF 0%, #F3F2FB 100%)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color: T_PURPLE, marginBottom: '0.8rem' }}>SOUND FAMILIAR?</p>
            <h2 style={h2Style}>
              ひとりの経営、<br className="prism-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>こうなっていませんか。</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
            {PAINS.map((p, i) => (
              <motion.div key={p.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{ position: 'relative', background: '#FFFFFF', border: `1px solid ${p.color}30`, borderRadius: 18, padding: '1.5rem 1.35rem', overflow: 'hidden', boxShadow: '0 8px 28px rgba(22,22,42,0.06)' }}>
                <div aria-hidden style={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: p.color, opacity: 0.13, filter: 'blur(50px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)`, boxShadow: `0 6px 16px ${p.color}50`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.85rem' }}>
                    <p.Icon size={22} color="#fff" strokeWidth={2.2} />
                  </div>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 800, marginBottom: '0.5rem', color: INK }}>{p.title}</h3>
                  <p style={{ fontSize: '0.88rem', color: 'rgba(0,0,0,0.68)', lineHeight: 1.75, margin: 0 }}>{p.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '2.25rem', fontSize: 'clamp(1rem, 2vw, 1.15rem)', color: 'rgba(22,22,42,0.82)', lineHeight: 1.9, fontWeight: 600 }}>
            その「もうひとつの仕事」を、Prismがぜんぶ引き受けます。
          </p>
        </div>
      </section>

      {/* ══ 3. 解決ブロック (Before → After) ═════════════════ */}
      <section id="solutions" className="lp-section-pad" style={{ padding: sectionPad, background: '#F3F2FB' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color: T_BLUE, marginBottom: '0.8rem' }}>WHAT PRISM DOES</p>
            <h2 style={h2Style}>
              数字も、書類も、下書きも。<br className="prism-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ぜんぶここで終わる。</span>
            </h2>
            <p style={{ color: 'rgba(0,0,0,0.62)', maxWidth: 640, margin: '0.9rem auto 0', fontSize: '0.95rem', lineHeight: 1.85 }}>
              経理ソフトでも、チャットAIでもない。あなたの会社を覚えて動く「AIの経営チーム」。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
            {SOLUTIONS.map((s, i) => (
              <motion.div key={s.tag} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.07 }}
                style={{ position: 'relative', background: '#FFFFFF', border: `1px solid ${s.color}30`, borderRadius: 20, padding: '1.5rem 1.35rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 32px rgba(22,22,42,0.07)' }}>
                <div aria-hidden style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', background: s.color, opacity: 0.12, filter: 'blur(55px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`, boxShadow: `0 6px 14px ${s.color}50`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <s.Icon size={19} color="#fff" strokeWidth={2.3} />
                  </div>
                  <span style={{ fontSize: '0.64rem', letterSpacing: '0.18em', fontWeight: 800, color: s.textColor, textTransform: 'uppercase' }}>{s.tag}</span>
                </div>
                <h3 style={{ position: 'relative', zIndex: 2, fontSize: '1.05rem', fontWeight: 800, color: INK, lineHeight: 1.5, margin: '0 0 0.85rem' }}>{s.title}</h3>
                <div style={{ position: 'relative', zIndex: 2, marginBottom: '0.7rem' }}>
                  <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 700, color: 'rgba(0,0,0,0.42)', margin: '0 0 0.3rem' }}>BEFORE</p>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.6)', lineHeight: 1.65, margin: 0 }}>{s.before}</p>
                </div>
                <div aria-hidden style={{ height: 1, background: `linear-gradient(90deg, transparent, ${s.color}66, transparent)`, margin: '0.2rem 0 0.8rem' }} />
                <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
                  <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 800, color: s.textColor, margin: '0 0 0.3rem' }}>WITH PRISM</p>
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
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color: T_AMBER, marginBottom: '0.8rem' }}>HOW IT WORKS</p>
            <h2 style={h2Style}>
              はじめ方は、<span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>3ステップ。</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
            {STEPS.map((st, i) => (
              <motion.div key={st.n} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{ background: 'linear-gradient(180deg, #F3F2FB, #FFFFFF)', border: '1px solid rgba(22,22,42,0.08)', borderRadius: 18, padding: '1.6rem 1.35rem 1.5rem', textAlign: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', margin: '0 auto 0.9rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 24px ${A_PURPLE}45` }}>
                  <st.Icon size={24} color="#fff" strokeWidth={2.2} />
                </div>
                <p style={{ fontSize: '0.75rem', color: T_PURPLE, margin: '0 0 0.35rem', fontWeight: 800, letterSpacing: '0.18em' }}>STEP {st.n}</p>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: INK, margin: '0 0 0.5rem' }}>{st.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.66)', lineHeight: 1.75, margin: 0 }}>{st.body}</p>
              </motion.div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2.25rem' }}>
            <button onClick={onEnterApp} style={{ ...ctaBtnHero, fontSize: '0.95rem', padding: '0.9rem 1.85rem' }}>
              いま、無料ではじめる
            </button>
            <p style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.5)', marginTop: '0.8rem' }}>{TRIAL_BASE_DAYS}日間無料 · クレカ不要</p>
          </div>
        </div>
      </section>

      {/* ══ 5. 料金 ══════════════════════════════════════════ */}
      <section id="pricing" className="lp-section-pad" style={{ padding: sectionPad, background: 'linear-gradient(180deg, #FFFFFF 0%, #F3F2FB 100%)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color: T_PINK, marginBottom: '0.8rem' }}>PRICING</p>
            <h2 style={h2Style}>
              まず{TRIAL_BASE_DAYS}日間、<span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>無料でぜんぶ。</span>
            </h2>
            <p style={{ color: 'rgba(0,0,0,0.62)', fontSize: '0.92rem', marginTop: '0.8rem', lineHeight: 1.8 }}>
              クレジットカード登録は不要。人を1人雇うより、はるかに軽い月額で。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
            {PLANS.map((p) => (
              <motion.div key={p.id} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}
                style={{
                  position: 'relative',
                  background: p.highlight ? `linear-gradient(180deg, ${A_PURPLE}14, #FFFFFF 55%)` : '#FFFFFF',
                  border: p.highlight ? `1.5px solid ${A_PURPLE}` : '1px solid rgba(22,22,42,0.12)',
                  borderRadius: 20, padding: '1.8rem 1.5rem',
                  boxShadow: p.highlight ? `0 18px 48px ${A_PURPLE}28` : '0 6px 20px rgba(22,22,42,0.05)',
                }}>
                {p.highlight && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: GRAD, color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '0.3rem 0.9rem', borderRadius: 999, letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>人気</div>
                )}
                <p style={{ fontSize: '0.78rem', color: T_PURPLE, margin: '0 0 0.4rem', fontWeight: 700 }}>— {p.tag}</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.3rem' }}>{p.name}</h3>
                <p style={{ margin: '0 0 0.4rem' }}>
                  <span style={{ fontSize: '2.1rem', fontWeight: 800 }}>{p.price}</span>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}> / 月</span>
                </p>
                <div aria-hidden style={{ height: 1, background: 'rgba(22,22,42,0.1)', margin: '0.9rem 0' }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.4rem' }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ fontSize: '0.87rem', color: 'rgba(0,0,0,0.78)', lineHeight: 1.7, marginBottom: '0.45rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <Check size={15} color={A_PURPLE} strokeWidth={2.6} style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={onEnterApp} style={{
                  width: '100%',
                  background: p.highlight ? GRAD : 'rgba(22,22,42,0.05)',
                  color: p.highlight ? '#fff' : INK,
                  border: p.highlight ? 'none' : '1px solid rgba(22,22,42,0.18)',
                  padding: '0.95rem 1rem', borderRadius: 12,
                  fontSize: '0.92rem', fontWeight: 800, cursor: 'pointer',
                  boxShadow: p.highlight ? `0 10px 28px ${A_PURPLE}50` : 'none',
                  letterSpacing: '0.02em',
                }}>
                  {p.name} を{TRIAL_BASE_DAYS}日間 無料でためす
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(0,0,0,0.5)', margin: '0.55rem 0 0' }}>クレカ不要 · いつでも解約</p>
              </motion.div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(0,0,0,0.5)', marginTop: '1.5rem' }}>年払いで2ヶ月分割引 · 法人・チームは別途お問い合わせください</p>
        </div>
      </section>

      {/* ══ 6. FAQ ═══════════════════════════════════════════ */}
      <section id="faq" className="lp-section-pad" style={{ padding: sectionPad, background: '#F3F2FB' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color: T_GREEN, marginBottom: '0.8rem' }}>FAQ</p>
            <h2 style={h2Style}>よくあるご質問</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FAQS.map((f) => <FaqItem key={f.q} question={f.q} answer={f.a} />)}
          </div>
        </div>
      </section>

      {/* ══ 7. 最終CTA ═══════════════════════════════════════ */}
      <section style={{ padding: '4.5rem 1.25rem 5rem', textAlign: 'center', position: 'relative', overflow: 'hidden', background: '#FFFFFF' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 30% 40%, ${A_PURPLE}18 0%, transparent 45%), radial-gradient(circle at 70% 60%, ${A_BLUE}16 0%, transparent 45%)` }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4.5vw, 2.9rem)', fontWeight: 900, lineHeight: 1.35, marginBottom: '1.1rem' }}>
            今夜の事務作業を、
            <br />
            <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>最後の夜にしよう。</span>
          </h2>
          <p style={{ color: 'rgba(0,0,0,0.62)', fontSize: '0.95rem', marginBottom: '1.8rem', lineHeight: 1.85 }}>
            {TRIAL_BASE_DAYS}日間、すべての機能を無料で。AI役員たちは、今日から出社できます。
          </p>
          <button onClick={onEnterApp} style={ctaBtnHero}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              無料でためす <ArrowRight size={18} strokeWidth={2.6} />
            </span>
          </button>
        </div>
      </section>

      {/* ── フッタ ── */}
      <footer id="contact" style={{ background: '#FFFFFF', padding: '3rem 1.25rem 2rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          <div>
            <PrismLogo size={28} withWordmark />
            <p style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.5)', marginTop: '0.75rem', lineHeight: 1.7 }}>
              経営まるごとおまかせの<br />AI参謀。
            </p>
          </div>
          <div>
            <p style={footHead}>PRODUCT</p>
            <a href="#solutions" style={footLink} className="lp-tap-link">できること</a>
            <a href="#pricing" style={footLink} className="lp-tap-link">料金</a>
            <a href="/iris" style={footLink} className="lp-tap-link">姉妹ブランド · CORE Iris</a>
          </div>
          <div>
            <p style={footHead}>COMPANY</p>
            <a href="/faq" style={footLink} className="lp-tap-link">よくある質問</a>
            <a href="/terms" style={footLink} className="lp-tap-link">利用規約</a>
            <a href="/privacy" style={footLink} className="lp-tap-link">プライバシー</a>
            <a href="/tokushoho" style={footLink} className="lp-tap-link">特商法表記</a>
          </div>
          <div>
            <p style={footHead}>CONTACT</p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.55)', lineHeight: 1.7 }}>
              お気軽にどうぞ。<br />
              <a href="mailto:hello@coreprism.app" style={{ color: T_PURPLE, textDecoration: 'none', display: 'inline-block', padding: '0.65rem 0.25rem', margin: '-0.35rem -0.25rem' }}>hello@coreprism.app</a>
            </p>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(0,0,0,0.4)' }}>
          © {new Date().getFullYear()} CORE Prism — AI Chief of Staff
        </div>
      </footer>

      {/* モバイル調整 */}
      <style>{`
        .prism-sp-br { display: none; }
        @media (max-width: 767px) {
          .prism-sp-br { display: inline; }
        }
      `}</style>
    </div>
  );
}

// ─── ヒーロー: 経営ダッシュボード実物風モック ─────────────────
// 「1画面に数字が集まる + チャット指令で実行」を1枚の画で伝える。
// 数字は「サンプル」表記つき (数字の嘘禁止)。
function PrismDashboardMock() {
  const metrics = [
    { Icon: Wallet, label: '今月の売上', value: '¥812,400', color: A_BLUE, textColor: T_BLUE },
    { Icon: Receipt, label: '経費', value: '¥238,900', color: A_GREEN, textColor: T_GREEN },
    { Icon: FileText, label: '未回収の請求書', value: '2件', color: A_AMBER, textColor: T_AMBER },
    { Icon: BookOpen, label: '決算書', value: '自動更新', color: A_PINK, textColor: T_PINK },
  ];
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', width: '100%' }}>
      <div style={{
        borderRadius: 22, padding: '16px 16px 18px',
        background: 'linear-gradient(170deg, #1B1B33, #101022)',
        border: `1px solid ${A_PURPLE}55`,
        boxShadow: `0 26px 70px rgba(22,22,42,0.4), 0 0 60px ${A_PURPLE}22`,
      }}>
        {/* ウィンドウバー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5757' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>coreprism.app · サンプル</span>
        </div>
        {/* 数字グリッド */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {metrics.map((m) => (
            <div key={m.label} style={{ borderRadius: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <m.Icon size={11} color={m.color} strokeWidth={2.2} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.06em' }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
            </div>
          ))}
        </div>
        {/* チャット指令 */}
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ alignSelf: 'flex-end', maxWidth: '86%', background: GRAD, borderRadius: '12px 12px 3px 12px', padding: '7px 12px' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', lineHeight: 1.5 }}>Prism、今月の請求書ぜんぶ送って</span>
          </div>
          <div style={{ alignSelf: 'flex-start', maxWidth: '92%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px 12px 12px 3px', padding: '7px 12px' }}>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.92)', lineHeight: 1.6 }}>
              <Check size={10} color="#4ade80" strokeWidth={2.6} style={{ verticalAlign: -1, marginRight: 4 }} />
              請求書3件の下書きができました。確認して承認すると送信します。
            </span>
          </div>
        </div>
        {/* AI役員行 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, overflow: 'hidden' }}>
          {[
            { label: 'CFO 財務', color: A_BLUE },
            { label: 'CMO 広報', color: A_PINK },
            { label: 'CSO 営業', color: A_AMBER },
            { label: '+10名', color: A_PURPLE },
          ].map((c) => (
            <span key={c.label} style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: '#fff', background: `${c.color}33`, border: `1px solid ${c.color}66`, borderRadius: 999, padding: '3px 9px', letterSpacing: '0.04em' }}>{c.label}</span>
          ))}
        </div>
      </div>
      <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgba(0,0,0,0.55)', marginTop: '0.8rem', lineHeight: 1.6 }}>
        数字は1画面 → 指示はチャット → 実行はAI役員 (画面はサンプル)
      </p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(22,22,42,0.1)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 14px rgba(22,22,42,0.04)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', background: 'transparent', border: 'none', padding: '1.05rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', color: INK, fontSize: '0.93rem', fontWeight: 700, gap: '1rem', minHeight: 44 }}
      >
        <span>{question}</span>
        <span aria-hidden style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: `${A_PURPLE}18`, color: T_PURPLE, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 1.2rem 1.05rem', color: 'rgba(0,0,0,0.7)', fontSize: '0.87rem', lineHeight: 1.8 }}>{answer}</div>
      )}
    </div>
  );
}

// ─── 共有スタイル ───────────────────────────────────────────
const h2Style: React.CSSProperties = {
  fontSize: 'clamp(1.65rem, 4vw, 2.6rem)', fontWeight: 800, lineHeight: 1.35, margin: 0, color: INK,
};
const navLink: React.CSSProperties = { fontSize: '0.85rem', color: 'rgba(0,0,0,0.72)', textDecoration: 'none', fontWeight: 600 };
const ctaBtnSmall: React.CSSProperties = {
  background: GRAD, color: '#fff', padding: '0.55rem 1.1rem', borderRadius: 10,
  fontSize: '0.85rem', fontWeight: 800, border: 'none', cursor: 'pointer',
  boxShadow: `0 4px 14px ${A_PURPLE}45`, whiteSpace: 'nowrap',
};
const ctaBtnHero: React.CSSProperties = {
  background: GRAD, color: '#fff', padding: '1.05rem 2.2rem', borderRadius: 14,
  fontSize: '1.02rem', fontWeight: 800, border: 'none', cursor: 'pointer',
  boxShadow: `0 12px 36px ${A_PURPLE}55`, letterSpacing: '0.02em',
};
const ctaBtnGhost: React.CSSProperties = {
  background: 'rgba(22,22,42,0.05)', color: INK, padding: '1.05rem 1.8rem', borderRadius: 14,
  fontSize: '0.98rem', fontWeight: 700, border: '1px solid rgba(22,22,42,0.16)',
  textDecoration: 'none', display: 'inline-block',
};
const footHead: React.CSSProperties = { fontSize: '0.7rem', letterSpacing: '0.22em', color: 'rgba(0,0,0,0.5)', marginBottom: '0.75rem', fontWeight: 800 };
const footLink: React.CSSProperties = { display: 'block', color: 'rgba(0,0,0,0.7)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '0.5rem' };
