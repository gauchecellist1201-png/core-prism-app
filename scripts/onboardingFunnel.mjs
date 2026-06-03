#!/usr/bin/env node
/**
 * onboardingFunnel.mjs — 直近 N 日のオンボーディング funnel をターミナルに表示
 *
 * デフォルト 14 日分。
 *
 * 使い方:
 *   node scripts/onboardingFunnel.mjs              # 本番 (default)
 *   node scripts/onboardingFunnel.mjs --days 30
 *   API_BASE=http://localhost:3000 node scripts/onboardingFunnel.mjs   # ローカル開発
 */

const args = process.argv.slice(2);
const argIdx = args.indexOf('--days');
const days = argIdx >= 0 ? Math.max(1, Math.min(60, Number(args[argIdx + 1]) || 14)) : 14;

const API_BASE = process.env.API_BASE || 'https://core-prism-app.vercel.app';
const url = `${API_BASE}/api/track/onboarding-step?days=${days}`;

const COLORS = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', cyan: '\x1b[36m', magenta: '\x1b[35m' };

function dropRateColor(r) {
  if (r >= 70) return COLORS.red;
  if (r >= 40) return COLORS.yellow;
  return COLORS.green;
}

function bar(n, max, width = 24) {
  if (max <= 0) return '';
  const filled = Math.round((n / max) * width);
  return COLORS.cyan + '█'.repeat(filled) + COLORS.dim + '·'.repeat(width - filled) + COLORS.reset;
}

async function main() {
  console.log(`${COLORS.bold}CORE オンボーディング funnel — 直近 ${days} 日 / ${API_BASE}${COLORS.reset}\n`);

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    console.error(`${COLORS.red}fetch 失敗: ${e.message}${COLORS.reset}`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(`${COLORS.red}HTTP ${res.status} ${res.statusText}${COLORS.reset}`);
    process.exit(2);
  }
  const json = await res.json();
  if (!json.ok) {
    console.error(`${COLORS.red}API エラー: ${JSON.stringify(json)}${COLORS.reset}`);
    process.exit(2);
  }
  if (!json.configured) {
    console.log(`${COLORS.yellow}⚠  UPSTASH_REDIS_REST_URL/TOKEN が未設定です。${COLORS.reset}`);
    console.log(`   ${json.hint}`);
    console.log(`\nlocalStorage の funnel データを見たい場合は ブラウザのコンソールで:`);
    console.log(`   ${COLORS.cyan}localStorage.getItem('core_onboarding_funnel_v1')${COLORS.reset}\n`);
    process.exit(0);
  }

  const rows = json.days || [];
  if (rows.length === 0) { console.log('(データなし)'); return; }

  // ヘッダ
  console.log(`${COLORS.dim}DATE        | WELCOME │ NAME │ IND │ MOD │ DONE │ DROP%  │ 完了率${COLORS.reset}`);
  console.log(`${COLORS.dim}${'─'.repeat(74)}${COLORS.reset}`);

  let totalW = 0, totalC = 0;
  for (const r of rows) {
    const d = r.data || {};
    const w = d.welcome || 0;
    const c = d.completed || 0;
    totalW += w; totalC += c;
    const completionPct = w > 0 ? Math.round((c / w) * 100) : 0;
    const dropCol = dropRateColor(r.dropRate);
    console.log(
      `${r.date} | ${String(w).padStart(7)} │ ${String(d.name || 0).padStart(4)} │ ` +
      `${String(d.industry || 0).padStart(3)} │ ${String(d.model || 0).padStart(3)} │ ` +
      `${COLORS.bold}${String(c).padStart(4)}${COLORS.reset} │ ` +
      `${dropCol}${String(r.dropRate).padStart(5)}%${COLORS.reset} │ ` +
      `${bar(c, w)} ${completionPct}%`
    );
  }

  // 合計
  const avgDrop = totalW > 0 ? Math.round((1 - totalC / totalW) * 1000) / 10 : 0;
  console.log(`${COLORS.dim}${'─'.repeat(74)}${COLORS.reset}`);
  console.log(
    `${COLORS.bold}合計        | ${String(totalW).padStart(7)} │      │     │     │ ` +
    `${String(totalC).padStart(4)} │ ${dropRateColor(avgDrop)}${String(avgDrop).padStart(5)}%${COLORS.reset} │ ${bar(totalC, totalW)} ` +
    `${totalW > 0 ? Math.round((totalC / totalW) * 100) : 0}%`
  );

  // 簡易分析
  console.log('');
  if (avgDrop >= 70) {
    console.log(`${COLORS.red}⚠  離脱率 ${avgDrop}% は要警告。welcome → name の段差を見直し推奨。${COLORS.reset}`);
  } else if (avgDrop >= 40) {
    console.log(`${COLORS.yellow}⚠  離脱率 ${avgDrop}% はやや高。industry / model の説明文を磨くと改善余地あり。${COLORS.reset}`);
  } else {
    console.log(`${COLORS.green}✓  離脱率 ${avgDrop}% は良好。${COLORS.reset}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
