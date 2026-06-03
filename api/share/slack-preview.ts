// ============================================================
// /api/share/slack-preview — Slack 向け リッチ プレビュー JSON
//
// オーナー指示 (2026-06-04 第 27 波 SSSS):
//   オーナーが LP を Slack でシェアしたい時、Slack Block Kit 形式の
//   JSON を返す。Slack の "Send via Webhook" / "Custom integrations" で
//   そのままペーストして使える形に。
//
// 使い方:
//   GET /api/share/slack-preview?url=https://core-prism-app.vercel.app/lp/sme
//     → { text, blocks } (fallback text + Block Kit)
//
//   POST { url } 同じ
//
//   GET ?url=...&copy=1 → text/plain で JSON 文字列を返す (コピペ用)
//
// 機能:
//   - URL から /lp/<slug> / /iris / / を判定 → タイトル / 説明 / og:image を
//     INDUSTRIES 設定から組み立て
//   - Slack の "Send to Slack" Webhook URL 形式に整形 (header / section /
//     image / divider / context / actions)
//   - ?slack=<workspace>.slack.com も任意で「投稿先」ボタンに反映
// ============================================================

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}

// 業種別 / Iris / Prism の 規定値 (industries.ts と同期)
const PROFILES: Record<string, { title: string; desc: string; emoji: string; og: string }> = {
  '/': {
    title: 'CORE Prism — AI 役員 14 名 で 会社が動く',
    desc: '判断 / 営業 / 財務 / マーケ / コンテンツ ── 全部 AI に任せる SaaS。7 日 無料。',
    emoji: '🌈',
    og: '/og-prism-v3.png',
  },
  '/pricing': {
    title: 'CORE Prism / Iris 料金',
    desc: 'BtoC ¥3,000 〜 / BtoB ¥20,000 〜 / Enterprise (応相談)。7 日無料体験。',
    emoji: '💴',
    og: '/og-core-v2.png',
  },
  '/iris': {
    title: 'CORE Iris — クリエイター 専用 AI マネージャー',
    desc: 'インスタ × 案件 × 創作 を 6 つの AI で。1 タップで「全部」 が回る。',
    emoji: '✨',
    og: '/og-iris-v3.png',
  },
  '/lp/sme': {
    title: 'CORE Prism — 中小企業 向け AI 役員 14 名',
    desc: '事務時間 月 28h → 6h。判断 / 提案 / 数字 を AI に丸投げ。',
    emoji: '💼',
    og: '/og/industry-sme.png',
  },
  '/lp/realestate-finance': {
    title: 'CORE Prism — 不動産 / 金融 営業 向け',
    desc: '物件分析 + 顧客対応 を AI に。提案速度 3 倍。',
    emoji: '🏠',
    og: '/og/industry-realestate-finance.png',
  },
  '/lp/consulting': {
    title: 'CORE Prism — コンサル 向け',
    desc: '提案書 + リサーチ を 5 分で。提案準備 8h → 30 分。',
    emoji: '🧠',
    og: '/og/industry-consulting.png',
  },
  '/lp/solo': {
    title: 'CORE Prism — 個人事業主 向け',
    desc: '事務・営業・経理 ぜんぶ AI に任せる。本業時間 +20h/週。',
    emoji: '👤',
    og: '/og/industry-solo.png',
  },
  '/lp/creator': {
    title: 'CORE Iris — クリエイター 向け',
    desc: '案件 + 投稿 + 交渉 が 1 画面。案件単価 +35%。',
    emoji: '🎨',
    og: '/og/industry-creator.png',
  },
  '/lp/freelance-pro': {
    title: 'CORE Prism — 高単価フリーランス 向け',
    desc: 'AI が右腕。単価 +50%。',
    emoji: '⚡',
    og: '/og/industry-freelance-pro.png',
  },
};

function pathFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    let p = u.pathname;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p || '/';
  } catch {
    // 相対パス指定
    if (rawUrl.startsWith('/')) return rawUrl;
    return '/';
  }
}

function absolute(u: string, origin: string): string {
  if (/^https?:\/\//.test(u)) return u;
  return `${origin}${u.startsWith('/') ? '' : '/'}${u}`;
}

function buildBlocks(rawUrl: string, profile: typeof PROFILES[string], origin: string) {
  const og = absolute(profile.og, origin);
  return {
    text: `${profile.emoji} ${profile.title} — ${profile.desc}\n${rawUrl}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${profile.emoji} ${profile.title}`, emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${profile.desc}*` },
      },
      {
        type: 'image',
        image_url: og,
        alt_text: profile.title,
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `:link: <${rawUrl}|${rawUrl}>` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✨ いま試す', emoji: true },
            url: rawUrl,
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '💴 料金を見る', emoji: true },
            url: `${origin}/pricing`,
          },
        ],
      },
    ],
  };
}

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

  let rawUrl = '';
  let copyMode = false;
  if (req.method === 'GET') {
    const u = new URL(req.url);
    rawUrl = (u.searchParams.get('url') || '').trim();
    copyMode = u.searchParams.get('copy') === '1';
  } else if (req.method === 'POST') {
    try {
      const body = await req.json() as { url?: string };
      rawUrl = String(body.url || '').trim();
    } catch { /* */ }
  } else {
    return json({ error: 'method_not_allowed' }, 405, ch);
  }

  if (!rawUrl) return json({ error: 'url required' }, 400, ch);

  // 安全性: コア ドメインのみ許可 (任意外部 URL は弾く)
  let path: string;
  let originForOg = 'https://core-prism-app.vercel.app';
  try {
    const u = new URL(rawUrl);
    if (!/(^|\.)core-prism-app\.vercel\.app$|^localhost(:|$)/.test(u.host)) {
      return json({ error: 'url must be on core-prism-app.vercel.app' }, 400, ch);
    }
    originForOg = `${u.protocol}//${u.host}`;
    path = pathFromUrl(rawUrl);
  } catch {
    return json({ error: 'invalid url' }, 400, ch);
  }

  const profile = PROFILES[path] || PROFILES['/'];
  const payload = buildBlocks(rawUrl, profile, originForOg);

  if (copyMode) {
    // コピペ用 — text/plain で 整形済 JSON を返す (Slack の "Send via Webhook" にそのまま貼れる)
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...ch },
    });
  }

  return json(payload, 200, ch);
}
