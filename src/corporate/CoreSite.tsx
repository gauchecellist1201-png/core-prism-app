// ============================================================
// CORE — 法人サイト (Corporate Site)
// 「いつの時代も、変わらない核を。」
// 配置: /corp ルート（2026-08-02 検索インデックス解禁／2026-08-31 株式会社CORE 表記に更新）
//
// 2026-08-21 オーナー指示で事業の見せ方を全面再定義:
//   OLD  AIを使って開発する会社
//   NEW  企業の本質的な課題を見つけ、AI・ソフトウェア・業務設計によって
//        事業そのものを変革する会社 ＝ AI Transformation Company
//   ブランド（金×黒・明朝・静かな余白・「核」の思想）は一切壊さない。
//   自社プロダクト8つは「作れることの証拠」として〈製品〉タブへ移した。
// ============================================================
import { useEffect, useState, useRef, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { motion } from 'framer-motion';
import LegalModal, { type LegalKind } from '../components/LegalModal';
import { Mail as MailIcon } from 'lucide-react';
import { PrismLogo, IrisLogo, ResonanceLogo, LumeLogo, GuildLogo, CrystalLogo, PulseLogo, UltimaLogo, AnimaLogo, VeritasLogo, SomaLogo, TabittoLogo, NexusLogo } from '../components/Logo';
import { CONTINUUM_PLANS } from './continuumPlans';
import ServiceFinder from './ServiceFinder';
import {
  SUITE_CORE, SUITE_MEMBERS, SUITE_ALL, SUITE_ROLES, SUITE_COUNT, SUITE_COUNT_KANJI,
  SUITE_BEST_TOTAL, suiteService, formatYen,
  type SuiteRole, type SuiteMember,
} from './suiteData';
import { VERTICALS } from '../vertical/verticalData';
import { VerticalIndustryIcon } from '../vertical/VerticalIndustryIcon';
import {
  FONT_DISPLAY, FONT_SERIF_JA, FONT_SERIF_EN, FONT_SANS,
  navLink, ctaSmall, ctaHero,
  sectionLabel, sectionLabelMain, sectionLabelSub,
} from './corpTheme';
import { useIsMobile } from './useIsMobile';
import {
  PhilosophyCore, CompanyOsSection,
  UseCasesSection, ServiceLayersSection, BusinessDevSection,
  IndustryOsSection, PartnerSection, AiNativeSection, TechnologySection,
  CoreNumbersSection, InvestmentSection,
  EngagementSection, SecuritySection, FaqSection,
} from './TransformSections';
import { ContactSection } from './CorpContactForm';
import {
  HomeHero, ProofStrip, WhyCore, ServicesEditorial, ProductsProof,
  ApproachSection, FounderMessage, CompanyOverview, FinalCta,
} from './HomeSections';
import { Manifesto, Values, PeopleMosaic, CreedBand } from './HomeManifesto';
import { COMPANY_INFO } from '../data/companyInfo';
import { RoaiBand, ExecutiveQuestion, Differentiation, RoaiModelSection, ScoreTeaser } from './roai/HomeRoaiSections';
import ReturnOnAiPage from './roai/ReturnOnAiPage';
import RoaiScore from './roai/RoaiScore';
import { setCorpTab } from './corpRouteStore';
import { track } from './roai/track';

const COMPANY = {
  nameJa: COMPANY_INFO.name,
  nameEn: COMPANY_INFO.nameEn,
  founded: COMPANY_INFO.founded,
  ceoJa: COMPANY_INFO.representative,
  ceoEn: COMPANY_INFO.representativeEn,
  addressJa: COMPANY_INFO.addressJa,
  addressEn: COMPANY_INFO.addressEn,
  email: COMPANY_INFO.email,
};

// プラットフォーム価格グリッド — 安い入口→最上位Crystalへ昇る並び。製品追加は1オブジェクト追加で並ぶ
const PLATFORM_PLANS: Array<{
  name: string; role: string; copy: string; price: string; priceNote: string;
  accent: string; url: string; Logo: typeof PrismLogo; step: string; featured?: boolean;
}> = [
  // オーナー指示 2026-08-07: NEXUS（話しながら画面に描く秘書）を最上段に追加。
  { name: 'Nexus', role: 'AI Secretary', copy: '話しながら画面に描くAI秘書。価値観→夢→今日の一手まで並走する。', price: '無料〜', priceNote: '上位 ¥9,800・¥19,800 / 月（税込）', accent: '#4dc3ff', url: 'https://core-nexus-kappa.vercel.app/lp/', Logo: NexusLogo, step: '新登場 — 夢を叶える秘書を', featured: true },
  // オーナー指示 2026-07-30: 主力は Prism → Resonance → Crystal。この順で先頭に置く。
  // ラベルは「STEP 1..5」の導線順だったが、主力を先に出す並びと矛盾するため
  // 「主力 / そのほか」の役割表記に変えた（読み手が順番を導線と誤解しないように）。
  { name: 'Prism', role: 'AI Business OS', copy: '経営の司令塔。7人の専属AIが事業を動かす。', price: '¥2,980〜', priceNote: '/ 月（税込）', accent: '#7DD3FC', url: '/pricing', Logo: PrismLogo, step: '主力 — 経営のすべてを', featured: true },
  { name: 'Resonance', role: 'LINE AI', copy: '一人ひとりに書き分けるLINE個別配信と自動応対。', price: '¥6,980〜', priceNote: '/ 月（税込）', accent: '#06C755', url: 'https://resonancebot-ivory.vercel.app/lp', Logo: ResonanceLogo, step: '主力 — LINEの集客を', featured: true },
  { name: 'Crystal', role: 'AI Concierge', copy: 'サイトに1行で住みつく、白と金のAIコンシェルジュ。', price: '¥29,800〜', priceNote: '/ 月（税込）・¥49,800プランあり', accent: '#7DD3FC', url: 'https://crystal-nine-self.vercel.app/', Logo: CrystalLogo, step: '主力 — サイトの接客を', featured: true },
  { name: 'Iris', role: 'Instagram AI', copy: 'Instagram運用のすべてをAIと。分析から案件まで。', price: '¥2,980〜', priceNote: '/ 月（税込）', accent: '#E1306C', url: '/iris?lp=1', Logo: IrisLogo, step: 'Instagram の運用に' },
  { name: 'Lume', role: 'Link Hub', copy: 'すべてのリンクをひとつに。いちばん軽い入口。', price: '無料〜', priceNote: '', accent: '#FFA42A', url: 'https://lume-deploy-five.vercel.app/', Logo: LumeLogo, step: 'まず無料ではじめる' },
  { name: 'Guild', role: 'Community OS', copy: '提案と投票で動く組織OS。まずは無料の入口から。', price: '¥980〜', priceNote: '/ 月（税込）', accent: '#2DD4BF', url: 'https://guild-gauches-projects.vercel.app/?lp=1', Logo: GuildLogo, step: 'チームで動かす' },
  { name: 'Pulse', role: 'Health AI', copy: '毎日のからだを見守るAI。睡眠・心拍・歩数を、毎朝やさしいことばに。', price: '無料〜', priceNote: '先行モニター中・正式版 ¥2,980/月（予定）', accent: '#FF5C8A', url: '/pulse', Logo: PulseLogo, step: 'からだを見守る' },
];



// 荘厳系フォント・章ラベル・CTA は corpTheme.ts に集約した（2026-08-21）。
// 新しい章（What We Do / AI COMPANY OS / 診断 …）と同じ出どころを使うため。

// ============================================================
//  jumpToHash — モバイルの章チップ専用のページ内ジャンプ。
//  標準のアンカー移動でも飛べるが、着地点は CSS の scroll-margin-top
//  固定値まかせになり、告知バーの有無でヘッダー高が変わると見出しが隠れる。
//  ここではヘッダーの実測高を引くので、常に見出しの真上に着地する。
//  17,908px を smooth で流すと数秒かかるため、ジャンプは即時にする。
// ============================================================
function jumpToHash(e: ReactMouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith('#')) return;
  const el = document.getElementById(href.slice(1));
  if (!el) return;
  e.preventDefault();
  const header = document.querySelector('header');
  const offset = (header?.getBoundingClientRect().height ?? 64) + 8;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'auto' });
  history.replaceState(null, '', href);
}

// ============================================================
//  タブ（2026-08-02 オーナー指示で全面導入）
//
//  なぜ:
//    「縦に長すぎる。タブで使い分けて、1ページあたりの情報量を少なくしたい。
//      自社サービスは自社サービスだけでホームに置いて、他は他でタブで切り替えたい」
//    1枚に12章すべてを積んでいたため、iPhone で 15,000px 超。
//    会社概要にたどり着くまでに全プロダクトを通過させられていた。
//
//  設計（[[ux_one_screen_tab_doctrine]] 準拠）:
//    ・タブを押すと画面が「入れ替わる」。下に足していかない。
//    ・切り替えたら必ず先頭へ戻す（前のタブのスクロール位置を持ち越さない）。
//    ・既存の #リンク（フッタ・CTA・共有された URL）を殺さない。
//      SECTION_TAB でどの章がどのタブに載っているかを引き、
//      必要ならタブを切り替えてからその章へ送る。
// ============================================================
export type CoreTabKey = 'home' | 'roai' | 'score' | 'os' | 'services' | 'products' | 'company' | 'contact';

/**
 * 2026-09-03 MASTER PROMPT: Return on AI と CORE ROAI SCORE は中心的な知的資産なので、
 * ハッシュではなく独立したパスを持つ（検索・共有・AI検索のため）。中身は同じ CoreSite のタブ。
 */
const TAB_PATH: Partial<Record<CoreTabKey, string>> = { roai: '/return-on-ai', score: '/roai-score' };
const PATH_TAB: Record<string, CoreTabKey> = { '/return-on-ai': 'roai', '/roai-score': 'score' };
function tabFromPath(): CoreTabKey | null {
  if (typeof window === 'undefined') return null;
  const p = window.location.pathname.replace(/\/$/, '');
  return PATH_TAB[p] ?? null;
}

/** タブごとの title / description / canonical（SEO・AI検索向け） */
const TAB_META: Record<CoreTabKey, { title: string; desc: string; path: string }> = {
  home: { title: '株式会社CORE | AI Transformation Company — Return on AI', desc: '核とは、人。AIは、人にしかできない仕事を人に返すための道具です。AI前提で会社そのものをつくり直し、AI投資を経営成果へ変えるAI Transformation Company。', path: '/corp' },
  roai: { title: 'Return on AI とは | 株式会社CORE', desc: 'AI投資は目的ではない。AIが何を返したかを、売上・コスト・時間・リスク・新しい価値で測る。CORE ROAI MODEL・ROAIの計算・損失回避・投資余力の逆算・Transformation Loop。', path: '/return-on-ai' },
  score: { title: 'CORE ROAI SCORE — 約3分のAI投資優先順位診断 | 株式会社CORE', desc: '約3分で、あなたの会社の次にAI投資すべき場所・削減できる時間・経済価値の概算・AI Readiness・投資余力の目安を可視化。連絡先不要、算定根拠つき。', path: '/roai-score' },
  os: { title: 'AI COMPANY OS | 株式会社CORE', desc: '経営・営業・顧客対応・バックオフィスを、人とAIエージェントが協働する一つのOperating Systemとして再設計する。', path: '/corp#os' },
  services: { title: 'サービス — AI戦略から運用・ROAI計測まで | 株式会社CORE', desc: 'AI Strategy / Business Redesign / AI Development / AI Security & Quality / AI Operation / ROAI Management。経営成果を生むプロセス別のサービス。', path: '/corp#services' },
  products: { title: '自社プロダクト | 株式会社CORE', desc: '自社で作り、本番で動かしているAIプロダクト群。作れることの証拠。', path: '/corp#products' },
  company: { title: '会社について | 株式会社CORE', desc: 'いつの時代も、変わらない核を。核とは、人。会社概要・理念・代表。', path: '/corp#company' },
  contact: { title: 'AI Transformationを相談する | 株式会社CORE', desc: 'どこへ、いくらAI投資すると、どの程度のReturnが期待できるか。ROAI戦略相談・お問い合わせ。', path: '/corp#contact' },
};

/**
 * short — 狭い画面用の短い名札。
 * 実測(iPhone 390px): 長い名札のままだと 5枚で 530px になり 140px はみ出して、
 * いちばん右の「お問い合わせ」が画面外に完全に消えていた。
 * 英字の副題も 640px 以下では隠す（CSS 側）。
 */
const CORE_TABS: { key: CoreTabKey; label: string; short: string; sub: string }[] = [
  { key: 'home', label: '変革', short: '変革', sub: 'TRANSFORMATION' },
  { key: 'roai', label: 'Return on AI', short: 'ROAI', sub: 'CONCEPT' },
  { key: 'score', label: 'ROAI SCORE', short: '診断', sub: 'DIAGNOSIS' },
  { key: 'os', label: 'AI COMPANY OS', short: 'AI OS', sub: 'FLAGSHIP' },
  { key: 'services', label: 'サービス', short: 'サービス', sub: 'SERVICES' },
  { key: 'products', label: 'プロダクト', short: '製品', sub: 'PRODUCTS' },
  { key: 'company', label: '会社について', short: '会社', sub: 'COMPANY' },
  { key: 'contact', label: 'ご相談', short: '相談', sub: 'CONTACT' },
];

/** 章 id → その章が載っているタブ。既存の #リンクを生かすための対応表。 */
const SECTION_TAB: Record<string, CoreTabKey> = {
  // 変革 — この会社が何をするのか
  top: 'home', philosophy: 'home', whatwedo: 'home', difference: 'home', assessment: 'home',
  why: 'home', proof: 'home', overview: 'home', cta: 'home', values: 'home',
  'roai-band': 'home', question: 'home', 'roai-model': 'home', 'score-teaser': 'home',
  // Return on AI（独立パス /return-on-ai）
  roai: 'roai', 'roai-fail': 'roai', 'roai-calc': 'roai', 'roai-loss': 'roai', 'roai-capacity': 'roai', 'roai-loop': 'roai', 'roai-measure': 'roai',
  // AI COMPANY OS — 中核商品
  companyos: 'os', usecases: 'os', continuum: 'os',
  // connect（座組み）は 2026-08-21 に〈製品〉タブへ移した。
  // 「8つがどう1つになるか」は、8つの製品カードと同じ画面で読めないと意味がないため。
  // 既存の #connect リンク（フッタ・共有URL）はこの表で製品タブへ送られる。
  // サービス — 事業階層・つくり方・技術・事業開発・提携・規模
  services: 'services', 'ai-native': 'services', technology: 'services',
  'business-dev': 'services', partner: 'services', investment: 'services',
  engagement: 'services', security: 'services',
  // プロダクト — 自社で作って動かしているもの（作れることの証拠）
  connect: 'products',
  finder: 'products', products: 'products', platform: 'products', screens: 'products',
  who: 'products', 'industry-os': 'products', vertical: 'products',
  'vertical-ultima': 'products', 'vertical-anima': 'products',
  'vertical-veritas': 'products', 'vertical-soma': 'products',
  // 会社
  'philosophy-core': 'company', numbers: 'company',
  mission: 'company', executive: 'company', journey: 'company', about: 'company',
  contact: 'contact', faq: 'contact',
};

