// ============================================================
// CORE Iris — ブランド案件カードのビジュアル (ロゴ + 商品画像)
// 実在ブランドはドメインを引き当ててロゴを取得。
// 商品画像はカテゴリ別キーワードで Unsplash から取得。
// 取得失敗時もカテゴリ色のグラデーションが残るので空にはならない。
// ============================================================
import type { BrandDeal, BrandCategory } from './brandDeals';

// ------------------------------------------------------------
// ブランド → ドメインのマッピング (logo を引くため)
// ------------------------------------------------------------
const BRAND_DOMAINS: Record<string, string> = {
  '資生堂': 'shiseido.co.jp',
  'コーセー': 'kose.co.jp',
  '花王': 'kao.com',
  'マンダム': 'mandom.co.jp',
  'イプサ': 'ipsa.co.jp',
  'ロクシタン': 'jp.loccitane.com',
  'THE BODY SHOP': 'the-body-shop.co.jp',
  'BOTANIST': 'botanistofficial.com',
  'SHIRO': 'shiro-shiro.jp',
  'Aesop': 'aesop.com',
  'Aēsop': 'aesop.com',
  'CHANEL': 'chanel.com',
  'CLINIQUE': 'clinique.jp',
  'M·A·C': 'maccosmetics.jp',
  'KATE': 'kate.kanebo.com',
  'DHC': 'dhc.co.jp',
  'FANCL': 'fancl.co.jp',
  'オルビス': 'orbis.co.jp',
  'POLA': 'pola.co.jp',
  'AHC': 'ahcbeauty.jp',
  'D-UP': 'dupshop.jp',
  'Athletia': 'athletia-beauty.com',
  'FUJIMI': 'fujimi.me',
  'ジョー マローン': 'jomalone.jp',
  'メイクアップ フォーエバー': 'makeupforever.com',
  'CICAPAIR': 'drjart.jp',

  'ユニクロ': 'uniqlo.com',
  'UNIQLO': 'uniqlo.com',
  'GU': 'gu-global.com',
  '無印良品': 'muji.com',
  'BEAMS': 'beams.co.jp',
  'WEGO': 'wego.jp',
  'GRL': 'grail.bz',
  'SNIDEL': 'snidel.com',
  'Mila Owen': 'milaowen.com',
  'PLST': 'plst.com',
  'STUDIOUS': 'studious.co.jp',
  'agete': 'agete.com',
  '4°C': 'fdcp.co.jp',
  'VA Vendome': 'vendome.jp',
  'Levi': 'levi.jp',
  'ABC-MART': 'abc-mart.net',
  'AOKI': 'aoki-style.com',
  'ZOZOTOWN': 'zozo.jp',
  'BEAMS BOY': 'beams.co.jp',

  'Anytime Fitness': 'anytimefitness.co.jp',
  'LAVA': 'yoga-lava.com',
  'カーブス': 'curves.co.jp',
  'chocoZAP': 'chocozap.jp',
  'ピラティスK': 'pilates-k.jp',
  'マイプロテイン': 'myprotein.jp',
  'クラチャイダムゴールド': 'kuracie.co.jp',
  'NULL': 'null-cosme.com',

  'BASE BREAD': 'basefood.co.jp',
  'nosh': 'nosh.jp',
  'Oisix': 'oisix.com',
  'GREEN SPOON': 'green-spoon.jp',
  'ZENB': 'zenb.jp',
  'Mister Donut': 'misterdonut.jp',
  'スターバックス': 'starbucks.co.jp',
  'タリーズコーヒー': 'tullys.co.jp',
  'カルディ': 'kaldi.co.jp',
  'ROYCE': 'royce.com',
  'Minimal': 'mini-mal.tokyo',
  'ピザーラ': 'pizza-la.co.jp',
  '叶 匠寿庵': 'kanou.com',
  'COEDO': 'coedobrewery.com',
  'TASTE TABLE': 'tastetable.jp',
  'grano': 'grano.shop',

  'Airbnb': 'airbnb.jp',
  'JTB': 'jtb.co.jp',
  'JR 東日本': 'jreast.co.jp',
  '星野リゾート': 'hoshinoresorts.com',
  'KKday': 'kkday.com',
  'HafH': 'hafh.com',
  'OYO': 'oyolife.co.jp',
  'ソウ・エクスペリエンス': 'sowxp.co.jp',
  '日比谷花壇': 'hibiyakadan.com',

  'PEPPY': 'peppynet.com',
  'PETOKOTO': 'petokoto.com',
  'GREEN DOG': 'green-dog.com',
  'PETPET': 'petpet.co.jp',

  'Apple': 'apple.com',
  'Anker': 'anker.com',
  'BOSE': 'bose.co.jp',
  'Dyson': 'dyson.co.jp',
  'BALMUDA': 'balmuda.com',
  'GoPro': 'gopro.com',
  'Sony': 'sony.jp',
  'iRobot': 'irobot-jp.com',
  'Nintendo': 'nintendo.co.jp',
  'Pixel': 'store.google.com',
  'Logicool': 'logicool.co.jp',

  'Duolingo': 'duolingo.com',
  'Udemy': 'udemy.com',
  'Schoo': 'schoo.jp',
  'Progate': 'progate.com',
  'BIZREACH': 'bizreach.jp',

  'IKEA': 'ikea.com',
  'ニトリ': 'nitori.co.jp',
  'Francfranc': 'francfranc.com',
  'KEYUCA': 'keyuca.com',
  'スリーコインズ': '3coins.jp',
  'LOFT': 'loft.co.jp',
  'KINTO': 'kinto.co.jp',
  'Snow Peak': 'snowpeak.co.jp',
  'カインズ': 'cainz.com',
  'マルニ木工': 'maruni.com',
  'リンナイ': 'rinnai.co.jp',
  'グリーンスナップ': 'greensnap.jp',
  'GreenSnap': 'greensnap.jp',
  '大塚家具': 'idc-otsuka.jp',
};

