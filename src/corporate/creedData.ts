// ============================================================
// creedData — 株式会社COREの理念の言葉と、理念の章で使う写真の正本（2026-09-02）
//   tagline は companyInfo.philosophy（SSOT）。ここではそれに「核とは何か」の答えを足す。
//   写真は Higgsfield nano_banana_pro で生成。実在の社員・顧客として紹介しない（名前・肩書を付けない）。
// ============================================================
import { COMPANY_INFO } from '../data/companyInfo';

export const PEOPLE = {
  workshop: '/corp/people-workshop.webp',
  team: '/corp/people-team.webp',
  craft: '/corp/people-craft.webp',
  clinic: '/corp/people-clinic.webp',
  home: '/corp/people-home.webp',
  arcade: '/corp/people-arcade.webp',
  hands: '/corp/people-hands.webp',
  factory: '/corp/people-factory.webp',
} as const;

/** 理念の言葉の正本。ホーム・会社タブ・OG から参照する。 */
export const CREED = {
  tagline: COMPANY_INFO.philosophy, // いつの時代も、変わらない核を。
  answer: '核とは、人。',
  answerEn: 'The core is people.',
  /** 理念を一行の約束にしたもの（2026-09-03 オーナー指示「理念でドリブンされる形に」）。 */
  promise: '人に、時間を返す。',
  /** ヒーローで理念のすぐ下に置く一文。AIの位置づけの正本。 */
  tool: 'AIは、人の仕事を奪う道具ではありません。人にしかできない仕事を、人に返すための道具です。',
  /** 理念から事業への橋。「導入」ではなく「つくり直す」理由をここで言い切る。 */
  soWhat: '機械にできることは、機械へ。空いた時間は、判断と、創造と、目の前の人へ。だから私たちは、AIを導入するのではなく、AI前提で会社そのものをつくり直します。',
  /** 「技術の会社なのに人を大事にする」の立ち位置を一言で（2026-09-04 オーナー指示）。理念の章の冒頭に置く。 */
  stance: '私たちはテクノロジーの会社です。けれど、いちばん大切にしているのは、人です。',
  mission: '人が、人にしかできないことに、時間を使える世界を。',
  lead: 'AIが賢くなるほど、人の温度が価値になる。私たちは技術を追いかける会社ではなく、人のために技術を使い切る会社です。',
  lines: [
    '効率化の先に笑顔がなければ、その効率化に意味はない。',
    '技術は五年で入れ替わる。人が人らしくあることの価値は、入れ替わらない。',
    '私たちが見ているのは、売上の数字ではなく、人が輝いているかどうか。',
  ],
  values: [
    {
      no: '01', en: 'HUMAN AT THE CORE', ja: '人を、真ん中に。',
      body: '設計の最初に置くのはモデルでも画面でもなく、その仕事をしている人です。その人の一日が楽になるか。それだけを基準に決めます。',
    },
    {
      no: '02', en: 'NEWEST FOR THE OLDEST', ja: '変わらないもののために、最新を使う。',
      body: '人の役に立つ。価値を生む。本質を解く。この古い理由のために、いちばん新しい技術を惜しまず使います。技術は目的ではなく、手段です。',
    },
    {
      no: '03', en: 'SMILES ARE THE METRIC', ja: '笑顔が増えたかを、成果にする。',
      body: '納品した数ではなく、現場の人が早く帰れたか、経営者が本業に戻れたか、家族と過ごす時間が戻ったか。変わったかどうかが、私たちの成果です。',
    },
  ],
} as const;
