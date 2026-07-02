// ============================================================
// conciergeConfig — 高級コンシェルジュ・ウィジェットのブランド設定
//
// 誰でも(オーナー以外も)自分のブランド設定を作り、URL の ?c=base64(JSON)
// に埋め込んで持ち運べる。埋め込み先サイトには一切サーバ設定不要。
// デフォルトは Prism 自身のコンシェルジュとして動く。
// ============================================================

export interface ConciergeFaqItem {
  /** 質問 (例: 「内見はできますか？」) */
  q: string;
  /** 回答 */
  a: string;
}

export interface ConciergeConfig {
  /** ブランド名 (例: THE RESIDENCE 麻布) */
  brandName: string;
  /** 一言タグライン (ヘッダに表示) */
  tagline: string;
  /** アクセント色 (hex)。金 #C9A96E がデフォルト */
  accentColor: string;
  /** 業種 (例: 高級不動産) */
  industry: string;
  /** 提供サービス (クイックボタンにもなる) */
  services: string[];
  /** よくある質問と回答 (AI がそのまま参照する) */
  faq: ConciergeFaqItem[];
  /** 日程予約ページ URL (あれば案内に使う) */
  bookingUrl?: string;
  /** 連絡先メール (あれば案内に使う) */
  contactEmail?: string;
  /** コンシェルジュの呼び名 (例: 澪 / コンシェルジュ) */
  conciergeName?: string;
  /** 一人称 (例: 私 / わたくし) */
  firstPerson?: string;
}

/** Prism 自身のコンシェルジュ (デフォルト設定 = ライブデモにもなる) */
export const DEFAULT_CONCIERGE_CONFIG: ConciergeConfig = {
  brandName: 'CORE Prism',
  tagline: '24時間、あなたのブランドを体現するコンシェルジュ',
  accentColor: '#C9A96E',
  industry: '高級ブランド向け AI コンシェルジュの提供',
  services: [
    '物件・商品のご案内',
    'ご内見・ご相談の日程調整',
    '料金プランのご説明',
    '導入のご相談',
  ],
  faq: [
    {
      q: '設置は難しいですか？',
      a: 'サイトにタグを1行貼るだけです。プログラミングの知識は不要で、5分で始められます。',
    },
    {
      q: '応対の言葉づかいは変えられますか？',
      a: 'はい。ブランド名・呼び名・一人称・よくある質問への答え方まで、すべてブランドに合わせて調整できます。',
    },
    {
      q: '深夜でも応対できますか？',
      a: 'はい。24時間365日、同じ品質でご応対します。ご相談の日程調整やご連絡先の受付も自動で行います。',
    },
  ],
  contactEmail: 'core.guild.inc@gmail.com',
  conciergeName: 'コンシェルジュ',
  firstPerson: '私',
};

// ─── Unicode 安全な base64url エンコード/デコード ───────────
// (日本語のブランド名・FAQ を URL に載せるため btoa 直は使えない)

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 設定 → URL に載せられる文字列 */
export function encodeConciergeConfig(cfg: ConciergeConfig): string {
  return toBase64Url(JSON.stringify(cfg));
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeString(v: unknown, max: number, fallback = ''): string {
  return typeof v === 'string' ? v.slice(0, max) : fallback;
}

/** 不正な JSON / 値が来ても壊れないよう、必ず正規化して返す */
export function normalizeConciergeConfig(raw: Partial<ConciergeConfig> | null | undefined): ConciergeConfig {
  const d = DEFAULT_CONCIERGE_CONFIG;
  if (!raw || typeof raw !== 'object') return { ...d };
  const services = Array.isArray(raw.services)
    ? raw.services.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.slice(0, 60)).slice(0, 8)
    : d.services;
  const faq = Array.isArray(raw.faq)
    ? raw.faq
        .filter((f): f is ConciergeFaqItem => !!f && typeof f === 'object' && typeof (f as ConciergeFaqItem).q === 'string' && typeof (f as ConciergeFaqItem).a === 'string')
        .map(f => ({ q: f.q.slice(0, 120), a: f.a.slice(0, 400) }))
        .slice(0, 12)
    : d.faq;
  return {
    brandName: sanitizeString(raw.brandName, 60) || d.brandName,
    tagline: sanitizeString(raw.tagline, 90) || d.tagline,
    accentColor: HEX_RE.test(String(raw.accentColor || '')) ? String(raw.accentColor) : d.accentColor,
    industry: sanitizeString(raw.industry, 60) || d.industry,
    services: services.length > 0 ? services : d.services,
    faq,
    bookingUrl: /^https?:\/\//.test(String(raw.bookingUrl || '')) ? sanitizeString(raw.bookingUrl, 300) : undefined,
    contactEmail: String(raw.contactEmail || '').includes('@') ? sanitizeString(raw.contactEmail, 200) : undefined,
    conciergeName: sanitizeString(raw.conciergeName, 30) || d.conciergeName,
    firstPerson: sanitizeString(raw.firstPerson, 10) || d.firstPerson,
  };
}

/** URL 文字列 → 設定。壊れていたら null */
export function decodeConciergeConfig(encoded: string): ConciergeConfig | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded));
    return normalizeConciergeConfig(parsed);
  } catch {
    return null;
  }
}

/** 現在の URL (?c=...) から設定を復元。無ければデフォルト */
export function readConciergeConfigFromUrl(): ConciergeConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CONCIERGE_CONFIG };
  try {
    const c = new URLSearchParams(window.location.search).get('c');
    if (!c) return { ...DEFAULT_CONCIERGE_CONFIG };
    return decodeConciergeConfig(c) ?? { ...DEFAULT_CONCIERGE_CONFIG };
  } catch {
    return { ...DEFAULT_CONCIERGE_CONFIG };
  }
}

/** 埋め込みモード (?embed=1) かどうか */
export function isConciergeEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('embed') === '1';
}
