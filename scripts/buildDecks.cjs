// ============================================================
// CORE 4プロダクト 営業資料 (pptxgenjs / 16:9 / ダーク・プレミアム)
// 価格 × できること を中心に、corp サイトのロゴ・カラーで統一
// 出力: ~/Desktop/CORE 営業資料/CORE_<Name>_営業資料.pptx
// ============================================================
const pptxgen = require("pptxgenjs");
const os = require("os");
const path = require("path");

const OUT = path.join(os.homedir(), "Desktop/CORE 営業資料");
const LOGO = path.join(OUT, "_logos");

const GOTH = "Hiragino Sans";
const MIN = "Hiragino Mincho ProN";
const NUM = "Helvetica Neue";

const BG = "07070F";
const PANEL = "10101C";
const PANEL2 = "14141F";
const INK = "FFFFFF";
const DIM = "AEB4C2";
const FAINT = "6E7686";

// ── ユーティリティ ──
function blend(hex, withHex, t) {
  const a = hex.match(/.{2}/g).map((h) => parseInt(h, 16));
  const b = withHex.match(/.{2}/g).map((h) => parseInt(h, 16));
  return a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

const PRODUCTS = [
  {
    key: "prism", name: "Prism", accent: "a78bfa", bright: "c4b5fd",
    role: "事業家のための AI エージェント OS", logo: "prism.png",
    tag: "すべての事業を、ひとつの頭脳で。", en: "One mind for your whole business.",
    problem: ["社長は、ひとりで全部やっている。", "営業も、財務も、契約も、議事録も。"],
    about: "経営者の中に同居する複数の役割を、専属の AI エージェントとして外に取り出す経営 OS。決断・営業・財務・創造——役割の数だけ、専門の頭脳が並走します。",
    caps: [
      ["七つの役割・七人の専属AI", "経営・営業・財務・創造を役割ごとに分担"],
      ["商談から契約まで一気通貫", "議事録・提案・財務・契約レビューを下書きまで"],
      ["13名のAI役員が並走", "次にやるべきことを、AIの方から提案"],
    ],
    steps: [["話す・渡す", "音声・ファイル・画像をそのまま投げる"], ["AIが仕上げる", "議事録も契約も、下書きまで完成"], ["確認して送る", "あなたは目を通して送り出すだけ"]],
    plans: [
      ["Free", "¥0", "/7日間", "全機能を7日間おためし・カード登録不要", false],
      ["Starter", "¥4,800", "/月", "基本AI機能・1人格1ユーザー・ナレッジ100件", false],
      ["Standard", "¥9,800", "/月", "全AI（商談AI含む）・人格無制限・音声秘書", true],
      ["Exclusive", "¥29,800", "/月", "専任CS・優先サポート・カスタム連携・導入伴走", false],
    ],
    connect: "Iris（Instagram）・Resonance（LINE）・Lume（リンク）が集めたお客様の動きは、最後にすべて Prism へ集まり、次の一手まで提案します。",
    url: "core-prism-app.vercel.app",
  },
  {
    key: "iris", name: "Iris", accent: "E1306C", bright: "F472B6",
    role: "インフルエンサーのための AI", logo: "iris.png",
    tag: "Instagramを、AIと育てる。", en: "Run Instagram with an AI agent.",
    problem: ["フォロワー数より、案件数。", "「いいね」は、仕事にならない。"],
    about: "届いた反応も、流れていく数字も受けとめ、次の一手に変えるクリエイターのための AI。インフルエンサーの六つの仕事を、ひとつのアプリにまとめます。",
    caps: [
      ["投稿AI", "構成・テロップ・キャプション・タグを丸ごと下書き"],
      ["Instagram解析", "数字を踏まえて、AIが次の一手まで決める"],
      ["案件・交渉AI", "スクショ3秒入力／返信・断り・カウンターを生成"],
    ],
    steps: [["ネタを渡す", "スクショ・写真・思いつきをそのまま"], ["AIが下書き", "投稿も返信も戦略も、AIが先に書く"], ["確認して出す", "整えて、投稿・送信するだけ"]],
    plans: [
      ["Free", "¥0", "/7日間", "全機能を7日間おためし・カード登録不要", false],
      ["Lite", "¥2,980", "/月", "AI相談50回/月・案件管理無制限・キャプション月30", false],
      ["Standard", "¥6,980", "/月", "リール自動生成・AI相談/解析ほぼ無制限・Instagram解析", true],
      ["Pro", "¥12,800", "/月", "連携アカウント5・ブランドマッチ・運用代行", false],
    ],
    connect: "Iris で掴んだファンの反応は、そのまま Resonance の LINE 配信や、司令塔 Prism の経営判断へとつながります。",
    url: "core-prism-app.vercel.app/iris",
  },
  {
    key: "resonance", name: "Resonance", accent: "06C755", bright: "34D399",
    role: "店舗・サロン・教室のための AI", logo: "resonance.png",
    tag: "LINEのご縁を、AIが温める。", en: "Let it resonate.",
    problem: ["同じ文を、全員に。もう、やめにする。", "お客様は、一人ひとり違う。"],
    about: "名簿の一人ひとりに、その人のための一文を AI が書き分け、LINE で手紙のように届ける個別配信。「また会いたい」を、静かに育てます。",
    caps: [
      ["個別文面AI", "一人ひとりに、別の言葉を書き分ける"],
      ["承認制で安心", "送る前に、必ず全件を確認できる設計"],
      ["LINE公式に接続", "お持ちのアカウントに、そのまま"],
    ],
    steps: [["LINEをつなぐ", "お持ちのLINE公式アカウントを接続"], ["AIが書き分け", "名簿ごとに最適な文面を下書き"], ["全件確認して送る", "一人ひとりに、手紙のように届く"]],
    plans: [
      ["7日間無料", "¥0", "/7日間", "全機能を7日間おためし・カード登録不要", false],
      ["Solo", "¥1,980", "/月", "AI個別配信・1アカウント・月2,000通", false],
      ["Pro", "¥4,980", "/月", "AIレター・1アカウント・月8,000通・全件確認", true],
      ["Business", "¥9,800", "/月", "3アカウント・月30,000通・設定代行", false],
    ],
    connect: "Iris や Lume が見つけた「いま関心のある人」へ、最適なタイミングで届きます。そして結果はすべて Prism に集まります。",
    url: "resonancebot-ivory.vercel.app",
  },
  {
    key: "lume", name: "Lume", accent: "FFA42A", bright: "FFD86B",
    role: "クリエイターのためのリンクハブ", logo: "lume.png",
    tag: "すべてのリンクを、ひとつに。", en: "Every link, in one place.",
    problem: ["プロフィールは、一行しかない。", "その一行に、全部を込める。"],
    about: "あなたのすべてのリンクを束ねるハブ。誰が、どこから、どのリンクに触れたのか。クリエイターの「いま」を、色と熱で映し出す、リンクまとめの新しい基準です。",
    caps: [
      ["30秒で完成", "5つのテーマで、すぐ整う美しいプロフィール"],
      ["クリックヒートマップ", "押された比率を、熱で可視化する"],
      ["流入元・時間帯分析", "どこから来て、何を踏んだかが分かる"],
    ],
    steps: [["リンクを並べる", "すべてのリンクをひとつに集約"], ["美しく仕上がる", "5つのテーマでプロフィール完成"], ["色で、分かる", "誰がどこを踏んだかを熱で可視化"]],
    plans: [
      ["7日間無料", "¥0", "/7日間", "全機能を7日間おためし・カード登録不要", false],
      ["Pro", "¥1,480", "/月", "ヒートマップ・流入元クロス分析・時間帯の可視化", true],
      ["Business", "¥3,480", "/月", "Pro全機能・複数プロフィール管理", false],
    ],
    connect: "誰がどのリンクを踏んだか。その流れは、Iris・Resonance・司令塔 Prism すべての判断材料になります。",
    url: "lume-deploy-five.vercel.app",
  },
];

function build(p) {
  const A = p.accent, B = p.bright;
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "W", width: 13.333, height: 7.5 });
  pptx.layout = "W";
  const W = 13.333, H = 7.5;
  const foot = (s) => {
    s.addText("株式会社コア  ·  CORE Inc.", { x: 0.5, y: H - 0.45, w: 6, h: 0.3, fontFace: GOTH, fontSize: 8, color: FAINT, align: "left" });
  };
  const bg = (s, c = BG) => s.background = { color: c };
  const glowBlob = (s, x, y, d, color, alpha) => s.addShape(pptx.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color, transparency: alpha } });

  // ── 1. TITLE ──
  let s = pptx.addSlide(); bg(s);
  glowBlob(s, W / 2 - 3, -1.6, 6, A, 90);
  s.addImage({ path: path.join(LOGO, p.logo), x: W / 2 - 0.95, y: 0.7, w: 1.9, h: 1.9 });
  s.addText(`CORE ${p.name.toUpperCase()}  /  ${p.role}`, { x: 0, y: 2.75, w: W, h: 0.4, fontFace: GOTH, fontSize: 13, color: B, bold: true, align: "center", charSpacing: 3 });
  s.addText(p.tag, { x: 0.5, y: 3.2, w: W - 1, h: 1.0, fontFace: MIN, fontSize: 46, color: INK, bold: true, align: "center" });
  s.addText(p.en, { x: 0, y: 4.35, w: W, h: 0.5, fontFace: GOTH, fontSize: 16, color: FAINT, italic: true, align: "center" });
  s.addShape(pptx.ShapeType.roundRect, { x: W / 2 - 2.1, y: 5.15, w: 4.2, h: 0.56, rectRadius: 0.28, fill: { color: A, transparency: 82 }, line: { color: A, width: 1 } });
  s.addText("7日間無料 ・ クレカ登録不要", { x: W / 2 - 2.1, y: 5.15, w: 4.2, h: 0.56, fontFace: GOTH, fontSize: 14, color: INK, align: "center", bold: true });
  foot(s);

  // ── 2. PROBLEM ──
  s = pptx.addSlide(); bg(s);
  s.addText("THE PROBLEM", { x: 0.9, y: 1.4, w: 6, h: 0.4, fontFace: GOTH, fontSize: 13, color: B, bold: true, charSpacing: 4 });
  s.addText(p.problem[0], { x: 0.9, y: 1.95, w: W - 1.8, h: 1.6, fontFace: MIN, fontSize: 44, color: INK, bold: true, align: "left", lineSpacingMultiple: 1.1 });
  s.addText(p.problem[1], { x: 0.9, y: 4.0, w: W - 1.8, h: 0.7, fontFace: GOTH, fontSize: 20, color: DIM, align: "left" });
  s.addText("∴", { x: W - 3.2, y: 4.6, w: 2.3, h: 1.6, fontFace: MIN, fontSize: 90, color: blend(BG, A, 0.5), align: "right" });
  foot(s);

  // ── 3. ABOUT + 3 capability cards ──
  s = pptx.addSlide(); bg(s);
  s.addText(`CORE ${p.name} とは`, { x: 0.9, y: 0.75, w: W - 1.8, h: 0.7, fontFace: MIN, fontSize: 34, color: INK, bold: true, align: "left" });
  s.addText(p.about, { x: 0.9, y: 1.55, w: W - 1.8, h: 1.2, fontFace: GOTH, fontSize: 16, color: DIM, align: "left", lineSpacingMultiple: 1.4 });
  const cw = (W - 1.8 - 0.6) / 3;
  p.caps.forEach((c, i) => {
    const x = 0.9 + i * (cw + 0.3);
    s.addShape(pptx.ShapeType.roundRect, { x, y: 3.15, w: cw, h: 3.0, rectRadius: 0.12, fill: { color: PANEL }, line: { color: blend(BG, A, 0.35), width: 1 } });
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.4, y: 3.5, w: 0.5, h: 0.5, fill: { color: A, transparency: 75 }, line: { color: A, width: 1 } });
    s.addText(`${i + 1}`, { x: x + 0.4, y: 3.5, w: 0.5, h: 0.5, fontFace: NUM, fontSize: 18, color: B, bold: true, align: "center" });
    s.addText(c[0], { x: x + 0.4, y: 4.25, w: cw - 0.8, h: 0.9, fontFace: GOTH, fontSize: 18, color: INK, bold: true, align: "left", valign: "top" });
    s.addText(c[1], { x: x + 0.4, y: 5.15, w: cw - 0.8, h: 0.9, fontFace: GOTH, fontSize: 13, color: DIM, align: "left", valign: "top", lineSpacingMultiple: 1.3 });
  });
  foot(s);

  // ── 4. HOW IT WORKS ──
  s = pptx.addSlide(); bg(s);
  s.addText("使い方は、三つだけ。", { x: 0.9, y: 0.8, w: W - 1.8, h: 0.7, fontFace: MIN, fontSize: 34, color: INK, bold: true, align: "left" });
  const sw = (W - 1.8 - 1.2) / 3;
  p.steps.forEach((st, i) => {
    const x = 0.9 + i * (sw + 0.6);
    s.addShape(pptx.ShapeType.roundRect, { x, y: 2.7, w: sw, h: 2.7, rectRadius: 0.12, fill: { color: PANEL2 }, line: { color: blend(BG, A, 0.3), width: 1 } });
    s.addText(`0${i + 1}`, { x: x + 0.35, y: 2.95, w: 2, h: 0.9, fontFace: NUM, fontSize: 40, color: B, bold: true, align: "left" });
    s.addText(st[0], { x: x + 0.38, y: 3.95, w: sw - 0.7, h: 0.6, fontFace: GOTH, fontSize: 19, color: INK, bold: true, align: "left" });
    s.addText(st[1], { x: x + 0.38, y: 4.55, w: sw - 0.7, h: 0.8, fontFace: GOTH, fontSize: 13, color: DIM, align: "left", lineSpacingMultiple: 1.3, valign: "top" });
    if (i < 2) s.addText("→", { x: x + sw, y: 3.6, w: 0.6, h: 0.6, fontFace: GOTH, fontSize: 22, color: A, align: "center" });
  });
  foot(s);

  // ── 5. PRICING (料金 × できること) ──
  s = pptx.addSlide(); bg(s);
  s.addText("料金 × できること", { x: 0.9, y: 0.6, w: W - 1.8, h: 0.7, fontFace: MIN, fontSize: 32, color: INK, bold: true, align: "left" });
  const rows = [[
    { text: "プラン", options: { fontFace: GOTH, fontSize: 12, color: FAINT, bold: true, fill: { color: BG }, valign: "middle" } },
    { text: "月額", options: { fontFace: GOTH, fontSize: 12, color: FAINT, bold: true, fill: { color: BG }, valign: "middle" } },
    { text: "主なできること", options: { fontFace: GOTH, fontSize: 12, color: FAINT, bold: true, fill: { color: BG }, valign: "middle" } },
  ]];
  p.plans.forEach(([nm, pr, per, feat, hot]) => {
    const rf = hot ? blend(BG, A, 0.18) : PANEL;
    rows.push([
      { text: nm + (hot ? "  ★人気" : ""), options: { fontFace: GOTH, fontSize: 15, color: INK, bold: true, fill: { color: rf }, valign: "middle" } },
      { text: pr + (per ? " " + per : ""), options: { fontFace: NUM, fontSize: 17, color: hot ? B : INK, bold: true, fill: { color: rf }, valign: "middle" } },
      { text: feat, options: { fontFace: GOTH, fontSize: 12.5, color: DIM, fill: { color: rf }, valign: "middle" } },
    ]);
  });
  s.addTable(rows, {
    x: 0.9, y: 1.5, w: W - 1.8, colW: [2.4, 2.0, W - 1.8 - 4.4],
    border: { type: "solid", color: blend(BG, INK, 0.1), pt: 1 },
    rowH: p.plans.length > 4 ? 0.74 : 0.92, valign: "middle",
    margin: [4, 8, 4, 10],
  });
  s.addText("全プラン 7日間無料・クレジットカード登録不要" + (p.key === "resonance" ? "（BYOKで原価ほぼ0）" : ""), { x: 0.9, y: H - 0.9, w: W - 1.8, h: 0.4, fontFace: GOTH, fontSize: 13, color: B, bold: true, align: "left" });
  foot(s);

  // ── 6. CONNECT ──
  s = pptx.addSlide(); bg(s);
  glowBlob(s, W / 2 - 2.4, 1.4, 4.8, A, 93);
  s.addText("ONE FLOW", { x: 0, y: 1.5, w: W, h: 0.4, fontFace: GOTH, fontSize: 13, color: B, bold: true, align: "center", charSpacing: 4 });
  s.addText("CORE は、つながっている。", { x: 0.5, y: 2.0, w: W - 1, h: 0.9, fontFace: MIN, fontSize: 38, color: INK, bold: true, align: "center" });
  s.addText(p.connect, { x: 2.0, y: 3.15, w: W - 4.0, h: 1.6, fontFace: GOTH, fontSize: 17, color: DIM, align: "center", lineSpacingMultiple: 1.6 });
  const chips = [["Prism", "a78bfa"], ["Iris", "E1306C"], ["Resonance", "06C755"], ["Lume", "FFA42A"]];
  const tot = chips.length, chw = 2.2, cgap = 0.3, startx = (W - (chw * tot + cgap * (tot - 1))) / 2;
  chips.forEach((c, i) => {
    const x = startx + i * (chw + cgap);
    const on = c[0].toLowerCase() === p.key;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 5.0, w: chw, h: 0.7, rectRadius: 0.35, fill: { color: on ? c[1] : PANEL, transparency: on ? 70 : 0 }, line: { color: c[1], width: on ? 2 : 1 } });
    s.addText(c[0], { x, y: 5.0, w: chw, h: 0.7, fontFace: GOTH, fontSize: 14, color: INK, bold: true, align: "center" });
  });
  foot(s);

  // ── 7. CLOSE / CTA ──
  s = pptx.addSlide(); bg(s);
  glowBlob(s, W / 2 - 3.2, 1.2, 6.4, A, 90);
  s.addImage({ path: path.join(LOGO, p.logo), x: W / 2 - 0.7, y: 1.6, w: 1.4, h: 1.4 });
  s.addText(p.tag, { x: 0.5, y: 3.2, w: W - 1, h: 1.0, fontFace: MIN, fontSize: 40, color: INK, bold: true, align: "center" });
  s.addText(`${p.url}    ·    hello@core-inc.jp`, { x: 0, y: 4.5, w: W, h: 0.5, fontFace: NUM, fontSize: 15, color: DIM, align: "center" });
  s.addText("7日間無料ではじめる", { x: W / 2 - 2, y: 5.3, w: 4, h: 0.6, fontFace: GOTH, fontSize: 16, color: B, bold: true, align: "center" });
  foot(s);

  const file = path.join(OUT, p.name, `CORE_${p.name}_営業資料.pptx`);
  return pptx.writeFile({ fileName: file }).then(() => console.log("wrote", file));
}

(async () => {
  for (const p of PRODUCTS) await build(p);
  console.log("ALL DONE");
})();
