// ============================================================
// reelTemplates — 白紙から作らせない「ワンタップ・リール型」
//
// 出典/狙い (BACKLOG 2026-07-05 CapCut「型に流し込むだけ数タップ」):
//   台本→リールを穴埋めテンプレ化し、素材を落とす→文言を直す→数タップで完成。
//   最初から“もう形になっている”状態にして、開いて即出す。
//
// これは静的定義（LLM不要・ネットワーク不要）なので表示は一瞬・失敗しない。
// 各型は「伸びるIGリールの実証構成」を hook→build→payoff→cta の役割で並べ、
//   ・各カットで“何を撮るか”(shoot)
//   ・字幕のたたき台(overlay)
//   ・秒数の目安(durationSec)
// を持つ。撮る前に型が分かるので、白紙の不安が消える。
// ============================================================
import type { CutRole } from './reelAiCaption';

export interface ReelTemplateSlot {
  role: CutRole;
  /** このカットで撮るもの（具体的な指示） */
  shoot: string;
  /** 画面に乗せる字幕のたたき台（そのまま or 直して使う） */
  overlay: string;
  /** 秒数の目安 */
  durationSec: number;
}

export interface ReelTemplate {
  id: string;
  /** Lucide アイコン名（コンポーネント側でマップ） */
  icon: 'sparkles' | 'list' | 'sun' | 'messageCircle' | 'alertTriangle' | 'gift';
  name: string;
  /** 一言でどんな型か */
  desc: string;
  /** 誰に効くか（ComposeContext.audience のたたき台にも使える） */
  audience: string;
  slots: ReelTemplateSlot[];
  /** 投稿本文のスケルトン（{ } は差し替え箇所） */
  caption: string;
  hashtags: string[];
}

