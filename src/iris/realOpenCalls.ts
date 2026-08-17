// ============================================================
// CORE Iris — 本物の公開募集 (実在・検証済み)
//
// オーナー指示 (2026-06-14):
//   「サンプルではなく、実在の公開募集を Web 収集して案件として実装。
//    インフルエンサーが本当に応募できる状態に。」
//
// ルール:
//   - applyUrl は実在し、かつ「応募ページとして今も開ける」ことを確認したもののみ。
//     確認は `node scripts/verifyIrisOpenCalls.mjs` で誰でも再実行できる。
//   - 報酬は「商品提供」「コミッション」など事実ベースの形のみ記載。
//     金額を勝手に断定しない (詳細は公式ページが真実)。
//   - これは "練習用サンプル" ではなく、公式ページへ直接応募できる本物。
//
// 2026-08-18 の再確認で分かったこと (この日に 2 件を外した):
//   - www.brandcosme.com … Cloudflare の Error 1000「DNS points to prohibited IP」。
//     サイトごと落ちている (curl でもブラウザでも 403)。
//   - www.dot-st.com/cp/st_ambassador … **HTTP は 200 を返すのに**、中身は
//     「and ST メンテナンスに伴うサイト一時停止のお知らせ」。
//     ステータスコードだけを見る確認では「生きている」と誤判定する。
//     → 確認は必ず本文も読む (verifyIrisOpenCalls.mjs はそうしている)。
// ============================================================
import type { BrandCategory } from './brandDeals';

export interface OpenCall {
  id: string;
  name: string;            // プログラム名
  org: string;             // 運営 / ブランド
  category: BrandCategory;
  kind: 'brand' | 'platform' | 'aggregator';
  summary: string;         // 一行サマリ
  reward: string;          // 報酬の「形」(事実ベース)
  requirement: string;     // 応募条件 (概要)
  applyUrl: string;        // 実在の応募先 (検証済)
  verifiedAt: string;      // 検証日 YYYY-MM-DD
}

const V = '2026-08-18';

export const REAL_OPEN_CALLS: OpenCall[] = [
  {
    id: 'oc-shiro',
    name: 'シロノサクラ。 美白ブランドアンバサダー 2026',
    org: 'シロノサクラ。',
    category: 'beauty',
    kind: 'brand',
    summary: '美白スキンケアの認知拡大に協力する 2026 通年アンバサダー。',
    reward: '商品提供（製品体験）',
    requirement: '国内在住 20〜39 歳・X / Instagram / TikTok の公開アカウント',
    applyUrl: 'https://shop.shiro-no-sakura.com/pages/ambassador_recruitment2026',
    verifiedAt: V,
  },
  {
    id: 'oc-monipla',
    name: 'モニプラ 商品モニター・ファンサイト募集',
    org: 'モニプラ ファンブログ',
    category: 'lifestyle',
    kind: 'aggregator',
    summary: 'ブランド公式のモニター・体験イベントが常時集まる募集ポータル。',
    reward: '案件により異なる（商品提供・モニター謝礼 等）',
    requirement: '各募集ページの条件を参照（フォロワー数不問の募集もあり）',
    applyUrl: 'https://monipla.jp/',
    verifiedAt: V,
  },
  {
    id: 'oc-koubo',
    name: 'Koubo アンバサダー公募一覧',
    org: 'Koubo（公募ポータル）',
    category: 'lifestyle',
    kind: 'aggregator',
    summary: '常に新しいアンバサダー・特派員募集が集まる公募ポータル。',
    reward: '案件により異なる（謝礼・商品提供 等）',
    requirement: '各募集ページの条件を参照',
    applyUrl: 'https://koubo.jp/category/nonsection/ambassador',
    verifiedAt: V,
  },
  {
    id: 'oc-andbuzz',
    name: '&Buzz コスメ系インフルエンサー募集',
    org: '&Buzz（AndBuzz）',
    category: 'beauty',
    kind: 'platform',
    summary: 'フォロワー制限なしのコスメ案件など、口コミ案件が多数。',
    reward: '商品提供・案件報酬（案件により異なる）',
    requirement: '美容系インスタグラマー（フォロワー制限なし案件あり）',
    applyUrl: 'https://andbuzz.net/',
    verifiedAt: V,
  },
  {
    id: 'oc-snapmart',
    name: 'Snapmart アンバサダー / 写真案件',
    org: 'Snapmart',
    category: 'lifestyle',
    kind: 'platform',
    summary: '写真・ライフスタイル発信で参加できるアンバサダー & 撮影案件。',
    reward: '報酬・商品提供（案件により異なる）',
    requirement: 'スマホ写真を投稿できる方（フォロワー数は不問の案件あり）',
    applyUrl: 'https://snapmart.jp/',
    verifiedAt: V,
  },
];

