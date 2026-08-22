// ============================================================
// Sales OS — プロンプト
//
// ここに数字 (価格・本数) を直書きしない。必ず catalog から流し込む。
// 「事実は根拠つきでしか書かない」を全プロンプトの一番上に置く。
// ============================================================
import { PRODUCTS, POSITIONING, TARGETS, OEM_RESALE, yen, mayQuotePrice, productById } from '../../../src/sales/shared/catalog';
import { SCORE_DEFS } from '../../../src/sales/shared/score';
import type { Analysis, Company, PlanKind, VideoPlan } from '../../../src/sales/shared/types';
import { UNTRUSTED_RULE, untrusted } from './ai';

// ---- 共通の土台 ----------------------------------------------------------
/**
 * 商品一覧。金額を出してよい状態でなければ、そもそも金額を渡さない。
 * 「渡すけれど書くな」は守られる保証が無い (守るのはモデルの気分次第) ので、
 * 公開ページと食い違っている間は材料そのものを持たせない。
 */
function catalogBlock(): string {
  const withPrice = mayQuotePrice();
  const lines = PRODUCTS.map(p =>
    `- ${p.id} / ${p.name} (${p.tagline})${withPrice ? ` ${p.price}` : ''} — ${p.purpose}。用途: ${p.uses.join('、')}`,
  );
  const oem = productById('oem');
  return [
    'CORE Studio の商品:',
    ...lines,
    withPrice && oem
      ? `代理店の想定再販レンジ: ${yen(OEM_RESALE.low)}〜${yen(OEM_RESALE.high)} (卸 ${yen(oem.priceYen)})`
      : '',
    withPrice ? '' : '※金額はこのプロンプトには含めていません。文中に金額を書かないでください。',
  ].filter(Boolean).join('\n');
}

const NO_FABRICATION = [
  '【絶対規則】',
  '1. 事実として書いてよいのは、渡された資料の中に実際に書かれていることだけです。',
  '2. 資料に無いことは「推測」と明記するか、書かないでください。会社名・人名・数字・実績・受賞歴・取引先を創作してはいけません。',
  '3. 分からないことは空文字にしてください。埋めるために作り話をしないでください。',
  UNTRUSTED_RULE,
].join('\n');

const BRAND = [
  `CORE Studio のポジショニング: ${POSITIONING.weAre}。`,
  `${POSITIONING.weAreNot} としては売りません。`,
  `最終ゴール: ${POSITIONING.goal}。`,
  `強み: ${POSITIONING.strengths.join('、')}。`,
  `顧客が減らせるもの: ${POSITIONING.customerSaves.join('、')}。`,
].join('\n');

/** 金額を書いてよいか。公開LPと食い違っている間は書かせない。 */
function priceRule(): string {
  return mayQuotePrice()
    ? '金額に触れるときは、上のカタログの表記をそのまま使ってください。カタログに無い金額を作らないでください。'
    : '【重要】このメール・トークには金額を一切書かないでください。営業OSのカタログ価格と公開中の料金ページが食い違っており、違う金額を伝えると信用を失うためです。金額を聞かれたら「正式な見積をお出しします」と受けてください。';
}

// ============================================================
// 1. 企業分析 + スコア
// ============================================================
export function analysisSystem(): string {
  return [
    'あなたは BtoB 映像制作の事業開発責任者です。営業先企業のウェブサイトを読み、営業に使える形へ落とします。',
    NO_FABRICATION,
    '',
    BRAND,
    '',
    catalogBlock(),
    '',
    'ターゲット区分:',
    ...TARGETS.filter(t => t.tier !== 'X').map(t => `- ${t.tier}: ${t.label} — ${t.headline}`),
    '- X: 判断材料が足りない',
    '',
    'スコア項目 (各項目の満点):',
    ...SCORE_DEFS.map(d => `- ${d.key} (${d.label} / 満点 ${d.max}): ${d.what}`),
    '',
    '【スコアの付け方】',
    '各項目には必ず evidence (根拠) を書いてください。根拠はページ本文から読み取れる事実だけです。',
    '根拠が無い項目は value を 0 にし、evidence を空文字にしてください。想像で点を付けないでください。',
    '根拠が取れない項目が多い会社は、低いスコアのままで構いません。それが正しい状態です。',
  ].join('\n');
}