/**
 * URL のハッシュから初期タブを決める。共有された #about が直接開けるように。
 *
 * 2026-08-21: goTab は章を指定せずに切り替えたとき `#os` `#company` のように
 * 「タブの名前」をハッシュに書く。ところが SECTION_TAB は「章の id」しか持たないため、
 * その URL を共有・再読み込みすると home に戻ってしまっていた（往復できていない）。
 * 章の id で引けなかったら、タブの名前としても引く。
 */
const TAB_KEYS = new Set<string>(CORE_TABS.map(t => t.key));

function tabFromHash(): CoreTabKey {
  if (typeof window === 'undefined') return 'home';
  const byPath = tabFromPath();
  if (byPath) return byPath;
  const id = window.location.hash.replace('#', '');
  if (SECTION_TAB[id]) return SECTION_TAB[id];
  if (TAB_KEYS.has(id)) return id as CoreTabKey;
  return 'home';
}

/**
 * 業種チップ → その業種のカードへ。
 *
 * 罠: 640px 以下では .lp-vertical-grid が「横スワイプの棚」になる（index.css）。
 *     カードは縦ではなく横にずれた位置にあるので、window.scrollTo（＝縦だけ）では
 *     画面が1ミリも動かず「押しても何も起きない」ように見える。
 *     inline:'center' を伴う scrollIntoView なら、棚の横位置も一緒に合う。
 */
function scrollToVerticalCard(e: ReactMouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  history.replaceState(null, '', '#' + id);
}

// ============================================================
//  （旧 MobileJump は 2026-08-02 のタブ導入で廃止）
//  横スクロールの章チップは「1枚の長いページの中を移動する」ための道具だった。
//  タブで画面そのものが入れ替わるようになり、役割が重複したため削除。
//  移動手段は .lp-tabs 1本に統一する（モバイルで移動手段が消えないこと＝巡回の観点2）。
// ============================================================

// ============================================================
//  MobileFold — モバイルだけ折りたたむ。デスクトップはそのまま出す。
//  「読まなくても困らないが、無いと不信になる」情報（会社概要など）に使う。
// ============================================================
function MobileFold({ summary, children }: { summary: string; children: ReactNode }) {
  const isMobile = useIsMobile();
  if (!isMobile) return <>{children}</>;
  return (
    <details className="lp-fold">
      <summary>{summary}</summary>
      <div className="lp-fold-body">{children}</div>
    </details>
  );
}

