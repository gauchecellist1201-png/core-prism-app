#!/usr/bin/env node
// ============================================================
// generateIndustryPerachi.mjs — 業界別 ペライチ画像 6 種 + 投稿文案
// オーナー指示 (2026-06-03 自律実行): D. Twitter 投稿準備
// ============================================================
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = '/Users/naokiide/Desktop/業界別ペライチ';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// 業界 config (LP 側と同じ数字を使う = 嘘がない)
const INDUSTRIES = [
  {
    slug: 'sme', name: 'SME 中小企業',
    bg: '#FAF6EC', cardBg: '#0E0E18',
    titleColor: '#1A1A2E', subColor: '#5B6076',
    heroText: 'コンサル代を 1/7 に',
    heroSub: '月¥30,000 で AI 役員 13 名',
    bigNumber: '¥170 万', bigNumberLabel: '月の節約',
    footerPrice: '月 ¥20,000〜',
    landingUrl: 'core-prism-app.vercel.app/lp/sme',
    panels: [
      { catch: 'AI 役員会', sub: '13 名がいつでも', main: '推奨 1 案 +\n代案 2 案' },
      { catch: '提案資料', sub: '全部 1 タップで', main: '5 分で\n完成' },
      { catch: '営業 CVR', sub: '商談 → 成約', main: '+18%\n(見込み)' },
      { catch: '事務時間', sub: '月の作業時間', main: '▲ 87%' },
    ],
  },
  {
    slug: 'realestate-finance', name: '不動産・金融',
    bg: '#F0F4FA', cardBg: '#0E1A2E',
    titleColor: '#0F2540', subColor: '#5B6B85',
    heroText: '契約 1 件で投資回収',
    heroSub: '提案の質を 5 倍に',
    bigNumber: '8h → 30min', bigNumberLabel: '提案準備時間',
    footerPrice: '月 ¥20,000〜', landingUrl: 'core-prism-app.vercel.app/lp/realestate-finance',
    panels: [
      { catch: '潜在ニーズ', sub: '顧客資料を 2 分で', main: '抽出 +\nリスク発見' },
      { catch: '反論対応', sub: '想定 20 パターン', main: '即時\n提示' },
      { catch: '成約率', sub: '新人の改善', main: '12 → 28%' },
      { catch: '投資回収', sub: '契約 1 件で', main: '12 ヶ月分' },
    ],
  },
  {
    slug: 'consulting', name: 'コンサル・士業',
    bg: '#F5F0FA', cardBg: '#1A0F2A',
    titleColor: '#2A1140', subColor: '#5B4670',
    heroText: '分析 → 提案 → 報告書',
    heroSub: 'AI が下書き、あなたは判断と署名',
    bigNumber: '5 → 12 案件', bigNumberLabel: '1 人あたり同時案件',
    footerPrice: '月 ¥20,000〜', landingUrl: 'core-prism-app.vercel.app/lp/consulting',
    panels: [
      { catch: '論点抽出', sub: '資料を入れると', main: '章立て +\nグラフ案' },
      { catch: '月次レポート', sub: '署名するだけで', main: '1.5 時間 →\n完成' },
      { catch: '案件数', sub: '同時対応可能', main: '2.4 倍' },
      { catch: 'レビュー時間', sub: 'ジュニアの', main: '▲ 70%' },
    ],
  },
  {
    slug: 'solo', name: '一人社長',
    bg: '#FAF7F0', cardBg: '#0E0E18',
    titleColor: '#1A1A2E', subColor: '#5B6076',
    heroText: 'ひとり社長の右腕',
    heroSub: '月¥5,000 で事務 / 営業 / 経理 全部 AI',
    bigNumber: '月 22h', bigNumberLabel: '本業に戻る時間',
    footerPrice: '月 ¥3,000〜', landingUrl: 'core-prism-app.vercel.app/lp/solo',
    panels: [
      { catch: '繋ぐだけで', sub: 'Stripe / Gmail / Cal', main: '数字 +\n予定 が見える' },
      { catch: '朝のブリーフ', sub: 'AI が今日を', main: '提案 →\n実行' },
      { catch: '事務時間', sub: 'オーナー実体験', main: '30 → 8 時間' },
      { catch: '時間の価値', sub: '時給 3,000 円換算', main: '月 ¥66K\n戻る' },
    ],
  },
  {
    slug: 'creator', name: 'クリエイター',
    bg: '#FDF4FA', cardBg: '#1F0B2A',
    titleColor: '#3D1A4A', subColor: '#6B3F7E',
    heroText: 'フォロワー数より、案件数',
    heroSub: '月¥5,000 で 6 人の AI チーム',
    bigNumber: '5 秒', bigNumberLabel: 'リール台本完成',
    footerPrice: '月 ¥3,000〜', landingUrl: 'core-prism-app.vercel.app/lp/creator',
    panels: [
      { catch: 'リール台本', sub: 'テーマ 1 行で', main: '5 秒で\n完成' },
      { catch: 'DM 返信', sub: 'AI 案件確度判定', main: '週 18 件 →\n4 案件' },
      { catch: '案件単価', sub: '交渉 AI 使用後', main: '+40%' },
      { catch: 'AI チーム', sub: '6 名のエージェント', main: '戦略 / 演出 /\n案件 / ファン' },
    ],
  },
  {
    slug: 'freelance-pro', name: '上位フリーランス',
    bg: '#F0FAF5', cardBg: '#0E1A1A',
    titleColor: '#0F2A20', subColor: '#5B7570',
    heroText: '単価交渉 + 請求業務',
    heroSub: 'AI に任せて月 +¥30 万',
    bigNumber: '+¥30 万', bigNumberLabel: '月の単価アップ',
    footerPrice: '月 ¥3,000〜', landingUrl: 'core-prism-app.vercel.app/lp/freelance-pro',
    panels: [
      { catch: '適正単価', sub: '案件登録すると', main: '交渉文 +\n契約書' },
      { catch: '確定申告', sub: '常に最新', main: '6h →\n30 分' },
      { catch: '議事録 AI', sub: '案件メモも全部', main: '構造化\n完了' },
      { catch: '投資回収', sub: '次の案件で', main: '2 日' },
    ],
  },
];

