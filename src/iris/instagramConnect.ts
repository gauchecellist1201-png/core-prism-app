// ============================================================
// instagramConnect — Iris ユーザーごとの Instagram 連携
//
// 設計思想:
// 1. Meta (Instagram) の Graph API は OAuth 必須・審査必要・LIVE 状態でないと
//    一般ユーザーの本番接続不可。これは Meta 側の制約で迂回不可。
// 2. そこで、本実装は「2 段構え」:
//    (A) 即時利用可: ユーザーの IG ハンドル + 自己申告フォロワー数 + 数枚の
//        スクショアップロードで擬似プロフィール構築 (デモ用途)
//    (B) 本格連携: Meta App Review が通り次第、OAuth フロー差込
// 3. ユーザー視点では (A) でも「連携できた」感覚を得て、案件マッチ + 分析が
//    動き出す。コードもそのまま (B) に差し替え可能な抽象化を維持。
// 4. データは Upstash KV (あれば) または localStorage に保存。
// ============================================================

export interface IgProfile {
  handle: string;          // @without_at
  followers: number;       // 申告値 or 取得値
  avgLikes: number;        // 平均いいね数
  avgComments: number;
  topPostCategories: string[]; // ['美容', 'ライフスタイル' 等]
  bestPostTime: string;    // '土 21:00' 等
  saveRate: number;        // 保存率 (%)
  storyViewRate: number;   // ストーリー閲覧率 (%)
  audienceAge: { range: string; pct: number }[]; // [{ range:'18-24', pct: 35 }, ...]
  audienceGender: { female: number; male: number; other: number };
  audienceTopCountries: { country: string; pct: number }[];
  source: 'self' | 'oauth' | 'screenshot-ai';
  connectedAt: string;     // ISO
  updatedAt: string;       // ISO
}

const STORAGE_KEY = 'core_iris_ig_profile_v1';

export function loadIgProfile(): IgProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IgProfile;
  } catch { return null; }
}

export function saveIgProfile(p: IgProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...p, updatedAt: new Date().toISOString(),
  }));
}

export function clearIgProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 自己申告ベースの即時プロフィール作成 (Meta 審査前のフォールバック)
 * handle と followers から、相場感のある初期値を推定して埋める
 */
export function createSelfReportedProfile(input: {
  handle: string;
  followers: number;
  categories?: string[];
}): IgProfile {
  const followers = Math.max(0, input.followers);
  // 業界平均的なエンゲージメント率から推定 (フォロワー数で逆相関)
  const engagementRate =
    followers < 1000 ? 0.08 :
    followers < 10000 ? 0.05 :
    followers < 100000 ? 0.025 :
    0.012;
  const avgLikes = Math.round(followers * engagementRate);
  const avgComments = Math.round(avgLikes * 0.06);

  return {
    handle: input.handle.replace(/^@/, ''),
    followers,
    avgLikes,
    avgComments,
    topPostCategories: input.categories?.length ? input.categories : ['ライフスタイル'],
    bestPostTime: '土 21:00',
    saveRate: 3.2,
    storyViewRate: 38,
    audienceAge: [
      { range: '18-24', pct: 22 },
      { range: '25-34', pct: 41 },
      { range: '35-44', pct: 24 },
      { range: '45+',   pct: 13 },
    ],
    audienceGender: { female: 68, male: 30, other: 2 },
    audienceTopCountries: [
      { country: '日本', pct: 87 },
      { country: '韓国', pct: 5 },
      { country: '台湾', pct: 3 },
    ],
    source: 'self',
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * OAuth 経由の本格接続 (Meta App Review 完了後に有効化)
 * 現状は API 404 を返すスタブ、env META_APP_ID が入ったら有効化
 */
export async function tryOauthConnect(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const resp = await fetch('/api/instagram/oauth-status', { method: 'GET' });
    if (!resp.ok) return { ok: false, reason: 'oauth_not_configured' };
    const data = await resp.json() as { configured?: boolean };
    if (!data.configured) return { ok: false, reason: 'pending_meta_review' };
    // 認証 URL に遷移
    window.location.href = '/api/instagram/oauth-start';
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e.message || 'unknown' };
  }
}

/**
 * 案件マッチング: IG プロフィールから合致度の高い案件カテゴリを推定
 */
export function matchBrandCategories(profile: IgProfile | null): string[] {
  if (!profile) return ['ライフスタイル', '美容', 'アパレル'];
  const cats = new Set(profile.topPostCategories);
  // 女性比率高めなら美容/コスメも追加
  if (profile.audienceGender.female > 60) {
    cats.add('美容'); cats.add('コスメ'); cats.add('スキンケア');
  }
  // フォロワー多めならテック・大手案件も
  if (profile.followers >= 30000) {
    cats.add('テック'); cats.add('家電');
  }
  return Array.from(cats);
}
