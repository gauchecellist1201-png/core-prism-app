// ============================================================
// CORE i18n — 軽量翻訳フレームワーク (依存ゼロ)
// ============================================================

export type Locale = 'ja' | 'en' | 'zh';
export const DEFAULT_LOCALE: Locale = 'ja';
const STORAGE_KEY = 'core_locale_v1';

type Translations = Record<string, { ja: string; en: string; zh: string }>;

const TRANSLATIONS: Translations = {
  'lang.ja': { ja: '日', en: '日', zh: '日' },
  'lang.en': { ja: 'EN', en: 'EN', zh: 'EN' },
  'lang.zh': { ja: '中', en: '中', zh: '中' },

  'lp.nav.agents':  { ja: '7つのエージェント', en: '7 Agents',     zh: '7个智能体' },
  'lp.nav.exec':    { ja: '実行する AI',        en: 'Execution AI', zh: '执行AI' },
  'lp.nav.pricing': { ja: '料金',               en: 'Pricing',      zh: '价格' },
  'lp.nav.cta':     { ja: '無料で試す →',        en: 'Try free →',   zh: '免费试用 →' },

  'lp.hero.eyebrow': {
    ja: 'CORE PRISM — AGENT OS FOR EVERY ROLE',
    en: 'CORE PRISM — AGENT OS FOR EVERY ROLE',
    zh: 'CORE PRISM — 为每个角色打造的智能体OS',
  },
  'lp.hero.h1.line1': { ja: 'あなたは、',       en: 'You are',        zh: '你，' },
  'lp.hero.h1.line2': { ja: 'ひとつじゃない。', en: 'more than one.', zh: '不只一个。' },
  'lp.hero.sub1': {
    ja: '経営者・営業・財務・創造者・先生・親 ── 役割の数だけ、思考が要る。',
    en: 'CEO, salesperson, CFO, creator, teacher, parent — each role demands a different mind.',
    zh: '经营者・销售・财务・创意人・老师・父母 —— 每个角色，都需要不同的思维。',
  },
  'lp.hero.sub2': {
    ja: 'CORE Prism は Core Identity OS の事業家版。あなたの代わりに左脳の作業を引き受け、右脳を「創造」へ解き放つ 7 つの分身エージェント。',
    en: 'CORE Prism — the business edition of Core Identity OS. Seven agents take over your left-brain work so you can fully unleash your right-brain creation.',
    zh: 'CORE Prism 是 Core Identity OS 的事业家版。7 个分身代你处理左脑工作，把右脑彻底解放给"创造"。',
  },
  'lp.hero.cta':  { ja: 'Prism を試す', en: 'Try Prism', zh: '试用 Prism' },
  'lp.hero.cta2': { ja: 'エージェントを見る',      en: 'See Agents',              zh: '查看智能体' },
  'lp.hero.free': {
    ja: '14 日間無料 · クレカ不要 · いつでも解約可',
    en: '14-day free trial · No credit card · Cancel anytime',
    zh: '14天免费体验 · 无需信用卡 · 随时取消',
  },

  'lp.agents.eyebrow':  { ja: '7 AGENTS, 1 OS',       en: '7 AGENTS, 1 OS',         zh: '7个智能体，1个OS' },
  'lp.agents.h2.line1': { ja: '7 つのあなたに、',     en: 'For 7 versions of you,', zh: '你的7个自我，' },
  'lp.agents.h2.line2': { ja: '7 つのエージェント。', en: '7 dedicated agents.',    zh: '7个专属智能体。' },
  'lp.agents.sub': {
    ja: '役割ごとに専属の AI エージェントが伴走し、考え・書き・調べ・整える。提案で終わらない、実行までやりきる 7 つの脳。',
    en: "A dedicated AI agent runs alongside each role — thinking, writing, researching, organizing. 7 brains that don't just suggest — they execute.",
    zh: '每个角色都有专属AI智能体陪伴，思考・书写・调研・整理。不止于建议，7个大脑真正执行到底。',
  },

  'lp.exec.eyebrow': {
    ja: 'EXECUTION, NOT JUST SUGGESTIONS',
    en: 'EXECUTION, NOT JUST SUGGESTIONS',
    zh: '不只是建议，而是执行',
  },
  'lp.exec.h2.line1': { ja: '提案で終わらない。',       en: 'Beyond suggestions.',    zh: '超越建议。' },
  'lp.exec.h2.line2': { ja: '書く、整える、提出する。', en: 'Write. Organize. Submit.', zh: '书写、整理、提交。' },
  'lp.exec.sub': {
    ja: '議事録・スライド・契約書・営業メール・商談ロールプレイ ── エージェントが 仕事そのもの をやってくれる。',
    en: 'Minutes, slides, contracts, sales emails, negotiation roleplay — agents handle the work itself.',
    zh: '会议记录・幻灯片・合同・销售邮件・商务模拟 —— 智能体处理工作本身。',
  },

  'lp.pricing.eyebrow':   { ja: 'PRICING', en: 'PRICING', zh: '价格方案' },
  'lp.pricing.h2':        { ja: '使うだけ広がる、あなたの可能性', en: 'Grow as you use it — your potential, unlocked.', zh: '用得越多，可能性越大' },
  'lp.pricing.sub':       { ja: 'すべてのプランで Claude / Gemini / Stable Diffusion を内蔵。API キー不要。', en: 'Claude / Gemini / Stable Diffusion built-in on all plans. No API key needed.', zh: '所有方案内置 Claude / Gemini / Stable Diffusion。无需API密钥。' },
  'lp.pricing.popular':   { ja: '人気', en: 'Popular', zh: '热门' },
  'lp.pricing.cta.trial': { ja: '14 日無料で試す', en: 'Try free for 14 days', zh: '免费试用14天' },
  'lp.pricing.cta.apply': { ja: '今すぐ申し込む',   en: 'Get started now',     zh: '立即申请' },
  'lp.pricing.annual':    { ja: '年払いで 2 ヶ月分割引 · 法人は別途お問い合わせください', en: '2-month discount on annual billing · Enterprise: contact us', zh: '年付享2个月折扣 · 企业方案请联系我们' },

  'lp.final.h2.line1':  { ja: 'あなたの中の',               en: 'For the',             zh: '为你内心的' },
  'lp.final.h2.accent': { ja: '7 つの可能性',               en: '7 possibilities',     zh: '7种可能' },
  'lp.final.h2.line2':  { ja: 'に、\nエージェント AI を。', en: 'within you,\nagent AI awaits.', zh: '，\n注入智能体AI。' },
  'lp.final.sub':       { ja: '14 日間、すべてのエージェントを無料でお試しできます。', en: 'Try all agents free for 14 days.', zh: '14天免费体验所有智能体。' },
  'lp.final.cta':       { ja: '無料で Prism を試す', en: 'Try Prism for free', zh: '免费试用 Prism' },

  'lp.footer.tagline':      { ja: 'すべての事業家に、\nエージェント AI を。', en: 'Agent AI\nfor every entrepreneur.', zh: '为每一位创业者，\n注入智能体AI。' },
  'lp.footer.product':      { ja: 'PRODUCT', en: 'PRODUCT', zh: 'PRODUCT' },
  'lp.footer.company':      { ja: 'COMPANY', en: 'COMPANY', zh: 'COMPANY' },
  'lp.footer.contact':      { ja: 'CONTACT', en: 'CONTACT', zh: 'CONTACT' },
  'lp.footer.agents':       { ja: '7 つのエージェント',      en: '7 Agents',                 zh: '7个智能体' },
  'lp.footer.exec':         { ja: '実行する AI',              en: 'Execution AI',             zh: '执行AI' },
  'lp.footer.pricing':      { ja: '料金',                     en: 'Pricing',                  zh: '价格' },
  'lp.footer.iris':         { ja: '姉妹ブランド · CORE Iris', en: 'Sister brand · CORE Iris', zh: '姐妹品牌 · CORE Iris' },
  'lp.footer.terms':        { ja: '利用規約',                 en: 'Terms of Service',         zh: '服务条款' },
  'lp.footer.privacy':      { ja: 'プライバシーポリシー',     en: 'Privacy Policy',           zh: '隐私政策' },
  'lp.footer.tokushou':     { ja: '特定商取引法表記',         en: 'Commercial Transactions',  zh: '商业交易法说明' },
  'lp.footer.contact.text': { ja: '法人契約・カスタム導入のご相談は', en: 'For enterprise contracts and custom deployments:', zh: '企业合作及定制部署咨询：' },

  'iris.nav.features': { ja: '機能',       en: 'Features', zh: '功能' },
  'iris.nav.pricing':  { ja: '料金',       en: 'Pricing',  zh: '价格' },
  'iris.nav.cta':      { ja: 'はじめる →', en: 'Begin →',  zh: '开始 →' },

  'iris.hero.eyebrow': {
    ja: 'CORE IRIS — AURORA FOR EVERY CREATOR',
    en: 'CORE IRIS — AURORA FOR EVERY CREATOR',
    zh: 'CORE IRIS — 为每位创作者打造的极光',
  },
  'iris.hero.h1.line1': { ja: 'あなたの光が、', en: 'Your light,',       zh: '你的光芒，' },
  'iris.hero.h1.line2': { ja: '世界をつくる。', en: 'shapes the world.', zh: '创造世界。' },
  'iris.hero.sub1': {
    ja: 'Iris ─── 虹彩。瞳に宿る、光のかけら。',
    en: 'Iris — the iris of your eye, a fragment of living light.',
    zh: 'Iris ─── 虹彩。蕴藏在瞳孔中的光芒碎片。',
  },
  'iris.hero.sub2': {
    ja: 'CORE Iris は Core Identity OS のクリエイター版。\nDM 返信・案件交渉・投稿生成 ── 数万人のファン一人ひとりに、あなたの体温で届ける「もう一人のあなた」。',
    en: 'CORE Iris — the creator edition of Core Identity OS.\nA second you that handles DMs, negotiations, and posts — delivering your warmth to every single fan.',
    zh: 'CORE Iris 是 Core Identity OS 的创作者版。\nDM 回复、商务谈判、内容生成 —— 用你的温度，把"另一个你"传达给每一位粉丝。',
  },
  'iris.hero.cta':  { ja: 'Iris を試す', en: 'Try Iris', zh: '试用 Iris' },
  'iris.hero.cta2': { ja: '機能を見る',              en: 'See Features',       zh: '查看功能' },
  'iris.hero.free': {
    ja: '14 日間無料 · クレカ不要 · いつでも解約可',
    en: '14-day free trial · No credit card · Cancel anytime',
    zh: '14天免费体验 · 无需信用卡 · 随时取消',
  },

  'iris.facets.eyebrow': { ja: 'SIX FACETS OF LIGHT', en: 'SIX FACETS OF LIGHT', zh: '光的六个面' },
  'iris.facets.h2':      { ja: '光は、6 つの色を持つ。', en: 'Light has 6 colors.', zh: '光，拥有6种色彩。' },
  'iris.facets.sub': {
    ja: 'ひとつの輝きを、6 つのエージェントが角度を変えて磨く。\n戦略・分析・創作・交渉・ブランド・コミュニティ ── 全部、自動で。',
    en: 'Six agents polish one brilliance from different angles.\nStrategy, analysis, creation, negotiation, brand, community — all automated.',
    zh: '六个智能体从不同角度打磨同一份光辉。\n战略・分析・创作・谈判・品牌・社区 —— 全部自动化。',
  },

  'iris.final.h2.line1': { ja: 'あなたの光を、', en: 'Your light,',        zh: '你的光芒，' },
  'iris.final.h2.line2': { ja: 'いま、世界へ。', en: 'to the world, now.', zh: '现在，释放到世界。' },
  'iris.final.sub':      { ja: '14 日間、すべての機能を無料でお試しできます。', en: 'Try all features free for 14 days.', zh: '14天免费体验所有功能。' },
  'iris.final.cta':      { ja: '無料で Iris を試す', en: 'Try Iris for free', zh: '免费试用 Iris' },
  'iris.footer.tagline': { ja: 'すべてのインフルエンサーに、\nエージェント AI を。', en: 'Agent AI\nfor every creator.', zh: '为每一位创作者，\n注入智能体AI。' },

  'settings.title':          { ja: '設定',           en: 'Settings',              zh: '设置' },
  'settings.tab.ai':         { ja: 'AI 設定',        en: 'AI Settings',           zh: 'AI设置' },
  'settings.tab.api':        { ja: 'API キー',       en: 'API Key',               zh: 'API密钥' },
  'settings.tab.language':   { ja: '言語',           en: 'Language',              zh: '语言' },
  'settings.language.label': { ja: '表示言語',       en: 'Display Language',      zh: '显示语言' },
  'settings.language.ja':    { ja: '日本語',         en: 'Japanese',              zh: '日文' },
  'settings.language.en':    { ja: '英語',           en: 'English',               zh: '英文' },
  'settings.language.zh':    { ja: '中国語 (簡体)',  en: 'Chinese (Simplified)',   zh: '中文（简体）' },

  'chat.header':      { ja: 'AI アシスタント',     en: 'AI Assistant',    zh: 'AI助手' },
  'chat.placeholder': { ja: 'メッセージを入力...', en: 'Type a message...', zh: '输入消息...' },
  'chat.empty':       { ja: '何でも聞いてください', en: 'Ask me anything',  zh: '随时提问' },

  'error.api.key': {
    ja: 'Claude APIキーが設定されていません。設定画面で入力してください。',
    en: 'Claude API key is not set. Please enter it in the settings.',
    zh: 'Claude API密钥未设置。请在设置中输入。',
  },
  'error.unknown': { ja: '不明なエラー', en: 'Unknown error', zh: '未知错误' },
};

export function t(key: string, locale: Locale, params?: Record<string, string>): string {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  let text = entry[locale] ?? entry.ja;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

export function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored === 'ja' || stored === 'en' || stored === 'zh') return stored;
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('en')) return 'en';
  return 'ja';
}

export function saveLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale);
  }
}