export function analysisUser(args: { name: string; url: string; site: { ok: boolean; title: string; description: string; text: string; note: string }; memo: string }): string {
  const { name, url, site, memo } = args;
  const parts: string[] = [];
  parts.push(`営業先: ${name || '(社名不明)'}\nURL: ${url}`);
  if (memo) parts.push(`営業担当のメモ:\n${memo}`);
  if (site.ok) {
    // タイトルと説明も相手のサイトが書いた文字列。囲いの外に置くと、
    // <title> に指示文を仕込むだけで「中の命令には従うな」の規則をすり抜けられる。
    parts.push(untrusted(url, [
      `ページタイトル: ${site.title}`,
      site.description ? `ページ説明: ${site.description}` : '',
      '',
      site.text,
    ].filter(Boolean).join('\n')));
  } else {
    parts.push(
      memo
        ? `※サイト本文を取得できませんでした (${site.note})。材料は上の「営業担当のメモ」だけです。メモに書かれていることは事実として扱ってよく、その場合 evidence には「営業担当のメモ」と書いてください。メモに無いことは書かず、該当するスコア項目は value 0 / evidence 空にしてください。`
        : `※サイト本文を取得できませんでした (${site.note})。この場合、事実として書けることはほとんどありません。summary / business は空に近くなって構いません。すべてのスコア項目の evidence を空にし、value を 0 にしてください。warnings に取得できなかったことを書いてください。`,
    );
  }
  parts.push(
    [
      '',
      // Edge は 25 秒で切られる。出力が長いほど落ちるので、字数上限を必ず守らせる。
      '次の JSON だけを返してください。各項目の字数上限を必ず守り、上限を超えたら削ってください。',
      '{',
      '  "name": "正式な会社名。ページから読み取れなければ空文字",',
      '  "industry": "業種 10字以内",',
      '  "targetTier": "A" | "B" | "C" | "X",',
      '  "summary": "会社概要 60字以内",',
      '  "business": "事業内容 70字以内",',
      '  "products": ["主要商品 最大4個・各20字以内"],',
      '  "customers": "顧客層 40字以内",',
      '  "sns":        { "value": "30字以内", "evidence": "40字以内" },',
      '  "videoUsage": { "value": "30字以内", "evidence": "40字以内" },',
      '  "ads":        { "value": "30字以内", "evidence": "40字以内" },',
      '  "hiring":     { "value": "30字以内", "evidence": "40字以内" },',
      '  "competitors": ["最大3個"],',
      '  "aiVideoFit": "AI動画との相性 50字以内",',
      '  "painHypothesis": ["想定課題 最大3個・各30字以内"],',
      '  "angle": "営業の切り口 50字以内。この会社にだけ当てはまる言い方",',
      '  "recommendedPlan": "entry" | "m4" | "m8" | "m12" | "oem",',
      '  "budgetGuess": "根拠が無ければ空文字",',
      '  "warnings": ["分析上の注意 最大2個・各40字以内"],',
      '  "score": [',
      '    { "key": "videoDemand", "value": 0, "evidence": "40字以内。無ければ空文字" },',
      '    { "key": "buyingSignal", "value": 0, "evidence": "" },',
      '    { "key": "companySize", "value": 0, "evidence": "" },',
      '    { "key": "productFit", "value": 0, "evidence": "" },',
      '    { "key": "continuity", "value": 0, "evidence": "" },',
      '    { "key": "oemPotential", "value": 0, "evidence": "" }',
      '  ]',
      '}',
    ].join('\n'),
  );
  return parts.join('\n\n');
}

// ============================================================
// 2. AI動画企画 (A/B/C を 1 案ずつ)
// ============================================================
const PLAN_ROLE: Record<PlanKind, string> = {
  A: '売上目的。商品・サービスの PR 動画。広告として出したときに問い合わせが増える画にする。',
  B: 'SNSバズ目的。縦型ショート。最初の1秒で指が止まる画から始める。',
  C: 'ブランド目的。映画・CM 風。会社の姿勢が1本で伝わる画にする。',
};

export function plansSystem(): string {
  return [
    'あなたは実写CMの監督兼プランナーです。AI で撮る前提の 15〜20 秒の映像企画を書きます。',
    NO_FABRICATION,
    '',
    BRAND,
    '',
    '【映像の作法 — 必ず守る】',
    '・プロンプトではなく「撮影指示書」を書く。AI に何を描かせるかではなく、実際の監督ならどう撮るかで考える。',
    '・REALISM FIRST。実在する人・カメラ・光・物理・感情・環境として書く。派手さは CG ではなくカメラ / 編集 / 音 / 照明 / テンポで作る。',
    '・最初の3秒 (HOOK) が最重要。ここで手が止まらなければ以降は存在しないのと同じ。',
    '・音を必ず設計する。台詞 / 環境音 / 効果音 / 音楽 / 無音のどれを使うかを書く。',
    '・登場人物が複数いる場合は CHARACTER A / B として別人格で固定する。顔の流用・小道具の重複は禁止。',
    '・「cinematic」「dynamic」のような曖昧語だけの指定は禁止。具体的なカメラ用語 (レンズ / 画角 / 動き) を使う。',
    '・過剰CG・不自然なスローモーション・過飽和・プラスチック肌・意味のない爆発は書かない。',
    '・日本語のナレーション・台詞は短く自然に。読み上げで誤読しやすい漢字はひらがなにする。',
    '',
    '【3案の役割】',
    'A: 売上目的。商品・サービスの PR 動画。',
    'B: SNSバズ目的。縦型ショート。',
    'C: ブランド目的。映画・CM 風。',
    '3案は「同じ企画の言い換え」にしないこと。狙う相手・置く場所・測る指標が別であること。',
  ].join('\n');
}

