/* 静的HTML（クローラーと最初の一瞬が見る側）に書いた数字が、実際のデータとずれていないかを検査する。
 *
 *   node scripts/check-static-facts.mjs
 *
 * なぜ要るか（2026-09-08 実測）:
 *   このサイトは React で、`#root` の中に**静的な本文**を先に置いてある
 *   （JSを実行しないクローラーに title だけしか見せない、を避けるため）。
 *   ところが静的な側は手で書くので、React 側のデータを直しても**置いていかれる**。
 *   しかも画面は正しく見えるので、誰も気づけない。実際にこうなっていた:
 *
 *   ① 診断の所要時間 … 設問を23問→13問に圧縮（c479def）した時、React 側だけ
 *      「約2分」に直り、配信HTMLは「約3分」のまま。検索結果とAI回答は3分と言い、
 *      開くと2分。**10箇所**（title・meta・OGP・Twitter・JSON-LD・FAQ・本文）が古かった。
 *   ② 実績の件数 … 実績ページの title が「映像・ウェブ・システム 8件」。
 *      8件は**Webだけ**の数で、映像6件が抜けていた（実際は14件）。
 *      自社を実際より小さく見せていた。
 *
 * ★数字を静的HTMLに書くこと自体は避けられない（クローラーはJSを実行しない）。
 *   だから「書いてよい。ただしデータとずれたら赤くする」という形にする。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* ★.pathname を使わないこと。日本語を含むパスだと化ける。 */
const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');

let ng = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log('  ok   ' + name);
  else { ng++; console.log('  NG   ' + name + (extra ? '  ' + extra : '')); }
};