export default function CoreSite() {
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);

  // ── タブ（2026-08-02）。押すと画面が入れ替わる。下に足していかない。 ──
  const [tab, setTab] = useState<CoreTabKey>(() => tabFromHash());
  const isNarrow = useIsMobile('(max-width: 640px)');
  const tabBarRef = useRef<HTMLDivElement>(null);

  /**
   * 選んでいるタブを、タブバーの中でも必ず見える位置へ寄せる。
   * これが無いと、右端の「お問い合わせ」を選んでも本人が画面外のままで、
   * どこにいるのか分からなくなる（旧 MobileJump が持っていた挙動を引き継ぐ）。
   */
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const chip = bar.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (!chip) return;
    const target = chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2;
    bar.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [tab]);

  /**
   * タブを切り替える。
   * scrollTo(0,0) を必ず伴う ＝ 前のタブで下まで読んでいた位置を持ち越すと、
   * 切り替えた先の途中から始まって「押しても何も起きない」ように見えるため。
   */
  /**
   * URL の書き方（2026-09-03）:
   *   roai / score タブは独立パス（/return-on-ai・/roai-score）。
   *   それ以外は /corp#章。パスが変わるときは pushState（戻るで前のページへ戻れるように）。
   */
  const writeUrl = (next: CoreTabKey, hash?: string) => {
    const path = TAB_PATH[next] ?? '/corp';
    const url = hash && !TAB_PATH[next] ? `${path}${hash}` : hash && TAB_PATH[next] ? `${path}${hash}` : TAB_PATH[next] ? path : `${path}#${next}`;
    if (window.location.pathname.replace(/\/$/, '') !== path) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  };

  const goTab = (next: CoreTabKey, hash?: string) => {
    setTab(next);
    if (hash) {
      writeUrl(next, hash);
      // 章指定つきの場合は、描画が入れ替わってから位置を合わせる
      requestAnimationFrame(() => {
        const el = document.getElementById(hash.replace('#', ''));
        if (!el) { window.scrollTo({ top: 0, behavior: 'auto' }); return; }
        const header = document.querySelector('header');
        const offset = (header?.getBoundingClientRect().height ?? 64) + 8;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'auto' });
      });
    } else {
      writeUrl(next);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  // 追従CTA（App.tsx 側）とページの計測に、いまのタブを知らせる
  useEffect(() => {
    setCorpTab(tab);
    track('corp_page_view', tab);
    const m = TAB_META[tab];
    document.title = m.title;
    const setMeta = (sel: string, attr: string, value: string) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', m.desc);
    setMeta('meta[property="og:title"]', 'content', m.title);
    setMeta('meta[property="og:description"]', 'content', m.desc);
    setMeta('meta[name="twitter:title"]', 'content', m.title);
    setMeta('meta[name="twitter:description"]', 'content', m.desc);
    const canon = `https://www.core-ai.jp${m.path.split('#')[0]}`;
    setMeta('link[rel="canonical"]', 'href', canon);
    setMeta('meta[property="og:url"]', 'content', canon);
  }, [tab]);

  /**
   * ページ内の #リンクを全部拾う共通ハンドラ。
   * 別タブにある章を指していたら、まずタブを切り替えてから送る。
   * （フッタの「会社概要」やヒーローの「プロダクトを見る」を殺さないため）
   */
  const handleAnchor = (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    // 独立パスのタブ（/return-on-ai・/roai-score）はページ遷移せずタブを切り替える
    const pathTab = PATH_TAB[href.replace(/\/$/, '')];
    if (pathTab) {
      e.preventDefault();
      goTab(pathTab);
      return;
    }
    if (!href.startsWith('#')) return;
    const id = href.slice(1);
    const target = SECTION_TAB[id];
    if (target && target !== tab) {
      e.preventDefault();
      goTab(target, href);
      return;
    }
    jumpToHash(e, href);
  };

  /**
   * 戻る/進む、および素の #リンク（追従CTAなど onClick を通らないもの）でタブを追従させる。
   *
   * 2026-08-21: タブを変えるだけだと、前のタブで下まで読んでいたスクロール位置が
   * そのまま残る。追従CTA「AI・DXについて相談する」(#contact) を長い〈サービス〉タブの
   * 途中で押すと、切り替わった先の相談タブでも同じ位置＝フッタ付近に着地し、
   * フォームが画面に無いまま「押しても何も起きない」ように見えていた。
   * タブを切り替えたら、必ずその章の見出しの真上へ送る。
   */
  useEffect(() => {
    const onHash = () => {
      setTab(tabFromHash());
      const id = window.location.hash.replace('#', '');
      requestAnimationFrame(() => {
        const el = id ? document.getElementById(id) : null;
        if (!el) { window.scrollTo({ top: 0, behavior: 'instant' }); return; }
        const header = document.querySelector('header');
        const offset = (header?.getBoundingClientRect().height ?? 64) + 8;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'instant' });
      });
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('popstate', onHash); };
  }, []);

  useEffect(() => {
    // title / description / canonical はタブごとに TAB_META で更新する（上の effect）

    // theme-color (金×黒テーマ)
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', '#070A10');

    // favicon を CORE 専用に
    const links = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
    links.forEach(l => l.parentElement?.removeChild(l));
    const setLink = (rel: string, href: string, type?: string, sizes?: string) => {
      const l = document.createElement('link');
      l.rel = rel; l.href = href;
      if (type) l.type = type;
      if (sizes) l.setAttribute('sizes', sizes);
      document.head.appendChild(l);
    };
    setLink('icon', '/core-icon.svg', 'image/svg+xml');
    setLink('icon', '/core-192.png', 'image/png', '192x192');
    setLink('icon', '/core-512.png', 'image/png', '512x512');
    setLink('apple-touch-icon', '/core-180.png', undefined, '180x180');

  }, []);

  return (
    <div
      style={{
        background: '#070A10',
        color: '#F3F6FB',
        minHeight: '100dvh',
        fontFamily: FONT_SANS,
        // 修正 (オーナー報告 2026-05-27 / 28):
        // overflowX: 'hidden' + overflowY: 'visible' は CSS 仕様で「両方 auto」に
        // 解釈され、iOS Safari でルート要素がスクロール容器化してフッターまで
        // たどり着けない不具合を引き起こす。
        // 解決: overflowX を 'clip' (modern alternative) に変更。clip は反対軸を
        // 触らないので、body 側の通常スクロールが完全に効く。
        overflowX: 'clip',
        overflowY: 'visible',
        // iOS Safari 慣性スクロール
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  HEADER                     */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(5,5,5,0.78)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(125,211,252,0.22)',
        }}
      >
        <div
          className="lp-safe"
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '0.85rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <a
            href="#top"
            onClick={e => { e.preventDefault(); goTab('home'); }}
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
            aria-label="株式会社CORE"
            className="lp-tap-link"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, lineHeight: 1 }}>
              <img
                src="/core-logo-mark-v2.png"
                alt="株式会社CORE"
                width={396}
                height={240}
                style={{ height: 36, width: 'auto', flexShrink: 0 }}
              />
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                <span
                  aria-hidden
                  style={{
                    fontFamily: '"Noto Sans JP", sans-serif',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.3em',
                    color: 'rgba(224,242,254,0.58)',
                    lineHeight: 1,
                  }}
                >
                  株式会社
                </span>
                <span
                  aria-hidden
                  style={{
                    fontFamily: '"Inter", "Noto Sans JP", sans-serif',
                    fontSize: 22.32,
                    fontWeight: 700,
                    letterSpacing: '0.42em',
                    color: '#E0F2FE',
                    background: 'linear-gradient(135deg, #FFFFFF, #BAE6FD, #38BDF8)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: 1,
                  }}
                >
                  CORE
                </span>
              </span>
            </span>
          </a>
          {/* 別ページ（タブでは切り替わらない別ルート）だけをここに残す */}
          <nav style={{ display: 'flex', gap: '1.6rem', alignItems: 'center' }}>
            <a href="/continuum" style={navLink} className="lp-nav-link">Continuum</a>
            <a href="/studio" style={navLink} className="lp-nav-link">制作スタジオ</a>
            <a href="/roai-score" onClick={e => { track('corp_cta_click', 'header'); handleAnchor(e, '/roai-score'); }} style={ctaSmall}>ROAIを診断</a>
          </nav>
        </div>

        {/*
          タブ本体。デスクトップも iPhone も同じ1本を使う。
          旧 MobileJump（章ジャンプのチップ）は、タブが同じ役割を果たすので廃止した。
        */}
        <div className="lp-tabs" role="tablist" aria-label="CORE サイトの切り替え" ref={tabBarRef}>
          {CORE_TABS.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              data-tab={t.key}
              aria-selected={tab === t.key}
              aria-label={t.label}
              onClick={() => goTab(t.key)}
              className={'lp-tab' + (tab === t.key ? ' is-on' : '')}
            >
              {isNarrow ? t.short : t.label}
              <span className="lp-tab-sub">{t.sub}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  01 HERO                    */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'home' && (
      <HomeHero onAnchor={handleAnchor} />
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  02 PHILOSOPHY（短い版）     */}
      {/*  03 WHAT WE DO（4階層）      */}
      {/*  DIFFERENCE（開発会社との違い）*/}
      {/*  04 ASSESSMENT（AI変革診断）  */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'home' && (
      <>
        {/* 2026-09-03 MASTER PROMPT: 思想理解 → 問題認識 → ROAI理解 → 自己診断 → 相談 の順に並べる。
            理念（核とは、人）と人の写真は Humanity の章として残す（§15）。 */}
        <RoaiBand onAnchor={handleAnchor} />
        <ExecutiveQuestion onAnchor={handleAnchor} />
        <Differentiation />
        <RoaiModelSection onAnchor={handleAnchor} />
        <ScoreTeaser onAnchor={handleAnchor} />
        <Manifesto onAnchor={handleAnchor} />
        <Values />
        <PeopleMosaic />
        <ProofStrip onAnchor={handleAnchor} />
        <WhyCore />
        <ServicesEditorial onAnchor={handleAnchor} />
        <ProductsProof onAnchor={handleAnchor} />
        <ApproachSection />
        <FounderMessage onAnchor={handleAnchor} />
        <CompanyOverview onAnchor={handleAnchor} />
        <FinalCta onAnchor={handleAnchor} />
      </>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  RETURN ON AI（/return-on-ai）  */}
      {/*  CORE ROAI SCORE（/roai-score） */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'roai' && <ReturnOnAiPage onAnchor={handleAnchor} />}
      {tab === 'score' && <RoaiScore onAnchor={handleAnchor} />}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  05 AI COMPANY OS ＋ 07 USE CASES  */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'os' && (
      <>
        <CompanyOsSection onAnchor={handleAnchor} />
        <UseCasesSection />
      </>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  06 SERVICES（4階層の詳細）〜 15 投資規模 */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'services' && (
      <>
        <ServiceLayersSection />
        {/* 「何ができるか」の直後に「どう進むか・やめられるか」を置く（稟議に持ち込める形にする） */}
        <EngagementSection onAnchor={handleAnchor} />
        <AiNativeSection />
        <TechnologySection />
        {/* 技術の話の直後に「その情報はどこへ行くのか」を置く */}
        <SecuritySection />
        <BusinessDevSection />
        <PartnerSection onAnchor={handleAnchor} />
        <InvestmentSection onAnchor={handleAnchor} />
      </>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  10 INDUSTRY AI OS（プロダクトタブの先頭） */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'products' && (
      <IndustryOsSection onAnchor={handleAnchor} />
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  CONNECT — 座組み（八つで、ひとつの AI 会社）  */}
      {/*                                              */}
      {/*  2026-08-21 オーナー指示で全面改訂:            */}
      {/*   ・AI OS タブ → 製品タブへ移した（8つの製品カードの直前）*/}
      {/*   ・7つ立ての古い座組みを、実在する8つ＋Universe に作り直した */}
      {/*   ・「便利な道具が7つ」ではなく「AIの会社がまるごと1つ」に言い換えた */}
      {/*   ・本数と単品合計は suiteData.ts から計算（本文にベタ書きしない）*/}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'products' && (
      <section
        id="connect"
        className="lp-section-pad"
        style={{
          padding: '7rem 1.5rem',
          background: 'radial-gradient(130% 90% at 50% 0%, #0C1119 0%, #070A10 68%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <p style={sectionLabel}>
            <span style={sectionLabelMain}>ひ&nbsp;と&nbsp;そ&nbsp;ろ&nbsp;い</span>
            <span style={sectionLabelSub}>ONE&nbsp;COMPANY</span>
          </p>

          <motion.h2
            initial={{ y: 22 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9 }}
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(2rem, 5vw, 3.6rem)',
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: '0.04em',
              marginBottom: '1.5rem',
            }}
          >
            道具を、{SUITE_COUNT_KANJI}つ買うのではない。
            <br />
            <span
              style={{
                background: 'linear-gradient(110deg,#FFFFFF,#BAE6FD 55%,#7DD3FC)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 900,
              }}
            >
              AIの会社が、まるごとひとつ。
            </span>
          </motion.h2>

          <p
            style={{
              fontFamily: FONT_SERIF_JA,
              fontSize: 'clamp(0.98rem, 1.45vw, 1.12rem)',
              color: 'rgba(226,232,240,0.78)',
              lineHeight: 2.2,
              maxWidth: 760,
              margin: '0 auto 2.5rem',
              fontWeight: 400,
            }}
          >
            CORE の {SUITE_COUNT} つは、それぞれ単体でも売っています。
            <br />
            けれど本当の姿は、机の上に並ぶ {SUITE_COUNT} 個の道具ではありません。
            <br />
            集客、接客、顧客対応、経営判断、実行、そして経営者自身の体調管理まで。
            <br />
            <strong style={{ color: '#F3F6FB', fontWeight: 700 }}>会社の部署が、そのまま{SUITE_COUNT_KANJI}つ揃っている</strong>ということです。
            <br />
            あなたに残るのは、社長の仕事だけ。
          </p>

          {/* 五つの持ち場（図と表の共通の凡例） */}
          <SuiteRoleChain />

          {/* 座組みの図（Guild の場・中心 Prism・6つの部署・土台に Universe） */}
          <ConnectedSuite />

          {/* 座組みの一覧 — 「どの部署が、どのサービスか」 */}
          <SuiteRoster />

          {/* ひとつのパッケージ — 座組みの結論。価格は continuumPlans.ts が唯一の出どころ。 */}
          <SuitePackage onAnchor={handleAnchor} />
        </div>
      </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  「あなたにはどれ？」3問診断 ＋ 8つの比較  */}
      {/*  座組みで全体を見せた直後に「では自分はどこから？」を置く。 */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'products' && (
      <ServiceFinder />
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  PRODUCTS                  */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'products' && (
      <section
        id="products"
        className="lp-section-pad"
        style={{
          padding: '7rem 1.5rem',
          background: '#080B11',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4.5rem' }}>
            <p style={sectionLabel}>
              <span style={sectionLabelMain}>プロダクト</span>
              <span style={sectionLabelSub}>PRODUCTS</span>
            </p>
            <h2
              style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: 'clamp(1.85rem, 3.8vw, 2.85rem)',
                fontWeight: 700,
                lineHeight: 1.5,
                marginBottom: '1.25rem',
                letterSpacing: '0.04em',
              }}
            >
              {SUITE_COUNT_KANJI}つの専門。ひとつの、頭脳。
            </h2>
            <p
              style={{
                fontFamily: FONT_SERIF_JA,
                color: 'rgba(226,232,240,0.7)',
                fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
                maxWidth: 700,
                margin: '0 auto',
                lineHeight: 2,
                fontWeight: 400,
              }}
            >
              経営の司令塔 <strong style={{ color: '#F3F6FB', fontWeight: 600 }}>Prism</strong> に、
              Instagram・LINE・リンクの三つの SNS ツールがつながる。
              <br />
              あなたの仕事も SNS も、ひとつの AI エージェントの流れで動きます。
            </p>
          </div>

          {/* PRISM — 全事業の司令塔 */}
          <FeatureProduct
            brand="prism"
            badge="司令塔 ／ 全事業を一元管理"
            tagline="すべての事業を、ひとつの頭脳で。"
            taglineEn="One mind for your whole business."
            description="営業・財務・契約・議事録 —— 経営のすべてを 13 名の AI エージェントが引き受ける司令塔。Iris・Resonance・Lume が SNS で掴んだお客様の動きも、最後はここにすべて集まり、次の一手まで提案します。"
            features={[
              '七つの役割に、七人の専属エージェント',
              '商談・財務・契約をひと続きに自動化',
              '三つの SNS ツールの結果も、ここに集約',
            ]}
            accentColor="#a78bfa"
            accentGradient="linear-gradient(135deg,#ff5757,#ff9842,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6)"
            url="/?lp=1"
            defaultOpen
          />

          {/* ── UNIVERSE — 別格（オーナー指示 2026-08-02: 司令塔 Prism の横に、これだけは別格として置く） ──
              通常の FeatureProduct カードにせず、星空の一枚バナーで「格の違い」を出す。 */}
          <a
            href="https://core-universe.vercel.app/"
            target="_blank"
            rel="noreferrer"
            aria-label="CORE Universe — AIに任せられる仕事の宇宙図を開く"
            style={{
              display: 'block',
              margin: '2.5rem 0',
              padding: 'clamp(1.8rem, 4vw, 3rem) clamp(1.4rem, 4vw, 3rem)',
              borderRadius: 26,
              border: '1px solid rgba(201,162,75,0.45)',
              background:
                'radial-gradient(120% 140% at 85% 0%, rgba(59,52,94,0.55) 0%, rgba(10,13,20,0.96) 55%), #0a0d14',
              position: 'relative',
              overflow: 'hidden',
              textDecoration: 'none',
              color: '#F3F6FB',
            }}
          >
            {/* Universe マーク（オーナー提供画像 2026-08-03。素材: ~/Desktop/00-CORE/Universe/logo/universe-mark-v6-transparent.png）
                モバイルは右バナー配置だと見出しに重なるため、見出しの上に中央寄せで流し込む。 */}
            {!isNarrow && (
              <img
                src="/universe-mark.png"
                alt=""
                aria-hidden
                style={{
                  position: 'absolute',
                  // right を負にすると、親が overflow:hidden なので球体の右側が切り落とされる。
                  // 実測(1920px)で -38px ぶん欠けていたため、必ず 0 以上に収める。
                  right: 'clamp(0px, 1.5vw, 28px)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 'clamp(200px, 26vw, 340px)',
                  height: 'auto',
                  opacity: 0.92,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* 球体を右に収めた分、中幅(641〜900px程度)では本文が球体の上に乗って読めなくなる。
                テキスト側の幅も球体の手前で止める。 */}
            <div
              style={{
                position: 'relative',
                maxWidth: isNarrow ? 640 : 'min(640px, calc(100% - 220px))',
                textAlign: isNarrow ? 'center' : undefined,
              }}
            >
              {isNarrow && (
                <img
                  src="/universe-mark.png"
                  alt=""
                  aria-hidden
                  style={{ display: 'block', width: 132, height: 132, margin: '0 auto 1.2rem', opacity: 0.92 }}
                />
              )}
              <p style={{ fontSize: '0.72rem', letterSpacing: '0.34em', color: '#d9b36a', fontWeight: 700, marginBottom: '0.9rem' }}>
                別格 ─ CORE UNIVERSE
              </p>
              <h3
                style={{
                  fontFamily: FONT_SERIF_JA,
                  fontSize: 'clamp(1.5rem, 3.2vw, 2.2rem)',
                  fontWeight: 700,
                  lineHeight: 1.6,
                  letterSpacing: '0.04em',
                  marginBottom: '1rem',
                }}
              >
                AIに任せられる仕事が、
                <br />
                ぜんぶ見える宇宙図。
              </h3>
              <p style={{ fontFamily: FONT_SERIF_JA, color: 'rgba(226,232,240,0.75)', fontSize: '0.95rem', lineHeight: 2, marginBottom: '1.4rem' }}>
                30の仕事を星座に。星を押すと「人がやる → AIが下書き → 全自動」の3段のはしごが見え、
                どの仕事から任せるべきかが分かります。宇宙図は無料。すべてのCOREサービスは、この宇宙のどこかの星です。
              </p>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  minHeight: 48, padding: '0 1.6rem', borderRadius: 999,
                  border: '1px solid rgba(201,162,75,0.6)', color: '#E8CF9A',
                  fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.06em',
                }}
              >
                宇宙図をひらく →
              </span>
            </div>
          </a>

          {/* NEXUS — 話しながら画面に描くAI秘書（2026-08-07 追加。トップ側に配置） */}
          <FeatureProduct
            brand="nexus"
            badge="AI秘書 ／ 夢を叶えてくれる相棒"
            tagline="話しながら、画面に描く秘書。"
            taglineEn="Your AI secretary that draws while it talks."
            description="価値観 → 夢 → 長期・中間・短期の目標 → 今日の一手、まで一緒に並走するAI秘書。優先順位は締切ではなく「夢との距離」で決め、毎日15分の計画で迷いを減らします。"
            features={[
              '価値観・夢から逆算して、今日やることまで落とし込む',
              '話しかけるだけで、AIが画面に構造化して描き出す',
              '無料から。上位プランで日々の伴走が深くなる',
            ]}
            accentColor="#4dc3ff"
            accentGradient="linear-gradient(135deg,#a5e6ff,#4dc3ff,#2f9fd6)"
            url="https://core-nexus-kappa.vercel.app/lp/"
          />

          {/* オーナー指示 2026-07-30: 主力は Prism → Resonance → Crystal。この順に並べる。
              reversed は左右交互のレイアウト指定なので、並べ替えに合わせて偶数番目に付け直した。 */}

          {/* RESONANCE — LINE を AI で（主力2） */}
          <FeatureProduct
            brand="resonance"
            badge="LINE を、AI エージェントに"
            tagline="LINE のご縁を、AIが温める。"
            taglineEn="Run LINE with an AI agent."
            description="名簿の一人ひとりに、その人のための一文を AI が書き分け、LINE で手紙のように届ける個別配信。Iris や Lume が見つけた「いま関心のある人」へ、最適なタイミングで届きます。"
            features={[
              '一人ひとりに、AIが文面を書き分ける',
              '送る前に必ず全件を確認できる安心設計',
              'Iris・Lume の来訪データで宛先を最適化',
            ]}
            accentColor="#06C755"
            accentGradient="linear-gradient(135deg,#34D399,#06C755,#0EA5E9)"
            url="https://resonancebot-ivory.vercel.app/lp"
            reversed
          />

          {/* CRYSTAL — 話しかけるだけの AI コンシェルジュ（主力3） */}
          <FeatureProduct
            brand="crystal"
            badge="AI コンシェルジュ ／ サイトに1行で"
            tagline="話しかけるだけで、すべて解決。"
            taglineEn="Speak, and it is handled."
            description="画面いっぱいに咲くクリスタルの花に、声で話しかけるだけ。あなたのサイトを訪れたお客様を 24 時間お迎えし、質問に答え、見込みの高い方から商談の日程まで受け取る、白と金の AI コンシェルジュです。"
            features={[
              '会社案内を貼るだけで学習・FAQ も自動生成',
              '有望なお客様を見極めて日程と連絡先を獲得',
              '設置は HTML にタグ1行、多言語で自動応対',
            ]}
            accentColor="#7DD3FC"
            accentGradient="linear-gradient(135deg,#6B7A99,#8C7A5E,#7DD3FC)"
            url="https://crystal-nine-self.vercel.app/"
          />

          {/* IRIS — Instagram を AI で */}
          <FeatureProduct
            brand="iris"
            badge="Instagram を、AI エージェントに"
            tagline="Instagram を、AIと育てる。"
            taglineEn="Run Instagram with an AI agent."
            description="投稿・分析・案件管理・DM 返信 —— Instagram 運用のすべてを AI が担います。ここで掴んだファンの反応は、そのまま Resonance の LINE 配信や、Prism の経営判断へと流れていきます。"
            features={[
              '投稿AI × Instagram 解析で戦略を自動化',
              '案件管理・DM 返信まで下書きを用意',
              '反応データを Resonance・Prism へ連携',
            ]}
            accentColor="#E1306C"
            accentGradient="linear-gradient(135deg,#FCB045,#E1306C,#833AB4)"
            url="/iris?lp=1"
            reversed
          />

          {/* LUME — すべてのリンクを束ねるハブ */}
          <FeatureProduct
            brand="lume"
            badge="すべてのリンクを、ひとつに"
            tagline="すべてのリンクを、ひとつに。"
            taglineEn="Every link, in one place."
            description="プロフィールのたった一行に、あなたのすべてのリンクを束ねるハブ。誰が、どこから、どのリンクに触れたのか —— そのクリックの流れは、Iris・Resonance・Prism すべての判断材料になります。"
            features={[
              '全リンクを、ひとつのプロフィールに集約',
              'クリックの偏りを熱で可視化するヒートマップ',
              '来訪データを Prism・Iris・Resonance へ',
            ]}
            accentColor="#FFA42A"
            accentGradient="linear-gradient(135deg,#FFD86B,#FFA42A,#FF7A18)"
            url="https://lume-deploy-five.vercel.app/"
          />

          {/* GUILD — 貢献で決める組織 OS */}
          <FeatureProduct
            brand="guild"
            badge="チーム ／ 貢献で決める組織 OS"
            tagline="肩書きではなく、貢献で動く。"
            taglineEn="Run your team by contribution."
            description="社員・副業・フリーランス・AI を、ひとつの「ギルド」へ。意思決定は提案と投票で透明に行い、決まったことは改ざんできない記録として刻まれます。Prism が率いる 13 名の AI 役員も、このギルドの一員として動きます。"
            features={[
              '提案 → 投票で、チーム全員が意思決定に参加',
              '決定は改ざん検知つきのタイムラインに記録',
              '社員・副業・フリーランス・AI を一つのギルドに',
            ]}
            accentColor="#2DD4BF"
            accentGradient="linear-gradient(135deg,#5EEAD4,#22D3EE,#2DD4BF)"
            url="https://guild-gauches-projects.vercel.app/?lp=1"
            reversed
          />

          {/* PULSE — 毎日のからだを見守るヘルスケアAI (第7のプロダクト) */}
          <FeatureProduct
            brand="pulse"
            badge="からだ見守り AI ／ Apple Watch をつなぐだけ"
            tagline="毎日のからだを、AIがやさしく見守る。"
            taglineEn="Daily wellness, gently watched."
            description="睡眠・心拍・歩数から「きょうの調子」を100点満点で読みとき、毎朝やさしいことばでお届け。がんばるためではなく、健やかでいるために。ピンクの光が呼吸する、からだ専用のAIです。"
            features={[
              'Apple Watch や iPhone をつなぐだけで自動記録',
              '「きょうの調子」スコアと、けさのことばを毎朝',
              'いつもと違う変化にはやく気づき、専門家に見せられる記録に',
            ]}
            accentColor="#FF5C8A"
            accentGradient="linear-gradient(135deg,#FF5C8A,#E8859E,#C9A192)"
            url="/pulse"
          />

          {/* STUDIO — ウェブ制作・受託開発 (受託サービスの導線。
              リンク先 /studio は白基調・法人トーンのため、暗い製品群の中で
              白いカードとして置き、世界観を一致させる) */}
          <a
            href="/studio"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '0.9rem',
              padding: 'clamp(2.2rem, 4vw, 3.2rem) clamp(1.4rem, 4vw, 3rem)',
              background: '#FFFFFF',
              border: '1px solid rgba(168,130,60,0.4)',
              borderRadius: 24,
              textDecoration: 'none',
              transition: 'transform 0.2s cubic-bezier(.4,0,.2,1), box-shadow 0.2s ease',
            }}
            className="lp-feature-product"
          >
            <span
              style={{
                fontFamily: FONT_SANS,
                fontSize: '0.68rem',
                letterSpacing: '0.32em',
                color: '#8f6d2f', /* 2026-07-30: #A8823C は白カード上で 3.55:1 と基準未達だった */
                fontWeight: 700,
              }}
            >
              CORE STUDIO — WEB PRODUCTION &amp; DEVELOPMENT
            </span>
            <span
              style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: 'clamp(1.3rem, 2.6vw, 1.7rem)',
                fontWeight: 700,
                lineHeight: 1.6,
                letterSpacing: '0.04em',
                color: '#111827',
              }}
            >
              成果から逆算する、
              <span style={{ display: 'inline-block' }}>ウェブ制作と受託開発。</span>
            </span>
            <span
              style={{
                fontFamily: FONT_SANS,
                fontSize: '0.92rem',
                lineHeight: 2,
                color: '#374151',
                maxWidth: 560,
              }}
            >
              {SUITE_COUNT}つの自社プロダクトを開発・運営する体制で、
              貴社のサイト制作からシステム開発まで一貫して承ります。
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 48,
                marginTop: '0.4rem',
                padding: '0 1.9rem',
                borderRadius: 6,
                background: '#111827',
                color: '#FFFFFF',
                fontFamily: FONT_SANS,
                fontSize: '0.88rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              制作スタジオを見る →
            </span>
            <span
              style={{
                fontFamily: FONT_SANS,
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                color: '#6B7280',
              }}
            >
              LP 1枚から、予約・決済つきサイト、業務システムまで
            </span>
          </a>
        </div>
      </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  REAL SCREENS — 実物で、ご覧ください（本番スクリーンショット6面の章扉） */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'products' && (
      <section
        id="screens"
        className="lp-section-pad"
        style={{ padding: '7rem 1.5rem', background: 'linear-gradient(180deg, #0A0D14, #12100a 55%, #0A0D14)', color: '#F3F6FB' }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', letterSpacing: '0.35em', textTransform: 'uppercase', color: '#C9A24B', fontSize: '0.8rem', margin: 0 }}>Real Screens</p>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3.6vw, 2.4rem)', fontWeight: 600, letterSpacing: '0.04em', margin: '0.6rem 0 0.4rem' }}>実物で、ご覧ください。</h2>
            <p style={{ color: 'rgba(226,232,240,0.68)', fontSize: '0.92rem', lineHeight: 2, maxWidth: 560, margin: '0 auto' }}>
              モックアップではなく、いま本番で動いている画面。<br />気になった一枚から、そのまま触れられます。
            </p>
          </div>
          <div className="lp-shot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              // 主力3つ (Prism → Resonance → Crystal) を先頭に。以降は上の PRODUCTS と同じ並び。
              { img: '/lp/shot-prism.jpg', name: 'Prism', cap: 'あなた専属のAI経営参謀', url: '/' },
              // Universe は別格。上の PRODUCTS タブと同じく Prism の直後に置く。
              { img: '/lp/shot-universe.jpg', name: 'Universe', cap: 'AIに任せられる仕事の地図', url: 'https://core-universe.vercel.app' },
              { img: '/lp/shot-resonance.jpg', name: 'Resonance', cap: 'LINEの返信を、AIが先に', url: 'https://resonancebot-ivory.vercel.app/lp' },
              { img: '/lp/shot-crystal.jpg', name: 'Crystal', cap: '話しかけられるAI接客', url: 'https://crystal-nine-self.vercel.app/' },
              { img: '/lp/shot-iris.jpg', name: 'Iris', cap: 'インフルエンサーの相棒AI', url: '/iris?lp=1' },
              { img: '/lp/shot-lume.jpg', name: 'Lume', cap: 'プロフィールを最も美しく', url: 'https://lume-deploy-five.vercel.app/' },
              { img: '/lp/shot-guild.jpg', name: 'Guild', cap: 'みんなで決める組織OS', url: 'https://guild-hazel.vercel.app/?lp=1' },
            ].map((s) => (
              <a
                key={s.name}
                href={s.url}
                target={s.url.startsWith('http') ? '_blank' : undefined}
                rel={s.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                style={{
                  display: 'block', textDecoration: 'none', color: 'inherit',
                  border: '1px solid rgba(201,162,75,0.25)', borderRadius: 16, overflow: 'hidden',
                  background: '#0b0a07',
                  transition: 'transform 0.2s cubic-bezier(.22,1,.36,1), box-shadow 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = '#C9A24B'; e.currentTarget.style.boxShadow = '0 26px 56px -26px rgba(0,0,0,.85)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(201,162,75,0.25)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ aspectRatio: '4 / 5', overflow: 'hidden' }}>
                  <img src={s.img} alt={s.name + ' の実際の画面'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </div>
                <div style={{ padding: '0.8rem 0.9rem 0.95rem', borderTop: '1px solid rgba(201,162,75,0.2)' }}>
                  <div style={{ fontFamily: '"Inter", sans-serif', fontSize: '0.85rem', letterSpacing: '0.12em', color: '#E9CD8A' }}>{s.name}</div>
                  {/* ↗ は「別タブで開く」の印。サイト内へ飛ぶ Prism / Iris には付けない（1137行の
                      v.external ? '見にいく ↗' : '詳しく見る →' と同じルールに揃える）。 */}
                  <div style={{ fontSize: '0.74rem', color: 'rgba(226,232,240,0.62)', marginTop: 2 }}>{s.cap} {s.url.startsWith('http') ? '↗' : '→'}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  PLATFORM — 価格グリッド    */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'products' && (
      <section
        id="platform"
        className="lp-section-pad"
        style={{ padding: '7rem 1.5rem', background: 'linear-gradient(180deg,#080B11 0%,#070A10 100%)' }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={sectionLabel}>
              <span style={sectionLabelMain}>プラットフォーム</span>
              <span style={sectionLabelSub}>PLATFORM</span>
            </p>
            <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.85rem, 3.8vw, 2.85rem)', fontWeight: 700, lineHeight: 1.5, marginBottom: '1.25rem', letterSpacing: '0.04em' }}>
              小さく始めて、大きく育てる。
            </h2>
            <p style={{ fontFamily: FONT_SERIF_JA, color: 'rgba(226,232,240,0.7)', fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)', maxWidth: 680, margin: '0 auto', lineHeight: 2 }}>
              どのプロダクトも、月々数千円から。事業が育ったら、そのまま上位プランへ。
              <br />
              {SUITE_COUNT_KANJI}つすべてが、ひとつの CORE でつながっています。
            </p>
          </div>
          <div className="lp-platform-grid">
            {PLATFORM_PLANS.map(p => (
              <a
                key={p.name}
                href={p.url}
                target={p.url.startsWith('http') ? '_blank' : undefined}
                rel="noopener"
                className="lp-tap-link lp-plan-card"
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.55rem',
                  padding: '1.7rem 1.6rem 1.5rem', borderRadius: 18, textDecoration: 'none',
                  background: p.featured ? 'linear-gradient(160deg, rgba(125,211,252,0.14), rgba(125,211,252,0.02))' : 'rgba(255,255,255,0.03)',
                  border: p.featured ? '1px solid rgba(125,211,252,0.55)' : '1px solid rgba(125,211,252,0.22)',
                  boxShadow: p.featured ? '0 24px 60px -30px rgba(125,211,252,0.45)' : 'none',
                  color: '#F3F6FB', position: 'relative',
                }}
              >
                <span style={{ fontFamily: FONT_SANS, fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 700, color: p.featured ? '#BAE6FD' : 'rgba(226,232,240,0.5)' }}>{p.step}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem' }}>
                  <span style={{
                    width: 46, height: 46, borderRadius: 13, display: 'grid', placeItems: 'center', flexShrink: 0,
                    background: `radial-gradient(circle at 50% 30%, ${p.accent}26, #0c0a07)`,
                    border: `1px solid ${p.accent}55`, boxShadow: `0 0 18px ${p.accent}26`,
                  }}>
                    <p.Logo size={30} withWordmark={false} />
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '1.45rem', fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.2 }}>{p.name}</span>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.62rem', letterSpacing: '0.22em', color: p.accent, textTransform: 'uppercase', marginTop: 3 }}>{p.role}</span>
                  </span>
                </span>
                <span style={{ fontFamily: FONT_SANS, fontSize: '0.82rem', color: 'rgba(226,232,240,0.65)', lineHeight: 1.85, minHeight: '3em', marginTop: '0.3rem' }}>{p.copy}</span>
                <span style={{
                  marginTop: 'auto', paddingTop: '0.9rem', borderTop: '1px solid rgba(125,211,252,0.2)',
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.6rem',
                }}>
                  <span style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '1.26rem', color: p.featured ? '#BAE6FD' : '#F3F6FB', fontVariantNumeric: 'tabular-nums' }}>
                    {p.price}
                    <small style={{ fontSize: '0.72rem', fontWeight: 400, color: 'rgba(226,232,240,0.6)', marginLeft: 6 }}>{p.priceNote}</small>
                  </span>
                  <span style={{ fontFamily: FONT_SANS, fontSize: '0.72rem', fontWeight: 600, color: p.accent, whiteSpace: 'nowrap' }}>詳しく →</span>
                </span>
              </a>
            ))}
          </div>
          {/* 2026-08-02: 0.48=4.27:1 で AA(4.5:1) に届いていなかった。料金の但し書きは
              いちばん読まれないと困る文。0.60=6.2:1 に上げる（薄さの序列は 0.56<0.58<0.60 で維持）。 */}
          <p style={{ textAlign: 'center', marginTop: '1.6rem', fontFamily: FONT_SANS, fontSize: '0.74rem', color: 'rgba(226,232,240,0.60)', lineHeight: 1.9 }}>
            ※ 価格は税込・月額の入口プランです。詳細は各プロダクトのページでご確認ください。
          </p>
        </div>
      </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  CORE VERTICAL — 業界特化ライン（プラットフォームとは別の棚） */}
      {/*  第1弾 ULTIMA（建設・電気設備工事） / 第2弾 ANIMA（アニメ制作進行） */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'products' && (
      <section
        id="vertical"
        className="lp-section-pad"
        style={{ padding: '7rem 1.5rem', background: 'radial-gradient(120% 100% at 50% 0%, #0C1119 0%, #070A10 68%)', scrollMarginTop: 70 }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={sectionLabel}>
              <span style={sectionLabelMain}>業&nbsp;界&nbsp;特&nbsp;化</span>
              <span style={sectionLabelSub}>CORE&nbsp;VERTICAL</span>
            </p>
            <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.85rem, 3.8vw, 2.85rem)', fontWeight: 700, lineHeight: 1.5, marginBottom: '1.25rem', letterSpacing: '0.04em' }}>
              あなたの業界の、AI。
            </h2>
            <p style={{ fontFamily: FONT_SERIF_JA, color: 'rgba(226,232,240,0.7)', fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)', maxWidth: 680, margin: '0 auto 2rem', lineHeight: 2 }}>
              どの業界でも使える道具とは別に、ひとつの業界の仕事そのものを引き受けるAIを作っています。
              <br />
              その業界の言葉で話し、その業界の書類を作り、その業界の法令の中で動きます。
            </p>

            {/*
              2026-08-02 オーナー指摘「どの業界なのか分かりづらい」への対応。
              まず業種の名札だけを並べて「自分の業界はどれか」を先に決めてもらう。
              押すとその業界のカードへ。色は業種ごとに必ず違う色相（verticalData.ts）。
            */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center',
            }}>
              {VERTICALS.map(v => (
                <a
                  key={v.key}
                  href={`#vertical-${v.key}`}
                  onClick={e => scrollToVerticalCard(e, `vertical-${v.key}`)}
                  className="lp-tap-link"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    minHeight: 44, padding: '0 1.05rem', borderRadius: 999,
                    textDecoration: 'none', color: v.accent,
                    background: `${v.accent}14`, border: `1px solid ${v.accent}59`,
                    fontFamily: FONT_SANS, fontSize: '0.84rem', fontWeight: 800, letterSpacing: '0.04em',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  <VerticalIndustryIcon kind={v.industryIcon} size={17} />
                  {v.industryShort}
                </a>
              ))}
            </div>
          </div>

          <div className="lp-vertical-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {VERTICALS.map(v => {
              const Logo = v.key === 'ultima' ? UltimaLogo : v.key === 'anima' ? AnimaLogo : v.key === 'soma' ? SomaLogo : v.key === 'tabitto' ? TabittoLogo : VeritasLogo;
              return (
                <a
                  key={v.key}
                  id={`vertical-${v.key}`}
                  href={v.path}
                  target={v.external ? '_blank' : undefined}
                  rel={v.external ? 'noopener' : undefined}
                  className="lp-tap-link"
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '0.55rem', textDecoration: 'none', color: '#F3F6FB',
                    padding: 0, borderRadius: 18, overflow: 'hidden', scrollMarginTop: 84,
                    background: `linear-gradient(165deg, ${v.accent}1C, rgba(255,255,255,0.02))`,
                    border: `1px solid ${v.accent}4D`,
                  }}
                >
                  {/*
                    業種の帯 — カードのいちばん上に、業種だけを大きく。
                    ここを読めば「自分向けかどうか」が製品名を知らなくても分かる。
                  */}
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '0.55rem',
                    padding: '0.7rem 1.6rem', background: `${v.accent}24`,
                    borderBottom: `1px solid ${v.accent}40`, color: v.accent,
                    fontFamily: FONT_SANS, fontSize: '0.86rem', fontWeight: 800, letterSpacing: '0.06em',
                  }}>
                    <VerticalIndustryIcon kind={v.industryIcon} size={18} />
                    {v.industryShort}のかたへ
                  </span>

                  <span style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', padding: '1.3rem 1.6rem 1.6rem', flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <span style={{
                        width: 50, height: 50, borderRadius: 14, display: 'grid', placeItems: 'center', flexShrink: 0,
                        background: `radial-gradient(circle at 50% 30%, ${v.accent}2E, #0c0a07)`,
                        border: `1px solid ${v.accent}66`, boxShadow: `0 0 20px ${v.accent}26`,
                      }}>
                        <Logo size={31} withWordmark={false} />
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '1.42rem', fontWeight: 600, letterSpacing: '0.06em', lineHeight: 1.2 }}>{v.name}</span>
                        <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.6rem', letterSpacing: '0.22em', color: v.accent, textTransform: 'uppercase', marginTop: 3 }}>{v.role}</span>
                      </span>
                    </span>
                    {/* 2026-08-02: 0.45=3.87:1 で AA 落第。10.9px しかない業種名が
                        いちばん薄いのは逆＝小さい字ほど濃くする。0.58=5.9:1。 */}
                    <span style={{ fontFamily: FONT_SANS, fontSize: '0.72rem', color: 'rgba(226,232,240,0.58)', letterSpacing: '0.05em', marginTop: '0.5rem' }}>{v.industry}</span>
                    <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.02rem', fontWeight: 700, lineHeight: 1.65 }}>{v.tagline}</span>
                    <span style={{ fontFamily: FONT_SANS, fontSize: '0.81rem', color: 'rgba(226,232,240,0.65)', lineHeight: 1.9 }}>{v.body}</span>
                    <span style={{
                      marginTop: 'auto', paddingTop: '1rem', borderTop: `1px solid ${v.accent}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap',
                    }}>
                      {/* 同上。「本番稼働中 / デモ公開中」は買う前にいちばん確かめたい一行。 */}
                      <span style={{ fontFamily: FONT_SANS, fontSize: '0.7rem', color: 'rgba(226,232,240,0.58)' }}>{v.status}</span>
                      <span style={{ fontFamily: FONT_SANS, fontSize: '0.78rem', fontWeight: 700, color: v.accent, whiteSpace: 'nowrap' }}>
                        {v.external ? '見にいく ↗' : '詳しく見る →'}
                      </span>
                    </span>
                  </span>
                </a>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <a
              href="/vertical"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 48,
                padding: '0 26px', borderRadius: 999, textDecoration: 'none',
                fontFamily: FONT_SANS, fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em',
                color: '#EEF2F7', border: '1px solid rgba(125,211,252,0.55)', background: 'rgba(125,211,252,0.08)',
              }}
            >
              業界特化ラインを見る →
            </a>
          </div>
        </div>
      </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  USE CASES (誰のための CORE か) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'products' && (
      <section
        id="who"
        className="lp-section-pad"
        style={{ padding: '7rem 1.5rem', background: 'linear-gradient(180deg,#080B11 0%,#070A10 100%)' }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.75rem' }}>
            <p style={sectionLabel}>
              <span style={sectionLabelMain}>使い方</span>
              <span style={sectionLabelSub}>WHO&nbsp;IT&apos;S&nbsp;FOR</span>
            </p>
            <h2 style={{
              fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.85rem, 3.8vw, 2.85rem)',
              fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.04em', marginBottom: '1.1rem',
            }}>
              組み合わせ方は、あなた次第。
            </h2>
            <p style={{
              fontFamily: FONT_SERIF_JA, color: 'rgba(226,232,240,0.7)',
              fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)', maxWidth: 660, margin: '0 auto', lineHeight: 2,
            }}>
              四つは、ひとつずつでも、すべて一緒でも。
              <br />
              あなたの仕事に合わせて、必要なところから始められます。
            </p>
          </div>

          <div
            className="lp-usecase-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}
          >
            <UseCaseCard
              persona="個人事業主・経営者"
              headline="経営も、SNSも、片手間に。"
              body="判断・営業・財務・事務は Prism の AI 役員 13 名へ。集客の Instagram・LINE もつなげば、現場の反応がそのまま経営判断に届きます。"
              tools={[{ t: 'Prism', c: '#a78bfa' }, { t: 'Iris', c: '#E1306C' }, { t: 'Resonance', c: '#06C755' }]}
              lead="Prism"
            />
            <UseCaseCard
              persona="インフルエンサー・クリエイター"
              headline="発信から収益まで、一本の線に。"
              body="Iris で Instagram を伸ばし、Lume で全リンクをひとつのプロフィールに束ねる。どの投稿が、どのリンクのクリックを生んだかまで見えます。"
              tools={[{ t: 'Iris', c: '#E1306C' }, { t: 'Lume', c: '#FFA42A' }]}
              lead="Iris"
            />
            <UseCaseCard
              persona="店舗・サロン・教室"
              headline="一度きりを、また会いたいへ。"
              body="Resonance が LINE のご縁を一人ひとり温め、Lume が予約や各リンクへの動線を可視化。来店につながる流れを、AI が静かに育てます。"
              tools={[{ t: 'Resonance', c: '#06C755' }, { t: 'Lume', c: '#FFA42A' }]}
              lead="Resonance"
            />
          </div>
        </div>
      </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  13 変わらないもの ＋ 14 数字で見る CORE */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'company' && (
      <>
        <CreedBand onAnchor={handleAnchor} />
        <PhilosophyCore />
        <CoreNumbersSection />
      </>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  JOURNEY (歩み)              */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'company' && (
      <section
        id="journey"
        className="lp-section-pad"
        style={{
          padding: '7rem 1.5rem',
          background: 'radial-gradient(120% 80% at 50% 20%, #0c0a05 0%, #070A10 70%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={sectionLabel}>
              <span style={sectionLabelMain}>歩&nbsp;み</span>
              <span style={sectionLabelSub}>JOURNEY</span>
            </p>
            <motion.h2
              initial={{ y: 20 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9 }}
              style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: 'clamp(1.85rem, 3.5vw, 2.65rem)',
                fontWeight: 700,
                lineHeight: 1.5,
                letterSpacing: '0.05em',
              }}
            >
              はじまりから、その先へ。
            </motion.h2>
            <p style={{
              fontFamily: FONT_SERIF_EN,
              fontSize: 'clamp(0.85rem, 1.3vw, 1rem)',
              color: 'rgba(226,232,240,0.52)',
              fontStyle: 'italic',
              letterSpacing: '0.08em',
              marginTop: '0.85rem',
            }}>
              From the first day, toward what stays.
            </p>
          </div>

          {/* 縦タイムライン */}
          <MobileFold summary="これまでの歩み（2025年〜）">
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, position: 'relative' }}>
            {/* 縦線 */}
            <div aria-hidden style={{
              position: 'absolute',
              left: 'calc(1.1rem - 1px)',
              top: 6,
              bottom: 6,
              width: 2,
              background: 'linear-gradient(180deg, rgba(186,230,253,0.65), rgba(125,211,252,0.4), rgba(125,211,252,0.12))',
            }} />
            {[
              {
                year: '2026',
                title: 'CORE 創業',
                body: '「いつの時代も、変わらない核を」を理念に創業。事業家のための Prism を起点に、Iris・Resonance・Lume を加えた四つのプロダクトと、13 名の AI 役員で、中小経営者と個人事業主を支える土台を築きます。',
                accent: '#E0F2FE',
              },
              {
                year: '2026 後期',
                title: '四プロダクトの本格ローンチ',
                body: '日本の個人事業主・中小経営者へ正式リリース。使ったぶんだけ支払い、上限を超えたぶんは買い足す。気づかぬうちに高額にならない、公正な料金設計で届けます。',
                accent: '#BAE6FD',
              },
              {
                year: '2027',
                title: '法人プランとチーム機能',
                body: 'メンバー招待、共有ダッシュボード、外部ツール連携を整え、5〜50 名の組織にも導入できる体験へ。経営者と現場をつなぐ「橋」を、AI が担います。',
                accent: '#7DD3FC',
              },
              {
                year: '2028 —',
                title: '国境を越える「核」',
                body: '英語・韓国語・台湾繁体字に対応し、東アジアの中小経営者へ。やさしい言葉でいつでも頼れる AI 役員を、誰の手元にも届けます。',
                accent: '#A98B57',
              },
            ].map((m, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{
                  display: 'flex',
                  gap: '1.25rem',
                  paddingLeft: 0,
                  marginBottom: '2.5rem',
                  alignItems: 'flex-start',
                  position: 'relative',
                }}
              >
                {/* ドット (核を象る同心円) */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `radial-gradient(circle, ${m.accent} 0%, ${m.accent}22 70%, transparent 72%)`,
                  border: `1px solid ${m.accent}66`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: `0 0 18px ${m.accent}44, 0 0 0 4px #070A10`,
                  position: 'relative',
                  zIndex: 2,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#fff',
                    boxShadow: `0 0 8px ${m.accent}`,
                  }} />
                </div>
                <div style={{ flex: 1, paddingTop: '0.2rem' }}>
                  <div style={{
                    fontFamily: FONT_SERIF_EN,
                    fontSize: '0.78rem',
                    letterSpacing: '0.22em',
                    color: m.accent,
                    fontWeight: 700,
                    marginBottom: '0.4rem',
                  }}>
                    {m.year}
                  </div>
                  <div style={{
                    fontFamily: FONT_SERIF_JA,
                    fontSize: 'clamp(1.15rem, 1.85vw, 1.4rem)',
                    fontWeight: 700,
                    color: '#F3F6FB',
                    marginBottom: '0.6rem',
                    letterSpacing: '0.04em',
                  }}>
                    {m.title}
                  </div>
                  <p style={{
                    fontFamily: FONT_SERIF_JA,
                    fontSize: 'clamp(0.9rem, 1.3vw, 1rem)',
                    color: 'rgba(226,232,240,0.7)',
                    lineHeight: 1.95,
                    margin: 0,
                  }}>
                    {m.body}
                  </p>
                </div>
              </motion.li>
            ))}
          </ol>
          </MobileFold>

        </div>
      </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  ABOUT (会社概要)            */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'company' && (
      <section
        id="about"
        className="lp-section-pad"
        style={{
          padding: '7rem 1.5rem',
          background: '#070A10',
        }}
      >
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={sectionLabel}>
              <span style={sectionLabelMain}>会社概要</span>
              <span style={sectionLabelSub}>ABOUT</span>
            </p>
            <h2
              style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: 'clamp(1.85rem, 3.5vw, 2.6rem)',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              わたしたちについて
            </h2>
          </div>

          {/* CEO 紹介ブロック */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '2.5rem',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '3.5rem',
              padding: '2.5rem',
              border: '1px solid rgba(125,211,252,0.24)',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.025)',
            }}
          >
            <picture>
              <source srcSet="/ceo-naoki-ide-v2.webp" type="image/webp" />
              <img
                src="/ceo-naoki-ide-v2.jpg"
                alt="井出 直毅 / Naoki Ide — Founder & CEO"
                width={240}
                height={320}
                loading="lazy"
                decoding="async"
                style={{
                  width: 240,
                  height: 320,
                  objectFit: 'cover',
                  borderRadius: 16,
                  boxShadow: '0 18px 44px rgba(0,0,0,0.6), 0 0 0 1px rgba(125,211,252,0.45), 0 0 40px rgba(125,211,252,0.12)',
                  display: 'block',
                  flexShrink: 0,
                }}
              />
            </picture>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <p
                style={{
                  fontFamily: FONT_SERIF_EN,
                  fontSize: '0.78rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(226,232,240,0.6)',
                  marginBottom: '0.6rem',
                }}
              >
                Founder &amp; CEO
              </p>
              <p
                style={{
                  fontFamily: FONT_SERIF_JA,
                  fontSize: 'clamp(1.4rem, 2.2vw, 1.75rem)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  marginBottom: '0.2rem',
                  color: '#F3F6FB',
                }}
              >
                井出 直毅
              </p>
              <p
                style={{
                  fontFamily: FONT_SERIF_EN,
                  fontSize: '1rem',
                  color: 'rgba(226,232,240,0.75)',
                  letterSpacing: '0.06em',
                  marginBottom: '1.25rem',
                }}
              >
                Naoki Ide
              </p>
              <p
                style={{
                  fontFamily: FONT_SERIF_EN,
                  fontSize: '0.95rem',
                  color: 'rgba(226,232,240,0.7)',
                  lineHeight: 1.7,
                  fontStyle: 'italic',
                }}
              >
                Multidisciplinary creator at the intersection of business, music, dentistry, and AI.
              </p>
            </div>
          </div>

          {/* オーナー指示 2026-07-30: 「AI 役員 13 名」ブロックは削除。
              会社紹介の途中で製品の内部構成（CXO の一覧）を並べると、
              読み手の関心が「誰の会社か」から逸れて縦も伸びる。
              役員の話は Prism 側の LP に置く。 */}

          <MobileFold summary="会社情報（設立・所在地・事業内容）">
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 0,
              border: '1px solid rgba(125,211,252,0.24)',
              borderRadius: 14,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.025)',
            }}
          >
            <InfoRow label="会社名"     subLabel="Company"      value={COMPANY.nameJa}  subValue={COMPANY.nameEn} />
            <InfoRow label="設立"       subLabel="Founded"      value={COMPANY.founded} />
            <InfoRow label="代表取締役" subLabel="CEO"           value={COMPANY.ceoJa}    subValue={COMPANY.ceoEn} />
            <InfoRow label="本社所在地" subLabel="Headquarters" value={COMPANY.addressJa} subValue={COMPANY.addressEn} />
            <InfoRow label="事業内容"   subLabel="Business"     value="エージェントAIを中心とした SaaS の開発・運営" />
            <InfoRow label="提供サービス" subLabel="Products"   value="CORE Nexus（話しながら画面に描くAI秘書）／ CORE Universe（AIに任せられる仕事の宇宙図）／ CORE Prism（事業家向け）／ CORE Iris（インフルエンサー向け）／ CORE Resonance（店舗・サロン・教室向け）／ CORE Lume（クリエイター向け）／ Crystal（AI コンシェルジュ・接客サイト向け）／ CORE Pulse（からだ見守りAI）" isLast />
          </dl>
          </MobileFold>

          {/* 現在の提供状況について（feedback_lp_selling_structure §8 と同型。各サービスのFAQ/約款で
              既に開示済みの事実のみを転記し、法人サイト側にも同じ開示を横展開する。新規の数字・約束は作らない） */}
          <div style={{ marginTop: '3.5rem' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.72rem', letterSpacing: '0.28em', color: '#7DD3FC', textTransform: 'uppercase', marginBottom: '0.8rem', textAlign: 'center' }}>
              Current Status
            </p>
            <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.25rem, 2.3vw, 1.6rem)', fontWeight: 700, textAlign: 'center', marginBottom: '0.8rem', letterSpacing: '0.03em' }}>
              現在の提供状況について
            </h3>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: 'rgba(226,232,240,0.68)', lineHeight: 1.9, textAlign: 'center', maxWidth: 620, margin: '0 auto 2.2rem' }}>
              各サービスを正しくご検討いただけるよう、現在対応が完了していない点も含めて開示します。
            </p>
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              {[
                { t: '株式会社COREとして運営しています', d: '法人化にともない、運営体制は株式会社CORE（代表 井出直毅）に切り替わりました。安心してお試しいただけるよう、各サービスに無料お試し期間といつでも解約可能な仕組みを設けています。' },
                { t: '「絶対に継続する」とはお約束できません', d: 'これはどの事業者にも共通する点です。解約はいつでも各サービスの画面から行え、電話等での引き止めは行いません。' },
                { t: '導入実績・効果数値は、公開できる段階のもののみ記載しています', d: '「導入◯◯社」「効果◯◯%」といった数字は、実績として公開できる段階に至るまでは記載しません。公開可能になり次第、各サービスのページに掲載します。' },
                { t: '一部の管理機能は開発中です', d: '例えば Prism では、アプリ内での領収書発行画面が現時点では未実装です。必要な方はメールにてご連絡いただければ個別に対応します。' },
              ].map((c) => (
                <div key={c.t} style={{ padding: '1.4rem 1.6rem', borderRadius: 14, border: '1px solid rgba(125,211,252,0.24)', background: 'rgba(255,255,255,0.025)' }}>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontWeight: 600, fontSize: '0.95rem', color: '#F3F6FB', lineHeight: 1.8, marginBottom: '0.5rem' }}>{c.t}</p>
                  <p style={{ fontFamily: FONT_SANS, fontSize: '0.82rem', color: 'rgba(226,232,240,0.62)', lineHeight: 1.9 }}>{c.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  EXECUTIVE WELL-BEING PACKAGE */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'company' && (
      <section
        id="executive"
        className="lp-section-pad"
        style={{ padding: '7rem 1.5rem', background: '#070A10' }}
      >
        <div
          style={{
            maxWidth: 1080, margin: '0 auto', position: 'relative', overflow: 'hidden',
            borderRadius: 24, padding: 'clamp(2.4rem, 5vw, 4.2rem)',
            /* 白ベース化でも、この演奏ショーケースは金×黒の高級タイルとして暗いまま残す(白ページ上のアクセント) */
            background: 'radial-gradient(140% 120% at 85% -20%, #121B2B 0%, #080B11 60%)',
            border: '1px solid rgba(125,211,252,0.5)',
            boxShadow: '0 40px 90px -40px rgba(125,211,252,0.55), inset 0 0 80px rgba(125,211,252,0.05)',
          }}
        >
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.74rem', letterSpacing: '0.3em', color: '#7DD3FC', textTransform: 'uppercase', marginBottom: '1.2rem' }}>
            Executive Well-being Package
          </p>
          <h2
            style={{
              fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.6rem, 3.4vw, 2.5rem)', fontWeight: 700, lineHeight: 1.7, letterSpacing: '0.04em',
              background: 'linear-gradient(120deg, #FFFFFF, #7DD3FC)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
              marginBottom: '1.2rem',
            }}
          >
            AI が事業を伸ばし、
            <br />
            音楽が組織を潤す。
          </h2>
          <p style={{ fontFamily: FONT_SERIF_JA, color: 'rgba(255,255,255,0.68)', fontSize: 'clamp(0.92rem, 1.4vw, 1.02rem)', lineHeight: 2.1, maxWidth: 640 }}>
            CORE の上位プランをご契約の企業さまだけにご案内する、招待制の最上位パッケージ。
            主宰・井出直毅のもう一つの顔 —— 世界のラグジュアリーの現場で演奏するチェリスト
            <strong style={{ color: '#BAE6FD', fontWeight: 600 }}> GAUCHE </strong>
            による特別な体験を、御社の福利厚生とブランドに。
          </p>
          <div className="lp-exec-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', margin: '2.2rem 0 2.4rem' }}>
            {[
              { t: '周年・VIP レセプションでの出張演奏', d: 'リッツ・カールトン、Loro Piana Milano で磨いた演奏が、御社のイベントの「格」を引き上げます。' },
              { t: 'チェロスクール法人契約（福利厚生）', d: '従業員は GAUCHE Cello School の受け放題レッスンへ。楽器は無料貸与、手ぶらで始められます。' },
              { t: '経営層向け Executive Private 優先枠', d: '役員・経営層のための完全1対1レッスン。多忙な予定に合わせるフルフレックス制。' },
            ].map(f => (
              <div key={f.t} style={{ padding: '1.3rem 1.2rem', borderRadius: 14, background: 'rgba(125,211,252,0.05)', border: '1px solid rgba(125,211,252,0.22)' }}>
                <p style={{ fontFamily: FONT_SERIF_JA, fontWeight: 600, fontSize: '0.95rem', color: '#EEF2F7', lineHeight: 1.8, marginBottom: '0.5rem' }}>{f.t}</p>
                <p style={{ fontFamily: FONT_SANS, fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.9 }}>{f.d}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.2rem', justifyContent: 'space-between' }}>
            <p style={{ fontFamily: FONT_SERIF_EN, fontSize: '1.3rem', letterSpacing: '0.14em', color: '#BAE6FD' }}>
              By Invitation
              {/* 2026-07-31 巡回: 0.45(4.43:1) は 0.72rem の字送り広めの文だとさらに読みにくい。0.62 に。 */}
              <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: '0.72rem', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.62)', marginTop: 4 }}>
                上位プラン契約企業さま限定 ・ 完全個別お見積り
              </span>
            </p>
            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
              <a
                href={`mailto:${COMPANY.email}?subject=${encodeURIComponent('【Executive Well-being Package】ご相談')}`}
                className="lp-tap-link"
                style={{
                  fontFamily: FONT_SANS, fontSize: '0.88rem', fontWeight: 700, padding: '0.95rem 1.9rem', borderRadius: 999,
                  background: 'linear-gradient(135deg, #BAE6FD, #7DD3FC)', color: '#0B1220', textDecoration: 'none',
                }}
              >
                導入の相談をする
              </a>
              <a
                href="https://gauche-artist.vercel.app/"
                target="_blank"
                rel="noopener"
                className="lp-tap-link"
                style={{
                  fontFamily: FONT_SANS, fontSize: '0.88rem', fontWeight: 600, padding: '0.95rem 1.9rem', borderRadius: 999,
                  border: '1px solid rgba(125,211,252,0.5)', color: '#BAE6FD', textDecoration: 'none',
                }}
              >
                GAUCHE の演奏を見る ↗
              </a>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  14 CONTACT                 */}
      {/*  すべての章の CTA がここに集まる（2026-08-21 §16）。   */}
      {/*  メールだけの窓口から、要件を書いて送れるフォームへ。   */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'contact' && (
      <FaqSection />
      )}

      {tab === 'contact' && (
      <ContactSection>
        {/* フォームが合わない用件（取材・採用）のための、従来どおりのメール窓口 */}
        <div style={{ marginTop: '3.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.52)', letterSpacing: '0.18em', marginBottom: '1.1rem', fontFamily: FONT_SERIF_EN, textTransform: 'uppercase' }}>
            Other
          </p>
          <div
            className="lp-contact-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}
          >
            {[
              { label: '取材 / プレス', desc: 'メディア掲載・登壇依頼・資料請求', subject: '取材依頼' },
              { label: '採用 / 業務委託', desc: 'エンジニア・デザイナー・パートナー', subject: '採用に関心があります' },
              { label: 'プロダクトのご利用', desc: 'Prism・Resonance ほか各サービスについて', subject: 'プロダクトについて' },
            ].map((c, i) => (
              <a
                key={i}
                href={`mailto:${COMPANY.email}?subject=${encodeURIComponent(c.subject)}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1.5rem 1.25rem',
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px solid rgba(125,211,252,0.24)',
                  borderRadius: 14,
                  textDecoration: 'none',
                  color: 'inherit',
                  textAlign: 'center',
                  transition: 'background 0.2s, border-color 0.2s, transform 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(125,211,252,0.12)';
                  e.currentTarget.style.borderColor = 'rgba(125,211,252,0.4)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.035)';
                  e.currentTarget.style.borderColor = 'rgba(125,211,252,0.24)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontFamily: FONT_SERIF_JA, fontWeight: 600, fontSize: '0.95rem', color: '#F3F6FB', letterSpacing: '0.02em' }}>{c.label}</span>
                <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)', lineHeight: 1.6 }}>{c.desc}</span>
              </a>
            ))}
          </div>

          {/* 直接連絡 */}
          <p style={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.52)', letterSpacing: '0.18em', marginBottom: '0.85rem', fontFamily: FONT_SERIF_EN, textTransform: 'uppercase' }}>
            Direct
          </p>
          <a
            href={`mailto:${COMPANY.email}`}
            style={{
              ...ctaHero,
              fontFamily: '"SF Mono", "Menlo", monospace',
              letterSpacing: '0.05em',
              fontSize: '0.95rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <MailIcon size={17} strokeWidth={2.2} />
            {COMPANY.email}
          </a>
          {/* メールを書く前に、ほとんどの人が確かめたいのは
              「誰がやっているのか」「いくらか」「やめられるか」の 3 つ。
              リンクの文言でそれが分かるようにする（2026-07-31） */}
          <p style={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.60)', marginTop: '1.25rem', fontFamily: FONT_SERIF_JA, lineHeight: 1.8 }}>
            {/* 文中のリンクなので面は広げられないが、上下に余白を持たせて指で狙える
                高さ（実測 18px → 44px）にする。行の高さは変わらない。 */}
            <a href="/faq" style={{ color: '#BAE6FD', textDecoration: 'underline', textUnderlineOffset: 3, display: 'inline-block', padding: '13px 4px' }}>よくある質問</a>
            {' '}に、誰が作っているか・料金・解約・データの扱いをまとめています。
          </p>
          {/* 2026-08-03: 「動いているのか」を確かめる場所を、問い合わせる前に置く */}
          <p style={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.60)', marginTop: '0.6rem', fontFamily: FONT_SERIF_JA, lineHeight: 1.8 }}>
            <a href="/status" style={{ color: '#BAE6FD', textDecoration: 'underline', textUnderlineOffset: 3, display: 'inline-block', padding: '13px 4px' }}>いまの稼働状況</a>
            {' '}では、7つのサービスがこの瞬間ひらけるかを実際に測って出しています。
          </p>
        </div>
      </ContactSection>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  FOOTER                     */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer
        style={{
          background: '#070A10',
          padding: '3.5rem 1.5rem 2.5rem',
          borderTop: '1px solid rgba(125,211,252,0.14)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '2rem',
            marginBottom: '2.75rem',
          }}
        >
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, lineHeight: 1 }}>
              <img
                src="/core-logo-mark-v2.png"
                alt="CORE"
                width={396}
                height={240}
                style={{ height: 32, width: 'auto', flexShrink: 0 }}
              />
              <span
                aria-hidden
                style={{
                  fontFamily: '"Inter", "Noto Sans JP", sans-serif',
                  fontSize: 19.84,
                  fontWeight: 700,
                  letterSpacing: '0.42em',
                  color: '#E0F2FE',
                  background: 'linear-gradient(135deg, #FFFFFF, #BAE6FD, #38BDF8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1,
                }}
              >
                CORE
              </span>
            </span>
            <p
              style={{
                fontFamily: FONT_SERIF_JA,
                fontSize: '0.78rem',
                color: 'rgba(226,232,240,0.52)',
                lineHeight: 1.9,
                marginTop: '0.85rem',
              }}
            >
              いつの時代も、<br />変わらない核を。
            </p>
          </div>
          <div>
            <p style={footHead}>プロダクト</p>
            <a href="https://core-nexus-kappa.vercel.app/lp/" target="_blank" rel="noopener noreferrer" style={footLink} className="lp-tap-link">CORE Nexus</a>
            <a href="/?lp=1" style={footLink} className="lp-tap-link">CORE Prism</a>
            <a href="/iris?lp=1" style={footLink} className="lp-tap-link">CORE Iris</a>
            <a href="https://guild-gauches-projects.vercel.app/?lp=1" target="_blank" rel="noopener noreferrer" style={footLink} className="lp-tap-link">CORE Guild</a>
            <a href="https://resonancebot-ivory.vercel.app/lp" target="_blank" rel="noopener noreferrer" style={footLink} className="lp-tap-link">CORE Resonance</a>
            <a href="https://lume-deploy-five.vercel.app/" target="_blank" rel="noopener noreferrer" style={footLink} className="lp-tap-link">CORE Lume</a>
            <a href="https://crystal-nine-self.vercel.app/" target="_blank" rel="noopener noreferrer" style={footLink} className="lp-tap-link">Crystal</a>
            <a href="/pulse" style={footLink} className="lp-tap-link">CORE Pulse</a>
          </div>
          <div>
            <p style={footHead}>サービス</p>
            <a href="#whatwedo" onClick={e => handleAnchor(e, '#whatwedo')} style={footLink} className="lp-tap-link">事業内容</a>
            <a href="#companyos" onClick={e => handleAnchor(e, '#companyos')} style={footLink} className="lp-tap-link">AI COMPANY OS</a>
            <a href="#assessment" onClick={e => handleAnchor(e, '#assessment')} style={footLink} className="lp-tap-link">AI Transformation診断</a>
            <a href="#ai-native" onClick={e => handleAnchor(e, '#ai-native')} style={footLink} className="lp-tap-link">開発思想と技術</a>
            <a href="#partner" onClick={e => handleAnchor(e, '#partner')} style={footLink} className="lp-tap-link">パートナー提携</a>
          </div>
          <div>
            <p style={footHead}>会社</p>
            <a href="/studio" style={footLink} className="lp-tap-link">制作スタジオ</a>
            <a href="#philosophy-core" onClick={e => handleAnchor(e, '#philosophy-core')} style={footLink} className="lp-tap-link">思想</a>
            <a href="#about" onClick={e => handleAnchor(e, '#about')} style={footLink} className="lp-tap-link">会社概要</a>
            <a href="#contact" onClick={e => handleAnchor(e, '#contact')} style={footLink} className="lp-tap-link">お問い合わせ</a>
          </div>
          <div>
            <p style={footHead}>連絡先</p>
            <a href={`mailto:${COMPANY.email}`} style={footLink} className="lp-tap-link">{COMPANY.email}</a>
            <p
              style={{
                fontSize: '0.72rem',
                color: 'rgba(125,211,252,0.85)',
                lineHeight: 1.8,
                marginTop: '0.5rem',
                fontFamily: FONT_SERIF_JA,
              }}
            >
              {COMPANY.addressJa}
            </p>
          </div>
          {/* 2026-08-03: 競合 board は「稼働状況・更新履歴・ロードマップ」を常設で持っている。
              CORE は /status と /trust を作ってあったのに、どのページからもリンクが無く
              誰も辿り着けなかった。約束ではなく「いまどうなっているか」を常設で置く。 */}
          <div>
            <p style={footHead}>安心のために</p>
            <a href="/faq" style={footLink} className="lp-tap-link">よくある質問</a>
            <a href="/status" style={footLink} className="lp-tap-link">いまの稼働状況</a>
            <a href="/trust" style={footLink} className="lp-tap-link">データの取り扱い</a>
          </div>
          <div>
            <p style={footHead}>法務</p>
            {([
              { k: 'tokushou', label: '特定商取引法に基づく表記' },
              { k: 'terms', label: '利用規約' },
              { k: 'privacy', label: 'プライバシーポリシー' },
            ] as { k: LegalKind; label: string }[]).map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setLegalKind(k)}
                style={{ ...footLink, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, font: 'inherit', minHeight: '44px', display: 'flex', alignItems: 'center' }}
                className="lp-tap-link"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div
          style={{
            borderTop: '1px solid rgba(125,211,252,0.14)',
            paddingTop: '1.75rem',
            textAlign: 'center',
            fontSize: '0.7rem',
            /* 2026-08-02: 0.4=3.26:1。11.2px で会社名・運営責任者を名乗る行が
               ページ中いちばん読みにくかった（法務表記は読めることが要件）。0.56=5.5:1。 */
            color: 'rgba(226,232,240,0.56)',
            fontFamily: FONT_DISPLAY,
            letterSpacing: '0.25em',
          }}
        >
          © {new Date().getFullYear()} Naoki Ide — 株式会社CORE・運営責任者: 井出 直毅
        </div>
      </footer>
      {legalKind && (
        <LegalModal key={`legal-${legalKind}`} kind={legalKind} onClose={() => setLegalKind(null)} />
      )}
    </div>
  );
}

// ============================================================
//  CoreOrb — 中央の白光と虹色光線 (荘厳に、控えめに)


// ============================================================
//  CoreWatermark — 巨大な「CORE」の透かし背景文字
// ============================================================

// ============================================================
//  FeatureProduct — Prism / Iris をフィーチャーする横長カード
// ============================================================
function FeatureProduct({
  brand,
  badge,
  tagline,
  taglineEn,
  description,
  features,
  accentColor,
  accentGradient,
  url,
  reversed,
  defaultOpen,
}: {
  brand: 'prism' | 'iris' | 'guild' | 'resonance' | 'lume' | 'crystal' | 'pulse' | 'nexus';
  badge: string;
  tagline: string;
  taglineEn: string;
  description: string;
  features: string[];
  accentColor: string;
  accentGradient: string;
  url: string;
  reversed?: boolean;
  /** モバイルで最初から開いておくか（先頭のPrismだけ true） */
  defaultOpen?: boolean;
}) {
  const Logo =
    brand === 'iris' ? IrisLogo :
    brand === 'guild' ? GuildLogo :
    brand === 'resonance' ? ResonanceLogo :
    brand === 'lume' ? LumeLogo :
    brand === 'crystal' ? CrystalLogo :
    brand === 'pulse' ? PulseLogo :
    brand === 'nexus' ? NexusLogo :
    PrismLogo;
  const productName =
    brand === 'iris' ? 'CORE Iris' :
    brand === 'guild' ? 'CORE Guild' :
    brand === 'resonance' ? 'CORE Resonance' :
    brand === 'lume' ? 'CORE Lume' :
    brand === 'crystal' ? 'Crystal' :
    brand === 'pulse' ? 'CORE Pulse' :
    brand === 'nexus' ? 'CORE Nexus' :
    'CORE Prism';

  // モバイルでは7枚を畳む。デスクトップは常に開いたまま（見え方を変えない）。
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(!!defaultOpen);
  const expanded = !isMobile || open;

  return (
    <motion.div
      initial={{ y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.7 }}
      className={'lp-feature-product' + (isMobile ? ' is-mobile' : '') + (expanded ? ' is-open' : '')}
      style={{
        position: 'relative',
        marginBottom: '2rem',
        padding: 'clamp(2rem, 4vw, 3.5rem)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))',
        border: '1px solid rgba(125,211,252,0.2)',
        borderRadius: 24,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(1.5rem, 3vw, 2.25rem)',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {/* 装飾オーラ */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -100,
          [reversed ? 'left' : 'right']: -100,
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: accentColor,
          opacity: 0.18,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* モバイルだけの見出し行。タップで開閉する（閉じている時はこれだけが見える） */}
      {isMobile && (
        <button
          type="button"
          className="lp-fp-head"
          aria-expanded={expanded}
          onClick={() => setOpen(o => !o)}
        >
          <span className="lp-fp-head-logo" style={{ boxShadow: `0 0 18px ${accentColor}33` }}>
            <Logo size={30} withWordmark={false} />
          </span>
          <span className="lp-fp-head-txt">
            <span
              className="lp-fp-head-brand"
              style={{
                background: accentGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {brand.toUpperCase()}
            </span>
            <span className="lp-fp-head-tag">{tagline}</span>
          </span>
          <span className="lp-fp-head-mark" style={{ color: accentColor }} aria-hidden>
            {expanded ? '−' : '＋'}
          </span>
        </button>
      )}

      {/* ロゴ + 視覚要素 */}
      {!isMobile && (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            filter: `drop-shadow(0 12px 32px ${accentColor}66)`,
          }}
        >
          <Logo size={140} withWordmark={false} />
        </motion.div>
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 'clamp(1.25rem, 2vw, 1.6rem)',
            fontWeight: 700,
            letterSpacing: '0.4em',
            marginTop: '1.5rem',
            background: accentGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            paddingLeft: '0.4em',
          }}
        >
          {brand.toUpperCase()}
        </p>
        <p
          style={{
            fontSize: '0.7rem',
            color: 'rgba(226,232,240,0.55)',
            letterSpacing: '0.2em',
            marginTop: 4,
            fontFamily: FONT_SERIF_EN,
            fontStyle: 'italic',
          }}
        >
          {productName}
        </p>
      </div>
      )}

      {/* テキストコンテンツ */}
      {expanded && (
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 680, width: '100%', margin: '0 auto' }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: '0.7rem',
            letterSpacing: '0.25em',
            fontWeight: 700,
            padding: '0.35rem 0.85rem',
            borderRadius: 999,
            background: `${accentColor}25`,
            border: `1px solid ${accentColor}50`,
            color: accentColor,
            marginBottom: '1rem',
            fontFamily: FONT_SERIF_JA,
          }}
        >
          {badge}
        </span>
        <h3
          className="lp-fp-title"
          style={{
            fontFamily: FONT_SERIF_JA,
            fontSize: 'clamp(1.85rem, 3.4vw, 2.5rem)',
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: '0.5rem',
            letterSpacing: '0.04em',
          }}
        >
          {tagline}
        </h3>
        <p
          className="lp-fp-title-en"
          style={{
            fontFamily: FONT_SERIF_EN,
            fontSize: '0.9rem',
            color: 'rgba(226,232,240,0.52)',
            fontStyle: 'italic',
            letterSpacing: '0.1em',
            marginBottom: '1.5rem',
          }}
        >
          {taglineEn}
        </p>

        <p
          style={{
            fontFamily: FONT_SERIF_JA,
            fontSize: 'clamp(0.92rem, 1.4vw, 1rem)',
            color: 'rgba(226,232,240,0.78)',
            lineHeight: 2.1,
            marginBottom: '1.5rem',
            fontWeight: 400,
          }}
        >
          {description}
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem' }}>
          {features.map((f, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                fontFamily: FONT_SERIF_JA,
                fontSize: '0.92rem',
                color: 'rgba(226,232,240,0.78)',
                lineHeight: 1.9,
                marginBottom: '0.5rem',
              }}
            >
              <span
                style={{
                  color: accentColor,
                  flexShrink: 0,
                  fontSize: '0.7rem',
                  marginTop: '0.45rem',
                }}
              >
                ●
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <a
          href={url}
          {...(url.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: FONT_SERIF_JA,
            fontSize: '0.95rem',
            fontWeight: 700,
            // 明るいグラデ (Crystal 白金 / Lume 黄金 / Guild 淡ティール) は濃色文字で可読性を確保
            color: ['crystal', 'lume', 'guild'].includes(brand) ? '#0B1220' : '#fff',
            textDecoration: 'none',
            padding: '0.85rem 1.75rem',
            borderRadius: 12,
            background: accentGradient,
            boxShadow: `0 8px 24px ${accentColor}55`,
            letterSpacing: '0.08em',
          }}
        >
          {productName} を見る →
        </a>
      </div>
      )}
    </motion.div>
  );
}

// ============================================================
//  InfoRow — 会社概要の行
// ============================================================
function InfoRow({
  label,
  subLabel,
  value,
  subValue,
  isLast = false,
}: {
  label: string;
  subLabel: string;
  value: string;
  subValue?: string;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        padding: '1.4rem 1.75rem',
        borderBottom: isLast ? 'none' : '1px solid rgba(125,211,252,0.18)',
        alignItems: 'center',
        gap: '1rem',
      }}
      className="lp-info-row"
    >
      <div>
        <p
          style={{
            fontFamily: FONT_SERIF_JA,
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'rgba(226,232,240,0.92)',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: '0.65rem',
            letterSpacing: '0.25em',
            color: 'rgba(125,211,252,0.85)',
            marginTop: 4,
            fontWeight: 600,
          }}
        >
          {subLabel.toUpperCase()}
        </p>
      </div>
      <div>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', color: '#F3F6FB', lineHeight: 1.7, fontWeight: 500 }}>
          {value}
        </p>
        {subValue && (
          <p
            style={{
              fontFamily: FONT_SERIF_EN,
              fontSize: '0.78rem',
              color: 'rgba(226,232,240,0.52)',
              marginTop: 4,
              lineHeight: 1.6,
              fontStyle: 'italic',
            }}
          >
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  座組みの部品（2026-08-21 全面改訂）
//
//  古い版は「司令塔 Prism ＋ 5つの衛星」で、Nexus と Universe が図に居なかった。
//  実在するのは 8 つ（suiteData.SUITE_ALL）。数も並びもそこから引く。
//
//  図の考え方:
//    ・Guild は「ノード」ではなく、全員を包む〈場〉＝六角メンブレン。
//      貢献で動く組織そのものなので、点で描くと意味が変わる。
//    ・中心は Prism（経営）。
//    ・まわりの 6 つが部署。時計回りに 出会う → 届ける → 整える の順。
//    ・Universe は商品ではなく地図なので、場の外の「土台」に敷く。
// ============================================================

/** 図の衛星＝Guild 以外の 6 つ。Guild は場そのものなので点にしない。 */
const SUITE_SATELLITES = SUITE_MEMBERS.filter(m => m.key !== 'guild');

/**
 * 中心 50,50 の円周に等間隔で置く。半径は実測で決めた値。
 *
 * 罠（2026-08-21 実測）: 図の箱は min(90vw, 560px) なので、ハブが出る下限
 * 641px では箱が 577px しかない。カードは幅 116px(=20.1%)・高さ 112px(=19.4%)。
 * 半径 31 だと右上カードの角が六角メンブレンの斜辺（y=23.9 で x=83.6）を
 * 3.6% 越えて場の外へ出ていた。「Guild の場が全員を包む」という図の意味が壊れる。
 * 上下（r ≤ 31.9）より斜めのほうが厳しく、r ≤ 28.5。28 を採る。
 * 名札が2行に折れると高さが 133px に増えて再びはみ出すので、図では short を使う。
 */
const SAT_RADIUS = 27;
function satPos(i: number, total: number) {
  const a = (Math.PI * 2 * i) / total;
  return { x: 50 + SAT_RADIUS * Math.sin(a), y: 50 - SAT_RADIUS * Math.cos(a) };
}

const GUILD_TEAL = '#2dd4bf';

/** 衛星カード（角丸スクエア・発光）。ConnectedSuite の外に出してある
 *  ＝ 描画のたびに新しい型の要素になって中身が作り直されるのを防ぐ。 */
function SatCard({ m, size = 44 }: { m: SuiteMember; size?: number }) {
  const s = suiteService(m.key);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '0.85rem 0.6rem 0.75rem', width: 116,
      background: `radial-gradient(circle at 50% 30%, ${s.accent}24, #0c0a07)`,
      border: `1px solid ${s.accent}66`, borderRadius: 18,
      boxShadow: `0 0 26px ${s.accent}3a, inset 0 0 18px ${s.accent}14`,
      backdropFilter: 'blur(6px)',
    }}>
      <s.Logo size={size} withWordmark={false} />
      <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '0.82rem', color: '#F3F6FB', fontWeight: 600, fontStyle: 'italic' }}>{s.name}</span>
      {/* 部署名 = 製品名を知らない人が最初に読む一行。ここを薄くすると図の意味が消える。
          折り返し禁止: 2行になるとカードが伸びて六角の場からはみ出す（上の SAT_RADIUS の注記）。
          くわしい部署名（「集客 ─ Instagram」）は、図の下の一覧で読める。 */}
      <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.66rem', color: s.accent, fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
        {m.short}
      </span>
    </div>
  );
}

function PrismCard({ size = 58 }: { size?: number }) {
  const s = suiteService(SUITE_CORE.key);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '1.15rem 1.25rem 1rem', width: 144,
      background: 'radial-gradient(circle at 50% 32%, rgba(167,139,250,0.3), #0c0a07)',
      border: '1px solid rgba(167,139,250,0.6)', borderRadius: 22,
      boxShadow: '0 0 52px rgba(167,139,250,0.42), inset 0 0 26px rgba(167,139,250,0.14)',
    }}>
      <PrismLogo size={size} withWordmark={false} />
      <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.58rem', letterSpacing: '0.3em', color: 'rgba(226,232,240,0.6)', fontWeight: 700 }}>{s.name.toUpperCase()}</span>
      <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', color: '#F3F6FB', fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.5 }}>
        経営
        <br />
        7人の参謀
      </span>
    </div>
  );
}

/** 五つの持ち場を、流れとして1本に。図と一覧の共通の凡例になる。 */
function SuiteRoleChain() {
  return (
    <div
      className="lp-suite-chain"
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'center',
        gap: '0.5rem', maxWidth: 1020, margin: '0 auto 1rem',
      }}
    >
      {SUITE_ROLES.map((r, i) => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center',
            padding: '0.7rem 0.9rem', borderRadius: 14, width: 168, maxWidth: '100%',
            background: 'rgba(125,211,252,0.07)', border: '1px solid rgba(125,211,252,0.28)',
          }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.54rem', letterSpacing: '0.24em', color: 'rgba(186,230,253,0.8)', fontWeight: 700 }}>
              {r.en}
            </span>
            <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.98rem', fontWeight: 700, color: '#F3F6FB', letterSpacing: '0.08em' }}>
              {r.ja}
            </span>
            <span style={{ fontFamily: FONT_SANS, fontSize: '0.68rem', color: 'rgba(226,232,240,0.62)', lineHeight: 1.7 }}>
              {r.desc}
            </span>
          </div>
          {i < SUITE_ROLES.length - 1 && (
            <span aria-hidden style={{ alignSelf: 'center', color: 'rgba(125,211,252,0.55)', fontSize: '0.9rem' }}>→</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  ConnectedSuite — 座組みの図
//  Guild の〈場〉が全員を包み、中心の Prism に 6 部署がつながる。
//  土台に Universe（無料の地図）。
// ============================================================
function ConnectedSuite() {
  const sats = SUITE_SATELLITES.map((m, i) => ({ m, ...satPos(i, SUITE_SATELLITES.length) }));

  return (
    <div className="lp-connect-wrap">
      {/* ── HUB (デスクトップ / タブレット) ── */}
      {/* 図の箱。560px だと 6 枚のカードと中心の Prism が触れる（実測 ox=2px）。
          600px にすると、場の内側にも中心との間にも余白が残る（実測 gap 8px / 12px）。 */}
      <div className="lp-connect-hub" style={{ position: 'relative', width: 'min(92vw, 600px)', aspectRatio: '1 / 1', margin: '2.6rem auto 0' }}>
        {/* Guild の場：全員を内包する六角メンブレン（DAO＝組織そのもの・ノードではなく“場”） */}
        <motion.svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden
          animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0 }}>
          <defs>
            <linearGradient id="guildField" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#5eead4" />
              <stop offset="55%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#2dd4bf" />
            </linearGradient>
            <radialGradient id="guildFill" cx="50%" cy="44%" r="62%">
              <stop offset="0%" stopColor="rgba(45,212,191,0.12)" />
              <stop offset="68%" stopColor="rgba(45,212,191,0.035)" />
              <stop offset="100%" stopColor="rgba(45,212,191,0)" />
            </radialGradient>
          </defs>
          <path d="M25 8.4 L75 8.4 L98 50 L75 91.6 L25 91.6 L2 50 Z"
            fill="url(#guildFill)" stroke="url(#guildField)" strokeWidth="0.7" strokeOpacity="0.85" strokeLinejoin="round" />
          <path d="M28 13 L72 13 L92 50 L72 87 L28 87 L8 50 Z"
            fill="none" stroke="url(#guildField)" strokeWidth="0.3" strokeOpacity="0.4" strokeLinejoin="round" strokeDasharray="2 2.4">
            <animate attributeName="stroke-dashoffset" from="9" to="0" dur="3.4s" repeatCount="indefinite" />
          </path>
        </motion.svg>

        {/* 各部署 → 中心 Prism の接続線 */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 1 }}>
          {sats.map(s => (
            <line key={s.m.key} x1="50" y1="50" x2={s.x} y2={s.y} stroke={suiteService(s.m.key).accent}
              strokeWidth="0.5" strokeOpacity="0.6" strokeDasharray="1.6 1.8" strokeLinecap="round">
              <animate attributeName="stroke-dashoffset" from="7" to="0" dur="1.4s" repeatCount="indefinite" />
            </line>
          ))}
        </svg>

        {/* Guild ネームプレート（場のタイトル・上端中央） */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', zIndex: 4,
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.42rem 0.95rem', borderRadius: 999,
          background: 'rgba(6,18,16,0.88)', border: `1px solid ${GUILD_TEAL}88`,
          boxShadow: `0 0 24px ${GUILD_TEAL}55`, backdropFilter: 'blur(6px)', whiteSpace: 'nowrap',
        }}>
          <GuildLogo size={20} withWordmark={false} />
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.62rem', letterSpacing: '0.34em', color: '#7ef0dd', fontWeight: 700, paddingLeft: '0.34em' }}>GUILD</span>
        </div>
        {/* 場の意味（下端中央） */}
        <div style={{
          position: 'absolute', bottom: '-1.7rem', left: '50%', transform: 'translateX(-50%)', zIndex: 4,
          fontFamily: FONT_SERIF_JA, fontSize: '0.74rem', color: 'rgba(126,240,221,0.82)', letterSpacing: '0.06em', whiteSpace: 'nowrap',
        }}>
          実行 ─ 貢献で動く、ひとつの場〈Guild〉
        </div>

        <motion.div
          /* 呼吸は 1.045 → 1.03。ふくらんだ瞬間だけ隣のカードに触れていた（実測）。 */
          animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', left: '50%', top: '50%', x: '-50%', y: '-50%', zIndex: 3 }}>
          <PrismCard />
        </motion.div>
        {sats.map(s => (
          <div key={s.m.key} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)', zIndex: 2 }}>
            <SatCard m={s.m} />
          </div>
        ))}
      </div>

      {/* ── STACK (モバイル) ── */}
      <div className="lp-connect-stack" aria-hidden>
        <div style={{
          position: 'relative', width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '2rem 0.9rem 1.4rem', borderRadius: 24,
          border: `1px solid ${GUILD_TEAL}55`,
          background: `radial-gradient(circle at 50% 0%, ${GUILD_TEAL}16, transparent 70%)`,
          boxShadow: `inset 0 0 34px ${GUILD_TEAL}1a, 0 0 24px ${GUILD_TEAL}1f`,
        }}>
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)',
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.32rem 0.82rem', borderRadius: 999,
            background: '#06120f', border: `1px solid ${GUILD_TEAL}88`, boxShadow: `0 0 18px ${GUILD_TEAL}44`, whiteSpace: 'nowrap',
          }}>
            <GuildLogo size={16} withWordmark={false} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.56rem', letterSpacing: '0.3em', color: '#7ef0dd', fontWeight: 700, paddingLeft: '0.3em' }}>GUILD</span>
          </div>

          <PrismCard size={50} />
          <span className="lp-connect-branch" />
          <div className="lp-connect-sats">
            {SUITE_SATELLITES.map(m => {
              const s = suiteService(m.key);
              return (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '0.9rem',
                  padding: '0.7rem 0.9rem', width: '100%',
                  background: `radial-gradient(circle at 0% 50%, ${s.accent}20, #0c0a07)`,
                  border: `1px solid ${s.accent}55`, borderRadius: 16 }}>
                  <s.Logo size={36} withWordmark={false} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '1rem', color: '#F3F6FB', fontWeight: 600, fontStyle: 'italic' }}>{s.name}</span>
                    <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.7rem', color: s.accent, fontWeight: 700, letterSpacing: '0.04em' }}>{m.dept}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '1rem', fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', color: 'rgba(126,240,221,0.82)', letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.8 }}>
            実行 ─ 貢献で動く、ひとつの場〈Guild〉
          </div>
        </div>
      </div>

      {/* 土台 — Universe は売り物ではなく地図。場の外に敷く。 */}
      <a
        href="https://core-universe.vercel.app/"
        target="_blank"
        rel="noreferrer"
        className="lp-tap-link"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.85rem', flexWrap: 'wrap',
          maxWidth: 620, margin: '3.4rem auto 0', minHeight: 56, padding: '0.9rem 1.4rem',
          borderRadius: 18, textDecoration: 'none', color: '#F3F6FB',
          background: 'radial-gradient(120% 160% at 50% 0%, rgba(59,52,94,0.5), rgba(10,13,20,0.9))',
          border: '1px solid rgba(201,162,75,0.42)',
        }}
      >
        <img src="/universe-mark.png" alt="" aria-hidden style={{ width: 34, height: 34, flexShrink: 0, opacity: 0.92 }} />
        <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.86rem', lineHeight: 1.9, textAlign: 'left' }}>
          <strong style={{ color: '#E8CF9A', fontWeight: 700 }}>土台は、無料の地図。</strong>
          {' '}CORE Universe で「どの仕事から任せるか」を先に決められます。
        </span>
        <span style={{ fontFamily: FONT_SANS, fontSize: '0.78rem', fontWeight: 700, color: '#E8CF9A', whiteSpace: 'nowrap' }}>宇宙図をひらく ↗</span>
      </a>
    </div>
  );
}