// ブランド名から最も近いドメインを引く (部分一致)
export function lookupDomain(brandName: string): string | null {
  const stripped = brandName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  // 完全一致 → 前方一致 → 部分一致
  if (BRAND_DOMAINS[stripped]) return BRAND_DOMAINS[stripped];
  for (const key of Object.keys(BRAND_DOMAINS)) {
    if (stripped.startsWith(key) || brandName.startsWith(key)) return BRAND_DOMAINS[key];
  }
  for (const key of Object.keys(BRAND_DOMAINS)) {
    if (stripped.includes(key) || brandName.includes(key)) return BRAND_DOMAINS[key];
  }
  return null;
}

// ロゴ URL を返す。ドメインが分かる場合は Google favicon API (128px) を使う。
// 解像度は十分で、認証も API キーも不要、ほぼすべてのブランドで動く。
export function getBrandLogoUrl(brandName: string): string | null {
  const domain = lookupDomain(brandName);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

// ------------------------------------------------------------
// 商品画像 — カテゴリ別の Unsplash キーワード
// ------------------------------------------------------------
const CATEGORY_KEYWORDS: Record<BrandCategory, string[]> = {
  beauty:    ['skincare', 'cosmetics', 'beauty-product', 'perfume', 'makeup-flatlay'],
  fashion:   ['fashion-flatlay', 'outfit', 'apparel', 'streetwear', 'accessories'],
  health:    ['fitness', 'yoga-mat', 'running-shoes', 'gym', 'wellness'],
  food:      ['gourmet-food', 'cafe', 'japanese-food', 'meal-prep', 'dessert'],
  lifestyle: ['lifestyle', 'minimalist-desk', 'morning-coffee', 'self-care', 'aesthetic'],
  travel:    ['travel-japan', 'hotel-room', 'airport', 'scenic-view', 'ryokan'],
  pet:       ['dog-portrait', 'cat-portrait', 'puppy', 'pet-food'],
  tech:      ['tech-gadget', 'headphones', 'laptop-desk', 'smartphone', 'camera-lens'],
  learning:  ['books-stack', 'study-desk', 'online-class', 'notebook-pen'],
  home:      ['scandinavian-interior', 'living-room', 'plants-indoor', 'kitchen-counter'],
};

// deal.id から決定論的にキーワードを選び、Unsplash の Source API で画像を取得。
// (source.unsplash.com は 2024 年に featured が一部廃止されたが、
//  キーワード指定の random はまだ生きている)
export function getDealImageUrl(deal: BrandDeal): string {
  const keywords = CATEGORY_KEYWORDS[deal.category];
  // deal.id を簡易ハッシュ → 安定して同じ画像を返す
  let h = 0;
  for (let i = 0; i < deal.id.length; i++) h = (h * 31 + deal.id.charCodeAt(i)) | 0;
  const kw = keywords[Math.abs(h) % keywords.length];
  return `https://source.unsplash.com/featured/600x320/?${encodeURIComponent(kw)}&sig=${deal.id}`;
}

// 画像読み込みに失敗したときの fallback グラデーション (カテゴリ色)
export function getDealGradient(_deal: BrandDeal, accent: string): string {
  // accent (カテゴリ色) を中心に、彩度を変えた縦グラデ
  return `linear-gradient(135deg, ${accent}E0 0%, ${accent}80 60%, #1F1A2EE0 100%)`;
}
