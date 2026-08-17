// ============================================================
// scripts/verifyIrisOpenCalls.mjs
//
// 「本物の公開募集」(src/iris/realOpenCalls.ts) の応募先が
// 今も本当に開けるかを確かめ直す。
//
//   node scripts/verifyIrisOpenCalls.mjs
//
// なぜ「ステータスコードだけ」では駄目か (2026-08-18 に実測):
//   www.dot-st.com/cp/st_ambassador は **HTTP 200 を返しながら**、
//   中身は「and ST メンテナンスに伴うサイト一時停止のお知らせ」だった。
//   200 だけを見る確認は、これを「生きている」と数えてしまう。
//   www.brandcosme.com は Cloudflare の Error 1000 (DNS points to prohibited IP)
//   でサイトごと落ちていた。
//   → 必ず本文も読む。読んだ上で「応募ページとして開けるか」を決める。
//
// 終了コード: 全部開ければ 0 / 1件でも開けなければ 1
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src', 'iris', 'realOpenCalls.ts');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 「開いても応募できない」と分かる印。
// 探すのは **タイトルと本文の書き出しだけ**（先頭 500 文字）。
// ページ全体を探すと誤検知する: モニプラのトップは生きているのに、
// お知らせ一覧の中に「2026/07/17 メンテナンス実施のお知らせ」という
// 過去の記事見出しがあり、全文検索だと「サイトが止まっている」と誤判定した
// (2026-08-18 実測)。ページ *が* 告知なのか、告知を *載せている* だけなのかは
// 書き出しに出るかどうかで分かれる。
const DEAD_MARKERS = [
  { re: /メンテナンス|一時停止|サイトを停止/, why: 'ページ自体がメンテナンス告知' },
  { re: /DNS points to prohibited IP|Error\s*1000/i, why: 'Cloudflare Error 1000 (サイトが落ちている)' },
  { re: /404\s*not\s*found|ページが見つかりません|お探しのページは見つかり/i, why: 'ページが無い' },
  { re: /募集は終了|受付を終了|募集を終了/, why: '募集が終了している' },
];
/** 印を探す範囲 (先頭からの文字数) */
const HEAD_CHARS = 500;

/** realOpenCalls.ts から id と applyUrl を取り出す (ビルド不要) */
function readOpenCalls() {
  const src = readFileSync(SRC, 'utf8');
  const out = [];
  const re = /id:\s*'([^']+)'[\s\S]*?applyUrl:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) out.push({ id: m[1], url: m[2] });
  return out;
}

/** HTML からタグを落として、判定に使う地の文にする */
function plainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function check(url) {
  let res;
  let html = '';
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept-Language': 'ja-JP,ja;q=0.9', Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
      signal: AbortSignal.timeout(30000),
    });
    html = await res.text();
  } catch (e) {
    return { ok: false, status: 0, why: `つながらない (${String(e.message).slice(0, 60)})` };
  }
  const text = plainText(html);
  const title = plainText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  // 判定はタイトル + 書き出しだけ (ページ全体を見ると過去のお知らせ見出しで誤検知する)
  const head = `${title} ${text.slice(0, HEAD_CHARS)}`;
  const dead = DEAD_MARKERS.find(d => d.re.test(head));
  if (dead) return { ok: false, status: res.status, why: dead.why };
  if (res.status >= 400) return { ok: false, status: res.status, why: `HTTP ${res.status}` };
  if (text.length < 40) return { ok: false, status: res.status, why: '本文がほぼ空' };
  return { ok: true, status: res.status, why: '' };
}

const calls = readOpenCalls();
if (!calls.length) {
  console.error('realOpenCalls.ts から応募先 URL を1件も読めませんでした');
  process.exit(1);
}

const results = [];
for (const c of calls) {
  const r = await check(c.url);
  results.push({ ...c, ...r });
  console.log(`${r.ok ? 'OK ' : 'NG '} ${String(r.status).padEnd(4)} ${c.id.padEnd(14)} ${c.url}${r.why ? '  << ' + r.why : ''}`);
}

const ng = results.filter(r => !r.ok);
console.log(`\n${results.length} 件中 ${results.length - ng.length} 件が今も開けました。`);
if (ng.length) {
  console.log('開けなかった募集 — 画面から外すか URL を直してください:');
  for (const r of ng) console.log(`  - ${r.id}: ${r.url} (${r.why})`);
  console.log('直したら src/iris/realOpenCalls.ts の verifiedAt も今日の日付に更新してください。');
  process.exit(1);
}
console.log('src/iris/realOpenCalls.ts の verifiedAt を今日の日付に更新してください。');