/* データ側の件数を、正本の配列そのものから数える */
const countIds = (src, name) => {
  const i = src.indexOf('export const ' + name);
  if (i < 0) return -1;
  const seg = src.slice(i, src.indexOf('\n];', i));
  return (seg.match(/\bid:\s*['"]/g) || []).length;
};
const webWorks = countIds(read('src/studio/plans.ts'), 'WORKS');
const filmWorks = countIds(read('src/studio/works.ts'), 'FILM_WORKS');
const totalWorks = webWorks + filmWorks;

console.log('\n[1] 実績の件数（データ: Web ' + webWorks + '件 + 映像 ' + filmWorks + '件 = ' + totalWorks + '件）');
ok('データ側を数えられた', webWorks > 0 && filmWorks > 0, `web=${webWorks} film=${filmWorks}`);
{
  const worksHtml = read('studio-works.html');
  const m = worksHtml.match(/映像・ウェブ・システム\s*(\d+)件/);
  ok('実績ページの見出しが合計と一致している', m && Number(m[1]) === totalWorks,
    m ? `HTML=${m[1]}件 / データ=${totalWorks}件` : '見出しが見つからない');
  ok('見出しは4か所とも同じ数（title・OGP・Twitter・JSON-LD）',
    (worksHtml.match(new RegExp('映像・ウェブ・システム ' + totalWorks + '件', 'g')) || []).length >= 4,
    '片方だけ直すと、共有カードだけ古い数字になる');

  const studioHtml = read('studio.html');
  const m2 = studioHtml.match(/(\d+)件の実績を見る/);
  ok('入口の「◯件の実績を見る」も合計と一致している', m2 && Number(m2[1]) === totalWorks,
    m2 ? `HTML=${m2[1]}件 / データ=${totalWorks}件` : 'リンクが見つからない');

  /* ★Web だけの数を出している所は、Web の数と合っていること（合計ではない） */
  const plansHtml = read('studio-plans.html');
  const m3 = plansHtml.match(/公開中の実績は(\d+)件/);
  ok('ウェブ制作の頁は「Webだけの数」と一致している', m3 && Number(m3[1]) === webWorks,
    m3 ? `HTML=${m3[1]}件 / Web=${webWorks}件` : '見つからない');
}

console.log('\n[2] 診断の所要時間（設問を減らしたら、静的HTMLも直す）');
{
  /* React 側が言っている時間を正本にする（画面がお客様の実体験） */
  const src = read('src/corporate/roai/RoaiScore.tsx');
  const m = src.match(/約(\d+)分・選択式/);
  ok('React 側の所要時間を読めた', Boolean(m), m ? m[0] : '見つからない');
  const minutes = m ? m[1] : null;
  if (minutes) {
    for (const f of ['roai-score.html', 'corp.html', 'return-on-ai.html']) {
      const h = read(f);
      const wrong = (h.match(/約(\d+)分/g) || []).filter((x) => x !== `約${minutes}分`);
      ok(`${f} の所要時間が画面と揃っている`, wrong.length === 0,
        `画面=約${minutes}分 / HTMLに残っている別の値: ${JSON.stringify([...new Set(wrong)])}`);
    }
    /* 画面側にも別の値が混ざっていないか（studio → 診断への橋・リンクの説明文） */
    const others = ['src/studio/NeriHandoff.tsx', 'src/lib/coreLinks.ts'];
    for (const f of others) {
      const h = read(f);
      const wrong = (h.match(/約(\d+)分/g) || []).filter((x) => x !== `約${minutes}分`);
      ok(`${f} の所要時間が揃っている`, wrong.length === 0, JSON.stringify([...new Set(wrong)]));
    }
  }
}

console.log('\n[3] 生成のもと（正本）も揃っている');
{
  /* ★2026-09-08 に踏んだ罠: roai-score.html / return-on-ai.html / studio-works.html は
     scripts/genRoutePages.mjs が**ビルドのたびに作り直す写し**。写しだけを直しても
     次のビルドで元に戻る。しかも写しを見る検査は、直した直後だけ緑になって通ってしまう。
     だから「もと」の側も必ず見る。 */
  const gen = read('scripts/genRoutePages.mjs');
  const src = read('src/corporate/roai/RoaiScore.tsx');
  const m = src.match(/約(\d+)分・選択式/);
  const minutes = m ? m[1] : null;
  if (minutes) {
    const wrong = (gen.match(/約(\d+)分/g) || []).filter((x) => x !== `約${minutes}分`);
    ok('生成スクリプトの所要時間が画面と揃っている', wrong.length === 0,
      `画面=約${minutes}分 / もとに残っている別の値: ${JSON.stringify([...new Set(wrong)])}`);
  }
  const mw = gen.match(/映像・ウェブ・システム\s*(\d+)件/);
  ok('生成スクリプトの実績件数が合計と一致している', mw && Number(mw[1]) === totalWorks,
    mw ? `もと=${mw[1]}件 / データ=${totalWorks}件` : '見出しが見つからない');
}

console.log('\n[4] 逆テスト');
{
  const worksHtml = read('studio-works.html');
  const broken = worksHtml.replace(/映像・ウェブ・システム \d+件/, '映像・ウェブ・システム 999件');
  const m = broken.match(/映像・ウェブ・システム\s*(\d+)件/);
  ok('★件数を1つ変えた写しは、一致しないと判定される', m && Number(m[1]) !== totalWorks);

  const h = read('roai-score.html').replace(/約2分/, '約9分');
  const wrong = (h.match(/約(\d+)分/g) || []).filter((x) => x !== '約2分');
  ok('★所要時間を1つ変えた写しは、ずれとして見つかる', wrong.length > 0, JSON.stringify(wrong));

  /* ★いちばん大事な逆テスト: 「写しだけ直して、もとを直し忘れた」を見つけられるか */
  const gen = read('scripts/genRoutePages.mjs').replace(/約2分/, '約3分');
  const genWrong = (gen.match(/約(\d+)分/g) || []).filter((x) => x !== '約2分');
  ok('★もと(genRoutePages.mjs)だけ古い写しは、ずれとして見つかる', genWrong.length > 0,
    '写しだけ見る検査だと、ここが素通りしてビルドで元に戻る');
}

console.log('');
if (ng) { console.log(`NG  ${ng}件。クローラーが見る側の数字が、実際とずれています`); process.exit(1); }
console.log('OK  静的HTMLの数字は、実際のデータと揃っています');