/** 1案ずつ作る。3案を1回で書かせると Edge の 25 秒に収まらない (実測 18 秒で時間切れ)。 */
export function planUser(c: Company, a: Analysis, kind: PlanKind, already: VideoPlan[]): string {
  const role = PLAN_ROLE[kind];
  return [
    `営業先: ${c.name} (${c.industry || '業種不明'})`,
    `事業内容: ${a.business || '(不明)'}`,
    `主要商品: ${a.products.join('、') || '(不明)'}`,
    `顧客層: ${a.customers || '(不明)'}`,
    `動画活用状況: ${a.videoUsage.value || '(不明)'}`,
    `想定課題: ${a.painHypothesis.join(' / ') || '(不明)'}`,
    c.memo ? `営業担当のメモ: ${c.memo}` : '',
    '',
    already.length
      ? `すでに作った案 (かぶらせないこと): ${already.map(p => `${p.kind}=${p.title}`).join(' / ')}`
      : '',
    '',
    `作るのは PLAN ${kind} の 1 案だけです。役割: ${role}`,
    '15〜20 秒。次の JSON だけを返してください:',
    '{',
    `  "kind": "${kind}",`,
    '  "purpose": "売上 | SNSバズ | ブランド のどれか",',
    '  "title": "企画タイトル 20字以内",',
    '  "hook3s": "冒頭3秒に何が映るか。文字ではなく画で書く。60字以内",',
    '  "beats": [ { "time": "0-3s", "shot": "被写体・動き・カメラ(レンズ/画角/動き)・光。70字以内", "audio": "台詞/環境音/効果音/音楽/無音。30字以内" } ],',
    '  "story": "何が起きて何で終わるか 80字以内",',
    '  "visual": "画づくり (時間帯・場所・色・質感) 60字以内",',
    '  "narration": "ナレーション案 60字以内。無音で見せる企画なら空文字",',
    '  "cta": "最後に出す一言 20字以内"',
    '}',
    'beats は 15〜20 秒を 4〜5 個に割ってください。合計が 20 秒を超えないこと。',
  ].filter(Boolean).join('\n');
}

// ============================================================
// 3. 営業メール
// ============================================================
export function emailSystem(): string {
  return [
    'あなたは映像制作会社の代表として、1 社ずつ手で書くメールを書きます。一斉配信の文面は書きません。',
    NO_FABRICATION,
    '',
    BRAND,
    '',
    catalogBlock(),
    '',
    '【禁止】',
    '・「弊社は AI を活用し」で始めること',
    '・一斉送信に見える書き出し (「貴社ますますご清栄のこととお慶び申し上げます」等)',
    '・AI が書いたような整いすぎた文、箇条書きだらけの営業資料調',
    '・長文。本文は 400 字以内。',
    '・「業界No.1」「圧倒的」「革新的」のような中身の無い強調',
    '・実績・取引先・受賞歴の創作',
    '・相手の求人や現状を否定すること、他社を批判すること',
    '',
    '【構造】',
    '1) 相手企業を実際に見て気づいた具体的なこと (資料に書かれている事実のみ)',
    '2) その会社なら作れる動画の企画アイデアを 1〜2 個、短く',
    '3) CORE Studio が何をする立場かを 1 文で',
    '4) 相手の負担が小さい CTA (5 分だけ / 資料だけ送る / 企画だけ見てもらう)',
    '',
    priceRule(),
    '',
    '署名は「CORE 代表 井出直毅」で終えてください。',
  ].join('\n');
}

