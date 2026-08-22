// ============================================================
// Sales OS — 営業先サイトの取得 (SSRF ガードつき)
//
// 「URL を入れたら分析」はサーバーに任意の URL を叩かせる機能なので、
// 社内ネットワーク / クラウドのメタデータ endpoint を踏ませない防御が要る。
//   - http / https 以外を拒否
//   - IP リテラル (v4/v6) を拒否 = 169.254.169.254 等を名前解決なしで弾く
//   - ホスト名の中に IP が埋まっている形 (127.0.0.1.nip.io) を拒否
//   - localhost / *.local / *.internal / ドット無しホストを拒否
//   - DNS over HTTPS で実際に引いて、private / loopback / link-local に
//     向くホストを拒否 (文字列検査だけでは 127.0.0.1.nip.io の類を防げない)
//   - リダイレクトは手動で 3 回まで、毎回同じ検査をかける
//   - 本文サイズ上限 / タイムアウト
// ============================================================

const MAX_BYTES = 600_000;
const MAX_REDIRECTS = 3;

const BLOCKED_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localdomain|metadata.*)$/i;

// ワイルドカードDNS (任意のIPへ解決させられる) は名前の時点で落とす
const WILDCARD_DNS = /(^|\.)(nip\.io|sslip\.io|xip\.io|localtest\.me|traefik\.me|lvh\.me|vcap\.me)$/i;

/** ホスト名のどこかに v4 の点付き表記が埋まっているか (127.0.0.1.nip.io 等) */
function embedsIpv4(host: string): boolean {
  return /(^|\.)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\.|$)/.test(host);
}

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
  if (embedsIpv4(host)) throw new Error('IPアドレスを名前に埋め込んだURLは開けません。');
  if (WILDCARD_DNS.test(host)) throw new Error('任意のアドレスへ解決させられるドメインは開けません。');
  if (BLOCKED_HOST.test(host)) throw new Error('社内・ローカル向けのURLは開けません。');
  if (!host.includes('.')) throw new Error('社内・ローカル向けのURLは開けません。');
  return u;
}

// ---- 解決先アドレスの検査 ------------------------------------------------
/** "1.2.3.4" を 32bit にする。形が違えば null。 */
function ipv4ToInt(a: string): number | null {
  const p = a.split('.');
  if (p.length !== 4) return null;
  let v = 0;
  for (const seg of p) {
    if (!/^\d{1,3}$/.test(seg)) return null;
    const n = Number(seg);
    if (n > 255) return null;
    v = v * 256 + n;
  }
  return v;
}

/**
 * IPv6 を 8 グループに展開する ("::" を 0 で埋める)。
 * 末尾が v4 表記 (::ffff:127.0.0.1) の場合は 2 グループに畳んでから返す。
 */
function expandIpv6(a: string): number[] | null {
  let t = a.trim().replace(/^\[|\]$/g, '');
  const zone = t.indexOf('%');
  if (zone >= 0) t = t.slice(0, zone);
  if (!t.includes(':')) return null;

  // 末尾の v4 表記を 2 グループへ
  const v4 = t.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const n = ipv4ToInt(v4[1]);
    if (n === null) return null;
    t = t.slice(0, t.length - v4[1].length)
      + ((n >>> 16) & 0xffff).toString(16) + ':' + (n & 0xffff).toString(16);
  }

  const halves = t.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (!part) return [];
    const out: number[] = [];
    for (const g of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  if (head === null || tail === null) return null;
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    return [...head, ...new Array<number>(fill).fill(0), ...tail];
  }
  return head.length === 8 ? head : null;
}

/**
 * private / loopback / link-local / CGNAT など、外に出てはいけない宛先か。
 *
 * IPv6 は必ず展開してから見る。::ffff:127.0.0.1 と ::ffff:7f00:1 は同じアドレスで、
 * 文字列の見た目だけで判定すると後者を素通しして loopback へ繋げてしまう。
 */
