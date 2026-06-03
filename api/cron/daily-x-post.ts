// ============================================================
// /api/cron/daily-x-post — 毎朝 X (旧 Twitter) に投稿
//
// オーナー指示 (2026-06-03 自律): CC. X 自動投稿スクリプト
//
// 仕様:
//   - 18 本の投稿文案 (6 業界 × 3 パターン) からローテーション
//   - 各業界のペライチ PNG を添付 (public/og/<slug>.png)
//   - X API v2 + Media v1.1 (OAuth 1.0a User Context)
//
// Vercel Cron (vercel.json):
//   "crons": [{ "path": "/api/cron/daily-x-post", "schedule": "0 22 * * *" }]
//   ※ UTC 22:00 = JST 朝 7:00
//
// 必要な env (Vercel Production):
//   X_CONSUMER_KEY       (= API Key)
//   X_CONSUMER_SECRET    (= API Key Secret)
//   X_ACCESS_TOKEN       (= User Access Token)
//   X_ACCESS_SECRET      (= User Access Token Secret)
//   CRON_SECRET (任意)
//
// 注意:
//   X API は無料枠で投稿 1日 50 件まで。1 日 1 件なら十分。
//   Media Upload は v1.1 endpoint 必須 (v2 では media upload まだベータ)。
//   OAuth 1.0a 署名が必要なので、HMAC-SHA1 を手書きで作る (Edge runtime 制約)。
// ============================================================
import { INDUSTRIES } from '../../src/lp/industries';

export const config = { runtime: 'edge' };