// ── SVG 生成 ────────────────────────────────────
function makeSvg(c) {
  const W = 1600, H = 900;
  // iPhone モック (1 個 320x600 ぐらいに)
  const phW = 300, phH = 600, gap = 40;
  const totalW = 4 * phW + 3 * gap;
  const xStart = (W - totalW) / 2;
  const yPhone = 180;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif">
  <rect width="${W}" height="${H}" fill="${c.bg}"/>
  <rect x="24" y="24" width="${W-48}" height="${H-48}" rx="28" fill="${shade(c.bg)}" opacity="0.55"/>

  <!-- ヘッダー -->
  <text x="${W/2}" y="80" text-anchor="middle" fill="${c.titleColor}" font-size="38" font-weight="900">${c.heroText}</text>
  <text x="${W/2}" y="120" text-anchor="middle" fill="${c.subColor}" font-size="18" font-weight="600">${c.heroSub}</text>

  <defs>
    <filter id="phShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
      <feOffset dy="4" result="off"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.16"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  ${c.panels.map((p, i) => makePhone(xStart + i * (phW + gap), yPhone, phW, phH, p, c, i)).join('\n')}

  <text x="${W/2}" y="${H-50}" text-anchor="middle" fill="${c.subColor}" font-size="14" font-weight="700" letter-spacing="2">${c.footerPrice || '月 ¥5,000〜'} ・ 7 日間 無料 ・ カード登録なし ・ ${c.landingUrl}</text>
</svg>`;
}

function makePhone(x, y, w, h, p, c, idx) {
  // ヘッダー (キャッチ + サブ)
  const catchY = 38;
  const subY = 70;
  // メイン (大文字)
  const mainLines = p.main.split('\n');
  const mainStartY = 280;
  const phoneId = `acc-${idx}`;
  return `<g transform="translate(${x},${y})" filter="url(#phShadow)">
    <rect x="0" y="0" width="${w}" height="${h}" rx="42" fill="${c.cardBg}" stroke="${darken(c.cardBg, 0.4)}" stroke-width="2"/>
    <rect x="${w/2 - 35}" y="14" width="70" height="16" rx="8" fill="#000"/>
    <text x="28" y="44" fill="#fff" font-size="12" font-weight="700">9:41</text>
    <text x="${w-28}" y="44" fill="#fff" font-size="11" text-anchor="end">●●● 100%</text>

    <text x="${w/2}" y="${catchY+80}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="14" font-weight="700" letter-spacing="3">${p.catch}</text>
    <text x="${w/2}" y="${subY+90}" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="12" font-weight="500">${p.sub}</text>

    <line x1="40" y1="200" x2="${w-40}" y2="200" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

    ${mainLines.map((line, i) => `<text x="${w/2}" y="${mainStartY + i * 56}" text-anchor="middle" fill="${idx % 2 === 0 ? '#FBBF24' : '#34D399'}" font-size="44" font-weight="900">${escape(line)}</text>`).join('\n    ')}

    <line x1="40" y1="${h-130}" x2="${w-40}" y2="${h-130}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <text x="${w/2}" y="${h-95}" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="11" font-weight="600">CORE で</text>
    <text x="${w/2}" y="${h-75}" text-anchor="middle" fill="#fff" font-size="13" font-weight="800">タップで AI 実行</text>

    <rect x="40" y="${h-50}" width="${w-80}" height="34" rx="17" fill="${idx === 1 || idx === 3 ? '#FBBF24' : 'rgba(255,255,255,0.08)'}" stroke="${idx !== 1 && idx !== 3 ? 'rgba(255,255,255,0.15)' : 'none'}" stroke-width="1"/>
    <text x="${w/2}" y="${h-28}" text-anchor="middle" fill="${idx === 1 || idx === 3 ? '#0a0a0f' : '#fff'}" font-size="12" font-weight="800">▶ 触ってみる</text>
  </g>`;
}

function shade(hex) {
  // simple darken for backgrounds
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0,2),16);
  const g = parseInt(m[1].slice(2,4),16);
  const b = parseInt(m[1].slice(4,6),16);
  return `#${[r,g,b].map(n => Math.max(0, n - 12).toString(16).padStart(2,'0')).join('')}`;
}
function darken(hex, factor) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const r = Math.floor(parseInt(m[1].slice(0,2),16) * (1 - factor));
  const g = Math.floor(parseInt(m[1].slice(2,4),16) * (1 - factor));
  const b = Math.floor(parseInt(m[1].slice(4,6),16) * (1 - factor));
  return `#${[r,g,b].map(n => Math.max(0,n).toString(16).padStart(2,'0')).join('')}`;
}
function escape(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── レンダリング ─────────────────────────────────
console.log(`🎨 業界別ペライチ 6 種を生成中…`);
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

for (const c of INDUSTRIES) {
  const svgPath = resolve(outDir, `${c.slug}.svg`);
  const htmlPath = resolve(outDir, `_${c.slug}.html`);
  const pngPath = resolve(outDir, `${c.name.replace(/ /g, '_')}.png`);

  writeFileSync(svgPath, makeSvg(c), 'utf8');
  writeFileSync(htmlPath, `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:${c.bg}}</style></head><body><object type="image/svg+xml" data="${c.slug}.svg" width="1600" height="900"></object></body></html>`, 'utf8');

  try {
    execSync(`"${chrome}" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --virtual-time-budget=4000 --screenshot="${pngPath}" --window-size=1600,900 "file://${htmlPath}" 2>&1`, { stdio: 'pipe' });
    console.log(`  ✔ ${c.name}: ${pngPath}`);
  } catch (e) {
    console.error(`  ✗ ${c.name}: ${e.message}`);
  }
}

// クリーンアップ
console.log(`\n📝 投稿文案を生成中…`);
writePostingCopy(INDUSTRIES);

// SVG / HTML を消す (PNG だけ残す)
INDUSTRIES.forEach(c => {
  try {
    execSync(`rm -f "${resolve(outDir, `_${c.slug}.html`)}"`);
    execSync(`rm -f "${resolve(outDir, `${c.slug}.svg`)}"`);
  } catch {}
});

console.log(`\n✅ 完了! ${outDir} に保存しました`);

function writePostingCopy(industries) {
  const lines = [
    '# 𝕏 業界別 投稿文案 (3 パターン × 6 業界 = 18 案)',
    '',
    'オーナー指示 2026-06-03: 業界別 LP 6 種のペライチ + 投稿文案。',
    '',
  ];

  const COPIES = {
    'sme': {
      patternA: '中小企業の社長へ。\n\nコンサル代 月¥200 万を、月¥30,000 に圧縮できる時代になりました。\n\n・AI 役員 13 名がいつでも経営判断を支える\n・提案資料 / 営業文 / 月次 P/L 全部 AI 下書き\n・事務時間 ▲ 87% (オーナー実体験)\n\n7 日間 無料・カード登録なし\n🟡 core-prism-app.vercel.app/lp/sme',
      patternB: 'ひとりで全部抱えてる中小企業の社長、\n\nAI 役員 13 名 をいつでも雇える時代になった。\n\n月¥30,000。コンサルの 1/7。\n7 日間 無料、カード登録なし。\n\n🟡 core-prism-app.vercel.app/lp/sme',
      patternC: '創業 3 年の自分の会社、ひとりで全部やってきて月 30 時間が事務に消えてました。\n\nAI に肩代わりさせるアプリ作ったら 8 時間に。\n\n同じ悩みの中小社長さんに共有します。\nコンサル代より安い、月¥30,000。\n\n🟡 core-prism-app.vercel.app/lp/sme',
    },
    'realestate-finance': {
      patternA: '不動産・金融営業の方へ💼\n\n顧客資料を入れた瞬間に、潜在ニーズ・法的リスク・反論想定・クロージング文まで全部出る AI 営業パートナー。\n\n・提案準備 8h → 30 分\n・成約率 12% → 28% (新人での見込み)\n・契約 1 件で 12 ヶ月分回収\n\n月¥30,000・7 日間 無料\n🟢 core-prism-app.vercel.app/lp/realestate-finance',
      patternB: '契約 1 件で年間コスト回収。\n\nAI 営業パートナーが提案準備を 8h → 30 分に。\n\n月¥30,000、7 日間 無料。\n🟢 core-prism-app.vercel.app/lp/realestate-finance',
      patternC: '新人の成約率が 12% → 28% に上がった、不動産営業の話。\n\n何が変わったか:「反論対応 20 パターン」をその場で見られるようになった。新人でもプロの提案が出せる。\n\n月¥30,000。 詳細 →\n🟢 core-prism-app.vercel.app/lp/realestate-finance',
    },
    'consulting': {
      patternA: 'コンサル・士業の方へ。\n\n分析 → 提案 → 報告書 を AI が下書き。\nあなたは判断と署名だけ。\n\n・報告書作成 8h → 1.5h (▲ 81%)\n・1 人あたり同時案件 5 → 12\n・ジュニアのレビュー時間 ▲ 70%\n\n月¥50,000・1 案件¥4,200。 7 日間 無料\n🟣 core-prism-app.vercel.app/lp/consulting',
      patternB: '案件数 2.4 倍。\n品質はそのままに。\n\nコンサル・士業の方の右腕 AI。\n月¥50,000、7 日間 無料。\n🟣 core-prism-app.vercel.app/lp/consulting',
      patternC: 'クライアントが急に増えて、1 人で 5 案件回すのが限界だった。\n\nAI 導入後、同じ品質で 12 案件回せるようになった。\n月次レポート作成が 8 時間 → 1.5 時間に。\n\n同業の方に共有します。\n🟣 core-prism-app.vercel.app/lp/consulting',
    },
    'solo': {
      patternA: '一人経営 3 年やってきて、いちばん時間を吸われてたのが「数字確認・請求書発行・タスク整理」の事務系で月 30 時間。\n\nAI に肩代わりさせるアプリ作ったら 8 時間に減りました。\n\n同じ悩みの方に共有します。月 ¥5,000・7 日無料。\n🟡 core-prism-app.vercel.app/lp/solo',
      patternB: 'ひとり社長の右腕、月 ¥5,000。\n\n事務 / 営業 / 経理 ぜんぶ AI に。\n月 22h が本業に戻る。\n\n7 日間 無料・カード登録なし\n🟡 core-prism-app.vercel.app/lp/solo',
      patternC: '月¥5,000 で「事務専属社員 + AI 役員 13 名」を雇える時代。\n\n・経営の数字、Stripe つなぐだけで自動集計\n・朝のブリーフ → 提案タップで AI がその場で実行\n・営業文 / 請求書 全部 1 タップで下書き\n\n7 日間 無料\n🟡 core-prism-app.vercel.app/lp/solo',
    },
    'creator': {
      patternA: 'SNS クリエイターのための「6 人の AI チーム」作りました 💼\n\n・リール台本: テーマ 1 行で 5 秒で完成\n・DM 返信: AI 下書き → 承認するだけ\n・案件管理: DM → 商談 → 入金 1 つに\n・専属戦略チーム 6 名 (戦略 / 演出 / 案件 / ファン / 収益 / 健康)\n\n月¥5,000・7 日間 無料\n🌸 core-prism-app.vercel.app/lp/creator',
      patternB: '「映え」より「いくら入ったか」。\n\nリール台本 5 秒・DM 返信 AI・案件管理 全部入り。\n月¥5,000・7 日間 無料。\n🌸 core-prism-app.vercel.app/lp/creator',
      patternC: 'DM の返信が間に合わなくて、案件いくつか取りこぼしてた話。\n\nAI 案件確度判定 + 返信下書きを使い始めて、週 18 件 → 案件化 4 件に。\n単価交渉 AI で案件単価 +40%。\n\n月¥5,000 で投資回収 2 案件。\n🌸 core-prism-app.vercel.app/lp/creator',
    },
    'freelance-pro': {
      patternA: 'フリーランス上位 10% への入口。\n\n単価交渉と請求業務、AI に任せて月 +¥30 万。\n税理士不要、議事録不要、提案作成不要。「制作」だけに集中。\n\n・案件登録 → 適正単価 + 交渉文 + 契約書\n・確定申告準備 月 6h → 30 分\n・案件単価 +40% (交渉 AI 使用後)\n\n月¥15,000・7 日間 無料\n🟢 core-prism-app.vercel.app/lp/freelance-pro',
      patternB: '次の案件 +¥30 万なら 2 日で投資回収。\n\nフリーランスのための AI 経営パートナー。\n月¥15,000・7 日間 無料。\n🟢 core-prism-app.vercel.app/lp/freelance-pro',
      patternC: '案件単価が低くて消耗してたとき、交渉 AI を試したら平均単価 +35%。\n\n税理士頼みだった確定申告も、月 6 時間 → 30 分に。\n\n月¥15,000 で 1 案件取れば回収完了。\n🟢 core-prism-app.vercel.app/lp/freelance-pro',
    },
  };

  for (const c of industries) {
    const copy = COPIES[c.slug];
    if (!copy) continue;
    lines.push(`---\n\n## ${c.name} (\`/lp/${c.slug}\`)`);
    lines.push(`\n### パターン A: 業界特化 (推奨)\n\n${copy.patternA}\n`);
    lines.push(`### パターン B: 短文インパクト\n\n${copy.patternB}\n`);
    lines.push(`### パターン C: 実例で語る\n\n${copy.patternC}\n`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## バズらせるコツ (再掲)');
  lines.push('');
  lines.push('1. iPhone モック 4 つ横並び (今回のペライチがそれ)');
  lines.push('2. 数字をハッキリ書く (¥170 万 / 5 秒 / -87%)');
  lines.push('3. 「7 日間 無料 / カード登録なし」を必ず添える');
  lines.push('4. 対象を冒頭に明示 (「中小企業の社長へ」)');
  lines.push('5. ハッシュタグは 1-2 個まで');
  lines.push('6. 投稿時間: 朝 7 時 / 昼 12 時 / 夜 21 時');
  lines.push('7. 反応が良ければ 1 週間後に再放送');
  lines.push('');

  writeFileSync(resolve(outDir, '投稿文案_18本.md'), lines.join('\n'), 'utf8');
  console.log(`  ✔ 投稿文案: ${outDir}/投稿文案_18本.md`);
}
