// ============================================================
// CORE SUITE — 「8つのサービスが、ひとつの AI 会社になる」座組みの単一の正
//
// なぜこのファイルがあるか（2026-08-21）:
//   同じ座組みが3か所でバラバラに書かれていて、数がどこも合っていなかった。
//     ・つながり(ONE FLOW) の図と本文 …… 7つ（Nexus と Universe が抜けていた）
//     ・製品タブの見出し ……………………… 「八つの専門」
//     ・Continuum のプラン文面 …………… 「6サービス」/「7つのAIエージェント」
//     ・制作スタジオのカード ……………… 「7つの自社プロダクト」
//   数を本文にベタ書きしていたのが原因。1つ足すたびに全部直す必要があり、
//   実際には誰も直せていなかった。ここを唯一の出どころにして、
//   本数も単品合計も「数える／足す」に置き換える。
//
// 実在するサービスの並びは ServiceFinder.SERVICES（8つ）が正。
// 価格は ServiceGuideData.GUIDES の「いちばん選ばれているプラン」から足す。
// ここで新しい数字を作らない（[[core-prism-honest-numbers]]）。
// ============================================================
import { SERVICES, type ServiceKey } from './ServiceFinder';
import { GUIDES } from './ServiceGuideData';

/** 会社の中での持ち場。図もこの5つで色分けする。 */
export type SuiteRole = 'meet' | 'reach' | 'decide' | 'move' | 'you';

export const SUITE_ROLES: { key: SuiteRole; ja: string; en: string; desc: string }[] = [
  { key: 'meet', ja: '出会う', en: 'MEET', desc: 'お客様と出会い、その場でお迎えする' },
  { key: 'reach', ja: '届ける', en: 'REACH', desc: '一人ひとりに、その人のことばで届ける' },
  { key: 'decide', ja: '決める', en: 'DECIDE', desc: '集まったすべてを読んで、次の一手を出す' },
  { key: 'move', ja: '動かす', en: 'MOVE', desc: '決まったことを、チームが実行する' },
  { key: 'you', ja: '整える', en: 'YOU', desc: '経営者自身の、夢とからだを守る' },
];

export type SuiteMember = {
  key: ServiceKey;
  role: SuiteRole;
  /** 会社にたとえると、どの部署か。製品名を知らない人が最初に読む一行。 */
  dept: string;
  /** 図の中で使う短い名札。2行に折れると、カードが六角の場からはみ出す（実測）。 */
  short: string;
  /** その部署が引き受ける仕事。事実だけ書く。 */
  line: string;
};

/**
 * 中心（司令塔）。図でも本文でも Prism だけは別扱いなので分けて持つ。
 */
export const SUITE_CORE: SuiteMember = {
  key: 'prism', role: 'decide', dept: '経営 ─ 7人の参謀', short: '経営',
  line: 'ほかのすべてが掴んだことは、ここに集まる。読んで、次の一手まで出す。',
};

/**
 * 司令塔をとりまく7つ。図の6角形には上から時計回りにこの順で並ぶ。
 * 並び順＝お客様と出会ってから、社内が動くまでの順番。
 */
export const SUITE_MEMBERS: SuiteMember[] = [
  { key: 'iris', role: 'meet', dept: '集客 ─ Instagram', short: '集客', line: '投稿と分析をAIと。誰がどの投稿に反応したかを掴む。' },
  { key: 'lume', role: 'meet', dept: '入口 ─ リンク', short: '入口', line: 'すべてのリンクを1ページに。誰がどこを押したかが色で見える。' },
  { key: 'crystal', role: 'meet', dept: '接客 ─ サイト', short: '接客', line: 'サイトに来た方を24時間お迎えし、商談の日程まで受け取る。' },
  { key: 'resonance', role: 'reach', dept: '顧客 ─ LINE', short: '顧客', line: '名簿の一人ひとりに、その人のための一文を書き分けて届ける。' },
  { key: 'guild', role: 'move', dept: '実行 ─ チーム', short: '実行', line: '提案と投票で決め、決まったことを消えない記録に残して動く。' },
  { key: 'nexus', role: 'you', dept: '秘書 ─ 夢', short: '秘書', line: '価値観と夢から逆算して、きょう何をするかまで一緒に描く。' },
  { key: 'pulse', role: 'you', dept: '健康 ─ からだ', short: '健康', line: '睡眠・心拍・歩数から「きょうの調子」を毎朝ことばで届ける。' },
];

/** 座組みの全員（司令塔＋7つ）。本数はここを数える。 */
export const SUITE_ALL: SuiteMember[] = [SUITE_CORE, ...SUITE_MEMBERS];

/** 8。本文に数字をベタ書きしないための唯一の出どころ。 */
export const SUITE_COUNT = SUITE_ALL.length;

/** 漢数字。「八つの部署」のように使う。 */
const KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export const SUITE_COUNT_KANJI = KANJI[SUITE_COUNT] ?? String(SUITE_COUNT);

/** ServiceFinder の実データ（名前・価格・リンク・ロゴ）を key で引く。 */
export const suiteService = (key: ServiceKey) => SERVICES.find(s => s.key === key)!;

// ── 単品でそろえたときの合計 ───────────────────────────────
//
// 罠: これまで本文に「約¥109,000」とベタ書きされていたが、
//     どのプランを足しても再現できない数字だった（実測: best合計 ¥88,820）。
//     買う前にいちばん見られる数字なので、必ず実データから足す。
//     Pulse は先行モニター中で ¥0（ServiceFinder の price が「無料」）。
//
// 税の扱い（2026-08-21 オーナー確定：税込¥9,800に統一）:
//   お客様向けの ServiceFinder（税込¥9,800）を正とする。営業資料
//   ServiceGuideData 側にあった Nexus だけ「/ 月（税抜）」の表記は誤りとして
//   税込に直した。単品合計は税込 ¥9,800 で足す（¥88,820）。
//
/** '¥9,800' / '¥98,000〜' → 9800 / 98000。数字が読めなければ null。 */
function yen(s: string): number | null {
  const m = s.replace(/,/g, '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** そのサービスの「いちばん選ばれているプラン」の月額。無い／無料なら 0。 */
export function bestMonthly(key: ServiceKey): number {
  const g = GUIDES.find(x => x.slug === key);
  if (!g) return 0; // Pulse は営業資料が未作成（先行モニター中・無料）
  const plan = g.plans.find(p => p.best) ?? g.plans[0];
  return yen(plan.price) ?? 0;
}

export const formatYen = (n: number) => '¥' + n.toLocaleString('ja-JP');

/** 8つを、いちばん選ばれているプランで単品購入したときの月額合計。 */
export const SUITE_BEST_TOTAL = SUITE_ALL.reduce((sum, m) => sum + bestMonthly(m.key), 0);

/** 単品合計の内訳（「どのプランを足したのか」を出せるようにする）。 */
export const SUITE_BEST_BREAKDOWN = SUITE_ALL.map(m => ({
  key: m.key,
  name: suiteService(m.key).name,
  monthly: bestMonthly(m.key),
}));

/** 任意の組み合わせの単品合計（Continuum Light の例示に使う）。 */
export const sumBest = (keys: ServiceKey[]) => keys.reduce((s, k) => s + bestMonthly(k), 0);