export const REEL_TEMPLATES: ReelTemplate[] = [
  {
    id: 'before-after',
    icon: 'sparkles',
    name: 'Before → After',
    desc: '変化を見せて「私も」を引き出す王道',
    audience: '悩みを解決したい人',
    slots: [
      { role: 'hook', shoot: '「変わる前」の状態をそのまま撮る（正直に）', overlay: 'これが {悩み} だった頃…', durationSec: 2 },
      { role: 'build', shoot: '何をしたか（手元・工程・使ったもの）を1〜2カット', overlay: 'やったのは {方法} だけ', durationSec: 3 },
      { role: 'payoff', shoot: '「変わった後」を明るく・寄りで撮る', overlay: '{日数}でここまで変わった', durationSec: 3 },
      { role: 'cta', shoot: '自分の顔 or 手元で一言そえる', overlay: '保存して真似してね', durationSec: 2 },
    ],
    caption: '{悩み}だった私が{方法}で変わった話。\n\nポイントは3つ:\n① {ポイント1}\n② {ポイント2}\n③ {ポイント3}\n\n気になったら保存して、あとで見返してね。',
    hashtags: ['ビフォーアフター', '変化の記録', 'やってよかった'],
  },
  {
    id: 'howto3',
    icon: 'list',
    name: '知っておくべき3選',
    desc: '数字で区切って最後まで見せる保存型',
    audience: '情報を集めている人',
    slots: [
      { role: 'hook', shoot: '結論を先に言う自分 or テロップ画面', overlay: '知らないと損する{テーマ}3選', durationSec: 2 },
      { role: 'build', shoot: '①を説明するカット（実例・手元）', overlay: '① {1つ目}', durationSec: 3 },
      { role: 'build', shoot: '②を説明するカット', overlay: '② {2つ目}', durationSec: 3 },
      { role: 'payoff', shoot: '③（一番効くやつ）を強めに', overlay: '③ これが一番効く → {3つ目}', durationSec: 3 },
      { role: 'cta', shoot: '一言そえる', overlay: '保存して後で試してね', durationSec: 2 },
    ],
    caption: '知らないと損する{テーマ}3選。\n\n① {1つ目}\n② {2つ目}\n③ {3つ目}（これが一番効く）\n\nどれか1つでも刺さったら保存推奨。',
    hashtags: ['知って得する', '{テーマ}', '保存推奨'],
  },
  {
    id: 'routine',
    icon: 'sun',
    name: '1日ルーティン',
    desc: '暮らしを覗かせて親近感で伸ばす',
    audience: 'ライフスタイルに興味がある人',
    slots: [
      { role: 'hook', shoot: '朝の始まりの1カット（起きる・カーテン・コーヒー）', overlay: '{肩書き}の朝の過ごし方', durationSec: 2 },
      { role: 'build', shoot: '午前の行動をテンポよく2〜3カット', overlay: '{時間}〜 {やること}', durationSec: 4 },
      { role: 'payoff', shoot: '一番見せ場の瞬間（こだわり・仕事・作品）', overlay: 'ここが私のこだわり', durationSec: 3 },
      { role: 'cta', shoot: '夜のしめ or 一言', overlay: 'あなたの朝は？コメントで教えて', durationSec: 2 },
    ],
    caption: '{肩書き}のとある1日。\n\n何気ない日常だけど、{こだわり}だけは大事にしてます。\n\nあなたの1日はどんな感じ？コメントで教えてね。',
    hashtags: ['ルーティン', '暮らしの記録', '日常'],
  },
  {
    id: 'voice',
    icon: 'messageCircle',
    name: 'お客様の声・実例',
    desc: '第三者の言葉で信頼を作る成約型',
    audience: '購入を迷っている人',
    slots: [
      { role: 'hook', shoot: '実物・現場・お客様（許可を得て）を撮る', overlay: '「{お客様の一言}」', durationSec: 2 },
      { role: 'build', shoot: 'どんな悩みで来たか、状況が分かるカット', overlay: '最初は {悩み} で悩んでいた', durationSec: 3 },
      { role: 'payoff', shoot: 'ビフォーアフター or 完成・結果', overlay: '結果はこの通り', durationSec: 3 },
      { role: 'cta', shoot: '申し込み方法を一言（DM・プロフリンク）', overlay: '気になる方はDMで', durationSec: 2 },
    ],
    caption: '先日いただいたお声を紹介します。\n\n「{お客様の一言}」\n\n{悩み}で悩まれていた方が、{結果}に。\n\nご相談はDM or プロフィールのリンクから。',
    hashtags: ['お客様の声', 'お客様事例', 'ありがとうございます'],
  },
  {
    id: 'mistake',
    icon: 'alertTriangle',
    name: 'やりがちな失敗',
    desc: '共感→解決で「役に立った」を作る',
    audience: '同じ失敗をしたくない人',
    slots: [
      { role: 'hook', shoot: '「あるある」な失敗の瞬間を再現 or 指差し', overlay: 'これやってたら要注意', durationSec: 2 },
      { role: 'build', shoot: 'なぜダメなのかを見せるカット', overlay: '実はこれ、{理由}なんです', durationSec: 3 },
      { role: 'payoff', shoot: '正しいやり方を実演', overlay: '正解はこっち → {正しい方法}', durationSec: 3 },
      { role: 'cta', shoot: '一言そえる', overlay: '当てはまった人は保存を', durationSec: 2 },
    ],
    caption: '{テーマ}でやりがちな失敗、実はこれです。\n\n❌ {失敗}\n⭕️ {正解}\n\n知らずにやってた人、意外と多いはず。保存しておくと安心です。',
    hashtags: ['やりがちな失敗', '{テーマ}', '知らないと損'],
  },
  {
    id: 'reveal',
    icon: 'gift',
    name: '開封・お披露目',
    desc: '「見たい」を引っぱる期待型',
    audience: '新商品・新作が気になる人',
    slots: [
      { role: 'hook', shoot: '中身が見えない状態（箱・袋・シルエット）', overlay: '待ちに待った{もの}が届いた', durationSec: 2 },
      { role: 'build', shoot: '開ける瞬間・手元をゆっくり', overlay: '開けてみると…', durationSec: 3 },
      { role: 'payoff', shoot: '中身をきれいに・寄りで見せる', overlay: 'じゃーん！{もの}', durationSec: 3 },
      { role: 'cta', shoot: '感想と入手方法を一言', overlay: '詳細はプロフィールから', durationSec: 2 },
    ],
    caption: 'ついに届いた{もの}を開封します。\n\n{ここが好きなポイント}が想像以上でした。\n\n気になる方はプロフィールのリンクをチェックしてね。',
    hashtags: ['開封の儀', '新作', '買ってよかった'],
  },
];