interface PostPlan { industry: string; pattern: 'A' | 'B' | 'C'; text: string; ogImage: string; }

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;
  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) {
    return jsonRes(503, { ok: false, error: 'X_* 環境変数が未設定' });
  }

  // ── 18 本ローテーション (曜日 + 時刻でずらす) ──
  const plans = buildAllPlans();
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getUTCFullYear(), 0, 0).getTime()) / 86_400_000);
  const planIdx = dayOfYear % plans.length;
  const plan = plans[planIdx];

  try {
    // 1) 画像をダウンロード → base64 化
    const imageRes = await fetch(plan.ogImage);
    if (!imageRes.ok) throw new Error(`画像取得失敗: ${imageRes.status}`);
    const imageBuf = await imageRes.arrayBuffer();
    const imageB64 = arrayBufferToBase64(imageBuf);

    // 2) Media Upload (v1.1)
    const mediaId = await uploadMedia({
      consumerKey, consumerSecret, accessToken, accessSecret,
      imageB64,
    });

    // 3) Tweet 作成 (v2)
    const tweetId = await postTweet({
      consumerKey, consumerSecret, accessToken, accessSecret,
      text: plan.text,
      mediaId,
    });

    return jsonRes(200, {
      ok: true, planIdx, industry: plan.industry, pattern: plan.pattern,
      tweetId, mediaId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonRes(500, { ok: false, error: msg, plan: { industry: plan.industry, pattern: plan.pattern } });
  }
}

// ── 投稿プラン生成 ──────────────────────────────
function buildAllPlans(): PostPlan[] {
  const ICONS: Record<string, string> = {
    'sme': '🟡', 'realestate-finance': '🟢', 'consulting': '🟣',
    'solo': '🟡', 'creator': '🌸', 'freelance-pro': '🟢',
  };
  const COPIES: Record<string, Record<'A' | 'B' | 'C', string>> = {
    'sme': {
      A: '中小企業の社長へ。\n\nコンサル代 月¥200 万を、月¥30,000 に圧縮できる時代になりました。\n\n・AI 役員 13 名がいつでも経営判断を支える\n・提案資料 / 営業文 / 月次 P/L 全部 AI 下書き\n・事務時間 ▲ 87% (オーナー実体験)\n\n7 日間 無料・カード登録なし',
      B: 'ひとりで全部抱えてる中小企業の社長へ。\n\nAI 役員 13 名 をいつでも雇える時代。\n月¥30,000、コンサルの 1/7。\n7 日間 無料、カード登録なし。',
      C: '創業 3 年、ひとりで全部やってきて月 30 時間が事務に消えてました。\n\nAI に肩代わりさせるアプリ作ったら 8 時間に。\n\n同じ悩みの中小社長さんに共有します。\nコンサル代より安い、月¥30,000。',
    },
    'realestate-finance': {
      A: '不動産・金融営業の方へ 💼\n\n顧客資料を入れた瞬間に、潜在ニーズ・法的リスク・反論想定・クロージング文まで全部出る AI 営業パートナー。\n\n・提案準備 8h → 30 分\n・成約率 12% → 28% (新人での見込み)\n・契約 1 件で 12 ヶ月分回収\n\n月¥30,000・7 日間 無料',
      B: '契約 1 件で年間コスト回収。\n\nAI 営業パートナーが提案準備を 8h → 30 分に。\n\n月¥30,000、7 日間 無料。',
      C: '新人の成約率が 12% → 28% に上がった、不動産営業の話。\n\n何が変わったか:「反論対応 20 パターン」をその場で見られるようになった。新人でもプロの提案が出せる。\n\n月¥30,000。',
    },
    'consulting': {
      A: 'コンサル・士業の方へ。\n\n分析 → 提案 → 報告書 を AI が下書き。\nあなたは判断と署名だけ。\n\n・報告書作成 8h → 1.5h (▲ 81%)\n・1 人あたり同時案件 5 → 12\n・ジュニアのレビュー時間 ▲ 70%\n\n月¥50,000・1 案件¥4,200・7 日間 無料',
      B: '案件数 2.4 倍。\n品質はそのままに。\n\nコンサル・士業の方の右腕 AI。\n月¥50,000、7 日間 無料。',
      C: 'クライアントが急に増えて、1 人で 5 案件回すのが限界だった。\n\nAI 導入後、同じ品質で 12 案件回せるようになった。\n月次レポート作成が 8 時間 → 1.5 時間に。\n\n同業の方に共有します。',
    },
    'solo': {
      A: '一人経営 3 年、いちばん時間を吸われてたのが「数字確認・請求書発行・タスク整理」の事務系で月 30 時間。\n\nAI に肩代わりさせるアプリ作ったら 8 時間に減りました。\n\n同じ悩みの方に共有します。月 ¥5,000・7 日無料。',
      B: 'ひとり社長の右腕、月 ¥5,000。\n\n事務 / 営業 / 経理 ぜんぶ AI に。\n月 22h が本業に戻る。\n\n7 日間 無料・カード登録なし',
      C: '月¥5,000 で「事務専属社員 + AI 役員 13 名」を雇える時代。\n\n・経営の数字、Stripe つなぐだけで自動集計\n・朝のブリーフ → 提案タップで AI がその場で実行\n・営業文 / 請求書 全部 1 タップで下書き\n\n7 日間 無料',
    },
    'creator': {
      A: 'SNS クリエイターのための「6 人の AI チーム」作りました 💼\n\n・リール台本: テーマ 1 行で 5 秒で完成\n・DM 返信: AI 下書き → 承認するだけ\n・案件管理: DM → 商談 → 入金 1 つに\n・専属戦略チーム 6 名\n\n月¥5,000・7 日間 無料',
      B: '「映え」より「いくら入ったか」。\n\nリール台本 5 秒・DM 返信 AI・案件管理 全部入り。\n月¥5,000・7 日間 無料。',
      C: 'DM の返信が間に合わなくて、案件いくつか取りこぼしてた話。\n\nAI 案件確度判定 + 返信下書きを使い始めて、週 18 件 → 案件化 4 件に。\n単価交渉 AI で案件単価 +40%。\n\n月¥5,000 で投資回収 2 案件。',
    },
    'freelance-pro': {
      A: 'フリーランス上位 10% への入口。\n\n単価交渉と請求業務、AI に任せて月 +¥30 万。\n税理士不要、議事録不要、提案作成不要。「制作」だけに集中。\n\n・案件登録 → 適正単価 + 交渉文 + 契約書\n・確定申告準備 月 6h → 30 分\n\n月¥15,000・7 日間 無料',
      B: '次の案件 +¥30 万なら 2 日で投資回収。\n\nフリーランスのための AI 経営パートナー。\n月¥15,000・7 日間 無料。',
      C: '案件単価が低くて消耗してたとき、交渉 AI を試したら平均単価 +35%。\n\n税理士頼みだった確定申告も、月 6 時間 → 30 分に。\n\n月¥15,000 で 1 案件取れば回収完了。',
    },
  };

  const plans: PostPlan[] = [];
  for (const slug of Object.keys(INDUSTRIES)) {
    const c = COPIES[slug];
    if (!c) continue;
    const icon = ICONS[slug] || '✦';
    const url = `https://core-prism-app.vercel.app/lp/${slug}`;
    for (const pat of ['A', 'B', 'C'] as const) {
      const text = `${c[pat]}\n\n${icon} ${url}`;
      plans.push({
        industry: slug,
        pattern: pat,
        text: text.slice(0, 280), // X 文字数上限 (一応)
        ogImage: `https://core-prism-app.vercel.app/og/${slug}.png`,
      });
    }
  }
  return plans;
}

// ── X API: Media Upload (v1.1) ────────────────
async function uploadMedia(opts: {
  consumerKey: string; consumerSecret: string;
  accessToken: string; accessSecret: string;
  imageB64: string;
}): Promise<string> {
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  // form-urlencoded で media_data を送信 (multipart より OAuth 署名が楽)
  const body = `media_data=${encodeURIComponent(opts.imageB64)}`;
  const oauthHeader = await buildOAuthHeader({
    method: 'POST', url,
    consumerKey: opts.consumerKey, consumerSecret: opts.consumerSecret,
    accessToken: opts.accessToken, accessSecret: opts.accessSecret,
    bodyParams: { media_data: opts.imageB64 },
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': oauthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Media upload ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json() as { media_id_string?: string };
  if (!data.media_id_string) throw new Error('Media upload: media_id_string なし');
  return data.media_id_string;
}

// ── X API: Tweet (v2) ─────────────────────────
async function postTweet(opts: {
  consumerKey: string; consumerSecret: string;
  accessToken: string; accessSecret: string;
  text: string; mediaId: string;
}): Promise<string> {
  const url = 'https://api.twitter.com/2/tweets';
  const oauthHeader = await buildOAuthHeader({
    method: 'POST', url,
    consumerKey: opts.consumerKey, consumerSecret: opts.consumerSecret,
    accessToken: opts.accessToken, accessSecret: opts.accessSecret,
    bodyParams: {}, // v2 は JSON body なので OAuth 署名対象は空
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': oauthHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: opts.text,
      media: { media_ids: [opts.mediaId] },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tweet ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json() as { data?: { id?: string } };
  if (!data.data?.id) throw new Error('Tweet: id なし');
  return data.data.id;
}

// ── OAuth 1.0a 署名生成 ──────────────────────
async function buildOAuthHeader(opts: {
  method: string; url: string;
  consumerKey: string; consumerSecret: string;
  accessToken: string; accessSecret: string;
  bodyParams: Record<string, string>;
}): Promise<string> {
  const nonce = randomNonce(32);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: opts.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: opts.accessToken,
    oauth_version: '1.0',
  };
  // 署名パラメータ = oauth_* + URL クエリ + フォームボディ
  const allParams: Record<string, string> = { ...oauthParams, ...opts.bodyParams };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map(k => `${rfc3986(k)}=${rfc3986(allParams[k])}`)
    .join('&');
  const baseString = [
    opts.method.toUpperCase(),
    rfc3986(opts.url),
    rfc3986(paramString),
  ].join('&');
  const signingKey = `${rfc3986(opts.consumerSecret)}&${rfc3986(opts.accessSecret)}`;
  const signature = await hmacSha1Base64(signingKey, baseString);
  oauthParams.oauth_signature = signature;
  const header = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${rfc3986(k)}="${rfc3986(oauthParams[k])}"`)
    .join(', ');
  return header;
}

function rfc3986(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function randomNonce(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, len);
}

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const keyBuf = await crypto.subtle.importKey(
    'raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', keyBuf, enc.encode(data));
  return arrayBufferToBase64(sig);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function jsonRes(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
