#!/usr/bin/env node
/**
 * checkTrademark.mjs — 商標衝突リスク 自動チェック支援スクリプト
 *
 * J-PlatPat は SPA でクエリパラメータ経由の直接検索 URL を持たないため、
 * このスクリプトは「検索エントリ URL を一括で開く + チェックリストを出力」する
 * オーナー支援ツールです。
 *
 * 使い方:
 *   node scripts/checkTrademark.mjs            # macOS で全 URL を一括で Safari/デフォルトブラウザに開く
 *   node scripts/checkTrademark.mjs --print    # URL を表示するだけ (ブラウザを開かない)
 *
 * チェック対象キーワード:
 *   - CORE Prism   (英字)
 *   - CORE Iris    (英字)
 *   - コアプリズム  (カナ)
 *   - コアアイリス  (カナ)
 *
 * 重点区分:
 *   第 9 類  — 電子計算機用プログラム (DL 型ソフト)
 *   第 42 類 — ダウンロードしないで使うコンピュータソフトウェアの提供 (SaaS)
 *   第 35 類 — 経営の診断・指導 (CORE Prism は経営支援を含むため念のため)
 *   第 41 類 — オンラインでの教育情報の提供 (Iris のコミュニティ機能のため)
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const execAsync = promisify(exec);

const KEYWORDS = [
  { display: 'CORE Prism',   query: 'CORE+Prism',   note: '主力プロダクト名 (英字)' },
  { display: 'CORE Iris',    query: 'CORE+Iris',    note: 'クリエイター向けプロダクト名 (英字)' },
  { display: 'コアプリズム', query: 'コアプリズム', note: 'CORE Prism のカナ読み' },
  { display: 'コアアイリス', query: 'コアアイリス', note: 'CORE Iris のカナ読み' },
];

// 検索エントリ点 (J-PlatPat の商標検索 / patent-i.com の検索)
const buildSearchUrls = (kw) => ({
  jPlatPat:    `https://www.j-platpat.inpit.go.jp/t0000`, // SPA: トップに飛んで「商標」タブから検索
  patentI:     `https://patent-i.com/?s=${encodeURIComponent(kw.display)}`,
  toreruWeb:   `https://search.toreru.jp/?q=${encodeURIComponent(kw.display)}`,
  google:      `https://www.google.com/search?q=${encodeURIComponent(`"${kw.display}" 商標 第9類 第42類 site:j-platpat.inpit.go.jp OR site:patent-i.com OR site:ipforce.jp`)}`,
});

const args = process.argv.slice(2);
const PRINT_ONLY = args.includes('--print');

const log = (...a) => console.log(...a);
const header = (t) => log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

async function openUrl(url) {
  if (PRINT_ONLY) { log('  →', url); return; }
  try {
    await execAsync(`open "${url}"`);
  } catch (e) {
    log('  ! 開けませんでした:', url);
  }
}

async function main() {
  header('CORE 商標調査 — 自動オープンスクリプト');
  log(`対象キーワード: ${KEYWORDS.length} 件`);
  log(`重点区分: 第 9 類 / 第 42 類 / 第 35 類 / 第 41 類`);
  log(PRINT_ONLY ? '\n[--print モード] URL のみ表示します' : '\n[既定] Safari/ブラウザに順次 URL を開きます');

  const reportLines = [];
  reportLines.push('# 商標調査 チェックリスト (自動生成)');
  reportLines.push(`\n生成日時: ${new Date().toISOString()}`);
  reportLines.push('\n## チェック対象');
  reportLines.push('| キーワード | 用途 |');
  reportLines.push('|---|---|');
  for (const kw of KEYWORDS) reportLines.push(`| ${kw.display} | ${kw.note} |`);

  reportLines.push('\n## 重点区分');
  reportLines.push('- **第 9 類**  電子計算機用プログラム (DL 型ソフト)');
  reportLines.push('- **第 42 類** ダウンロードしないで使うコンピュータソフトウェアの提供 (SaaS)');
  reportLines.push('- **第 35 類** 経営の診断・指導');
  reportLines.push('- **第 41 類** オンラインでの教育情報の提供');

  reportLines.push('\n## 検索 URL 一覧');

  for (const kw of KEYWORDS) {
    header(`▼ ${kw.display}  (${kw.note})`);
    const urls = buildSearchUrls(kw);
    reportLines.push(`\n### ${kw.display}`);
    reportLines.push(`- J-PlatPat (商標検索トップ): ${urls.jPlatPat}`);
    reportLines.push(`  - 開いたら検索枠に **${kw.display}** を入力 → 区分で 09/42/35/41 を指定`);
    reportLines.push(`- patent-i.com: ${urls.patentI}`);
    reportLines.push(`- Toreru 商標検索: ${urls.toreruWeb}`);
    reportLines.push(`- Google 絞り込み: ${urls.google}`);

    log('\nJ-PlatPat (検索枠に貼付):');
    await openUrl(urls.jPlatPat);
    log('patent-i.com:');
    await openUrl(urls.patentI);
    log('Toreru:');
    await openUrl(urls.toreruWeb);
    log('Google 絞り込み:');
    await openUrl(urls.google);
  }

  reportLines.push('\n## 確認手順 (J-PlatPat)');
  reportLines.push('1. https://www.j-platpat.inpit.go.jp/t0000 を開く');
  reportLines.push('2. 「商標」タブ → 検索枠にキーワード入力');
  reportLines.push('3. 「類」欄で 09 / 42 / 35 / 41 を選択');
  reportLines.push('4. 検索 → ヒット件数を確認');
  reportLines.push('5. 同一/類似が出たら登録番号と権利者を控える');

  reportLines.push('\n## 判定基準');
  reportLines.push('- **緑** (登録可能性高): 同一/類似なし');
  reportLines.push('- **黄** (要弁理士相談): 部分一致あり / 類似群コード重複');
  reportLines.push('- **赤** (即変更検討): 完全同一あり / 著名商標と紛らわしい');

  reportLines.push('\n## オーナー Action');
  reportLines.push('- [ ] 4 キーワード × 4 区分 = 16 検索を実施');
  reportLines.push('- [ ] ヒット 0 件であれば 弁理士へ商標出願見積を依頼 (Toreru / Cotobox 推奨)');
  reportLines.push('- [ ] 緊急度高 (赤判定) があれば命名再考');

  const outDir = join(homedir(), 'Desktop', '商標調査');
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, `${new Date().toISOString().slice(0, 10)}_商標調査_自動チェックリスト.md`);
  await writeFile(outFile, reportLines.join('\n'), 'utf-8');

  header('完了');
  log(`チェックリストを保存しました: ${outFile}`);
  log('\n手動の判定が必要な箇所は J-PlatPat の画面で行ってください。');
}

main().catch(e => { console.error(e); process.exit(1); });