// ============================================================
//  SuiteRoster — 座組みの一覧（どの部署が、どのサービスか）
//  図で形を見せ、ここで言葉にする。製品の詳細は真下の PRODUCTS 章。
// ============================================================
function SuiteRoster() {
  const roleJa = (k: SuiteRole) => SUITE_ROLES.find(r => r.key === k)!.ja;
  return (
    <div
      className="lp-suite-roster"
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(258px, 1fr))', gap: '0.75rem',
        maxWidth: 1080, margin: '3.5rem auto 0', textAlign: 'left',
      }}
    >
      {SUITE_ALL.map(m => {
        const s = suiteService(m.key);
        const isCore = m.key === SUITE_CORE.key;
        return (
          <div
            key={m.key}
            style={{
              display: 'flex', flexDirection: 'column', gap: '0.55rem',
              padding: '1.15rem 1.2rem', borderRadius: 16,
              background: `linear-gradient(165deg, ${s.accent}${isCore ? '1F' : '12'}, rgba(255,255,255,0.02) 76%)`,
              border: `1px solid ${s.accent}${isCore ? '66' : '33'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ display: 'inline-flex', flexShrink: 0 }}><s.Logo size={26} withWordmark={false} /></span>
              <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '1.02rem', fontStyle: 'italic', fontWeight: 600, color: '#F3F6FB' }}>{s.name}</span>
              <span style={{
                marginLeft: 'auto', flexShrink: 0,
                fontFamily: FONT_SANS, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.08em',
                color: s.accent, background: `${s.accent}1F`, border: `1px solid ${s.accent}4D`,
                borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
              }}>
                {roleJa(m.role)}
              </span>
            </div>
            {/* 0.58 未満は黒地で AA 落第。小さい字ほど濃くする（恒久ルール）。 */}
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.8rem', fontWeight: 700, color: s.accent, letterSpacing: '0.04em', margin: 0 }}>
              {m.dept}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.84rem', color: 'rgba(226,232,240,0.76)', lineHeight: 1.95, margin: 0 }}>
              {m.line}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  SuitePackage — 座組みの結論。「これ全部で、ひとつ」
//  価格は continuumPlans.ts、単品合計は suiteData.ts が唯一の出どころ。
//  ここで数字を打ち直さない（[[core-prism-honest-numbers]]）。
// ============================================================
function SuitePackage({ onAnchor }: { onAnchor: (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => void }) {
  return (
    <div
      style={{
        maxWidth: 960, margin: '4.5rem auto 0', padding: 'clamp(1.9rem, 4vw, 3rem) clamp(1.3rem, 4vw, 2.6rem)',
        borderRadius: 26, textAlign: 'center',
        background: 'linear-gradient(165deg, rgba(125,211,252,0.15), rgba(125,211,252,0.03) 72%)',
        border: '1px solid rgba(125,211,252,0.55)',
        boxShadow: '0 34px 90px -46px rgba(125,211,252,0.6)',
      }}
    >
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.34em', color: '#7DD3FC', textTransform: 'uppercase', marginBottom: '1rem' }}>
        CORE Continuum
      </p>
      <h3 style={{
        fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.4rem, 3.2vw, 2.15rem)', fontWeight: 700,
        lineHeight: 1.6, letterSpacing: '0.04em', color: '#F3F6FB', marginBottom: '1.1rem',
      }}>
        この{SUITE_COUNT_KANJI}つを、ひとつの契約で。
      </h3>
      <p style={{
        fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.92rem, 1.4vw, 1.02rem)',
        color: 'rgba(226,232,240,0.78)', lineHeight: 2.1, maxWidth: 640, margin: '0 auto 2rem',
      }}>
        単品でそろえると、おすすめプランの合計で
        {' '}<strong style={{ color: '#BAE6FD', fontWeight: 700 }}>月 {formatYen(SUITE_BEST_TOTAL)}</strong>。
        <br />
        Continuum なら、ひとつのアカウントで、ひとつの請求で使えます。
      </p>

      {/* 3プランの入口。実額は continuumPlans.ts から。 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.7rem', marginBottom: '2rem',
      }}>
        {CONTINUUM_PLANS.map(pl => (
          <div key={pl.name} style={{
            display: 'flex', flexDirection: 'column', gap: 4, minWidth: 168,
            padding: '0.95rem 1.2rem', borderRadius: 14,
            background: pl.featured ? 'rgba(125,211,252,0.16)' : 'rgba(255,255,255,0.04)',
            border: pl.featured ? '1px solid rgba(125,211,252,0.6)' : '1px solid rgba(255,255,255,0.12)',
          }}>
            <span style={{ fontFamily: FONT_SERIF_EN, fontSize: '0.92rem', letterSpacing: '0.08em', color: '#EEF2F7' }}>{pl.name}</span>
            <span style={{ fontFamily: FONT_SANS, fontVariantNumeric: 'tabular-nums', fontSize: '1.24rem', fontWeight: 800, color: pl.featured ? '#BAE6FD' : '#F4F7FC' }}>
              {pl.price}
              <span style={{ fontSize: '0.66rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginLeft: 5 }}>/ 月（税込）</span>
            </span>
            <span style={{ fontFamily: FONT_SANS, fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>{pl.tag}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.7rem' }}>
        <a
          href="/continuum"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 50,
            padding: '0 28px', borderRadius: 999, textDecoration: 'none',
            fontFamily: FONT_SANS, fontSize: '0.88rem', fontWeight: 800, letterSpacing: '0.04em',
            background: 'linear-gradient(90deg,#BAE6FD,#7DD3FC)', color: '#141414',
          }}
        >
          Continuum の世界を見る →
        </a>
        <a
          href="#continuum"
          onClick={e => onAnchor(e, '#continuum')}
          className="lp-tap-link"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 50,
            padding: '0 26px', borderRadius: 999, textDecoration: 'none',
            fontFamily: FONT_SANS, fontSize: '0.86rem', fontWeight: 800, letterSpacing: '0.04em',
            color: '#EEF2F7', border: '1px solid rgba(125,211,252,0.55)', background: 'rgba(125,211,252,0.08)',
          }}
        >
          プランと料金を見る
        </a>
      </div>

      <p style={{ fontFamily: FONT_SANS, fontSize: '0.72rem', color: 'rgba(255,255,255,0.62)', lineHeight: 2, marginTop: '1.5rem' }}>
        Pulse は先行モニター中のため無料（正式版 ¥2,980/月 の予定）で、上の合計には入れていません。
        <br />
        いつでも解約できます。
      </p>
    </div>
  );
}
// ───────────── ユースケース・カード ─────────────
function UseCaseCard({ persona, headline, body, tools, lead }: {
  persona: string; headline: string; body: string;
  tools: { t: string; c: string }[]; lead: string;
}) {
  const leadColor = tools.find(t => t.t === lead)?.c || tools[0].c;
  return (
    <motion.div
      initial={{ y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7 }}
      className="lp-usecase-card"
      style={{
        padding: '2rem 1.75rem',
        background: `linear-gradient(170deg, ${leadColor}12, rgba(255,255,255,0.02) 70%)`,
        border: `1px solid ${leadColor}33`,
        borderRadius: 18,
        display: 'flex', flexDirection: 'column', gap: '1.1rem',
      }}
    >
      <span style={{
        alignSelf: 'flex-start', fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', fontWeight: 700,
        letterSpacing: '0.08em', padding: '0.35rem 0.85rem', borderRadius: 999,
        background: `${leadColor}22`, border: `1px solid ${leadColor}55`, color: leadColor,
      }}>
        {persona}
      </span>
      <h3 style={{
        fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', fontWeight: 700,
        color: '#F3F6FB', letterSpacing: '0.03em', lineHeight: 1.5, margin: 0,
      }}>
        {headline}
      </h3>
      <p style={{
        fontFamily: FONT_SERIF_JA, fontSize: '0.92rem', color: 'rgba(226,232,240,0.72)',
        lineHeight: 2, margin: 0, flex: 1,
      }}>
        {body}
      </p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', borderTop: '1px solid rgba(125,211,252,0.2)', paddingTop: '1rem' }}>
        {tools.map((t, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            fontFamily: FONT_SERIF_EN, fontSize: '0.8rem', fontStyle: 'italic', fontWeight: 600, color: '#F3F6FB',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.c, boxShadow: `0 0 7px ${t.c}` }} />
            {t.t}
            {i < tools.length - 1 && <span style={{ color: 'rgba(226,232,240,0.56)', marginLeft: '0.3rem', fontStyle: 'normal' }}>＋</span>}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ───────────── スタイル ─────────────
// navLink / ctaSmall / ctaHero / sectionLabel* は corpTheme.ts へ移した（2026-08-21）。
// フッタ専用の2つだけここに残す。
const footHead: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: '0.7rem',
  letterSpacing: '0.3em',
  color: 'rgba(226,232,240,0.55)',
  marginBottom: '0.85rem',
  fontWeight: 700,
};
const footLink: React.CSSProperties = {
  display: 'block',
  fontFamily: FONT_SERIF_JA,
  color: 'rgba(226,232,240,0.7)',
  fontSize: '0.85rem',
  textDecoration: 'none',
  marginBottom: '0.5rem',
};