export const KIND_META: Record<OpenCall['kind'], { label: string; color: string }> = {
  brand:      { label: '公式ブランド募集', color: '#E1306C' },
  platform:   { label: 'マッチング',       color: '#833AB4' },
  aggregator: { label: '公募ポータル',     color: '#3B82F6' },
};

export function getRealOpenCalls(): OpenCall[] {
  return REAL_OPEN_CALLS;
}

// ============================================================
// 「いつ確かめたのか」を、そのまま出す
//
// なぜ要るか:
//   この画面は緑のチェックで「実在・検証済み」と名乗る。けれど確認は
//   人が手で1回やっただけで、そのあと勝手に古くなっていく。
//   2026-06-14 に確認した 6 件を 2026-08-18 に測り直したら、**2 件が落ちていた**
//   （1 件はサイトごと停止、1 件は 200 を返しながら中身がメンテ告知）。
//   つまり「検証済み」とだけ書いた札は、65 日たっても同じ顔で嘘をつく。
//   日付を小さく添えるだけでは足りない（2026-06-14 が古いかどうかは、
//   その場で引き算できる人にしか分からない）。
//   ここでは「何日前か」を言葉にして、古くなったら緑の札をやめる。
// ============================================================

/** 検証済みと名乗ってよい上限。これを超えたら画面の言い方を変える */
export const OPEN_CALL_FRESH_DAYS = 30;

/** verifiedAt (YYYY-MM-DD) から今日までの日数。壊れた日付は null */
export function verifiedAgeDays(verifiedAt: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(verifiedAt);
  if (!m) return null;
  const then = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((today - then) / 86400000);
  return days < 0 ? 0 : days; // 未来日付は「今日」に丸める (先の日付で新しく見せない)
}

/** 「今日 確認」「3日前に確認」…。日付が壊れていれば日付そのものを返す */
export function verifiedLabel(verifiedAt: string, now: Date = new Date()): string {
  const d = verifiedAgeDays(verifiedAt, now);
  if (d === null) return `${verifiedAt} 確認`;
  if (d === 0) return '今日 確認';
  if (d === 1) return '昨日 確認';
  return `${d}日前に確認`;
}

/** 全件のうち一番古い確認からの日数 (0件なら null) */
export function oldestVerifiedAgeDays(calls: OpenCall[] = REAL_OPEN_CALLS, now: Date = new Date()): number | null {
  const ages = calls.map(c => verifiedAgeDays(c.verifiedAt, now)).filter((n): n is number => n !== null);
  return ages.length ? Math.max(...ages) : null;
}

/** 一覧の見出しに出す札。古くなったら緑のチェックをやめて、正直に言い直す */
export function openCallsBadge(
  calls: OpenCall[] = REAL_OPEN_CALLS,
  now: Date = new Date(),
): { fresh: boolean; text: string; note: string } {
  const oldest = oldestVerifiedAgeDays(calls, now);
  const n = calls.length;
  if (oldest !== null && oldest <= OPEN_CALL_FRESH_DAYS) {
    return {
      fresh: true,
      text: `実在・${oldest === 0 ? '今日 確認' : `${oldest}日前に確認`} ${n} 件`,
      note: '公式ページから今すぐ応募できる恒常募集です。下のサンプル案件は応募文の練習用です。',
    };
  }
  return {
    fresh: false,
    // 「検証済み」とは名乗らない。何日前に見たのかだけを言う
    text: oldest === null ? `${n} 件` : `${oldest}日前に確認 ${n} 件`,
    note: '前に確かめてから時間がたっています。募集が終わっていることがあるので、開いた先の公式ページで最新の条件をご確認ください。',
  };
}

