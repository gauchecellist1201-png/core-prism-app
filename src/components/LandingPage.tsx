// ============================================================
// CORE Prism — 公開ランディングページ (2026-07-30 黒ベースで全面刷新)
//
// オーナー指示 2026-07-30:
//   「白ベースじゃなくて黒ベースでいい。もっともっと顧客が買いたくなるLPに
//     抜本的に改善してほしい。言葉選びも重要」
//
// 設計:
//   ・漆黒(#07070C)の上にプリズムの光が差す構成。CORE の"格"を落とさず、
//     売る力（痛み→変化→証拠→リスク除去→価格）を通す。
//   ・煽らない。断定と具体で買わせる。誇張した統計は書かない（数字の嘘禁止）。
//
// 骨格: ヒーロー → 痛み3 → 変化4(Before/After) → 決め手3(競合との違い) →
//       3ステップ → 全機能 → 料金 → やめるときの安心 → FAQ → 最終CTA
//
// ルール: 絵文字UI禁止 / 375px見切れゼロ / 暗背景の文字は明るい側の色を使う /
//         実装済みの機能しか書かない
// ============================================================
import { motion } from 'framer-motion';
import { PrismLogo } from './Logo';
import { useMasterTap } from '../lib/masterTap';
import {
  Camera, MessageSquare, Users, FileText, Check, ArrowRight,
  Sparkles as SparklesIcon, Gift, Receipt, LayoutDashboard, Send,
  Moon, HelpCircle, BookOpen, Wallet, Brain, Zap, Download, Unlock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { REFERRAL_BONUS_DAYS, TRIAL_BASE_DAYS, TRIAL_WITH_REFERRAL_DAYS, getPendingReferral, getPendingReferralInviter, getPendingReferralMessage } from '../lib/referral';
import { seedDemoData, setDemoActive } from '../lib/onboarding';
import { whiteSafeGradient } from '../lib/accentFace';

// ─── 黒ベースの色設計 ────────────────────────────────────────
// 暗背景では「濃い色」は読めない。文字と枠には必ず明るい側(400番台)を使う。
const BG_DEEP = '#07070C';   // 最深部（ヒーロー・最終CTA）
const BG_SOFT = '#0D0D16';   // 一段明るい面（交互に敷いて単調さを消す）
const SURFACE = 'rgba(255,255,255,0.045)';       // カードの面
const SURFACE_HI = 'rgba(255,255,255,0.075)';    // 強調カードの面
const LINE = 'rgba(255,255,255,0.10)';           // 枠線
const TXT = '#F4F2FF';                            // 主文字
const TXT_SUB = 'rgba(244,242,255,0.70)';        // 副文字
const TXT_MUTE = 'rgba(244,242,255,0.58)';       // 注記 (0.46だと黒地で4.26:1と基準未達だった)

const A_PURPLE = '#A78BFA';
const A_BLUE = '#60A5FA';
const A_PINK = '#F472B6';
const A_GREEN = '#4ADE80';
const A_AMBER = '#FBBF24';
const GOLD = '#C9A24B'; // CORE 共通の格

// 文字を「グラデで塗る」用（暗い地の上に明るい色が乗る＝そのままで読める）
const GRAD = `linear-gradient(120deg, ${A_BLUE} 0%, ${A_PURPLE} 50%, ${A_PINK} 100%)`;
// 「面」にして白文字を乗せる用。この3色は白に対して 青2.54 / 紫2.72 / 桃2.65 ＝
// LPの主CTA（無料でためす・3日間 無料ではじめる・いま、無料ではじめる・
// Starter を3日間 無料でためす）の文字が全部読めていなかった（2026-08-08 実測）。
// 色相・彩度は変えず明るさだけ落とす＝青→紫→桃の流れは保ったまま白が 4.6 通る。
// 停止位置(0%/50%/100%)は温存＝見た目の配分は不変。
const GRAD_FACE = whiteSafeGradient([`${A_BLUE} 0%`, `${A_PURPLE} 50%`, `${A_PINK} 100%`], 120);
const sectionPad = '4.75rem 1.25rem';

// ─── 全機能カタログ ──────────────────────────────────────────
// 実装済みの機能だけを載せる — 存在しない機能を書くのは嘘なので禁止。
const ALL_FEATURES: { group: string; items: string[] }[] = [
  {
    group: 'AIの経営チーム',
    items: [
      '7人の参謀AI (経営・営業・財務・創造・学び・人材・生活)',
      '13名のAI役員 (CXO) に仕事を依頼 → 承認して納品',
      '今日の最優先を毎朝1つ提案 (実データが根拠)',
      '人格 (ペルソナ) を複数作って事業ごとに切替',
      '人格ごとの指示書 + 口調の学習',
      'プロダクト横断 — 人格をまたいで1つの商品を扱う',
    ],
  },
  {
    group: '経理・お金',
    items: [
      '売上・経費・請求書・決算書 (P/L・B/S) を1画面で',
      'レシートを撮るだけで帳簿に (OCR)',
      '見積 → 請求の一気通貫',
      'Stripe 連携で売上を自動反映',
      '数字を CSV / 全データを JSON で持ち出し (ロックインなし)',
      '5年後のキャリア・お金のシミュレーション',
    ],
  },
  {
    group: '営業・顧客',
    items: [
      'CRM (営業先・案件・進捗の管理)',
      '営業文・提案書の下書きAI',
      '交渉コーチ (値付け・断り方の相談)',
      '競合スカウト (同業の動きを定点観測)',
      '会議の録音 → AI議事録・要約',
      'ミーティング予約リンクの発行',
    ],
  },
  {
    group: 'SNS・発信',
    items: [
      'X / Threads のバイラル投稿スタジオ (分析→生成→投稿)',
      'Instagram 運用 (Iris): 分析・戦略・リール台本・返信',
      '画像スタジオ (バナー・アイキャッチ生成)',
      'スライド・資料の自動生成',
      'メールの下書き・仕分けAI',
    ],
  },
  {
    group: 'つながる (連携)',
    items: [
      'Google カレンダー連携 — AIが予定を読んで準備ブリーフ・空き時間の一手・衝突警告を自動提案',
      'Gmail インサイト (受信の要点を抽出)',
      'LINE通知 — AI役員の納品やタスク完了が公式LINEに届く',
      'Apple Watch・心拍計との健康データ連携',
      '資料・PDF・議事録を放り込むナレッジ (AIの記憶)',
      '会話やメモから自動でアクション分解 → チェックリスト化',
    ],
  },
  {
    group: '毎日の使いやすさ',
    items: [
      '音声でタスク予約 (「明日9時に◯◯して」)',
      '横断検索 (⌘K) — 全機能・全データを一度で',
      'スマホ対応PWA — ホーム画面に追加してアプリとして使える',
      'ライト / ダークモード',
      '健康の記録 (体調・睡眠) と経営数字の突き合わせ',
    ],
  },
];

// ─── 痛み ────────────────────────────────────────────────────
const PAINS: { Icon: LucideIcon; title: string; body: string; color: string }[] = [
  {
    Icon: Moon,
    title: '本業が終わってから、仕事が始まる',
    body: '請求書、帳簿、メールの返信。みんなが眠っている時間に、ひとりで机に向かう。それが毎晩、当たり前になっている。',
    color: A_PURPLE,
  },
  {
    Icon: HelpCircle,
    title: '「今月いくら残るのか」が、わからない',
    body: '売上はここ、経費はレシートの山、利益は税理士待ち。数字が見えないまま、なんとなく不安なまま月末が来る。',
    color: A_BLUE,
  },
  {
    Icon: Users,
    title: '手伝ってほしい。でも、雇えない',
    body: '経理も営業も広報も、ぜんぶ自分。人がいれば回るとわかっている。けれど、給与を出せる売上にはまだ届かない。',
    color: A_PINK,
  },
];

// ─── 変化 (Before → After) ───────────────────────────────────
const SOLUTIONS: {
  Icon: LucideIcon; tag: string; title: string; before: string; after: string; color: string;
}[] = [
  {
    Icon: LayoutDashboard,
    tag: '経営の数字が1画面',
    title: '「今月いくら残るか」を、開いた瞬間に',
    before: '売上はExcel、経費はレシートの山、請求書は別アプリ。全体像は月末までわからない',
    after: '売上・経費・請求書・決算書が1画面に。知りたいときに、いつでも見える',
    color: A_BLUE,
  },
  {
    Icon: Camera,
    tag: 'レシート撮るだけ帳簿',
    title: '撮影1回で、記帳が終わる',
    before: '日付・店名・金額・科目を1枚ずつ手入力。溜めた月末に半日かかる',
    after: 'レシートを撮るだけ。AIが日付・店舗・科目まで読み取って帳簿に載せる',
    color: A_GREEN,
  },
  {
    Icon: MessageSquare,
    tag: '話しかけるだけ',
    title: '「Prism、請求書開いて」で、実行される',
    before: 'メニューを探し、画面を行き来し、やり方を思い出すところから始まる',
    after: '話しかけるだけ。請求書作成もSNS・メールの下書きも、AIがその場で実行する',
    color: A_PURPLE,
  },
  {
    Icon: Users,
    tag: '13名のAI役員',
    title: '営業も財務も広報も、専門のAIが引き受ける',
    before: '判断も相談もぜんぶひとり。壁打ちの相手がいない',
    after: 'CFO・CMOなど13名のAI役員に相談。指示書とナレッジで、あなたの事業を覚えて動く',
    color: A_PINK,
  },
];

// ─── 決め手 (他と何が違うか) ─────────────────────────────────
const EDGES: { Icon: LucideIcon; head: string; body: string; color: string }[] = [
  {
    Icon: Brain,
    head: 'あなたの会社を、覚えている',
    body: '資料もPDFも議事録も放り込むだけ。人格ごとの指示書とナレッジに残り、次からは前提の説明が要らなくなります。毎回ゼロから話すチャットAIとは、そこが違う。',
    color: A_PURPLE,
  },
  {
    Icon: Zap,
    head: '答えるだけでなく、実行する',
    body: '請求書をつくる。下書きを書く。予定を読んで準備する。会話で終わらせず、実際の作業まで進めます。あなたは確認して、承認するだけ。',
    color: A_BLUE,
  },
  {
    Icon: Wallet,
    head: '人を1人雇うより、はるかに軽い',
    body: `経理ソフト、チャットAI、SNSツール、CRM。別々に契約していたものが、月 ¥2,980 からのひとつに収まります。`,
    color: A_AMBER,
  },
];

// ─── 使い方3ステップ ─────────────────────────────────────────
const STEPS: { Icon: LucideIcon; n: string; title: string; body: string }[] = [
  { Icon: SparklesIcon, n: '1', title: '無料ではじめる', body: '登録は1分。クレジットカードはいりません。サンプルデータで先に触ることもできます。' },
  { Icon: Camera, n: '2', title: '撮る・話しかける', body: 'レシートを撮る。「請求書開いて」と話しかける。それだけで数字が集まりはじめます。' },
  { Icon: Send, n: '3', title: 'AI役員が実行する', body: '帳簿づけ、請求書、メールやSNSの下書きまで。あなたは確認して、承認するだけ。' },
];

// ─── やめるときの安心 (リスク除去) ───────────────────────────
const SAFETY: { Icon: LucideIcon; head: string; body: string }[] = [
  { Icon: Unlock, head: 'クレジットカードは、はじめに要りません', body: `${TRIAL_BASE_DAYS}日間の無料体験はカード登録なしで始まります。体験が終わっても、請求は発生しません。` },
  { Icon: Check, head: '解約は1タップ。引き止めはしません', body: '電話も、理由の入力も、面談もありません。画面の中で完結します。' },
  { Icon: Download, head: 'データは、いつでも全部持ち出せます', body: '数字は CSV、全データは JSON で書き出せます。合わなければ、抱えたまま出ていけます。' },
];

// ─── 料金 ────────────────────────────────────────────────────
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
    q: 'いま使っている会計ソフトは、やめないといけませんか？',
    a: 'いいえ。数字は CSV で書き出せるので、いまの体制を残したまま並行して試せます。合わなければ、そのまま元に戻せます。',
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
    // sessionStorage を直接読むと、リンクを踏んだ日にそのまま登録しなかった人
    // (LINE のアプリ内ブラウザで開いて閉じた人) の招待バナーが翌日から消えていた。
    // getPendingReferral() は 30 日ぶんの控えから復元する。
    setPendingRef(getPendingReferral());
    setPendingInviter(getPendingReferralInviter());
    setPendingMsg(getPendingReferralMessage());
  }, []);

  // 「サンプルで触ってみる」: 実物品質のデモデータを投入してから入室
  //
  // 2026-07-27 修正: ここは onEnterApp() を呼んでいたが、未契約の人に対して
  //   onEnterApp は料金プランの画面を開く。つまり「架空の会社データで体験」と
  //   書いてあるボタンを押すと、体験ではなく申し込み画面が出ていた（本番で実測）。
  //   デモを入れたあとは、そのまま読み込み直して中に入る。
  const handleSampleEnter = () => {
    try {
      seedDemoData();
      setDemoActive(true);
      window.location.assign('/');
      return;
    } catch { /* 保存できなかった時だけ、これまでどおりの入口に戻す */ }
    onEnterApp();
  };

  return (
    <div style={{ background: BG_DEEP, color: TXT, minHeight: '100dvh', fontFamily: '"Inter","游ゴシック","Hiragino Kaku Gothic ProN",sans-serif', overflowX: 'hidden' }}>
      {/* ── 紹介リンク経由バナー (?ref=XXX 検出時のみ) ── */}
      {pendingRef && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'linear-gradient(90deg, #15803D, #22C55E, #65A30D)',
            color: '#fff', textAlign: 'center', padding: '0.85rem 1rem',
            fontSize: '0.92rem', fontWeight: 800, letterSpacing: '0.02em',
            position: 'sticky', top: 0, zIndex: 70,
            boxShadow: '0 4px 18px rgba(34,197,94,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.55rem', flexWrap: 'wrap',
          }}
          data-testid="referral-welcome-banner"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Gift size={19} strokeWidth={2.2} /></span>
          <span>
            {pendingInviter ? (
              <><strong style={{ background: 'rgba(0,0,0,0.28)', padding: '0.1rem 0.55rem', borderRadius: 8 }}>{pendingInviter} さん</strong>からの招待で </>
            ) : (
              <>友達からの招待で </>
            )}
            <strong style={{ background: 'rgba(0,0,0,0.28)', padding: '0.1rem 0.55rem', borderRadius: 8, letterSpacing: '0.06em' }}>+{REFERRAL_BONUS_DAYS} 日</strong> プレゼント中。
            通常 {TRIAL_BASE_DAYS} 日 → <strong>合計 {TRIAL_WITH_REFERRAL_DAYS} 日</strong> 無料でお試しできます
          </span>
          <button
            onClick={onEnterApp}
            style={{
              background: '#fff', color: '#15803D', border: 'none', borderRadius: 999,
              padding: '0.32rem 0.95rem', fontSize: '0.82rem', fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', whiteSpace: 'nowrap',
            }}
          >
            登録して受け取る →
          </button>
          {pendingMsg && (
            <p data-testid="referral-inviter-message" style={{ flexBasis: '100%', margin: '0.15rem 0 0', textAlign: 'center', fontSize: '0.84rem', fontWeight: 600, fontStyle: 'italic', color: 'rgba(255,255,255,0.96)', lineHeight: 1.5 }}>
              <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: '0.3rem' }}><MessageSquare size={15} strokeWidth={2.2} /></span>「{pendingMsg}」{pendingInviter ? ` — ${pendingInviter} さん` : ''}
            </p>
          )}
        </motion.div>
      )}

      {/* ── 告知バー (黒地に金の細線。1行で収める) ── */}
      <div style={{
        background: '#050509', color: 'rgba(255,255,255,0.92)', textAlign: 'center',
        padding: '0.5rem 1rem', fontSize: '0.74rem', fontWeight: 600,
        letterSpacing: '0.04em', lineHeight: 1.5,
        borderBottom: `1px solid ${GOLD}44`,
        position: 'relative', zIndex: 60,
      }}>
        <span style={{ whiteSpace: 'nowrap', color: GOLD, fontWeight: 800 }}>{TRIAL_BASE_DAYS}日間 完全無料</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{' / '}</span>
        <span style={{ whiteSpace: 'nowrap' }}>クレカ登録不要</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{' / '}</span>
        <span style={{ whiteSpace: 'nowrap' }}>解約は1タップ</span>
      </div>

      {/* ── ヘッダ ── */}
      <header className="lp-safe" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(7,7,12,0.82)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${LINE}` }}>
        {/* lp-header-row: 画面右上に固定表示される PublicThemeToggle(44px・z-70)が
            「無料でためす」に被らないよう、1200px以下では右側に逃げ場を空ける
            (2026-08-29・BACKLOG「338px²覆う」の根治。1200px超はmaxWidth+auto余白で
            自然にクリアされるためこのCSSは効かない=見た目は変えていない)。 */}
        <div className="lp-header-row" style={{ maxWidth: 1200, margin: '0 auto', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
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
      <section className="lp-hero-pad lp-safe" style={{ position: 'relative', padding: '4.25rem 1.25rem 4rem', overflow: 'hidden', background: BG_DEEP }}>
        {/* プリズム光背景 — 黒の上でだけ成立する、静かな分光 */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -150, right: -110, width: 440, height: 440, borderRadius: '50%', background: A_PURPLE, opacity: 0.20, filter: 'blur(110px)' }} />
          <div style={{ position: 'absolute', top: 200, left: -170, width: 420, height: 420, borderRadius: '50%', background: A_BLUE, opacity: 0.16, filter: 'blur(110px)' }} />
          <div style={{ position: 'absolute', bottom: -160, right: '18%', width: 400, height: 400, borderRadius: '50%', background: A_PINK, opacity: 0.13, filter: 'blur(110px)' }} />
        </div>

        <div className="lp-hero-grid" style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '3rem', alignItems: 'center' }}>
          {/* 左: コピー + CTA */}
          <div className="lp-hero-copy">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              style={{ fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, marginBottom: '1.2rem', color: GOLD }}>
              CORE PRISM — AI CHIEF OF STAFF
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1 }}
              style={{ fontSize: 'clamp(2.15rem, 5.2vw, 4.1rem)', fontWeight: 900, lineHeight: 1.2, letterSpacing: '-0.025em', marginBottom: '1.25rem', color: TXT }}>
              レシートは、撮るだけ。
              <br />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>請求書も営業文も、AIが作る。</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.28 }}
              style={{ fontSize: 'clamp(1rem, 1.6vw, 1.18rem)', color: TXT_SUB, lineHeight: 1.9, marginBottom: '1.9rem', maxWidth: 545 }}>
              ひとり社長の事務を<strong style={{ color: GOLD, fontWeight: 700 }}>月2,980円</strong>で引き受けるAI参謀。
              指示は<strong style={{ color: A_PURPLE, fontWeight: 700 }}>話すだけ</strong>で、
              売上・経費・請求書・決算書が<strong style={{ color: TXT, fontWeight: 700 }}>1画面</strong>にそろいます。
              {TRIAL_BASE_DAYS}日間無料・クレカ不要。
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.42 }}
              style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={onEnterApp} style={ctaBtnHero} className="lp-hero-cta-primary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  {TRIAL_BASE_DAYS}日間 無料ではじめる <ArrowRight size={18} strokeWidth={2.6} />
                </span>
              </button>
              <a href="#pricing" style={ctaBtnGhost} className="lp-hero-cta-secondary">料金を見る</a>
            </motion.div>
            <p style={{ fontSize: '0.8rem', color: TXT_MUTE, marginTop: '1rem', lineHeight: 1.7 }}>
              クレジットカード登録なし · 解約は1タップ · データはいつでも持ち出せます
            </p>
            <button type="button" onClick={handleSampleEnter} style={{
              marginTop: '0.85rem', background: 'transparent', color: 'rgba(244,242,255,0.88)',
              border: `1px dashed ${A_PURPLE}80`, borderRadius: 10, padding: '0.6rem 1rem',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: 44,
            }}>
              <SparklesIcon size={14} color={A_PURPLE} />
              <span>登録せずに、中を見る</span>
              <span style={{ fontSize: '0.7rem', color: TXT_MUTE }}>(架空の会社データで体験)</span>
            </button>
          </div>

          {/* 右: 経営ダッシュボード実物風モック */}
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }} className="lp-hero-mock">
            <PrismDashboardMock />
          </motion.div>
        </div>
      </section>

      {/* ══ 2. 痛み ══════════════════════════════════════════ */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={eyebrow(A_PURPLE)}>SOUND FAMILIAR?</p>
            <h2 style={h2Style}>
              ひとりの経営は、<br className="prism-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>静かに削られていく。</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
            {PAINS.map((p, i) => (
              <motion.div key={p.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{ position: 'relative', background: SURFACE, border: `1px solid ${p.color}33`, borderRadius: 18, padding: '1.55rem 1.35rem', overflow: 'hidden' }}>
                <div aria-hidden style={{ position: 'absolute', top: -60, right: -60, width: 170, height: 170, borderRadius: '50%', background: p.color, opacity: 0.16, filter: 'blur(60px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${p.color}22`, border: `1px solid ${p.color}55`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.9rem' }}>
                    <p.Icon size={21} color={p.color} strokeWidth={2.1} />
                  </div>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 800, marginBottom: '0.55rem', color: TXT, lineHeight: 1.5 }}>{p.title}</h3>
                  <p style={{ fontSize: '0.89rem', color: TXT_SUB, lineHeight: 1.8, margin: 0 }}>{p.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '2.4rem', fontSize: 'clamp(1.02rem, 2vw, 1.2rem)', color: TXT, lineHeight: 1.9, fontWeight: 600 }}>
            その「もうひとつの仕事」を、<span style={{ color: A_PURPLE }}>Prism がぜんぶ引き受けます。</span>
          </p>
        </div>
      </section>

      {/* ══ 3. 変化 (Before → After) ═════════════════════════ */}
      <section id="solutions" className="lp-section-pad" style={{ padding: sectionPad, background: BG_DEEP }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={eyebrow(A_BLUE)}>WHAT CHANGES</p>
            <h2 style={h2Style}>
              数字も、書類も、下書きも。<br className="prism-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ここで終わります。</span>
            </h2>
            <p style={leadStyle}>
              明日から、何がどう変わるのか。いまの状態と並べます。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
            {SOLUTIONS.map((s, i) => (
              <motion.div key={s.tag} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.07 }}
                style={{ position: 'relative', background: SURFACE, border: `1px solid ${s.color}33`, borderRadius: 20, padding: '1.55rem 1.35rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div aria-hidden style={{ position: 'absolute', top: -70, right: -70, width: 190, height: 190, borderRadius: '50%', background: s.color, opacity: 0.15, filter: 'blur(65px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}22`, border: `1px solid ${s.color}55`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <s.Icon size={18} color={s.color} strokeWidth={2.2} />
                  </div>
                  <span style={{ fontSize: '0.64rem', letterSpacing: '0.18em', fontWeight: 800, color: s.color, textTransform: 'uppercase' }}>{s.tag}</span>
                </div>
                <h3 style={{ position: 'relative', zIndex: 2, fontSize: '1.06rem', fontWeight: 800, color: TXT, lineHeight: 1.55, margin: '0 0 0.95rem' }}>{s.title}</h3>
                <div style={{ position: 'relative', zIndex: 2, marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 700, color: TXT_MUTE, margin: '0 0 0.32rem' }}>いま</p>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(244,242,255,0.55)', lineHeight: 1.7, margin: 0 }}>{s.before}</p>
                </div>
                <div aria-hidden style={{ height: 1, background: `linear-gradient(90deg, transparent, ${s.color}77, transparent)`, margin: '0.25rem 0 0.85rem' }} />
                <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
                  <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 800, color: s.color, margin: '0 0 0.32rem' }}>PRISM なら</p>
                  <p style={{ fontSize: '0.93rem', color: TXT, lineHeight: 1.75, fontWeight: 600, margin: 0 }}>{s.after}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4. 決め手 (競合との違い) ═════════════════════════ */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
            <p style={eyebrow(GOLD)}>WHY PRISM</p>
            <h2 style={h2Style}>
              経理ソフトでもない。<br className="prism-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>チャットAIでもない。</span>
            </h2>
            <p style={leadStyle}>
              似たものはあります。それでも、この3つは他では埋まりませんでした。
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {EDGES.map((e, i) => (
              <motion.div key={e.head} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{ display: 'flex', gap: '1.05rem', alignItems: 'flex-start', background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: '1.45rem 1.35rem' }}>
                <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, background: `${e.color}1F`, border: `1px solid ${e.color}55`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <p style={eyebrow(A_AMBER)}>HOW IT WORKS</p>
            <h2 style={h2Style}>
              はじめ方は、<span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>3ステップ。</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
            {STEPS.map((st, i) => (
              <motion.div key={st.n} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: '1.7rem 1.35rem 1.55rem', textAlign: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', margin: '0 auto 0.95rem', background: GRAD_FACE, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 30px ${A_PURPLE}55` }}>
                  <st.Icon size={24} color="#fff" strokeWidth={2.2} />
                </div>
                <p style={{ fontSize: '0.72rem', color: A_PURPLE, margin: '0 0 0.4rem', fontWeight: 800, letterSpacing: '0.18em' }}>STEP {st.n}</p>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: TXT, margin: '0 0 0.5rem' }}>{st.title}</h3>
                <p style={{ fontSize: '0.86rem', color: TXT_SUB, lineHeight: 1.8, margin: 0 }}>{st.body}</p>
              </motion.div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2.4rem' }}>
            <button onClick={onEnterApp} style={{ ...ctaBtnHero, fontSize: '0.96rem', padding: '0.95rem 1.9rem' }}>
              いま、無料ではじめる
            </button>
            <p style={{ fontSize: '0.76rem', color: TXT_MUTE, marginTop: '0.85rem' }}>{TRIAL_BASE_DAYS}日間無料 · クレカ不要</p>
          </div>
        </div>
      </section>

      {/* ══ 6. 全機能カタログ ════════════════════════════════
          オーナー指示 2026-07-26: 「一部抜粋だけでなく、全部の機能が分かるように」。
          実装済みの機能だけを載せる (存在しない機能を書くのは禁止)。 */}
      <section id="all-features" className="lp-section-pad" style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={eyebrow(A_PURPLE)}>ALL FEATURES</p>
            <h2 style={h2Style}>
              これ全部、<br className="prism-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ひとつの月額に入っています。</span>
            </h2>
            <p style={leadStyle}>
              抜粋ではありません。いま実際に使える機能を、隠さず全部並べます。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
            {ALL_FEATURES.map((g) => (
              <div key={g.group} style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: '1.4rem 1.3rem' }}>
                <h3 style={{ fontSize: '0.99rem', fontWeight: 800, color: TXT, margin: '0 0 0.8rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: GRAD, display: 'inline-block', flexShrink: 0 }} />
                  {g.group}
                </h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {g.items.map((f) => (
                    <li key={f} style={{ fontSize: '0.855rem', color: TXT_SUB, lineHeight: 1.65, paddingLeft: '1.35em', position: 'relative' }}>
                      <Check size={13} color={A_GREEN} strokeWidth={2.8} style={{ position: 'absolute', left: 0, top: '0.28em' }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '1.9rem', fontSize: '0.85rem', color: TXT_MUTE }}>
            ここに載っているのは、すべて実装済み・いま使える機能だけです。
          </p>
        </div>
      </section>

      {/* ══ 7. 料金 ══════════════════════════════════════════ */}
      <section id="pricing" className="lp-section-pad" style={{ padding: sectionPad, background: BG_DEEP }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.6rem' }}>
            <p style={eyebrow(A_PINK)}>PRICING</p>
            <h2 style={h2Style}>
              人を1人雇う前に、<br className="prism-sp-br" />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>まず{TRIAL_BASE_DAYS}日間、無料で。</span>
            </h2>
            <p style={leadStyle}>
              クレジットカードの登録はいりません。合わなければ、そのまま消えて構いません。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
            {PLANS.map((p) => (
              <motion.div key={p.id} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}
                style={{
                  position: 'relative',
                  background: p.highlight ? SURFACE_HI : SURFACE,
                  border: p.highlight ? `1.5px solid ${A_PURPLE}` : `1px solid ${LINE}`,
                  borderRadius: 20, padding: '1.9rem 1.5rem 1.7rem',
                  boxShadow: p.highlight ? `0 22px 60px ${A_PURPLE}30` : 'none',
                }}>
                {p.highlight && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: GRAD_FACE, color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '0.32rem 0.95rem', borderRadius: 999, letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>人気</div>
                )}
                <p style={{ fontSize: '0.78rem', color: A_PURPLE, margin: '0 0 0.4rem', fontWeight: 700 }}>— {p.tag}</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.3rem', color: TXT }}>{p.name}</h3>
                <p style={{ margin: '0 0 0.4rem' }}>
                  <span style={{ fontSize: '2.15rem', fontWeight: 800, color: TXT }}>{p.price}</span>
                  <span style={{ fontSize: '0.85rem', color: TXT_MUTE, fontWeight: 500 }}> / 月</span>
                </p>
                <div aria-hidden style={{ height: 1, background: LINE, margin: '0.95rem 0' }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem' }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ fontSize: '0.875rem', color: TXT_SUB, lineHeight: 1.7, marginBottom: '0.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <Check size={15} color={A_GREEN} strokeWidth={2.6} style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={onEnterApp} style={{
                  width: '100%',
                  background: p.highlight ? GRAD_FACE : 'rgba(255,255,255,0.07)',
                  color: '#fff',
                  border: p.highlight ? 'none' : `1px solid ${LINE}`,
                  padding: '1rem', borderRadius: 12,
                  fontSize: '0.92rem', fontWeight: 800, cursor: 'pointer',
                  boxShadow: p.highlight ? `0 12px 32px ${A_PURPLE}55` : 'none',
                  letterSpacing: '0.02em', minHeight: 44,
                }}>
                  {p.name} を{TRIAL_BASE_DAYS}日間 無料でためす
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.71rem', color: TXT_MUTE, margin: '0.6rem 0 0' }}>クレカ不要 · いつでも解約</p>
              </motion.div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: TXT_MUTE, marginTop: '1.6rem' }}>年払いで2ヶ月分割引 · 法人・チームは別途お問い合わせください</p>
        </div>
      </section>

      {/* ══ 8. やめるときの安心 ══════════════════════════════ */}
      <section className="lp-section-pad" style={{ padding: '3.75rem 1.25rem', background: BG_SOFT, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <p style={eyebrow(A_GREEN)}>NO LOCK-IN</p>
            <h2 style={{ ...h2Style, fontSize: 'clamp(1.5rem, 3.4vw, 2.2rem)' }}>
              やめるときの心配も、<span style={{ color: A_GREEN }}>先に消しておきました。</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: '1rem' }}>
            {SAFETY.map((s) => (
              <div key={s.head} style={{ background: SURFACE, border: `1px solid ${A_GREEN}2E`, borderRadius: 16, padding: '1.3rem 1.25rem' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${A_GREEN}1F`, border: `1px solid ${A_GREEN}4D`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.8rem' }}>
                  <s.Icon size={18} color={A_GREEN} strokeWidth={2.2} />
                </div>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: TXT, margin: '0 0 0.45rem', lineHeight: 1.55 }}>{s.head}</h3>
                <p style={{ fontSize: '0.86rem', color: TXT_SUB, lineHeight: 1.8, margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 9. FAQ ═══════════════════════════════════════════ */}
      <section id="faq" className="lp-section-pad" style={{ padding: sectionPad, background: BG_DEEP }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={eyebrow(A_BLUE)}>FAQ</p>
            <h2 style={h2Style}>よくあるご質問</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FAQS.map((f) => <FaqItem key={f.q} question={f.q} answer={f.a} />)}
          </div>
        </div>
      </section>

      {/* ══ 10. 最終CTA ══════════════════════════════════════ */}
      <section style={{ padding: '5rem 1.25rem 5.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden', background: BG_DEEP, borderTop: `1px solid ${LINE}` }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 28% 38%, ${A_PURPLE}26 0%, transparent 48%), radial-gradient(circle at 72% 62%, ${A_BLUE}22 0%, transparent 48%)` }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.9rem, 4.6vw, 3rem)', fontWeight: 900, lineHeight: 1.32, marginBottom: '1.15rem', color: TXT }}>
            今夜の事務作業を、
            <br />
            <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>最後の夜に。</span>
          </h2>
          <p style={{ color: TXT_SUB, fontSize: '0.98rem', marginBottom: '1.9rem', lineHeight: 1.9 }}>
            {TRIAL_BASE_DAYS}日間、すべての機能を無料で。<br className="prism-sp-br" />
            AI役員たちは、今日から出社できます。
          </p>
          <button onClick={onEnterApp} style={ctaBtnHero}>
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
      <footer id="contact" style={{ background: '#050509', padding: '3rem 1.25rem 2rem', borderTop: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          <div>
            <PrismLogo size={28} withWordmark />
            <p style={{ fontSize: '0.8rem', color: TXT_MUTE, marginTop: '0.75rem', lineHeight: 1.7 }}>
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
            <p style={{ fontSize: '0.85rem', color: TXT_MUTE, lineHeight: 1.7 }}>
              お気軽にどうぞ。<br />
              <a href="mailto:core.inc.guild@gmail.com" style={{ color: A_PURPLE, textDecoration: 'none', display: 'inline-block', padding: '0.65rem 0.25rem', margin: '-0.35rem -0.25rem', wordBreak: 'break-all' }}>core.inc.guild@gmail.com</a>
              <br />
              <a href="tel:090-6326-1783" style={{ color: A_PURPLE, textDecoration: 'none', display: 'inline-block', padding: '0.65rem 0.25rem', margin: '-0.35rem -0.25rem' }}>090-6326-1783</a>
              <br />
              受付時間 平日10:00〜18:00
            </p>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: TXT_MUTE }}>
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

interface Props {
  onEnterApp: () => void;
  onOpenLegal: (kind: 'terms' | 'privacy' | 'tokushou') => void;
}

// ─── ヒーロー: 経営ダッシュボード実物風モック ─────────────────
// 「1画面に数字が集まる + チャット指令で実行」を1枚の画で伝える。
// 数字は「サンプル」表記つき (数字の嘘禁止)。
function PrismDashboardMock() {
  const metrics = [
    { Icon: Wallet, label: '今月の売上', value: '¥812,400', color: A_BLUE },
    { Icon: Receipt, label: '経費', value: '¥238,900', color: A_GREEN },
    { Icon: FileText, label: '未回収の請求書', value: '2件', color: A_AMBER },
    { Icon: BookOpen, label: '決算書', value: '自動更新', color: A_PINK },
  ];
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', width: '100%' }}>
      <div style={{
        borderRadius: 22, padding: '16px 16px 18px',
        background: 'linear-gradient(170deg, #16162B, #0A0A14)',
        border: `1px solid ${A_PURPLE}66`,
        boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 70px ${A_PURPLE}26`,
      }}>
        {/* ウィンドウバー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5757' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>CORE Prism · サンプル</span>
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
          <div style={{ alignSelf: 'flex-end', maxWidth: '86%', background: GRAD_FACE, borderRadius: '12px 12px 3px 12px', padding: '7px 12px' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', lineHeight: 1.5 }}>Prism、今月の請求書ぜんぶ送って</span>
          </div>
          <div style={{ alignSelf: 'flex-start', maxWidth: '92%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px 12px 12px 3px', padding: '7px 12px' }}>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.92)', lineHeight: 1.6 }}>
              <Check size={10} color={A_GREEN} strokeWidth={2.6} style={{ verticalAlign: -1, marginRight: 4 }} />
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
      <p style={{ textAlign: 'center', fontSize: '0.72rem', color: TXT_MUTE, marginTop: '0.8rem', lineHeight: 1.6 }}>
        数字は1画面 → 指示はチャット → 実行はAI役員 (画面はサンプル)
      </p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', background: 'transparent', border: 'none', padding: '1.05rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', color: TXT, fontSize: '0.93rem', fontWeight: 700, gap: '1rem', minHeight: 44 }}
      >
        <span>{question}</span>
        <span aria-hidden style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: `${A_PURPLE}26`, color: A_PURPLE, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 1.2rem 1.05rem', color: TXT_SUB, fontSize: '0.87rem', lineHeight: 1.85 }}>{answer}</div>
      )}
    </div>
  );
}

// ─── 共有スタイル ───────────────────────────────────────────
const h2Style: React.CSSProperties = {
  fontSize: 'clamp(1.7rem, 4vw, 2.65rem)', fontWeight: 800, lineHeight: 1.35, margin: 0, color: TXT,
};
const leadStyle: React.CSSProperties = {
  color: TXT_SUB, maxWidth: 640, margin: '0.95rem auto 0', fontSize: '0.95rem', lineHeight: 1.9,
};
const eyebrow = (color: string): React.CSSProperties => ({
  fontSize: '0.68rem', letterSpacing: '0.38em', fontWeight: 700, color, marginBottom: '0.85rem',
});
const navLink: React.CSSProperties = { fontSize: '0.85rem', color: 'rgba(244,242,255,0.72)', textDecoration: 'none', fontWeight: 600 };
const ctaBtnSmall: React.CSSProperties = {
  background: GRAD_FACE, color: '#fff', padding: '0.6rem 1.1rem', borderRadius: 10,
  fontSize: '0.85rem', fontWeight: 800, border: 'none', cursor: 'pointer',
  boxShadow: `0 4px 16px ${A_PURPLE}55`, whiteSpace: 'nowrap',
};
const ctaBtnHero: React.CSSProperties = {
  background: GRAD_FACE, color: '#fff', padding: '1.05rem 2.1rem', borderRadius: 14,
  fontSize: '1.02rem', fontWeight: 800, border: 'none', cursor: 'pointer',
  boxShadow: `0 14px 40px ${A_PURPLE}66`, letterSpacing: '0.02em', minHeight: 44,
};
const ctaBtnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)', color: TXT, padding: '1.05rem 1.8rem', borderRadius: 14,
  fontSize: '0.98rem', fontWeight: 700, border: `1px solid ${LINE}`,
  textDecoration: 'none', display: 'inline-block',
};
const footHead: React.CSSProperties = { fontSize: '0.7rem', letterSpacing: '0.22em', color: TXT_MUTE, marginBottom: '0.75rem', fontWeight: 800 };
const footLink: React.CSSProperties = { display: 'block', color: 'rgba(244,242,255,0.7)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '0.5rem' };
