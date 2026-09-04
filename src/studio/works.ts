// ============================================================
// CORE Studio — 映像の制作実績 (データのみ)
//
// film.ts から切り出した理由 (2026-08-31):
//   実績は /studio/film だけでなく /studio/works (実績タブ) でも出すようになった。
//   持ち主が2つになったデータを、片方 (film.ts = 料金・条文込みで 73KB) の中に
//   置いたままにしない。ここが正本で、FilmTab も StudioSite もここから読む。
//
// バンドルについて — 切り出しても配られる量は変わらない (実測):
//   当初は「StudioSite から film.ts を import すると料金・条文の全文まで配られる」
//   のを避ける意図もあったが、本番のバンドルを実測したところ、この変更の前から
//   film.ts は main が同期で読む共有チャンク (assets/track-*.js) に同居していた。
//   したがって切り出しの効果は「所有者を1つにする」ことだけで、転送量は減らない。
//   減らしたい時に触るのは、この分割ではなく vite の chunk 分割設定。
// ============================================================

export type StudioProjectCategory = 'SHORT DRAMA' | 'BRAND FILM' | 'PRODUCT' | 'ARTIST' | 'SOCIAL' | 'EVENT BRANDING';

// ------------------------------------------------------------
// 制作実績 (/studio/film の「制作実績」セクションで使用)
//   クライアント名・動画が増え次第、この配列に1件ずつ追加する。
//   client を伏せて公開する場合は client を汎用表記にし、result は確認できる事実のみ書く (推測・誇張禁止)。
// ------------------------------------------------------------
export type FilmWork = {
  id: string;
  client: string;
  category: StudioProjectCategory;
  /** 依頼の目的 */
  purpose: string;
  /** 確認できている結果。無ければ省略する (無い結果を書かない) */
  result?: string;
  poster?: string;
  videoUrl?: string;
  /** 公開先URL (あれば) */
  url?: string;
};

export const FILM_WORKS: FilmWork[] = [
  // 2026-08-31 追加・先頭固定。百貨店の化粧品売場に店舗を構えるブランドの商品広告で、
  // 当社の実績のうち最も「発注を検討している法人」に効く1本。先頭は FilmWorks 側で
  // 大きく1件だけ出す枠 (flagship) に入るので、並べ替える時はこの順序の意味に注意する。
  {
    id: 'work-laguna-beaute-01',
    client: 'Laguna Beauté（ラグナボーテ）',
    category: 'PRODUCT',
    purpose: '百貨店の化粧品売場に店舗を構える神戸のエイジングケアブランド様の商品広告。化粧水「LAGUNA DERMA WATER」の透明感と水の質感を軸に、ブランドの世界観を保ったまま縦型1本に収めました。',
    poster: '/studio/film/laguna-beaute.jpg',
    videoUrl: '/studio/film/laguna-beaute.mp4',
    url: 'https://lagunabeaute.jp/',
  },
  // 2026-09-04 追加: 当社自身の企業紹介映像（/corp トップに掲載中）。
  //   外部クライアントではなく自社の実績として、映像がこの品質で作れることの証拠に置く。
  {
    id: 'work-core-corp-01',
    client: '株式会社CORE（自社）',
    category: 'BRAND FILM',
    purpose: '当社自身の企業紹介映像。社是「いつの時代も、変わらない核を。」を軸に、AIの会社でありながら人をいちばん大切にする姿勢を伝えるブランドフィルムです。',
    poster: '/corp-creed-poster.webp',
    videoUrl: '/corp-creed-portrait.mp4',
    url: 'https://www.core-ai.jp/corp',
  },
  {
    id: 'work-event-branding-01',
    client: 'GAUCHE（チェリスト）',
    category: 'EVENT BRANDING',
    purpose: '開催前に当日の熱量を見せる告知映像。会場の規模・照明・来場者の空気までを、本番を待たずに集客の材料にできます。',
    poster: '/studio/film/event-artist-live.jpg',
    videoUrl: '/studio/film/event-artist-live.mp4',
  },
  {
    id: 'work-asahikawa-villa-01',
    client: '株式会社グローバルジョイントコミットメント',
    category: 'BRAND FILM',
    purpose: '北海道旭川に建つヴィラの魅力を伝える紹介映像。竣工間近のヴィラを舞台に、当事者目線のドラマ仕立てで制作。',
    poster: '/studio/film/asahikawa-villa.jpg',
    videoUrl: '/studio/film/asahikawa-villa.mp4',
  },
  {
    id: 'work-jrc-01',
    client: 'JRC 日本記録協会',
    category: 'BRAND FILM',
    purpose: '日本記録の認定サービスを運営する「JRC 日本記録協会」様のブランドプロモーション映像。挑戦から認定の瞬間までを、当事者目線のドラマ仕立てで制作。',
    poster: '/studio/film/jrc.jpg',
    videoUrl: '/studio/film/jrc.mp4',
    url: 'https://www.official-jrc.com',
  },
  // 2026-08-24: SHORT DRAMA / BRAND FILM / SOCIAL の3枚は同一シリーズの別カットで、
  // 並べると同じ内容が3件あるように見えるため「GAUCHE のショートドラマ」1件に統合した。
  {
    id: 'work-short-drama-01',
    client: 'GAUCHE（チェリスト）',
    category: 'SHORT DRAMA',
    purpose: 'チェリスト本人を主人公にした連続もののショートドラマ。舞台裏・本番・日常を1つの物語としてつなぎ、TikTok / Reels で継続発信しています。',
    poster: '/studio/film/short-drama.jpg',
    videoUrl: '/studio/film/short-drama.mp4',
  },
];