// ============================================================
// プロフィールから「あなたに合いそうな募集」を推定して並べ替える
//
// 手入力ゼロ: メディアキットの自由記述(よく見てくれる人・世界観・過去案件・表示名)
// からジャンルのキーワードを拾い、合致する募集を上に並べる。
// 断定はしない (推定バッジ)。手掛かりが無ければ元の順序のまま (誤ったバッジは出さない)。
// ============================================================

/** カテゴリ推定用キーワード (日本語中心・あくまで手掛かり) */
const CATEGORY_KEYWORDS: Record<BrandCategory, string[]> = {
  beauty:    ['美容', 'コスメ', 'スキンケア', 'メイク', '化粧', '美白', 'ネイル', 'ヘアケア', '髪', '肌', 'デパコス'],
  fashion:   ['ファッション', '服', 'コーデ', 'アパレル', '古着', 'おしゃれ', '着回し', 'スタイリング', 'ブランド服'],
  health:    ['健康', 'フィットネス', '筋トレ', 'ヨガ', 'ダイエット', 'ランニング', 'ジム', '運動', 'トレーニング', 'ピラティス'],
  food:      ['グルメ', '料理', 'カフェ', 'レシピ', 'スイーツ', '飲食', 'ごはん', '食べ歩き', 'お菓子', 'ランチ'],
  lifestyle: ['暮らし', 'ライフスタイル', '日常', 'ミニマル', '主婦', '育児', 'ママ', '節約', '暮らしの'],
  travel:    ['旅', '旅行', '観光', 'トラベル', '温泉', 'ホテル', '絶景', '国内旅行', '海外旅行'],
  pet:       ['ペット', '犬', '猫', 'いぬ', 'ねこ', '動物', 'わんこ', 'にゃんこ'],
  tech:      ['ガジェット', 'テック', 'アプリ', 'パソコン', 'スマホ', 'カメラ', '家電', 'ガジェ'],
  learning:  ['学び', '勉強', 'キャリア', '資格', '英語', '読書', 'ビジネス書', '自己啓発', '副業'],
  home:      ['インテリア', '家具', '部屋', '収納', 'ディーアイワイ', '暮らしの道具', 'ルームツアー', '一人暮らし'],
};

/** 自由記述テキストから、当てはまりそうなカテゴリを推定 (合致数の多い順) */
export function inferPreferredCategories(...signals: (string | undefined)[]): BrandCategory[] {
  const text = signals.filter(Boolean).join(' ').toLowerCase();
  if (!text.trim()) return [];
  const scored: { cat: BrandCategory; hits: number }[] = [];
  for (const cat of Object.keys(CATEGORY_KEYWORDS) as BrandCategory[]) {
    const hits = CATEGORY_KEYWORDS[cat].reduce(
      (n, kw) => (text.includes(kw.toLowerCase()) ? n + 1 : n),
      0,
    );
    if (hits > 0) scored.push({ cat, hits });
  }
  return scored.sort((a, b) => b.hits - a.hits).map((s) => s.cat);
}

/** 推定カテゴリで募集を並べ替え (合致を先頭へ・元の相対順は維持)。matched フラグ付き。 */
export function rankOpenCalls(prefs: BrandCategory[]): (OpenCall & { matched: boolean })[] {
  const prefSet = new Set(prefs);
  const withFlag = REAL_OPEN_CALLS.map((c) => ({ ...c, matched: prefSet.has(c.category) }));
  // 安定ソート: 合致を先に、その中でも推定順位が高いカテゴリを優先
  const rank = (c: BrandCategory) => {
    const i = prefs.indexOf(c);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return withFlag
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      if (a.c.matched !== b.c.matched) return a.c.matched ? -1 : 1;
      const r = rank(a.c.category) - rank(b.c.category);
      return r !== 0 ? r : a.i - b.i;
    })
    .map((x) => x.c);
}
