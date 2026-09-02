#!/usr/bin/env node
// ============================================================
// CORE Studio — OG画像 (1200x630) v4  / 2026-09-01
//
//   node scripts/generateStudioOgV4.mjs
//     → public/og-studio-v4.png       … /studio      (ロゴを大きく1枚)
//     → public/og-studio-film-v4.png  … /studio/film (ロゴ + 見出し)
//
// v3 は白地に小さめのロゴ + 価格バッジだった。SNSのタイムラインでは白い板に見えて、
// 誰の投稿か一目で分からない。v4 は「CORE Studio のロゴを大きく出す」ことを主にして、
// CORE 本体のカード (黒地) と同じ家族に見えるよう黒基調へ寄せた。
//
// ★カードに価格を焼き込まない。v3 には「初回1本 20秒 ¥49,800」等が入っていて、
//   値段を変えるたびに画像も作り直さないとSNSにだけ古い金額が残る（画像の中の字は
//   どの検査も読めない）。金額は og:description（文字）側だけで言う。
//
// 作り方: scripts/og/*.html を Chrome に2倍の解像度で撮らせ、sharp で半分に縮める。
// Chrome を使うので Mac 上でのみ動く（グラデーション・ぼかし・粒子を素直に書けるため、
// sharp の SVG 描画より絵を作りやすい）。
//
// ★差し替える時は必ず版番号を上げること (v4 → v5)。ファイル名が同じままだと
//   X / Facebook / LINE は前の絵を出し続ける。参照側は studio.html /
//   studio-film.html / src/studio/StudioSite.tsx の3か所。
// ============================================================
import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const CARDS = [
  { src: 'studio-og.html', out: 'og-studio-v4.png' },
  { src: 'studio-film-og.html', out: 'og-studio-film-v5.png' },
];

if (!existsSync(CHROME)) {
  console.error('Google Chrome が見つからない:', CHROME);
  process.exit(1);
}

const TMP = path.join(ROOT, '.og-studio-2x.png');

for (const card of CARDS) {
  const src = path.join(__dirname, 'og', card.src);
  const out = path.join(PUBLIC, card.out);
  if (!existsSync(src)) { console.error('元のHTMLが無い:', src); process.exit(1); }

  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--allow-file-access-from-files',   // ロゴ(public/core-studio-logo-white.png)を読ませる
    '--force-device-scale-factor=2',
    '--window-size=1200,630',
    '--virtual-time-budget=8000',       // Google Fonts (Inter / Noto Serif JP) を待つ
    `--screenshot=${TMP}`,
    `file://${src}`,
  ], { stdio: 'ignore' });

  if (!existsSync(TMP)) { console.error('スクリーンショットが作られなかった:', card.src); process.exit(1); }

  await sharp(TMP).resize(1200, 630, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(out);
  unlinkSync(TMP);

  const meta = await sharp(out).metadata();
  console.log(`作成: public/${card.out}  ${meta.width}x${meta.height}`);
}
