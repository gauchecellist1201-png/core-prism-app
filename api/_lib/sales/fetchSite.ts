// ============================================================
// Sales OS — 営業先サイトの取得 (SSRF ガードつき)
//
// 「URL を入れたら分析」はサーバーに任意の URL を叩かせる機能なので、
// 社内ネットワーク / クラウドのメタデータ endpoint を踏ませない防御が要る。
//   - http / https 以外を拒否
//   - IP リテラル (v4/v6) を拒否 = 169.254.169.254 等を名前解決なしで弾く
//   - localhost / *.local / *.internal / ドット無しホストを拒否
//   - リダイレクトは手動で 3 回まで、毎回同じ検査をかける
//   - 本文サイズ上限 / タイムアウト
// ============================================================

const MAX_BYTES = 600_000;
const MAX_REDIRECTS = 3;

const BLOCKED_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localdomain|metadata.*)$/i;

/** IPv4 / IPv6 リテラルか (ホスト名としての形だけで判定) */
function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;                 // 1.2.3.4
  if (/^\[?[0-9a-f]*:[0-9a-f:.]*\]?$/i.test(host) && host.includes(':')) return true; // v6
  if (/^\d+$/.test(host)) return true;                                    // 2130706433 (整数表記)
  if (/^0x[0-9a-f]+$/i.test(host)) return true;                           // 16進表記
  return false;
}

export function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('URL の形式が正しくありません。');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('http / https のURLだけを開けます。');
  }
  const host = u.hostname.toLowerCase();
  if (!host) throw new Error('URL にホスト名がありません。');
  if (isIpLiteral(host)) throw new Error('IPアドレス直指定のURLは開けません。');
  if (BLOCKED_HOST.test(host)) throw new Error('社内・ローカル向けのURLは開けません。');
  if (!host.includes('.')) throw new Error('社内・ローカル向けのURLは開けません。');
  return u;
}

export interface SiteText {
  url: string;
  title: string;
  description: string;
  text: string;
  ok: boolean;
  /** 取得できなかった理由 (ok=false のとき画面と AI に正直に渡す) */
  note: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => {
      const n = Number(d);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    });
}

function metaOf(html: string, name: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
    'i',
  );
  const m = html.match(re);
  return m ? decodeEntities(m[1]).trim() : '';
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    // 半角スペース / タブ / 全角スペース (U+3000) をまとめる
    .replace(/[ \t\u3000]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readCapped(res: Response, signal: AbortSignal): Promise<string> {
  const body = res.body;
  if (!body) return await res.text();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
        if (total >= MAX_BYTES) break;
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* noop */ }
  }
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, total - off);
    merged.set(c.subarray(0, take), off);
    off += take;
    if (off >= total) break;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

/**
 * 営業先サイトを取れるだけ取ってテキストにする。
 * 失敗しても throw せず ok:false + note で返す (1社取れないだけで分析全体を止めない)。
 */
export async function fetchSiteText(rawUrl: string, signal: AbortSignal): Promise<SiteText> {
  const base: SiteText = { url: rawUrl, title: '', description: '', text: '', ok: false, note: '' };
  let current: URL;
  try {
    current = assertSafeUrl(rawUrl);
  } catch (e) {
    return { ...base, note: e instanceof Error ? e.message : 'URL を開けません。' };
  }

  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetch(current.toString(), {
        redirect: 'manual',
        signal,
        headers: {
          // 名乗る。robots を尊重するサイトが弾けるようにする。
          'User-Agent': 'CORE-Studio-SalesOS/1.0 (+https://core-prism-app.vercel.app/studio)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en;q=0.8',
        },
      });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        if (hop === MAX_REDIRECTS) return { ...base, url: current.toString(), note: 'リダイレクトが多すぎます。' };
        try {
          current = assertSafeUrl(new URL(loc, current).toString());
        } catch (e) {
          return { ...base, url: current.toString(), note: e instanceof Error ? e.message : '転送先を開けません。' };
        }
        continue;
      }
      break;
    }
    if (!res) return { ...base, note: 'サイトに接続できませんでした。' };
    if (!res.ok) {
      return { ...base, url: current.toString(), note: `サイトが HTTP ${res.status} を返しました。` };
    }
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (ctype && !/text\/html|application\/xhtml|text\/plain/.test(ctype)) {
      return { ...base, url: current.toString(), note: `HTML ではありませんでした (${ctype.split(';')[0]})。` };
    }

    const html = await readCapped(res, signal);
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
    const text = htmlToText(html);
    if (!text || text.length < 80) {
      return {
        ...base,
        url: current.toString(),
        title: decodeEntities(title),
        description: metaOf(html, 'description'),
        text,
        note: 'ページ本文がほとんど取れませんでした (JavaScript で描画するサイトの可能性)。',
      };
    }
    return {
      url: current.toString(),
      title: decodeEntities(title),
      description: metaOf(html, 'description') || metaOf(html, 'og:description'),
      // Edge の 25 秒に収めるため入力を絞る。会社の素性はページ前半でほぼ分かる。
      text: text.slice(0, 7_000),
      ok: true,
      note: '',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...base, url: current.toString(), note: /abort|timeout/i.test(msg) ? 'サイトの応答が遅く、時間内に取れませんでした。' : `サイトを取得できませんでした (${msg.slice(0, 80)})。` };
  }
}
