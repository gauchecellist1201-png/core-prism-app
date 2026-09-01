// ============================================================
// 株式会社CORE — 会社基本情報 (Single Source of Truth)
// 会社名・代表者・資本金など、複数ページ(法人サイト/Studio/利用規約等)
// で重複していた値をここへ集約。今後の変更はここ1箇所でよい。
// 2026-09-01 オーナー確定: 資本金は 2,000,000円(200万円) で確定。
// ============================================================

export const COMPANY_INFO = {
  name: '株式会社CORE',
  nameEn: 'CORE Inc.',
  representative: '井出 直毅',
  representativeEn: 'Naoki Ide',
  founded: '2026年',
  capital: 2_000_000,
  capitalDisplay: '200万円',
  addressJa: '〒658-0025 兵庫県神戸市東灘区魚崎南町7丁目11番7号',
  addressEn: '7-11-7 Uozaki-Minamimachi, Higashinada-ku, Kobe, Hyogo 658-0025, Japan',
  email: 'info@core-ai.jp',
  philosophy: 'いつの時代も、変わらない核を。',
} as const;
