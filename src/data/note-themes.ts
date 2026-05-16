// AI が「今夜書くべき note 記事テーマ」を選ぶための内蔵 DB。
// 50 テーマ × カテゴリ別。経営者・クリエイター・自営業向けの実装的なテーマ。

export type NoteThemeCategory =
  | 'leadership'   // 経営・リーダーシップ
  | 'product'      // プロダクト・開発
  | 'sales'        // 営業・マーケ
  | 'team'         // 組織・人材
  | 'finance'      // 数字・お金
  | 'mind'         // メンタル・哲学
  | 'craft';       // ものづくり・創作

export interface NoteTheme {
  id: string;
  category: NoteThemeCategory;
  title: string;
  hook: string;        // 出だしの 1 行
  outline: string[];   // 章立て (3〜5)
  audience: string;    // 想定読者
  estReadMin: number;  // 推定読了分
}

export const NOTE_THEMES: NoteTheme[] = [
  // ── leadership (10) ──
  { id: 'lead-001', category: 'leadership', title: '社員 5 人を超えた瞬間に変えた 3 つのこと', hook: '社員が 5 人を超えた途端、自分の役割がガラッと変わった。', outline: ['なぜ 5 人で限界が来るのか', '伝言ゲームを切る方法', '意思決定を分散する手順', '失敗から学んだこと'], audience: '創業期の経営者', estReadMin: 6 },
  { id: 'lead-002', category: 'leadership', title: '「全部自分でやりたい」を捨てた日のこと', hook: '任せられない人が一番遅い、と教わった。', outline: ['任せられない理由を分解する', '任せる相手の選び方', '任せた後の関わり方'], audience: '中堅マネージャー', estReadMin: 5 },
  { id: 'lead-003', category: 'leadership', title: '社長が現場に降りるべきタイミングと撤退の合図', hook: '降りるなら今、降りないならいつまでも降りるな。', outline: ['降りるべきサイン 3 つ', '降りた後にやること', '撤退の合図'], audience: '事業責任者', estReadMin: 7 },
  { id: 'lead-004', category: 'leadership', title: 'ビジョンを語らない経営者が嫌われない理由', hook: '熱量で語る経営者よりも、淡々と数字で語る人が信頼される時代になった。', outline: ['ビジョンの賞味期限', '数字 + ストーリーの組み合わせ', '具体例'], audience: '経営者全般', estReadMin: 6 },
  { id: 'lead-005', category: 'leadership', title: 'No と言える経営者が一番優しい', hook: '断ることが、相手に対する最大の誠実さだと気づいた。', outline: ['No を言えない理由', 'No を言うフレーズ集', '断った後にやるべきこと'], audience: '経営者・PM', estReadMin: 5 },
  { id: 'lead-006', category: 'leadership', title: '会議を半分に減らしたら売上が伸びた話', hook: '会議の数と売上は反比例する、というのは本当だった。', outline: ['減らした会議', '代わりに置いた仕組み', '結果'], audience: '経営者・幹部', estReadMin: 6 },
  { id: 'lead-007', category: 'leadership', title: '創業 3 年で見えてきた「いい組織」の 1 つの条件', hook: '優秀な人を集めても、いい組織にはならないと知った。', outline: ['ダメだった組織の共通点', 'いい組織の唯一の条件', '今やっていること'], audience: 'スタートアップ', estReadMin: 7 },
  { id: 'lead-008', category: 'leadership', title: '採用で「スキル」より重視するようになった指標', hook: 'スキルは教えられる、でも姿勢は教えられない。', outline: ['過去の採用ミス', '新しい評価軸', '見抜く質問'], audience: '採用担当・経営者', estReadMin: 5 },
  { id: 'lead-009', category: 'leadership', title: '社長が辞めると言われた日に学んだこと', hook: '辞めると言われたとき、自分が一番何を失うかが見える。', outline: ['辞意の本当の理由', '引き止め方ではなく対話の仕方', '今後変えたこと'], audience: '経営者', estReadMin: 6 },
  { id: 'lead-010', category: 'leadership', title: '40 代経営者が手放した「20 代の自分」', hook: '若い頃の武器が、今の自分の足を引っ張っていた。', outline: ['20 代の武器の正体', '手放すと決めた瞬間', '残したもの・捨てたもの'], audience: '中堅経営者', estReadMin: 7 },

  // ── product (8) ──
  { id: 'prod-001', category: 'product', title: '機能を 30 個削ったらユーザーが増えた', hook: '足し算より引き算のほうが難しい。', outline: ['削った機能リスト', '削る基準', '結果と教訓'], audience: 'プロダクトマネージャー', estReadMin: 6 },
  { id: 'prod-002', category: 'product', title: '「使い方が分からない」が出たら負け', hook: 'マニュアルを読ませた時点で、プロダクトの負け。', outline: ['迷う瞬間を 10 箇所洗い出した', '直し方', '指標の変化'], audience: 'UX 担当・PM', estReadMin: 5 },
  { id: 'prod-003', category: 'product', title: 'AI を載せても売れないプロダクトの共通点', hook: 'AI は魔法じゃない、ただの道具。', outline: ['失敗パターン 3 つ', '成功した 1 つの違い', '次にやること'], audience: 'AI プロダクト開発者', estReadMin: 7 },
  { id: 'prod-004', category: 'product', title: 'MVP より小さい "MVS" を作ろう', hook: 'Minimum Viable Story = 一番小さい物語。', outline: ['MVS とは', '作り方', '事例'], audience: '起業家・PM', estReadMin: 5 },
  { id: 'prod-005', category: 'product', title: 'プロダクトの「触り心地」を 0.1 秒単位で磨く', hook: '感動は 0.1 秒の積み重ねでできている。', outline: ['触り心地の正体', '磨いた 10 箇所', '計測方法'], audience: 'デザイナー・エンジニア', estReadMin: 6 },
  { id: 'prod-006', category: 'product', title: 'カスタマーサポートが一番のプロダクト改善源', hook: 'クレームは未来のロードマップ。', outline: ['CS チャット 100 件を読み直した', '見えた 5 つのパターン', '反映した機能'], audience: 'CS・PM', estReadMin: 5 },
  { id: 'prod-007', category: 'product', title: 'ノーコードで作ったプロダクトを売って気づいたこと', hook: 'コードを書かないほうが、お客さんに集中できた。', outline: ['ノーコードの限界', '突破した方法', '次のステップ'], audience: '個人開発者', estReadMin: 7 },
  { id: 'prod-008', category: 'product', title: 'デザインシステムを社内に根付かせる地味な工夫', hook: '導入より定着のほうが 10 倍むずかしい。', outline: ['導入直後の壁', '定着させた仕組み', '半年後の風景'], audience: 'デザイナー', estReadMin: 6 },

  // ── sales (8) ──
  { id: 'sale-001', category: 'sales', title: '営業しないで売れる商品の作り方', hook: '営業がいらない = 商品が語っている、ということ。', outline: ['営業ゼロで売れた事例', '商品に語らせる仕組み', '失敗パターン'], audience: '経営者・マーケ', estReadMin: 7 },
  { id: 'sale-002', category: 'sales', title: '紹介で 100 人増えた、たった 1 つの仕掛け', hook: '広告予算ゼロでも、紹介は設計できる。', outline: ['紹介が起こる条件', '仕掛けの作り方', '数字の変化'], audience: 'マーケ・経営者', estReadMin: 6 },
  { id: 'sale-003', category: 'sales', title: 'BtoB の DM 100 通から見えた「返信される文面」', hook: '件名で 7 割が決まる、と痛感した。', outline: ['返信率 0% の件名', '返信率 15% の件名', '本文の型'], audience: 'BtoB 営業', estReadMin: 5 },
  { id: 'sale-004', category: 'sales', title: 'デモで「うわ、すごい」と言わせる 3 分の組み立て', hook: 'デモは最初の 30 秒で勝負が決まる。', outline: ['30 秒で何を見せるか', '次の 1 分の展開', '最後の 90 秒'], audience: 'セールス・PM', estReadMin: 6 },
  { id: 'sale-005', category: 'sales', title: '価格を 3 倍にしたら売れた話', hook: '安いから売れる、は半分嘘だった。', outline: ['値上げの背景', '伝え方', '失った客・増えた客'], audience: '経営者・PM', estReadMin: 5 },
  { id: 'sale-006', category: 'sales', title: '「いつでも解約できる」をやめたら継続率が上がった', hook: '自由を強調するほど、続かない。', outline: ['仮説の検証', '導入したフロー', '数字の変化'], audience: 'サブスク事業', estReadMin: 6 },
  { id: 'sale-007', category: 'sales', title: '見込み客リストを 9 割捨てた日', hook: '量より質、を実感した瞬間。', outline: ['捨てた基準', '残した 1 割の特徴', '成約率の変化'], audience: 'BtoB 営業', estReadMin: 5 },
  { id: 'sale-008', category: 'sales', title: 'カスタマーサクセスを営業に変える', hook: 'CS こそ最強の営業部隊だった。', outline: ['CS が営業に変わる条件', '事例', '数字'], audience: '経営者・CS', estReadMin: 6 },

  // ── team (8) ──
  { id: 'team-001', category: 'team', title: '1on1 で「最近どう？」を禁句にした', hook: '抽象的な質問は、抽象的な答えしか返ってこない。', outline: ['抽象質問の罠', '具体質問 10 個', '効果'], audience: 'マネージャー', estReadMin: 5 },
  { id: 'team-002', category: 'team', title: 'リモートワークで生産性が落ちる本当の理由', hook: '通勤がなくなったのではなく、雑談がなくなった。', outline: ['雑談の機能', '再設計した仕組み', '結果'], audience: 'リモート組織', estReadMin: 6 },
  { id: 'team-003', category: 'team', title: '評価制度を捨てた会社が伸びた話', hook: '評価しないほうが、人は伸びることがある。', outline: ['評価制度の弊害', '代替の仕組み', '半年後'], audience: '人事・経営', estReadMin: 7 },
  { id: 'team-004', category: 'team', title: '採用面接で必ず聞く 3 つの質問', hook: '経歴より、ものの見方が聞ける質問を選んでいる。', outline: ['質問 1', '質問 2', '質問 3', '見抜けたもの'], audience: '採用担当', estReadMin: 5 },
  { id: 'team-005', category: 'team', title: '辞めていった人が教えてくれた組織の歪み', hook: '退職者のフィードバックは、組織を映す鏡。', outline: ['退職面談で見えた共通項', '変えた制度', '次の課題'], audience: '人事・経営', estReadMin: 6 },
  { id: 'team-006', category: 'team', title: 'チームのモチベを「上げない」マネジメント', hook: 'モチベは上げるものではなく、奪わないもの。', outline: ['モチベを奪う行為 5 つ', '奪わない仕組み', '事例'], audience: 'マネージャー', estReadMin: 5 },
  { id: 'team-007', category: 'team', title: '新人が 3 ヶ月で活躍する組織の共通点', hook: 'オンボーディングの設計が、組織の体力を表す。', outline: ['1 週目', '1 ヶ月目', '3 ヶ月目', 'チェックリスト'], audience: 'マネージャー・HR', estReadMin: 7 },
  { id: 'team-008', category: 'team', title: '会議の議事録を AI に任せてから起きたこと', hook: '議事録を書く時間がなくなって、考える時間が増えた。', outline: ['導入したツール', '運用ルール', '副作用'], audience: '組織全般', estReadMin: 5 },

  // ── finance (6) ──
  { id: 'fin-001', category: 'finance', title: '創業 1 年目、銀行口座を見ない日はなかった', hook: '残高を 1 日 5 回見ていた日々を振り返る。', outline: ['資金繰りの恐怖', '心が落ち着いた瞬間', '今やっていること'], audience: '創業者', estReadMin: 6 },
  { id: 'fin-002', category: 'finance', title: '利益率 30% を超えるために手放したこと', hook: '売上を捨てるのが、一番むずかしい。', outline: ['捨てた事業', '残した事業', '結果の数字'], audience: '経営者', estReadMin: 7 },
  { id: 'fin-003', category: 'finance', title: '経理を自分でやっていた経営者がやめた日', hook: '時給で考えると、自分でやってはいけなかった。', outline: ['任せると決めた基準', '任せた相手', '解放された時間'], audience: '中小経営者', estReadMin: 5 },
  { id: 'fin-004', category: 'finance', title: '借入はしてもいい、ただし守るべき 3 つのルール', hook: '借りるか借りないかではなく、どう借りるか。', outline: ['ルール 1: 用途', 'ルール 2: 期間', 'ルール 3: 金利', '事例'], audience: '経営者', estReadMin: 6 },
  { id: 'fin-005', category: 'finance', title: '黒字倒産を防ぐ「キャッシュフロー暗算術」', hook: '会計知識ゼロでも、暗算で資金繰りは見える。', outline: ['暗算の式', 'やってみる', '効果'], audience: '創業者', estReadMin: 5 },
  { id: 'fin-006', category: 'finance', title: '値下げ要求への「丁寧な NO」テンプレ', hook: '値下げを断ることは、相手への誠実さでもある。', outline: ['断る前に確認すること', '断るフレーズ', '代替案の出し方'], audience: '経営者・営業', estReadMin: 6 },

  // ── mind (5) ──
  { id: 'mind-001', category: 'mind', title: '経営者の孤独を 3 年やってわかったこと', hook: '孤独は消えない、付き合い方が変わるだけ。', outline: ['孤独の正体', '付き合い方', '誰に話すか'], audience: '経営者', estReadMin: 7 },
  { id: 'mind-002', category: 'mind', title: '焦りが消えた瞬間、売上が上がった', hook: '焦りは判断を曇らせる、と本当に思った。', outline: ['焦っていた頃の判断', '焦りを消した方法', '結果'], audience: '経営者', estReadMin: 6 },
  { id: 'mind-003', category: 'mind', title: '失敗を「面白がる」と決めた日', hook: '反省より、面白がるほうが進む。', outline: ['面白がる技術', '事例', '副作用'], audience: '全員', estReadMin: 5 },
  { id: 'mind-004', category: 'mind', title: '人を許せない経営者は、自分を許せない', hook: '他人への怒りは、自分への怒りの投影だった。', outline: ['怒りの分解', '許す技術', '効果'], audience: '経営者', estReadMin: 6 },
  { id: 'mind-005', category: 'mind', title: '「成果が出ない時期」をどう過ごすか', hook: '凪の時期は、次の波の準備期間。', outline: ['凪の見分け方', 'やるべきこと', 'やってはいけないこと'], audience: '創業者', estReadMin: 5 },

  // ── craft (5) ──
  { id: 'craft-001', category: 'craft', title: 'ものづくりの「最後の 10%」が一番大事', hook: '完成度 90% と 99% は別物。', outline: ['10% の正体', '磨き方', '事例'], audience: 'クリエイター', estReadMin: 6 },
  { id: 'craft-002', category: 'craft', title: '締め切りがあるから創作できる', hook: '自由は創造性を殺す、というのは本当だった。', outline: ['締め切りの設計', '自分への締め切り', '事例'], audience: '創作者', estReadMin: 5 },
  { id: 'craft-003', category: 'craft', title: '模倣から始める、ただし 3 ヶ月で卒業する', hook: '真似はスタート地点であって、ゴールではない。', outline: ['真似する対象', '卒業の合図', '自分の色の出し方'], audience: 'クリエイター', estReadMin: 6 },
  { id: 'craft-004', category: 'craft', title: '個人クリエイターが法人化して変わったこと', hook: '法人化は税金対策じゃなくて、姿勢の問題だった。', outline: ['法人化の前と後', '変わった付き合い方', '注意点'], audience: '個人事業主', estReadMin: 7 },
  { id: 'craft-005', category: 'craft', title: '作品を 100 個作って気づいた「自分の型」', hook: '型は探すものではなく、量から浮かび上がる。', outline: ['100 個作る方法', '見えてきた型', '次の壁'], audience: '創作者', estReadMin: 6 },
];

// 日付ベースで今日の 3〜5 テーマを返す (日替わり)
export function pickTodayThemes(seed: number, count: number = 3): NoteTheme[] {
  const list = [...NOTE_THEMES];
  // seed ベースで shuffle (簡易 LCG)
  let s = seed;
  for (let i = list.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, count);
}