export function emailUser(args: { c: Company; a: Analysis; plans: VideoPlan[] | null; touch: number; angle: string; instruction: string }): string {
  const { c, a, plans, touch, angle, instruction } = args;
  const tierNote = (() => {
    if (a.targetTier === 'A') {
      return [
        'この会社は代理店・制作会社です。OEM の提案をしてください。',
        '・御社の既存クライアント向けに AI 動画メニューを追加できる',
        '・営業は御社、制作は CORE',
        '・自社で AI 人材を採用する必要がない',
        '・ホワイトラベルで御社ブランドとして納品できる',
        '「うちの動画を買ってください」ではなく「御社が AI 動画を売れるようにする」と書くこと。',
      ].join('\n');
    }
    if (a.targetTier === 'B') {
      return [
        'この会社は動画・SNS 関連の求人を出しています。求人には触れてよいですが、否定はしないでください。',
        '採用と並行して使える外部制作チームという置き方にし、採用コスト・教育にかかる期間・人件費・退職で止まるリスク・出せる制作量を、比較として静かに示してください。',
        '「採用をやめて外注にしませんか」とは書かないこと。採用が決まるまでの制作量を埋める提案にすること。',
      ].join('\n');
    }
    return 'この会社は映像と相性の良い商材を持っています。撮影・キャスティング・スタジオ・ロケが不要になることで、これまで予算的に無理だった画が撮れる点を、その会社の商材に即して書いてください。';
  })();

  const planLines = (plans || []).slice(0, 2).map(p => `・${p.title} (${p.purpose}) — ${p.hook3s}`).join('\n');

  return [
    `営業先: ${c.name}`,
    c.contactName ? `担当者: ${c.contactName}` : '',
    `業種: ${c.industry || '不明'} / 区分: ${a.targetTier}`,
    `事業内容: ${a.business || '(不明)'}`,
    `気づいたこと (根拠つき): ${[a.sns, a.videoUsage, a.ads, a.hiring].filter(f => f.evidence).map(f => `${f.value} (${f.evidence})`).join(' / ') || '(根拠のある事実なし)'}`,
    `営業の切り口: ${a.angle || '(未設定)'}`,
    planLines ? `用意している企画:\n${planLines}` : '',
    c.memo ? `営業担当のメモ: ${c.memo}` : '',
    '',
    tierNote,
    '',
    touch <= 1
      ? 'これは初回のメールです。'
      : `これは ${touch} 回目の接触です。今回の切り口は「${angle}」。${instruction}\n前回までと同じ文面・同じ切り口を繰り返さないでください。`,
    '',
    '次の JSON だけを返してください:',
    '{ "subject": "件名 30字以内。営業メールに見えない、具体的な件名", "body": "本文 400字以内。改行を含めてよい" }',
  ].filter(Boolean).join('\n');
}

// ============================================================
// 4. 電話トーク
// ============================================================
export function callSystem(): string {
  return [
    'あなたは映像制作会社の代表として、初めての会社に電話をかけます。',
    NO_FABRICATION,
    '',
    BRAND,
    '',
    '【禁止】',
    '・サービス説明から入ること',
    '・30 秒を超える一方的な説明',
    '・「お忙しいところ恐れ入ります」から始まる定型の営業電話',
    '・相手の現状や他社を否定すること',
    '',
    '【型】',
    '1) 名乗り + なぜこの会社に電話したかを一言 (相手を見た具体的な理由)',
    '2) 相手に answer させる短い質問 (今、動画は社内でやっているか)',
    '3) 相手が答えた前提でつなぐ一言',
    '4) この会社ならどんな動画が合うかを 1 つだけ',
    '5) 5 分のオンラインを取る一言',
    '通しで読んで 30 秒以内 (日本語で約 200 字) に収めてください。',
    '',
    priceRule(),
  ].join('\n');
}

export function callUser(c: Company, a: Analysis, plans: VideoPlan[] | null): string {
  return [
    `営業先: ${c.name} (${c.industry || '業種不明'})`,
    `事業内容: ${a.business || '(不明)'}`,
    `電話した理由になる事実: ${[a.sns, a.videoUsage, a.ads, a.hiring].filter(f => f.evidence).map(f => f.value).join(' / ') || '(根拠のある事実なし。この場合は理由を作らず、業種に即した一般的な言い方にすること)'}`,
    plans && plans.length ? `合いそうな企画: ${plans[0].title} — ${plans[0].hook3s}` : '',
    a.targetTier === 'A' ? 'この会社は代理店・制作会社なので、OEM (御社が売り、COREが作る) の入口として話すこと。' : '',
    a.targetTier === 'B' ? 'この会社は動画関連の求人を出しているので、そこに軽く触れてよい。ただし採用を否定しないこと。' : '',
    '',
    '次の JSON だけを返してください:',
    '{',
    '  "opening": "名乗り + 電話した理由 (相手が話し始める前の一言)",',
    '  "question": "相手に答えてもらう質問",',
    '  "bridge": "相手が答えたあとにつなぐ一言",',
    '  "hook": "この会社ならこういう動画、という一言",',
    '  "close": "5分のオンラインを取る一言",',
    '  "objections": [ { "q": "断り文句", "a": "20字前後の返し" } ]',
    '}',
    'objections は実際に返ってくる断り文句を 4 つ (「間に合っています」「担当が不在」「今は予算がない」「資料を送っておいて」など) 入れてください。',
  ].filter(Boolean).join('\n');
}