export function isForbiddenAddress(ip: string): boolean {
  const a = (ip || '').trim().toLowerCase();
  if (!a) return true;

  if (a.includes(':')) {
    const g = expandIpv6(a);
    if (!g) return true;                                   // 読めないものは通さない
    const allZero = g.every(x => x === 0);
    if (allZero) return true;                              // ::
    if (g.slice(0, 7).every(x => x === 0) && g[7] === 1) return true;  // ::1
    // IPv4-mapped (::ffff:x.x.x.x) / IPv4-compatible (::x.x.x.x)
    const mapped = g.slice(0, 5).every(x => x === 0) && (g[5] === 0xffff || g[5] === 0);
    if (mapped) {
      const v4 = `${(g[6] >> 8) & 0xff}.${g[6] & 0xff}.${(g[7] >> 8) & 0xff}.${g[7] & 0xff}`;
      return isForbiddenAddress(v4);
    }
    if ((g[0] & 0xfe00) === 0xfc00) return true;           // fc00::/7 ユニークローカル
    if ((g[0] & 0xffc0) === 0xfe80) return true;           // fe80::/10 リンクローカル
    return false;
  }

  const n = ipv4ToInt(a);
  if (n === null) return true;
  const x = (n >>> 24) & 0xff, y = (n >>> 16) & 0xff;
  if (x === 0 || x === 10 || x === 127) return true;       // this / private / loopback
  if (x === 169 && y === 254) return true;                 // link-local (メタデータ)
  if (x === 172 && y >= 16 && y <= 31) return true;        // private
  if (x === 192 && y === 168) return true;                 // private
  if (x === 192 && y === 0) return true;                   // IETF 予約
  if (x === 100 && y >= 64 && y <= 127) return true;       // CGNAT
  if (x >= 224) return true;                               // multicast / 予約
  return false;
}

interface DohAnswer { data?: string; type?: number }

// 片方が届かないだけで分析が全部止まらないよう、2社に順に聞く
const DOH = [
  'https://cloudflare-dns.com/dns-query',
  'https://dns.google/resolve',
];

async function resolveAt(base: string, host: string, type: 'A' | 'AAAA', signal: AbortSignal): Promise<string[]> {
  const r = await fetch(`${base}?name=${encodeURIComponent(host)}&type=${type}`, {
    headers: { accept: 'application/dns-json' },
    signal,
  });
  if (!r.ok) throw new Error(`dns ${r.status}`);
  const j = (await r.json()) as { Answer?: DohAnswer[] };
  return (j.Answer || [])
    .filter(a => a.type === (type === 'A' ? 1 : 28) && typeof a.data === 'string')
    .map(a => String(a.data));
}

/**
 * ホスト名を実際に引いて、社内・ループバック・メタデータへ向いていないか確かめる。
 * 引けなかったときは通さない (fail-closed)。穴を開けたままにするより止める。
 *
 * 【残っている穴】ここで引いたアドレスと、直後の fetch() が実際に繋ぐアドレスは別物になりうる
 * (DNS rebinding / split-horizon)。塞ぐには「検査したIPに固定して繋ぐ」必要があるが、
 * Vercel Edge の fetch にはその手段が無い (接続先IPを指定できない)。
 * 完全に塞ぐなら egress プロキシを立てて宛先レンジをそこで制限する。
 * 現時点では、この経路は master 合言葉が要る = URL を入れられるのはオーナーだけ、
 * という前提で残存リスクを受け入れている。公開フォームからは絶対に呼ばないこと。
 */
export async function assertPublicHost(host: string, signal: AbortSignal): Promise<void> {
  let addrs: string[] = [];
  let resolved = false;
  for (const base of DOH) {
    try {
      const [v4, v6] = await Promise.all([
        resolveAt(base, host, 'A', signal).catch(() => [] as string[]),
        resolveAt(base, host, 'AAAA', signal).catch(() => [] as string[]),
      ]);
      if (v4.length || v6.length) { addrs = [...v4, ...v6]; resolved = true; break; }
    } catch { /* 次の提供元へ */ }
  }
  // 引けなかったら通さない (fail-closed)。穴を開けたままにするより止める。
  if (!resolved || !addrs.length) throw new Error('このURLの宛先を確認できませんでした。');
  const bad = addrs.find(isForbiddenAddress);
  if (bad) throw new Error('社内・ローカル向けのアドレスに解決されるURLは開けません。');
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

/**
 * 使う文字コードを決める。日本の会社サイトは今でも Shift_JIS / EUC-JP が残っている。
 * UTF-8 決め打ちで読むと文字化けしたまま ok:true になり、化けた文字列が
 * そのままスコアの根拠や営業メールの材料になる。
 */
function pickCharset(contentType: string, head: Uint8Array): string {
  const fromHeader = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  // HTML の宣言を先頭 2KB から拾う (ASCII 互換なので latin1 で読めば足りる)
  const peek = new TextDecoder('windows-1252').decode(head.subarray(0, 2048));
  const meta = peek.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1]
    || peek.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+)/i)?.[1];
  return (meta || 'utf-8').toLowerCase();
}

function decodeWith(charset: string, bytes: Uint8Array): string {
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
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
  return decodeWith(pickCharset(res.headers.get('content-type') || '', merged), merged);
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
      // 名前が通っても、解決先が社内かもしれない。毎ホップ引き直す。
      await assertPublicHost(current.hostname, signal);
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
