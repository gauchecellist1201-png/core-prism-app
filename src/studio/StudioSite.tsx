// ============================================================
// CORE Studio — ウェブ制作・受託開発 (/studio)
// 白基調・法人トーン。背景 #FFFFFF / 交互セクション #F7F7F5、
// 文字 #111827 系、金 #A8823C は線・ラベル・ホバーのみ少量。
// 見出し Noto Serif JP・本文サンセリフ。CTAは濃色ボタン。
// 文言・価格は plans.ts に集約 (ここにはレイアウトだけを書く)
// ============================================================
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  STUDIO, STATS, REASONS, PROCESS, PRODUCTION_PLANS, DEV_LEAD, DEV_TIERS,
  CARE_PLANS, WORKS, COMPANY, SERVICE_LINES, STUDIO_FAQ, thumbOf,
  type ProductionPlan, type DevTier,
} from './plans';
import { CONTACT } from './plans';
// 映像の制作実績。film.ts ではなく works.ts が正本 (実績タブと映像タブの両方が使うため)。
import { FILM_WORKS } from './works';
import { FILM_PLANS } from './film';
import { estimate, type EstimateAnswers, type Purpose, type Scale, type Feature, type Timeline, type Budget } from './estimate';
import { C, D, SERIF, SANS } from './theme';
import { Reveal, Band, H2, Note, IconCheck, IconArrow, IconChat, IconCopy } from './ui';
import { track } from './track';
import { ESTIMATE_KEY, EMPTY_DRAFT, parseSavedEstimate, type DraftOptions } from './estimateDraft';

const FilmTab = lazy(() => import('./FilmTab'));

// ---- tabs ----
type TabId = 'home' | 'film' | 'plans' | 'dev' | 'care' | 'works' | 'about' | 'contact';
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'ホーム' },
  { id: 'film', label: '映像制作' },
  { id: 'plans', label: 'サイト制作' },
  { id: 'dev', label: '受託開発' },
  { id: 'care', label: '運用' },
  { id: 'works', label: '実績' },
  { id: 'about', label: '会社案内' },
  { id: 'contact', label: 'お問い合わせ' },
];

const isTabId = (v: string): v is TabId => TABS.some(t => t.id === v);

// /studio/film のようなパスと、従来の /studio#film の両方を受ける。
// ハッシュはサーバーにもクローラーにも届かないので、以後は必ずパス側に正規化する。
const readTab = (): TabId => {
  if (typeof window === 'undefined') return 'home';
  const seg = window.location.pathname.replace(/^\/studio\/?/, '').replace(/\/$/, '');
  if (isTabId(seg)) return seg;
  const h = window.location.hash.replace('#', '');
  return isTabId(h) ? h : 'home';
};

const pathOf = (t: TabId) => (t === 'home' ? '/studio' : `/studio/${t}`);

// ---- カーソル追従のあかり (暗部の章だけ) ----
// 白地でやると光が濁って安っぽくなるので、黒地の Services にだけ置く。
// pointermove は 1 秒に数百回飛ぶため、座標の保存と描画を分け、rAF で 1 フレーム 1 回に間引く
// (毎回 style を書くとスクロールごと詰まる)。
// マウスが無い端末では光が指の下に隠れて意味が無く、hover が residual で残る事故にもなるので付けない。
function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let x = 0, y = 0;
    const paint = () => {
      raf = 0;
      el.style.setProperty('--sx', `${x}px`);
      el.style.setProperty('--sy', `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onEnter = () => el.setAttribute('data-lit', 'true');
    const onLeave = () => el.removeAttribute('data-lit');

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);
  return ref;
}

// ---- タブごとの title / description (映像は検索の入口が別なので分ける) ----
// 正本は studio.html / studio-film.html の静的メタ。ここを変えたら向こうも合わせる。
const SEO = {
  // v4 (2026-09-01): ロゴを大きく置いた黒地のカードへ刷新 (scripts/generateStudioOgV4.mjs)。
  // ファイル名を変えないと X/Facebook/LINE のキャッシュが差し替わらないので版番号を上げる。
  // ★タブごとに別のカードを出す。v3までは1枚を共用していたので、映像のページを共有しても
  //   会社紹介のカードが出ていた。
  // 2026-08-31 訂正: ここが studio.html (正本) の title/description を上書きして、
  // 「映像制作」を落とした古い文言に戻していた。主力は映像制作なので正本に合わせる。
  default: {
    ogImage: 'https://core-prism-app.vercel.app/og-studio-v4.png',
    title: 'CORE Studio — 映像制作・ウェブ制作・受託開発',
    description: 'COREは、AIプロダクトを自社で開発・運営する制作スタジオです。AIショートドラマなどの映像制作から、ウェブサイト制作、システム受託開発まで。戦略設計から公開後の運用改善まで一貫体制で担当します。',
  },
  film: {
    ogImage: 'https://core-prism-app.vercel.app/og-studio-film-v5.png',
    title: 'AI動画制作・ショートドラマ制作代行 — CORE Studio',
    description: 'ショートドラマ、ブランドムービー、SNS縦型動画、CMまで。企画・脚本・映像制作・編集・字幕・SNS最適化までを一貫制作するAIクリエイティブスタジオ。初回1本(15秒)¥49,800、毎月継続は月4本¥228,000から。初期費用0円・最低契約期間なし。',
  },
};

// ============================================================
export default function StudioSite() {
  const [tab, setTab] = useState<TabId>(readTab);

  useEffect(() => {
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', tab === 'film' ? D.bg : C.bg);

    const setMeta = (name: string, content: string) => {
      let m = document.querySelector(`meta[name="${name}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute('name', name); document.head.appendChild(m); }
      m.setAttribute('content', content);
    };
    const setProp = (property: string, content: string) => {
      let m = document.querySelector(`meta[property="${property}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute('property', property); document.head.appendChild(m); }
      m.setAttribute('content', content);
    };

    const seo = tab === 'film' ? SEO.film : SEO.default;
    // SNSのカードを出すクローラーはJSを実行しないので、本命は studio.html / studio-film.html の
    // 静的メタ (vercel.json の rewrite で配信) 側。ここは画面遷移した後の表示を合わせるための追従。
    // 一部だけ書き換えるとPrism本体のOGが混ざるので、SNSタグは一式そろえて差し替える。
    const url = `https://core-prism-app.vercel.app${pathOf(tab)}`;
    document.title = seo.title;
    setMeta('description', seo.description);
    setProp('og:title', seo.title);
    setProp('og:description', seo.description);
    setProp('og:url', url);
    setProp('og:site_name', 'CORE Studio');
    setProp('og:image', seo.ogImage);
    setProp('og:image:alt', seo.title);
    setMeta('twitter:title', seo.title);
    setMeta('twitter:description', seo.description);
    setMeta('twitter:image', seo.ogImage);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical); }
    canonical.setAttribute('href', url);
  }, [tab]);

  // どのタブが実際に見られたかを CORE 側に残す。
  // (これまで /studio の計測は訪問者自身の localStorage にしか無く、
  //  「映像を見に来た人が何人いたか」すら分からなかった)
  useEffect(() => { track('studio_tab_view', { tab }); }, [tab]);

  // Service の構造化データ (SPAなので実行時に差し込む。タブが変わるたびに
  // 画面の中身と揃え直す。離脱時に必ず片付ける)
  useEffect(() => {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'studio-jsonld';
    el.textContent = JSON.stringify(studioJsonLd(tab));
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [tab]);

  useEffect(() => {
    const sync = () => setTab(readTab());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);

  const go = (t: TabId) => {
    setTab(t);
    if (typeof window !== 'undefined') {
      history.pushState(null, '', pathOf(t));
      window.scrollTo({ top: 0 });
    }
  };

  return (
    <div style={{ background: C.bg, color: C.body, minHeight: '100dvh', fontFamily: SANS, overflowX: 'clip' }}>
      <style>{`
        .st-inner { max-width: 760px; margin: 0 auto; padding-left: 20px; padding-right: 20px; }
        /* ── スクロールで現れる箱 (ui.tsx の Reveal が付ける) ──────────────
           translate だけだと「ずれて出た」で終わる。ごく浅い blur を足して抜くと、
           止まった瞬間に像が結び、目が「今ここに来た」と感じる。
           easing は出だしが速く終わりが長い曲線。機械が動いた感じにしない。
           opacity:0 から始める以上、ui.tsx 側の「時間切れで必ず出す」逃げ道は外さないこと。 */
        .st-rv { transition: opacity 820ms cubic-bezier(.16,1,.3,1), transform 820ms cubic-bezier(.16,1,.3,1), filter 820ms cubic-bezier(.16,1,.3,1); }
        .st-rv[data-rv="pending"] { opacity: 0; transform: translateY(20px); filter: blur(6px); }
        .st-rv[data-rv="in"] { opacity: 1; transform: none; filter: none; }
        /* 章見出しの金の短い線。現れる時に左から伸びる = 章が始まった合図 */
        .st-h2-rule { display: block; width: 22px; height: 1.5px; flex: 0 0 auto; transform-origin: left center;
          transition: transform 900ms cubic-bezier(.16,1,.3,1) 140ms; }
        .st-rv[data-rv="pending"] .st-h2-rule { transform: scaleX(0); }
        @media (prefers-reduced-motion: reduce) {
          .st-rv, .st-rv[data-rv="pending"] { opacity: 1 !important; transform: none !important; filter: none !important; transition: none; }
          .st-h2-rule, .st-rv[data-rv="pending"] .st-h2-rule { transform: none !important; transition: none; }
        }
        .st-serif { font-family: ${SERIF}; }
        /* 金は白地で 3.55:1 しかないので、文字には goldText を使う (暗部では D.gold を上書き指定) */
        .st-label { font-family: ${SANS}; font-size: 11px; font-weight: 600; letter-spacing: 0.28em; text-transform: uppercase; color: ${C.goldText}; }
        .st-tabbar { display: flex; gap: 2px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 12px; }
        .st-tabbar::-webkit-scrollbar { display: none; }
        .st-tab { flex-shrink: 0; min-height: 46px; padding: 12px 13px; border: none; background: none; cursor: pointer;
          font-family: ${SANS}; font-size: 13.5px; letter-spacing: 0.04em; color: ${C.mute}; border-bottom: 2px solid transparent; }
        .st-tab:hover { color: ${C.ink}; }
        .st-tab[data-on="true"] { color: ${C.ink}; border-bottom-color: ${C.gold}; font-weight: 700; }
        .st-card { background: #FFFFFF; border: 1px solid ${C.line}; border-radius: 14px; padding: 24px 22px; }
        .st-card-featured { border: 1.5px solid ${C.goldLine}; box-shadow: 0 12px 32px -20px rgba(17,24,39,0.25); }
        .st-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 50px; padding: 13px 30px;
          border-radius: 6px; font-size: 14.5px; font-weight: 700; letter-spacing: 0.05em; cursor: pointer; text-decoration: none;
          font-family: ${SANS}; transition: opacity 160ms ease, border-color 160ms ease; }
        .st-btn-primary { background: ${C.dark}; color: #FFFFFF; border: 1px solid ${C.dark}; }
        .st-btn-primary:hover { opacity: 0.88; }
        .st-btn-ghost { background: #FFFFFF; color: ${C.ink}; border: 1px solid #C9CDD4; font-weight: 600; }
        .st-btn-ghost:hover { border-color: ${C.gold}; color: ${C.ink}; }
        /* LINEの相談・見積り導線は必ずこのクラス。実際のLINEブランド色(#06C755)。
           白文字は実測2.3:1で読めないので、地の濃色 #111827 を固定で使う */
        .st-btn-line { background: #06C755; color: #111827; border: 1px solid #06C755; font-weight: 700; }
        .st-btn-line:hover { opacity: 0.88; }
        .st-chip { display: inline-flex; align-items: center; min-height: 46px; padding: 11px 16px; border-radius: 8px;
          border: 1px solid #C9CDD4; background: #FFFFFF; color: ${C.body}; font-size: 14px; cursor: pointer; font-family: ${SANS}; text-align: left;
          transition: border-color 140ms ease; }
        .st-chip:hover { border-color: ${C.gold}; }
        .st-chip[data-on="true"] { border: 1.5px solid ${C.gold}; background: #FBF8F2; color: ${C.ink}; font-weight: 600; }
        .st-grid2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 640px) { .st-grid2 { grid-template-columns: 1fr 1fr; } }
        .st-worklink { color: ${C.ink}; }
        .st-worklink:hover { color: ${C.gold}; }
        a { -webkit-tap-highlight-color: rgba(168,130,60,0.15); }

        /* ── カーソルの手ざわり (2026-08-29 オーナー指示「カーソルがあった時に動きを」) ──
           タッチ端末に hover を持ち込むと、タップした要素に状態が residual で残り
           「押しっぱなし」に見える。マウスがある環境だけに限定する。
           動きを減らす設定の端末では transform を止め、色の変化だけ残す
           (動きが理由で気分が悪くなる人に、演出のために我慢させない)。 */
        @media (hover: hover) and (pointer: fine) {
          /* 面が浮く。cubic-bezier は「すっと出て、ふわっと止まる」= 手で持ち上げた感じ。
             linear や ease だと機械が動いた感じになり、高い買い物の画面に見えない */
          .st-card { transition: border-color 240ms ease, box-shadow 240ms ease, transform 240ms cubic-bezier(.2,.7,.3,1); }
          .st-card:hover { border-color: ${C.goldLine}; box-shadow: 0 16px 38px -24px rgba(17,24,39,0.42); }
          /* 押せるカードだけ浮かせる。読むだけのカード (選ばれる理由) は
             浮かせると押せると誤解されるので、線と影だけにとどめる */
          .st-workcard:hover { transform: translateY(-4px); }
          .st-workcard { will-change: transform; }
          /* 写真がゆっくり寄る。実物のサイトが「近づいてくる」ので、
             文字で説明しなくても「見に行ける」ことが伝わる */
          .st-workcard img { transition: transform 620ms cubic-bezier(.2,.7,.3,1); }
          .st-workcard:hover img { transform: scale(1.055); }
          /* 矢印が進行方向へ出る。行き先があることを、色ではなく動きで示す */
          .st-workcard svg, .st-svc-card svg { transition: transform 240ms cubic-bezier(.2,.7,.3,1); }
          .st-workcard:hover svg, .st-svc-card:hover svg { transform: translateX(4px); }
          .st-svc-card { transition: border-color 240ms ease, background 240ms ease, transform 240ms cubic-bezier(.2,.7,.3,1); }
          .st-svc-card:hover { transform: translateY(-4px); }
          .st-strip-shot img { transition: transform 620ms cubic-bezier(.2,.7,.3,1); }
          .st-strip-item:hover .st-strip-shot img { transform: scale(1.06); }
          /* ボタン。従来の opacity 0.88 は「文字まで薄くなる」= 押した手応えではなく
             要素が死んだ表示だった。浮かせて影を落とし、押せることを体で分からせる */
          .st-btn { transition: transform 200ms cubic-bezier(.2,.7,.3,1), box-shadow 200ms ease, border-color 200ms ease, background 200ms ease; }
          .st-btn-primary:hover { opacity: 1; transform: translateY(-2px); box-shadow: 0 14px 26px -14px rgba(17,24,39,0.55); }
          .st-btn-primary:active { transform: translateY(0); box-shadow: 0 6px 14px -10px rgba(17,24,39,0.5); }
          .st-btn-ghost:hover { transform: translateY(-2px); box-shadow: 0 12px 24px -18px rgba(17,24,39,0.4); }
          .st-btn-ghost:active { transform: translateY(0); }
          .st-btn-line:hover { opacity: 1; transform: translateY(-2px); box-shadow: 0 14px 26px -14px rgba(6,199,85,0.55); }
          .st-btn-line:active { transform: translateY(0); box-shadow: 0 6px 14px -10px rgba(6,199,85,0.5); }
          .st-chip { transition: border-color 160ms ease, transform 160ms cubic-bezier(.2,.7,.3,1); }
          .st-chip:hover { transform: translateY(-1px); }
          /* タブ。金の下線が中央から伸びる。今どこを見ているかが、
             色の違いだけでなく「線が育つ」動きでも分かる */
          .st-tab { position: relative; }
          .st-tab::after { content: ''; position: absolute; left: 50%; right: 50%; bottom: -2px; height: 2px;
            background: ${C.gold}; transition: left 240ms cubic-bezier(.2,.7,.3,1), right 240ms cubic-bezier(.2,.7,.3,1); }
          .st-tab:hover::after { left: 13px; right: 13px; }
          .st-tab[data-on="true"]::after { left: 0; right: 0; }
          /* 下線は ::after に一本化する。border-bottom を残すと選択中のタブだけ
             金の線が二重に太って見える (hover が無い端末では ::after を出さないので、
             従来どおり border-bottom 側が下線を担当する) */
          .st-tab[data-on="true"] { border-bottom-color: transparent; }
        }
        @media (prefers-reduced-motion: reduce) {
          .st-card, .st-workcard, .st-workcard img, .st-svc-card, .st-strip-shot img,
          .st-btn, .st-chip, .st-workcard svg, .st-svc-card svg { transition: none !important; transform: none !important; }
        }

        /* ── カーソル追従のあかり (黒地の Services だけ) ──────────────────
           座標は JS が --sx/--sy に書く。JS が動かない/触る端末では
           data-lit が付かないので、光は最初から最後まで出ない (= 素の黒地のまま)。
           光そのものは描画コストの軽い background だけで作る (filter/blur は使わない。
           セクション全面に blur を掛けるとスクロールが目に見えて落ちる)。 */
        .st-spot { position: relative; isolation: isolate; }
        .st-spot::before { content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background: radial-gradient(420px circle at var(--sx, 50%) var(--sy, 0px),
            rgba(212,169,79,0.15), rgba(212,169,79,0.05) 42%, transparent 72%);
          opacity: 0; transition: opacity 500ms ease; }
        .st-spot[data-lit]::before { opacity: 1; }
        /* 中身を光より前に出す。これが無いと ::before が本文の上に乗って字が霞む */
        .st-spot > * { position: relative; z-index: 1; }

        /* ── ヒーロー直下の実績帯 ───────────────────────────────
           制作会社のトップページで、実際に作ったものが1画面目に1枚も無かった。
           文章で「制作します」と言う代わりに、公開中のサイトの実物を流す。
           rAF は使わず CSS アニメーションだけで動かす (タブが隠れている間は
           ブラウザ側が勝手に止め、復帰時も位置が飛ばない)。 */
        .st-strip { position: relative; margin: 0 -20px; overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 40px), transparent);
                  mask-image: linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 40px), transparent); }
        /* 動かす箱に padding を付けてはいけない。translate の % は border box 基準なので、
           左右 20px を足すと 1周が 20px だけ行き過ぎ、周回のたびに帯が飛ぶ
           (端のぼかしは 40px しかないので隠しきれない)。両端は mask のぼかしで処理する。 */
        .st-strip-track { display: flex; gap: 12px; width: max-content; }
        .st-strip-item { flex-shrink: 0; width: 168px; background: none; border: none; padding: 0; cursor: pointer;
          text-align: left; font-family: ${SANS}; -webkit-tap-highlight-color: rgba(168,130,60,0.15); }
        /* span のままだと inline 扱いで aspect-ratio が効かず、帯が線に潰れる */
        .st-strip-shot { display: block; position: relative; aspect-ratio: 16 / 10; overflow: hidden; border-radius: 8px;
          border: 1px solid ${C.line}; background: ${C.alt}; transition: border-color 180ms ease; }
        .st-strip-item:hover .st-strip-shot, .st-strip-item:focus-visible .st-strip-shot { border-color: ${C.gold}; }
        .st-strip-shot img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; }
        .st-strip-name { display: block; font-size: 11.5px; color: ${C.mute}; margin-top: 7px; letter-spacing: 0.03em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media (prefers-reduced-motion: no-preference) {
          /* 半分ぶん + 隙間1つ ぶん動かすと、複製した後半が元の先頭に重なって継ぎ目が消える */
          .st-strip-track { animation: st-strip-scroll 52s linear infinite; }
          .st-strip:hover .st-strip-track, .st-strip:focus-within .st-strip-track { animation-play-state: paused; }
          @keyframes st-strip-scroll { from { transform: translate3d(0,0,0); } to { transform: translate3d(calc(-50% - 6px),0,0); } }
        }
        /* 動きを減らす設定の端末では、流さずに指でなぞる帯にする (複製は消す) */
        @media (prefers-reduced-motion: reduce) {
          .st-strip { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .st-strip::-webkit-scrollbar { display: none; }
          .st-strip-dup { display: none; }
        }

        /* ── 幅の広い章 (ホームだけ) ────────────────────────────────────
           本文中心のタブは 760px の1段組のままでよいが、ホームは制作会社の顔。
           パソコンで 760px に畳むと「スマホの画面を真ん中に置いただけ」に見え、
           両脇の空白が広いほど小さな会社に見えた。ホームの章だけ 1160px まで広げる。 */
        .st-inner.st-wide { max-width: 1160px; }

        /* ── ホームのヒーロー = 自社リール (2026-09-02 第2版) ────────────────
           旧版は 540x960 の縦型1本を画面幅いっぱいに引き伸ばしていた。iPhone では
           ほぼ等倍なので気にならないが、パソコン (1440px) では横 2.7倍に拡大され、
           1画面目が一番ぼやけていた。縦型の素材を横長の画面に敷く発想そのものが誤り。
           ・狭い画面: 縦型1本を全面に (等倍に近いので鮮明)
           ・広い画面: 縦型のまま 3 枚を「スマホの画面」の大きさで立てる。表示幅は
             最大でも 262px なので、540〜720px の素材が拡大されることは無い。
             両脇は同じ画をぼかして敷き、黒い空き地ではなく「その映像の中に居る」画面にする
             (映像タブの fm-hero と同じ考え方)。
           ・脇の2枚は広い画面でしか描かない (狭い画面では DOM に置かず、通信も発生させない) */
        .st-hero { position: relative; background: ${D.bg}; color: #FFFFFF; overflow: hidden; isolation: isolate; }
        .st-hero-amb { position: absolute; inset: -12%; z-index: 0; pointer-events: none;
          background-position: center; background-size: cover;
          filter: blur(64px) saturate(1.15) brightness(0.34); transform: scale(1.1); }
        .st-hero::before { content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background: linear-gradient(180deg, rgba(11,11,12,0.5) 0%, rgba(11,11,12,0.1) 40%, rgba(11,11,12,0.92) 100%); }
        .st-hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr; }
        /* 狭い画面: 映像が先、文字はその裾に重ねる (見出しと相談ボタンを1画面目に収める) */
        .st-hero-copy { order: 2; position: relative; z-index: 2; margin-top: -136px; padding: 0 0 36px; }
        .st-hero-reels { order: 1; position: relative; margin: 0 -20px; }
        .st-reel { position: relative; overflow: hidden; background: #000; }
        .st-reel video, .st-reel img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .st-reel-main { height: min(58dvh, 520px); }
        /* 下は文字が乗るので地の色まで落とし切る (白文字で 4.5:1 を割らせない) */
        .st-reel-main::after { content: ''; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(180deg, rgba(11,11,12,0.38) 0%, rgba(11,11,12,0) 30%, rgba(11,11,12,0.5) 62%, ${D.bg} 100%); }
        .st-reel-side { display: none; }
        .st-reel-name { display: none; }
        /* 「これは自社が作った映像である」を、映像の中で名乗る */
        .st-reel-cap { position: absolute; top: 14px; right: 14px; z-index: 2;
          display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.3); background: rgba(8,8,9,0.5);
          backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
          color: #FFFFFF; font-size: 10.5px; letter-spacing: 0.1em; line-height: 1; white-space: nowrap; }
        .st-reel-dot { width: 5px; height: 5px; border-radius: 999px; background: ${D.gold}; flex: 0 0 auto; }
        @media (prefers-reduced-motion: no-preference) {
          .st-reel-dot { animation: st-reel-pulse 2.4s ease-in-out infinite; }
          @keyframes st-reel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        }
        .st-hero-h1 { font-size: clamp(27px, 7vw, 46px); font-weight: 700; line-height: 1.38; letter-spacing: 0.02em;
          color: #FFFFFF; margin: 10px 0 0; text-shadow: 0 2px 24px rgba(0,0,0,0.5); }
        .st-hero-sub { font-size: 14.5px; line-height: 2; color: ${D.body}; margin: 16px 0 0; max-width: 520px; }
        .st-hero-cta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 22px; }
        .st-btn-dark { background: rgba(255,255,255,0.06); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.36); font-weight: 600; }
        .st-btn-dark:hover { border-color: ${D.gold}; color: ${D.gold}; }
        .st-hero-note { font-size: 12px; color: ${D.mute}; margin: 12px 0 0; line-height: 1.8; letter-spacing: 0.02em; }
        /* 数字は白い帯で別に置いていたが、ヒーローの中で名乗った方が「何者か」が1画面で分かる */
        .st-hero-stats { list-style: none; margin: 26px 0 0; padding: 20px 0 0; border-top: 1px solid ${D.line};
          display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
        .st-hero-stat b { display: block; font-family: ${SERIF}; font-size: 21px; font-weight: 700; color: #FFFFFF; letter-spacing: 0.02em; line-height: 1.3; }
        .st-hero-stat span { display: block; font-size: 11.5px; color: ${D.mute}; letter-spacing: 0.04em; margin-top: 3px; }
        @media (min-width: 960px) {
          .st-hero-grid { grid-template-columns: minmax(0, 1fr) auto; align-items: center;
            min-height: min(calc(100dvh - 112px), 760px); padding-top: 52px; padding-bottom: 60px; column-gap: 32px; }
          .st-hero-copy { order: 1; margin-top: 0; padding: 0; }
          .st-hero-reels { order: 2; margin: 0; display: flex; align-items: center; justify-content: flex-end; }
          .st-reel { border-radius: 22px; border: 1px solid rgba(255,255,255,0.16); aspect-ratio: 9 / 16;
            box-shadow: 0 44px 90px -40px rgba(0,0,0,0.95), 0 0 0 1px rgba(0,0,0,0.6); }
          /* 表示幅は素材 (540〜720px) より必ず小さい = 拡大されない */
          .st-reel-main { width: clamp(214px, 17.6vw, 252px); height: auto; z-index: 2; }
          .st-reel-main::after { background: linear-gradient(180deg, rgba(11,11,12,0.22) 0%, rgba(11,11,12,0) 26%, rgba(11,11,12,0) 66%, rgba(11,11,12,0.78) 100%); }
          .st-reel-side { display: block; width: clamp(172px, 14.2vw, 200px); transform: translateY(36px); z-index: 1; }
          .st-reel-side::after { content: ''; position: absolute; inset: 0; pointer-events: none;
            background: linear-gradient(180deg, rgba(11,11,12,0) 60%, rgba(11,11,12,0.78) 100%); }
          .st-reel-l { margin-right: -26px; }
          .st-reel-r { margin-left: -26px; }
          /* 右の1枚は左端 26px が中央の1枚の下に潜るので、名前をその分だけ右へ寄せる */
          .st-reel-r .st-reel-name { left: 44px; }
          /* 見出しは左の列 (1440px で約 476px) に 9 文字を1行で収める。54px だと「ウェブ|も、」で折れた */
          .st-hero-h1 { font-size: clamp(28px, 3.2vw, 38px); }
          .st-reel-name { display: block; position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 2; line-height: 1.5; }
          .st-reel-name b { display: block; font-family: ${SERIF}; font-size: 13px; font-weight: 700; color: #FFFFFF; }
          .st-reel-name span { display: block; font-size: 10.5px; letter-spacing: 0.14em; color: ${D.gold}; text-transform: uppercase; }
          .st-hero::before { background: linear-gradient(90deg, rgba(11,11,12,0.88) 0%, rgba(11,11,12,0.55) 48%, rgba(11,11,12,0.22) 100%); }
        }
        /* 数字4つを1行に並べるのは左の列が十分に広い時だけ (960px では「1営業|日」で折れた) */
        @media (min-width: 1200px) {
          .st-hero-stats { grid-template-columns: repeat(4, auto); justify-content: start; gap: 14px 36px; }
        }
        @media (hover: hover) and (pointer: fine) {
          .st-reel { transition: transform 460ms cubic-bezier(.2,.7,.3,1); }
          .st-reel-side:hover { transform: translateY(26px); }
        }

        /* ── 映像の実績 (ホーム) — カーソルを乗せると再生 ─────────────────
           ホームには映像制作の実績が1つも並んでいなかった (サイトの画像3枚だけ)。
           映像は poster を敷き、動画は preload="none" で置いておく。hover / focus で
           play() を呼び、動き出したら poster の上に重ねる。触る端末では hover が無いので
           押すと映像タブへ運ぶ (そこで再生できる)。 */
        .st-peek-row { display: flex; gap: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
          margin: 0 -20px; padding: 2px 20px 8px; scroll-snap-type: x mandatory; }
        .st-peek-row::-webkit-scrollbar { display: none; }
        .st-peek { flex: 0 0 auto; width: min(62vw, 220px); scroll-snap-align: center; position: relative; aspect-ratio: 9 / 16;
          border-radius: 16px; overflow: hidden; border: 1px solid ${D.line}; background: #000; padding: 0; cursor: pointer;
          text-align: left; font-family: ${SANS}; -webkit-tap-highlight-color: rgba(212,169,79,0.18); }
        .st-peek img, .st-peek video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .st-peek video { opacity: 0; transition: opacity 320ms ease; }
        .st-peek[data-playing="true"] video { opacity: 1; }
        .st-peek::after { content: ''; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(180deg, rgba(11,11,12,0) 55%, rgba(11,11,12,0.86) 100%); }
        .st-peek-meta { position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 1; }
        .st-peek-cat { display: block; font-size: 10px; letter-spacing: 0.2em; color: ${D.gold}; text-transform: uppercase; margin-bottom: 5px; }
        .st-peek-client { display: block; font-family: ${SERIF}; font-size: 13.5px; font-weight: 700; color: #FFFFFF; line-height: 1.5; }
        @media (min-width: 860px) {
          .st-peek-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 0; padding: 0; overflow: visible; }
          .st-peek { width: auto; }
        }
        @media (hover: hover) and (pointer: fine) {
          .st-peek { transition: transform 420ms cubic-bezier(.2,.7,.3,1), border-color 240ms ease; }
          .st-peek:hover { transform: translateY(-6px); border-color: ${D.goldLine}; }
        }

        /* ── 選ばれる理由 / 制作の流れ / 実績 — 広い画面では横に並べる ── */
        /* 誰が撮るか。暗地のまま、写真(3:4)と文章の2段組。 */
        .st-director { background: ${D.bg}; padding: clamp(44px, 6vw, 84px) 0; border-top: 1px solid ${D.line}; }
        .st-director-grid { display: grid; grid-template-columns: 1fr; gap: 26px; align-items: center; }
        .st-director-photo { margin: 0; width: min(100%, 320px); aspect-ratio: 3 / 4; border-radius: 12px; overflow: hidden; background: ${D.raise}; border: 1px solid ${D.line}; }
        .st-director-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .st-director-sig { display: flex; flex-direction: column; gap: 4px; margin-top: 22px; padding-left: 14px; border-left: 2px solid ${D.gold}; font-size: 13px; color: ${D.mute}; }
        .st-director-sig b { font-size: 17px; color: ${D.ink}; }
        .st-textlink { background: none; border: 0; padding: 0; margin-top: 8px; color: ${D.gold}; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
        .st-textlink:hover { text-decoration: underline; }
        @media (min-width: 860px) {
          .st-director-grid { grid-template-columns: 380px minmax(0, 1fr); gap: 56px; }
          .st-director-photo { width: 100%; }
        }
        .st-reasons { display: grid; gap: 14px; }
        @media (min-width: 860px) { .st-reasons { grid-template-columns: repeat(3, 1fr); } }
        .st-process { display: grid; gap: 12px; list-style: none; padding: 0; margin: 0; counter-reset: none; }
        @media (min-width: 640px) { .st-process { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 960px) { .st-process { grid-template-columns: repeat(3, 1fr); } }
        .st-step { display: flex; flex-direction: column; gap: 8px; background: #FFFFFF; border: 1px solid ${C.line}; border-radius: 14px; padding: 20px 20px 22px; }
        .st-step-no { font-family: ${SERIF}; font-size: 24px; font-weight: 700; color: ${C.goldText}; letter-spacing: 0.04em; line-height: 1; }
        .st-webworks { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
        @media (min-width: 860px) { .st-webworks { grid-template-columns: repeat(3, 1fr); gap: 18px; } }

        /* ── 実績タブの先頭に置く映像実績 (2026-08-31 新設) ────────────────
           主力は映像制作なのに、実績タブにはサイトの画像しか無かった。
           ここでは映像は再生せず静止画で見せ、押すと映像タブへ運ぶ
           (再生できない絵に再生の印を付けない)。 */
        .st-fw { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: center; }
        /* 2026-09-01: 元は2列grid (画像268px + 残り全部1fr) で、右列が文字量より広くstretchし、
           結果として画像だけ画面の左端に寄って見えた (行自体は中央でも、画像の視覚重心が中央からズレる)。
           中身の実寸で並べてからクラスタごと中央寄せする */
        @media (min-width: 860px) { .st-fw { display: flex; justify-content: center; align-items: center; gap: 40px; } }
        .st-fw-shot { position: relative; width: min(66vw, 258px); margin: 0 auto; aspect-ratio: 9 / 16;
          border-radius: 12px; overflow: hidden; border: 1px solid ${D.line}; background: #000; padding: 0;
          cursor: pointer; box-shadow: 0 34px 70px -44px rgba(0,0,0,0.9); }
        @media (min-width: 860px) { .st-fw-shot { width: 268px; margin: 0; flex: 0 0 auto; } }
        /* flex-basis:auto な文字量依存の箱は、中身が折り返せる文章だと残り幅いっぱいまで
           伸びてしまう(shrink-to-fitが効かない既知の挙動)。幅を固定値で明示して回避する */
        @media (min-width: 860px) { .st-fw-info { width: 400px; max-width: 400px; flex: 0 0 auto; } }
        .st-fw-shot img, .st-fw-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        /* 横スワイプの棚。中身が画面に収まる幅のとき(PC)は左端に貼り付かせず中央に寄せる。
           justify-content:center は overflow するとスクロールしても先頭が取り出せなくなるので使わない。
           fit-content + max-width:100% + margin auto なら、収まる時だけ中央・溢れる時は素直に横スクロール。 */
        .st-fw-row { display: flex; gap: 11px; overflow-x: auto; -webkit-overflow-scrolling: touch;
          scrollbar-width: none; padding: 2px 20px 12px; scroll-snap-type: x mandatory;
          box-sizing: border-box; width: fit-content; max-width: 100%; margin-inline: auto; }
        .st-fw-row::-webkit-scrollbar { display: none; }
        .st-fw-item { flex: 0 0 auto; width: 126px; scroll-snap-align: center; background: none; border: none;
          padding: 0; cursor: pointer; text-align: left; font-family: ${SANS};
          -webkit-tap-highlight-color: rgba(212,169,79,0.18); }
        .st-fw-thumb { display: block; position: relative; width: 100%; aspect-ratio: 9 / 16; border-radius: 10px;
          overflow: hidden; border: 1px solid ${D.line}; background: #000; transition: border-color 180ms ease; }
        .st-fw-item:hover .st-fw-thumb, .st-fw-item:focus-visible .st-fw-thumb { border-color: ${D.goldLine}; }
        .st-fw-name { display: block; font-size: 11.5px; color: ${D.body}; margin-top: 8px; line-height: 1.6; }

        /* ── ご依頼いただけること (暗部) ── */
        .st-svc { display: grid; gap: 12px; }
        @media (min-width: 700px) { .st-svc { grid-template-columns: 1fr 1fr; } }
        .st-svc-card { display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box;
          background: ${D.raise}; border: 1px solid ${D.line}; border-radius: 14px; padding: 20px 18px;
          cursor: pointer; text-align: left; font-family: ${SANS}; color: ${D.body};
          transition: border-color 180ms ease, background 180ms ease; }
        .st-svc-card:hover, .st-svc-card:focus-visible { border-color: ${D.goldLine}; background: #1A1A1D; }
        .st-svc-card[data-featured="true"] { border-color: ${D.goldLine}; }

        /* ヒーローに fade-up の入場アニメーションは付けない。
           opacity:0 から始める演出は、アニメーションのタイムラインが進まない状況
           (ページが隠れたまま読み込まれた場合など) で見出しが消えたままになる。
           トップページの最重要要素を、たかだか0.6秒の演出のために消える可能性に晒さない。 */
      `}</style>

      {/* ヘッダー */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.line}`, paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1160, margin: '0 auto', padding: '15px 20px 9px' }}>
          <button onClick={() => go('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'inline-flex' }}>
            <img src="/core-studio-logo.png" alt="CORE Studio" style={{ height: 22, width: 'auto', display: 'block' }} />
          </button>
          <a href="/corp" style={{ fontSize: 12, color: C.mute, textDecoration: 'none', letterSpacing: '0.05em', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>CORE公式サイト</a>
        </div>
        <nav className="st-tabbar" style={{ maxWidth: 1160, margin: '0 auto' }} aria-label="スタジオ内メニュー">
          {TABS.map(t => (
            <button key={t.id} className="st-tab" data-on={tab === t.id} onClick={() => go(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'home' && <HomeTab go={go} />}
        {tab === 'film' && (
          <Suspense fallback={<div style={{ background: D.bg, minHeight: '60dvh' }} />}>
            <FilmTab />
          </Suspense>
        )}
        {tab === 'plans' && <PlansTab go={go} />}
        {tab === 'dev' && <DevTab go={go} />}
        {tab === 'care' && <CareTab />}
        {tab === 'works' && <WorksTab go={go} />}
        {tab === 'about' && <AboutTab />}
        {tab === 'contact' && <ContactTab />}
      </main>

      {/* フッター */}
      <footer style={{ borderTop: `1px solid ${C.line}`, background: C.alt, padding: '32px 20px calc(32px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <img src="/core-studio-logo.png" alt="CORE Studio" style={{ height: 24, width: 'auto', display: 'block' }} />
        </div>
        <a href={`mailto:${STUDIO.email}`} style={{ fontSize: 12.5, color: C.mute, textDecoration: 'underline', minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 8px' }}>{STUDIO.email}</a>
        <div style={{ fontSize: 12.5, color: C.mute, marginTop: 10, letterSpacing: '0.04em', lineHeight: 1.9 }}>
          株式会社CORE<br />代表 井出直毅
        </div>
      </footer>
    </div>
  );
}

// ---- 相談導線 (どのタブでも入口はLINEに統一する) ----
const LineCta = ({ label = CONTACT.lineLabel, where }: { label?: string; where: string }) => (
  <a className="st-btn st-btn-line" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
    onClick={() => track('studio_line_cta', { where })}>
    <IconChat /> {label}
  </a>
);

// ---- 構造化データ (提供サービスの一覧。価格は film.ts / plans.ts の実値に合わせる)
// FAQPage は STUDIO_FAQ (HomeTab の <FaqList> だけ) が画面に出ているタブでのみ足す。
// film タブは同じ場所に別の質問 (FILM_FAQ) を出しているので、ここでは足さず
// FilmTab 側で自分の FAQ を注入する。plans/dev/care/works/about/contact には
// 画面上どこにも FAQ が無いので、FAQPage は載せない。 ----
function studioJsonLd(tab: TabId) {
  return {
    '@context': 'https://schema.org',
    '@graph': tab === 'home' ? [studioServiceLd(), studioFaqLd()] : [studioServiceLd()],
  };
}

/** ホームに出しているものと同じ質問・同じ答えだけを渡す (画面に無い Q&A を構造化データに書かない) */
function studioFaqLd() {
  return {
    '@type': 'FAQPage',
    mainEntity: STUDIO_FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

function studioServiceLd() {
  return {
    '@type': 'ProfessionalService',
    name: 'CORE Studio',
    url: STUDIO.url,
    email: STUDIO.email,
    areaServed: 'JP',
    description: SEO.default.description,
    makesOffer: [
      {
        '@type': 'Offer',
        name: 'AI動画制作・ショートドラマ制作代行',
        description: 'ショートドラマ・ブランドムービー・SNS縦型動画・CMの企画から脚本・映像制作・編集・字幕・SNS最適化までの一貫制作。',
        priceCurrency: 'JPY',
        price: '49800',
        url: `${STUDIO.url}#film`,
      },
      {
        '@type': 'Offer',
        name: 'ウェブサイト制作',
        description: 'LPからコーポレートサイト、予約・決済を備えた本格サイトまでの制作。',
        priceCurrency: 'JPY',
        price: '50000',
        url: `${STUDIO.url}#plans`,
      },
      {
        '@type': 'Offer',
        name: 'システム受託開発',
        description: 'MVPからSaaS・基幹システムまでのアプリケーション開発。',
        priceCurrency: 'JPY',
        price: '500000',
        url: `${STUDIO.url}#dev`,
      },
    ],
  };
}

// ---- ヒーロー直下の実績帯 ----
// 制作会社のトップページなのに、1画面目に実際に作ったものが1枚も無く、
// 説明の文章だけが並んでいた。公開中のサイトの実物をここで流す。
// 同じ並びを2度描いて継ぎ目のない周回にする (後半は読み上げ・タブ移動の対象から外す)。
function WorksStrip({ go }: { go: (t: TabId) => void }) {
  const half = WORKS.map((w, i) => ({ w, key: `a-${w.id}`, dup: false, i }));
  const dup = WORKS.map((w, i) => ({ w, key: `b-${w.id}`, dup: true, i }));
  return (
    <div style={{ marginTop: 34 }}>
      <div className="st-strip">
        <div className="st-strip-track">
          {[...half, ...dup].map(({ w, key, dup: isDup, i }) => (
            <button
              key={key}
              type="button"
              className={`st-strip-item${isDup ? ' st-strip-dup' : ''}`}
              aria-hidden={isDup || undefined}
              tabIndex={isDup ? -1 : undefined}
              onClick={() => go('works')}
            >
              <span className="st-strip-shot">
                {/* 先頭3枚だけ先に読む。残りは帯が回ってくるまで取りに行かない */}
                <img src={thumbOf(w)} alt={isDup ? '' : `${w.name} のトップページ`}
                  loading={!isDup && i < 3 ? 'eager' : 'lazy'} decoding="async" width={480} height={300} />
              </span>
              <span className="st-strip-name">{w.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: C.mute, letterSpacing: '0.03em' }}>いずれも公開中のサイト・システムです</span>
        <button onClick={() => go('works')}
          style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.ink }}>
          {WORKS.length}件の実績を見る <IconArrow color={C.gold} />
        </button>
      </div>
    </div>
  );
}

// ---- ヒーローの映像 (3本とも当社の制作。名前はどれも実際のクライアント) ----
// a: 自社リール (1080p の原本から 720x1280 に切り出した 16 秒・8 カット)。狭い画面ではこれ1本を全面に出す
// b / c: 広い画面の両脇。540x960 で十分 (表示幅は最大 212px = 2倍画面でも 424px)
const HERO_REELS = {
  main: { src: '/studio/film/hero-a.mp4', poster: '/studio/film/hero-a.jpg', name: 'CORE Studio Showreel', note: 'Showreel' },
  left: { src: '/studio/film/hero-b.mp4', poster: '/studio/film/hero-b.jpg', name: 'Laguna Beauté', note: 'Product' },
  right: { src: '/studio/film/hero-c.mp4', poster: '/studio/film/hero-c.jpg', name: 'JRC 日本記録協会', note: 'Brand Film' },
} as const;

// 広い画面かどうか。脇の2枚を「CSS で隠す」のではなく「描かない」ために使う
// (display:none でも <video> は preload の分を取りに行く)。
function useWide(min = 960) {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(`(min-width: ${min}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(`(min-width: ${min}px)`);
    if (!mq) return;
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [min]);
  return wide;
}

function HeroReel({ r, kind, autoplay }: { r: { src: string; poster: string; name: string; note: string }; kind: 'main' | 'l' | 'r'; autoplay: boolean }) {
  const cls = kind === 'main' ? 'st-reel st-reel-main' : `st-reel st-reel-side st-reel-${kind}`;
  const ref = useRef<HTMLVideoElement>(null);
  // 自社リール(main)はクライアント案件の素材を編集で使っているので、脇の個別リールと
  // 同じカットが混ざっている。3本とも読み込み完了と同時に0秒から再生するため、
  // そのカットが毎回同じ瞬間に重なって見えていた(実測: Laguna Beautéのボトルが
  // main と left に同時に映る)。読み込めた時点で位相をランダムにずらして揃わないようにする。
  // ★1回だけずらすのでは足りない。ループのたびに native の loop で0秒へ揃えて戻ると、
  // 揃った位相がそのまま固定される場合がある(実測: hero-bはボトルの尺が長く、
  // ランダムな位置がそのボトル区間に重なりやすい)。loop属性を使わず、ループのたびに
  // 毎回ランダムな位置へ飛ばして再生し直し、位相を絶えず揺らし続ける。
  useEffect(() => {
    const el = ref.current;
    if (!el || !autoplay) return;
    const desync = () => {
      if (el.duration > 0 && Number.isFinite(el.duration)) el.currentTime = Math.random() * el.duration;
    };
    const onEnded = () => { desync(); void el.play().catch(() => {}); };
    if (el.readyState >= 1 && el.duration) desync();
    else el.addEventListener('loadedmetadata', desync, { once: true });
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('loadedmetadata', desync);
      el.removeEventListener('ended', onEnded);
    };
  }, [autoplay]);
  return (
    <div className={cls}>
      <video ref={ref} src={r.src} poster={r.poster} autoPlay={autoplay} muted playsInline preload="metadata" aria-hidden />
      {kind === 'main' && <span className="st-reel-cap"><span className="st-reel-dot" aria-hidden />CORE STUDIO 制作実績より</span>}
      <span className="st-reel-name"><span>{r.note}</span><b>{r.name}</b></span>
    </div>
  );
}

// ---- 映像の実績 1枚 (hover / focus で再生) ----
function FilmPeek({ w, onOpen }: { w: (typeof FILM_WORKS)[number]; onOpen: () => void }) {
  const v = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const play = () => { const el = v.current; if (!el) return; void el.play().catch(() => {}); };
  const stop = () => { const el = v.current; if (!el) return; el.pause(); el.currentTime = 0; setPlaying(false); };
  return (
    <button type="button" className="st-peek" data-playing={playing} onClick={onOpen}
      onPointerEnter={e => { if (e.pointerType === 'mouse') play(); }} onPointerLeave={stop} onFocus={play} onBlur={stop}
      aria-label={`${w.client} の映像を見る`}>
      {w.poster && <img src={w.poster} alt="" loading="lazy" decoding="async" />}
      {w.videoUrl && <video ref={v} src={w.videoUrl} muted loop playsInline preload="none" aria-hidden onPlaying={() => setPlaying(true)} />}
      <span className="st-peek-meta">
        <span className="st-peek-cat">{w.category}</span>
        <span className="st-peek-client">{w.client}</span>
      </span>
    </button>
  );
}

// ============================================================
// ホーム
// ============================================================
function HomeTab({ go }: { go: (t: TabId) => void }) {
  const spotRef = useSpotlight<HTMLElement>();
  const wide = useWide();
  // 動きを減らす設定の端末では自動再生しない (poster が出たままになる)
  const autoplay = useMemo(() => !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches), []);
  return (
    <div>
      {/* ヒーロー (2026-09-02 第2版)。設計の理由は上の CSS (.st-hero) に書いた。 */}
      <section className="st-hero" aria-label="CORE Studio の制作実績より">
        <div className="st-hero-amb" style={{ backgroundImage: `url(${HERO_REELS.main.poster})` }} aria-hidden />
        <div className="st-inner st-wide st-hero-grid">
          <div className="st-hero-copy">
            <div className="st-label" style={{ color: D.gold }}>Film / Web / Development</div>
            <h1 className="st-serif st-hero-h1">映像も、ウェブも、<br />成果から逆算してつくる。</h1>
            <p className="st-hero-sub">
              AIプロダクトを自社で開発・運営する制作スタジオです。映像制作・ウェブ制作・受託開発・公開後の運用まで、ひとつの体制で担当します。
            </p>
            <div className="st-hero-cta">
              <LineCta where="home-hero" />
              <button className="st-btn st-btn-dark" onClick={() => go('contact')}>6つの質問で概算を出す</button>
            </div>
            <p className="st-hero-note">{CONTACT.lineNote}</p>
            <ul className="st-hero-stats">
              {STATS.map(s => (
                <li key={s.label} className="st-hero-stat"><b>{s.value}</b><span>{s.label}</span></li>
              ))}
            </ul>
          </div>
          <div className="st-hero-reels">
            {wide && <HeroReel r={HERO_REELS.left} kind="l" autoplay={autoplay} />}
            <HeroReel r={HERO_REELS.main} kind="main" autoplay={autoplay} />
            {wide && <HeroReel r={HERO_REELS.right} kind="r" autoplay={autoplay} />}
          </div>
        </div>
      </section>

      {/* 映像の実績 — ヒーローの黒地をそのまま続けて、作ったものを先に見せる */}
      <Band dark wide pad="clamp(48px, 6vw, 80px) 0">
        <H2 dark en="Film Works" sub="商品広告、ブランドムービー、イベント告知、ショートドラマまで。いずれも当社の制作です。カーソルを乗せると再生、押すと映像制作のページへ進みます。">映像の制作実績</H2>
        <div className="st-peek-row">
          {FILM_WORKS.slice(0, 4).map(w => (
            <FilmPeek key={w.id} w={w} onOpen={() => { track('studio_home_film_peek', { id: w.id }); go('film'); }} />
          ))}
        </div>
        <div style={{ marginTop: 22, display: 'flex', gap: '12px 22px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="st-btn st-btn-dark" onClick={() => go('film')}>映像制作の料金と実績を見る <IconArrow color={D.gold} /></button>
          {/* 「いくら・いつ・何回直せるか」を映像の隣で読めるようにする。数字は film.ts の TRIAL からだけ取る (直打ち禁止) */}
          {FILM_PLANS[0] && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9, color: D.body }}>
              初めての1本は <b style={{ color: D.ink }}>{FILM_PLANS[0].price}</b>（{FILM_PLANS[0].unit}）・初稿まで <b style={{ color: D.ink }}>{FILM_PLANS[0].delivery}</b>・修正 <b style={{ color: D.ink }}>{FILM_PLANS[0].spec.find(x => x.label === '修正')?.value ?? '2回'}</b>
            </p>
          )}
        </div>
      </Band>

      {/* 誰が撮るか — 匿名の制作会社に見えないよう、撮る人の顔と理由を置く (2026-09-02) */}
      <section className="st-director" aria-label="誰が撮るか">
        <Reveal className="st-inner st-wide st-director-grid">
          <figure className="st-director-photo">
            <picture>
              <source srcSet="/ceo-naoki-ide-v2.webp" type="image/webp" />
              <img src="/ceo-naoki-ide-v2.jpg" alt={`${COMPANY.repName} — ${COMPANY.repTitle}`} width={675} height={900} loading="lazy" decoding="async" />
            </picture>
          </figure>
          <div className="st-director-copy">
            <div className="st-label" style={{ color: D.gold, marginBottom: 14 }}>Who makes it</div>
            <h2 className="st-serif" style={{ fontSize: 'clamp(23px, 5.6vw, 34px)', fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.03em', color: D.ink, margin: 0 }}>
              企画から公開後の運用まで、<br />ひとつの窓口で担当します。
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 2.1, color: D.body, margin: '18px 0 0', maxWidth: 560 }}>
              株式会社COREは、神戸を拠点に、映像制作・Webサイト制作・システム開発を行う制作会社です。
              ご相談から企画・構成、撮影・編集、公開後の運用まで、代表が一貫して窓口を担当します。
              途中で担当者が変わらないため、最初にお聞きした意図が、そのまま最終形まで残ります。
            </p>
            <p style={{ fontSize: 14.5, lineHeight: 2.1, color: D.body, margin: '14px 0 0', maxWidth: 560 }}>
              制作は納品で終わりではありません。公開から2週間後に、再生数や反応をご一緒に確認する時間をいただき、
              何が伝わり、何が伝わらなかったかを整理します。その結果が、次の一手を決める材料になります。
            </p>
            <div className="st-director-sig">
              <b className="st-serif">{COMPANY.repName}</b>
              <span>{COMPANY.repTitle}</span>
              <button type="button" className="st-textlink" onClick={() => go('about')}>会社案内を読む <IconArrow color={D.gold} /></button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 公開中のサイト・システムの帯 — 「制作します」と書く代わりに実物を流す */}
      <Band wide pad="30px 0 44px">
        <WorksStrip go={go} />
      </Band>

      {/* ご依頼いただけること — 白基調のサイトの中で、ここだけ暗部に落として章の違いを見せる。
          以前はここが映像制作だけの帯で、サイト制作・受託開発・運用はタブを開くまで存在が分からず、
          ホーム全体で価格が1円も出ていなかった。4つの領域と「いくらから」をこの1章にまとめる。 */}
      <section ref={spotRef} className="st-spot" style={{ background: D.bg, padding: 'clamp(48px, 6vw, 84px) 0' }}>
        <Reveal className="st-inner st-wide">
          <div className="st-label" style={{ color: D.gold, marginBottom: 14 }}>Services</div>
          <h2 className="st-serif" style={{ fontSize: 'clamp(23px, 6.2vw, 36px)', fontWeight: 700, lineHeight: 1.55, color: D.ink, margin: 0 }}>
            映像から、サイト、システム、<br />そのあとの運用まで。
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 2.05, color: D.body, margin: '18px 0 26px', maxWidth: 580 }}>
            4つの領域を、ひとつの体制で担当します。金額はご契約時に確定し、以後の追加費用はいただきません。
          </p>
          {/* button の中身は span だけで組む (p / div は button の内容モデルに入らない) */}
          <div className="st-svc">
            {SERVICE_LINES.map(s => (
              <button key={s.tab} className="st-svc-card" data-featured={s.tab === 'film'} onClick={() => go(s.tab)}>
                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span>
                    <span className="st-label" style={{ color: D.gold, fontSize: 11, letterSpacing: '0.2em', display: 'block', marginBottom: 7 }}>{s.en}</span>
                    <span className="st-serif" style={{ fontSize: 19, fontWeight: 700, color: D.ink }}>{s.name}</span>
                  </span>
                  <span className="st-serif" style={{ fontSize: 17, fontWeight: 700, color: D.gold, flexShrink: 0, whiteSpace: 'nowrap' }}>{s.from}</span>
                </span>
                {/* 金額だけ出して条件を隠さない (「〜から」が何のことか、その場で読めるようにする) */}
                <span style={{ display: 'block', fontSize: 12.5, color: D.mute, lineHeight: 1.85, letterSpacing: '0.02em', marginTop: -2 }}>{s.fromNote}</span>
                {/* 最安プランだけに付く除外は、金額と同じ画面で読めないと意味がない */}
                {s.fromCaveat && (
                  <span style={{ display: 'block', fontSize: 12.5, color: D.gold, lineHeight: 1.85, letterSpacing: '0.02em', borderLeft: `2px solid ${D.goldLine}`, paddingLeft: 10 }}>
                    {s.fromCaveat}
                  </span>
                )}
                <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.95, color: D.body }}>{s.lead}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: D.ink, marginTop: 'auto', paddingTop: 4 }}>
                  {s.name}を見る <IconArrow color={D.gold} />
                </span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: D.mute, lineHeight: 1.9, margin: '18px 0 0' }}>
            {CONTACT.lineNote}
          </p>
        </Reveal>
      </section>

      {/* 選ばれる理由 */}
      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="Why CORE" sub="自社プロダクトの開発・運営で培った実践知を、貴社の案件に投入します。">COREが選ばれる理由</H2>
        <div className="st-reasons">
          {REASONS.map((r, i) => (
            <div key={r.id} className="st-card">
              <span className="st-serif" style={{ display: 'block', fontSize: 15, fontWeight: 700, color: C.goldText, marginBottom: 10 }}>{String(i + 1).padStart(2, '0')}</span>
              <div className="st-serif" style={{ fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.6 }}>{r.title}</div>
              <p style={{ fontSize: 14, lineHeight: 2, color: C.body, margin: '8px 0 0' }}>{r.body}</p>
            </div>
          ))}
        </div>
      </Band>

      {/* 制作の流れ */}
      <Band wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="Process" sub="お見積り時に金額を確定し、以後の追加費用はいただきません。各工程の進捗は随時ご報告します。">制作の流れ</H2>
        <ol className="st-process">
          {PROCESS.map(p => (
            <li key={p.no} className="st-step">
              <span className="st-step-no">{p.no}</span>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: C.ink }}>{p.title}</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.9, color: C.body, margin: 0 }}>{p.body}</p>
            </li>
          ))}
        </ol>
      </Band>

      {/* 実績ダイジェスト */}
      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="Web Works" sub="いずれも公開中のサイト・システムです。実物をご確認いただけます。">サイト・システムの制作実績</H2>
        {/* 実物のトップページで語る (文字カード廃止) */}
        <div className="st-webworks">
          {WORKS.slice(0, 3).map(w => (
            <a key={w.id} href={w.url} target="_blank" rel="noopener noreferrer" className="st-card st-workcard" style={{ textDecoration: 'none', padding: 0, overflow: 'hidden' }}>
              <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
                <img src={w.img} alt={`${w.name} のトップページ`} loading="lazy"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
              </div>
              <div style={{ padding: '12px 14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div className="st-label" style={{ fontSize: 10, marginBottom: 4 }}>{w.category}</div>
                  <div className="st-serif" style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{w.name}</div>
                </div>
                <IconArrow color={C.gold} />
              </div>
            </a>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <button className="st-btn st-btn-ghost" onClick={() => go('works')}>{WORKS.length}件の実績をすべて見る</button>
        </div>
      </Band>

      {/* よくあるご質問 — 相談ボタンの直前に置く。
          発注前に確認したいこと (無料の範囲・実費・支払い・NDA) は、
          これまでサイト制作のプランカードを開かないと読めなかった。 */}
      <Band wide pad="clamp(52px, 6vw, 84px) 0">
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <H2 en="FAQ" sub="ご相談の前に多くいただくご質問です。ここに無いことも、そのままお尋ねください。">よくあるご質問</H2>
          <FaqList items={STUDIO_FAQ} />
        </div>
      </Band>

      {/* CTA */}
      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <div style={{ border: `1px solid ${C.goldLine}`, borderRadius: 14, padding: 'clamp(36px, 5vw, 56px) 22px', textAlign: 'center', background: '#FFFFFF', maxWidth: 820, margin: '0 auto' }}>
          <div className="st-label" style={{ marginBottom: 12 }}>Contact</div>
          <div className="st-serif" style={{ fontSize: 21, fontWeight: 700, color: C.ink, lineHeight: 1.7 }}>まずは、お気軽にご相談ください。</div>
          <p style={{ fontSize: 13.5, color: C.body, margin: '10px 0 22px', lineHeight: 2 }}>
            6つの質問に答えるだけで、概算のお見積りをその場でご確認いただけます。
          </p>
          <LineCta where="home-bottom" />
          <div style={{ marginTop: 12 }}>
            <button className="st-btn st-btn-ghost" onClick={() => go('contact')}>先に概算を知る</button>
          </div>
          <Note>{CONTACT.lineNote}</Note>
        </div>
      </Band>
    </div>
  );
}

// ---- 開閉する Q&A (プランカードの中と同じ手ざわりに揃える) ----
// 1問目だけ開いておく。全部閉じた状態だと「質問の見出しが並んだだけ」に見え、
// ここに答えがあること自体が伝わらない。
function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="st-card" style={{ padding: '6px 22px' }}>
      {items.map((f, i) => (
        <div key={f.q} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.line}` }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            style={{ width: '100%', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              padding: '14px 0', fontSize: 14, fontWeight: 600, color: C.ink, fontFamily: SANS,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, lineHeight: 1.7 }}>
            <span>{f.q}</span>
            <span style={{ color: C.goldText, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{open === i ? '−' : '+'}</span>
          </button>
          {open === i && (
            <p style={{ fontSize: 13.5, lineHeight: 2, color: C.body, margin: '0 0 16px' }}>{f.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// サイト制作 4プラン
// ============================================================
function PlanCard({ p }: { p: ProductionPlan }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  return (
    <div className={`st-card${p.featured ? ' st-card-featured' : ''}`}>
      {p.featured && <div className="st-label" style={{ fontSize: 10.5, marginBottom: 10 }}>Recommended — 標準プラン</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div className="st-serif" style={{ fontSize: 21, fontWeight: 700, letterSpacing: '0.06em', color: C.ink }}>{p.name}</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{p.price}</div>
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: '8px 0 10px', lineHeight: 1.8 }}>{p.lead}</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: '0 0 12px', color: C.body }}>{p.scope}</p>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: C.mute, marginBottom: 16, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        <span>納期の目安 — <strong style={{ color: C.ink, fontWeight: 600 }}>{p.duration}</strong></span>
        <span>規模 — <strong style={{ color: C.ink, fontWeight: 600 }}>{p.pages}</strong></span>
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 8 }}>含まれるもの</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {p.includes.map(i => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{i}</li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 14, background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '11px 14px', fontSize: 13, lineHeight: 1.9, color: C.body }}>
        <span style={{ color: C.ink, fontWeight: 600 }}>こんな貴社に — </span>{p.bestFor}
      </div>
      <div style={{ marginTop: 14 }}>
        {p.faq.map((f, i) => (
          <div key={f.q} style={{ borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{ width: '100%', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '10px 0', fontSize: 13.5, color: C.ink, fontFamily: SANS, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>Q. {f.q}</span><span style={{ color: C.goldText, fontSize: 16, lineHeight: 1 }}>{openFaq === i ? '−' : '+'}</span>
            </button>
            {openFaq === i && <p style={{ fontSize: 13, lineHeight: 1.9, color: C.body, margin: '0 0 12px' }}>{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlansTab({ go }: { go: (t: TabId) => void }) {
  const [sel, setSel] = useState(1); // 既定は Core
  const p = PRODUCTION_PLANS[sel];
  return (
    <Band>
      <H2 en="Website" sub="1ページのLPから、予約・決済を備えた本格サイトまで。いずれのプランも、ご契約時に金額を確定し、以後の追加費用はいただきません。">サイト制作 — 4つのプラン</H2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {PRODUCTION_PLANS.map((pp, i) => (
          <button key={pp.id} className="st-chip" data-on={sel === i} onClick={() => setSel(i)}>
            {pp.name}<span style={{ marginLeft: 6, fontSize: 12, opacity: 0.75 }}>{pp.price}</span>
          </button>
        ))}
      </div>
      <PlanCard p={p} />
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <LineCta label="このプランをLINEで相談する" where="plans" />
        <div style={{ marginTop: 12 }}>
          <button className="st-btn st-btn-ghost" onClick={() => go('contact')}>先に概算を知る</button>
        </div>
        <Note>{CONTACT.lineNote}</Note>
      </div>
    </Band>
  );
}

// ============================================================
// 受託開発 4Tier
// ============================================================
function TierCard({ t }: { t: DevTier }) {
  return (
    <div className="st-card">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div className="st-serif" style={{ fontSize: 21, fontWeight: 700, letterSpacing: '0.06em', color: C.ink }}>{t.name}</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{t.price}</div>
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: '8px 0 10px', lineHeight: 1.8 }}>{t.lead}</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: '0 0 12px', color: C.body }}>{t.scope}</p>
      <div style={{ fontSize: 12.5, color: C.mute, marginBottom: 14, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        期間の目安 — <strong style={{ color: C.ink, fontWeight: 600 }}>{t.duration}</strong>
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 8 }}>開発例</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {t.examples.map(e => (
            <li key={e} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{e}</li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 14, background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '11px 14px', fontSize: 13, lineHeight: 1.9, color: C.body }}>
        <span style={{ color: C.ink, fontWeight: 600 }}>価格の考え方 — </span>{t.pricing}
      </div>
    </div>
  );
}

function DevTab({ go }: { go: (t: TabId) => void }) {
  const [sel, setSel] = useState(0);
  return (
    <Band>
      <H2 en="Development" sub={DEV_LEAD}>受託開発 — 4つのTier</H2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {DEV_TIERS.map((t, i) => (
          <button key={t.id} className="st-chip" data-on={sel === i} onClick={() => setSel(i)}>{t.name}</button>
        ))}
      </div>
      <TierCard t={DEV_TIERS[sel]} />
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <LineCta label="開発についてLINEで相談する" where="dev" />
        <div style={{ marginTop: 12 }}>
          <button className="st-btn st-btn-ghost" onClick={() => go('contact')}>先に概算を知る</button>
        </div>
        <Note>要件が固まっていない段階からのご相談も承ります。</Note>
      </div>
    </Band>
  );
}

// ============================================================
// 運用プラン
// ============================================================
function CareTab() {
  return (
    <Band>
      <H2 en="Maintenance" sub="公開はゴールではなくスタートです。アクセスデータをもとに、貴社サイトの成果を継続的に高めます。">運用 — 月額プラン</H2>
      <div style={{ display: 'grid', gap: 14 }}>
        {CARE_PLANS.map(cp => (
          <div key={cp.id} className="st-card">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{cp.name}</div>
              <div className="st-serif" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{cp.price}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: '8px 0 12px', lineHeight: 1.8 }}>{cp.lead}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {cp.includes.map(i => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <LineCta label="運用についてLINEで相談する" where="care" />
        <Note>他社で制作されたサイトの運用のみのご依頼も承ります。</Note>
      </div>
    </Band>
  );
}

// ============================================================
// Works
// ============================================================
// ---- 実績タブの先頭 = 映像制作の実績 ----
// 主力商品は映像制作。実績タブがサイトの画像だけで始まっていたのを、先頭に映像を置いた。
function FilmWorksBand({ go }: { go: (t: TabId) => void }) {
  const [lead, ...rest] = FILM_WORKS;
  if (!lead) return null;
  const openFilm = () => { track('studio_works_to_film', { from: 'works-tab' }); go('film'); };

  return (
    <section style={{ background: D.bg, padding: '46px 0 40px' }}>
      <Reveal className="st-inner">
        <H2 dark en="Film" sub="商品広告・ブランドムービー・ショートドラマまで。すべて当社が制作し、実際に納品した映像です。">映像制作の実績</H2>
        <div className="st-fw">
          <button type="button" className="st-fw-shot" onClick={openFilm}
            aria-label={`${lead.client} の制作事例を映像制作のページで見る`}>
            {lead.poster && <img src={lead.poster} alt={`${lead.client} の制作事例`} loading="lazy" />}
          </button>
          <div className="st-fw-info">
            <span className="st-label" style={{ color: D.gold, fontSize: 10.5 }}>{lead.category}</span>
            <h3 className="st-serif" style={{ fontSize: 'clamp(20px, 5vw, 27px)', fontWeight: 700, color: D.ink, lineHeight: 1.5, margin: '11px 0 0' }}>{lead.client}</h3>
            <p style={{ fontSize: 13.5, lineHeight: 2.05, color: D.body, margin: '12px 0 18px', maxWidth: 460 }}>{lead.purpose}</p>
            <button className="st-btn" onClick={openFilm}
              style={{ background: D.gold, color: '#17130A', border: `1px solid ${D.gold}`, fontWeight: 700 }}>
              映像を再生して見る
            </button>
          </div>
        </div>
      </Reveal>
      {rest.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div className="st-fw-row">
            {rest.map(w => (
              <button key={w.id} type="button" className="st-fw-item" onClick={openFilm}
                aria-label={`${w.client} の制作事例を映像制作のページで見る`}>
                <span className="st-fw-thumb">{w.poster && <img src={w.poster} alt="" loading="lazy" />}</span>
                <span className="st-fw-name">{w.client}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function WorksTab({ go }: { go: (t: TabId) => void }) {
  const cats = ['企業サイト', 'EC・ブランド', 'アプリ', '個人'] as const;
  return (
    <>
    <FilmWorksBand go={go} />
    <Band>
      <H2 en="Web" sub="いずれも公開中のサイト・システムです。実物をご確認ください。">サイト・システムの実績</H2>
      {cats.map(cat => {
        const list = WORKS.filter(w => w.category === cat);
        if (!list.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div className="st-label" style={{ fontSize: 11, marginBottom: 10 }}>{cat}</div>
            {/* 実物のトップページを主役に (文字だけの無機質カード廃止) */}
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
              {list.map(w => (
                <a
                  key={w.id}
                  className="st-card st-workcard"
                  href={w.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
                    <img
                      src={w.img}
                      alt={`${w.name} のトップページ`}
                      loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                    />
                  </div>
                  <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <div className="st-serif" style={{ fontSize: 16.5, fontWeight: 700, color: C.ink }}>{w.name}</div>
                    <p style={{ fontSize: 12.5, lineHeight: 1.8, color: C.body, margin: 0, flex: 1 }}>{w.copy}</p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 4 }}>
                      サイトを見る <IconArrow color={C.gold} />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <LineCta where="works" />
      </div>
    </Band>
    </>
  );
}

// ============================================================
// 会社案内
// ============================================================
function AboutTab() {
  return (
    <Band>
      <H2 en="Company">{COMPANY.title}</H2>

      {/* 代表メッセージ */}
      <div className="st-card" style={{ marginBottom: 18 }}>
        <div className="st-label" style={{ fontSize: 11, marginBottom: 14 }}>Message</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 16, lineHeight: 1.7 }}>{COMPANY.messageTitle}</div>
        {COMPANY.message.map(s => (
          <p key={s.slice(0, 12)} style={{ fontSize: 14, lineHeight: 2.15, color: C.body, margin: '0 0 16px' }}>{s}</p>
        ))}
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <span style={{ fontSize: 12.5, color: C.mute, marginRight: 10 }}>{COMPANY.repTitle}</span>
          <span className="st-serif" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{COMPANY.repName}</span>
        </div>
      </div>

      {/* 会社概要 */}
      <div className="st-card">
        <div className="st-label" style={{ fontSize: 11, marginBottom: 14 }}>Profile</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 8, lineHeight: 1.7 }}>会社概要</div>
        <div>
          {COMPANY.profile.map((f, i) => (
            <div key={f.label} style={{ display: 'flex', gap: 16, fontSize: 13.5, padding: '12px 0', borderBottom: i < COMPANY.profile.length - 1 ? `1px solid ${C.line}` : 'none', lineHeight: 1.9 }}>
              <span style={{ color: C.mute, minWidth: 68, flexShrink: 0, fontWeight: 600 }}>{f.label}</span>
              <span style={{ color: C.body, overflowWrap: 'anywhere' }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <LineCta where="about" />
        <Note>{CONTACT.lineNote}</Note>
      </div>
    </Band>
  );
}

// ============================================================
// お問い合わせ — 見積ウィザード + mailto
// ============================================================
type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 6 = 結果

const PURPOSES: Array<{ v: Purpose; label: string }> = [
  { v: 'lp', label: '集客LP (1ページ)' },
  { v: 'corporate', label: 'コーポレートサイト' },
  { v: 'ec', label: 'EC・オンライン販売' },
  { v: 'webapp', label: 'Webアプリ・業務システム' },
  { v: 'saas', label: 'SaaS・本格プロダクト' },
];
const SCALES: Array<{ v: Scale; label: string }> = [
  { v: 'small', label: '小規模 (〜5ページ/画面)' },
  { v: 'medium', label: '標準 (〜15ページ/画面)' },
  { v: 'large', label: '大規模 (それ以上)' },
];
const FEATURES: Array<{ v: Feature; label: string }> = [
  { v: 'booking', label: '予約' },
  { v: 'payment', label: '決済' },
  { v: 'auth', label: 'ログイン・会員' },
  { v: 'ai', label: 'AI機能' },
  { v: 'multilingual', label: '多言語' },
];
const TIMELINES: Array<{ v: Timeline; label: string }> = [
  { v: 'asap', label: '2週間以内 (特急)' },
  { v: 'normal', label: '1〜2ヶ月' },
  { v: 'flexible', label: '3ヶ月以上・柔軟' },
];
const BUDGETS: Array<{ v: Budget; label: string }> = [
  { v: 'u10', label: '〜10万円' },
  { v: 'u30', label: '〜30万円' },
  { v: 'u100', label: '〜100万円' },
  { v: 'u500', label: '〜500万円' },
  { v: 'over500', label: '500万円以上' },
  { v: 'unknown', label: '未定' },
];

const labelOf = <T extends string>(list: Array<{ v: T; label: string }>, v: T) => list.find(x => x.v === v)?.label ?? String(v);

/** 保存の読み戻しに渡す「実在する選択肢」の一覧 (画面の並びが唯一の出どころ) */
const DRAFT_OPTIONS: DraftOptions = {
  purposes: PURPOSES.map(x => x.v),
  scales: SCALES.map(x => x.v),
  features: FEATURES.map(x => x.v),
  timelines: TIMELINES.map(x => x.v),
  budgets: BUDGETS.map(x => x.v),
};

function ContactTab() {
  // 保存があれば続きから開く (読めない・壊れている時は素の初期値)
  const restored = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try { return parseSavedEstimate(localStorage.getItem(ESTIMATE_KEY), DRAFT_OPTIONS); } catch { return null; }
  }, []);
  const init = restored ?? EMPTY_DRAFT;

  const [step, setStep] = useState<WizardStep>(init.step as WizardStep);
  const [purpose, setPurpose] = useState<Purpose | null>(init.purpose as Purpose | null);
  const [scale, setScale] = useState<Scale | null>(init.scale as Scale | null);
  const [cms, setCms] = useState<boolean | null>(init.cms);
  const [features, setFeatures] = useState<Feature[]>(init.features as Feature[]);
  const [timeline, setTimeline] = useState<Timeline | null>(init.timeline as Timeline | null);
  const [budget, setBudget] = useState<Budget | null>(init.budget as Budget | null);
  const [copied, setCopied] = useState(false);
  const [resumed, setResumed] = useState(restored !== null);

  const answers: EstimateAnswers | null = useMemo(() => {
    if (!purpose || !scale || cms === null || !timeline || !budget) return null;
    return { purpose, scale, cms, features, timeline, budget };
  }, [purpose, scale, cms, features, timeline, budget]);

  const result = useMemo(() => (answers ? estimate(answers) : null), [answers]);

  // 途中の答えを手元に残す。1問目のまま (step 0) は残さない
  // ——「開いただけ」を復帰対象にすると、次に来た時に何も変わらないのに
  // 「続きから」と名乗ることになる。
  useEffect(() => {
    try {
      if (step === 0) localStorage.removeItem(ESTIMATE_KEY);
      else localStorage.setItem(ESTIMATE_KEY, JSON.stringify({ step, purpose, scale, cms, features, timeline, budget }));
    } catch { /* 保存できない設定でも入力は続けられる */ }
  }, [step, purpose, scale, cms, features, timeline, budget]);

  // 何問目まで来て帰ったかを CORE 側に残す。戻るボタンで下がった時は数えない
  // (同じ人が行ったり来たりするたびに「到達者」が増えると、離脱地点が読めなくなる)。
  // 続きから開いた回は、その step を新規到達として数えない (reachedRef の初期値がそれ)。
  const reachedRef = useRef<number>(init.step);
  useEffect(() => {
    if (step <= reachedRef.current) return;
    if (reachedRef.current === 0 && step === 1) track('studio_estimate_start');
    reachedRef.current = step;
    track('studio_estimate_step', { step });
  }, [step]);

  useEffect(() => {
    if (restored) track('studio_estimate_resume', { step: restored.step });
    // 復帰は「この画面を開いた回」に 1 度だけ数える
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 結果が出たことは 1 回だけ数える (プラン別)
  const doneRef = useRef(false);
  useEffect(() => {
    if (step === 6 && result && !doneRef.current) {
      doneRef.current = true;
      track('studio_estimate_done', { plan: result.plan });
    }
  }, [step, result]);

  const resetAll = () => {
    setStep(0); setPurpose(null); setScale(null); setCms(null);
    setFeatures([]); setTimeline(null); setBudget(null);
    setResumed(false);
    reachedRef.current = 0;
    doneRef.current = false;
    try { localStorage.removeItem(ESTIMATE_KEY); } catch { /* */ }
  };

  const summaryText = useMemo(() => {
    if (!answers || !result) return '';
    return [
      '【CORE Studio お見積りのご相談】',
      `・目的: ${labelOf(PURPOSES, answers.purpose)}`,
      `・規模: ${labelOf(SCALES, answers.scale)}`,
      `・CMS (自社更新): ${answers.cms ? '必要' : '不要'}`,
      `・機能: ${answers.features.length ? answers.features.map(f => labelOf(FEATURES, f)).join(' / ') : 'なし'}`,
      `・希望納期: ${labelOf(TIMELINES, answers.timeline)}`,
      `・予算感: ${labelOf(BUDGETS, answers.budget)}`,
      '',
      `【概算結果】${result.plan} プラン / ¥${result.minPrice}万〜¥${result.maxPrice}万`,
    ].join('\n');
  }, [answers, result]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // clipboard 不許可環境では選択用に prompt
      window.prompt('以下をコピーしてLINEに貼り付けてください', summaryText.replace(/\n/g, ' '));
    }
  };

  // LINEを開く前に概算結果をコピーしておく。貼るだけで相談が始まる状態にする。
  const openLine = () => {
    track('studio_line_cta', { where: 'estimate-result' });
    void copySummary();
  };

  const stepDefs: Array<{ title: string; body: ReactNode }> = [
    {
      title: '制作したいものをお選びください',
      body: <ChoiceGrid items={PURPOSES} value={purpose} onPick={v => { setPurpose(v); setStep(1); }} />,
    },
    {
      title: '想定される規模をお選びください',
      body: <ChoiceGrid items={SCALES} value={scale} onPick={v => { setScale(v); setStep(2); }} />,
    },
    {
      title: '貴社での更新機能 (CMS) は必要ですか',
      body: (
        <ChoiceGrid
          items={[{ v: 'yes', label: '必要 — お知らせ等を自社で更新したい' }, { v: 'no', label: '不要 — 更新は依頼したい' }]}
          value={cms === null ? null : cms ? 'yes' : 'no'}
          onPick={v => { setCms(v === 'yes'); setStep(3); }}
        />
      ),
    },
    {
      title: '必要な機能をお選びください (複数可・なければそのまま次へ)',
      body: (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FEATURES.map(f => (
              <button key={f.v} className="st-chip" data-on={features.includes(f.v)}
                onClick={() => setFeatures(prev => prev.includes(f.v) ? prev.filter(x => x !== f.v) : [...prev, f.v])}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="st-btn st-btn-primary" onClick={() => setStep(4)}>次へ</button>
          </div>
        </div>
      ),
    },
    {
      title: 'ご希望の納期をお選びください',
      body: <ChoiceGrid items={TIMELINES} value={timeline} onPick={v => { setTimeline(v); setStep(5); }} />,
    },
    {
      title: 'ご予算の目安をお選びください',
      body: <ChoiceGrid items={BUDGETS} value={budget} onPick={v => { setBudget(v); setStep(6); }} />,
    },
  ];

  if (step === 6 && result) {
    return (
      <Band>
        <H2 en="Estimate" sub="ご回答をもとに算出した概算です。正式なお見積りはヒアリングの上で確定し、ご契約後の追加費用は発生しません。">概算お見積り</H2>
        <div className="st-card st-card-featured" style={{ textAlign: 'center', padding: '32px 22px' }}>
          <div className="st-label" style={{ fontSize: 10.5 }}>ご提案プラン</div>
          <div className="st-serif" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.06em', color: C.ink, margin: '10px 0 2px' }}>{result.plan}</div>
          <div style={{ fontSize: 12.5, color: C.mute }}>{result.kind === 'dev' ? '受託開発' : 'サイト制作'}</div>
          <div className="st-serif" style={{ fontSize: 24, fontWeight: 700, color: C.ink, margin: '18px 0 4px' }}>
            ¥{result.minPrice}万 <span style={{ fontSize: 15, color: C.mute, fontWeight: 400 }}>〜</span> ¥{result.maxPrice}万
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: C.body, margin: '16px 0 0', textAlign: 'left', background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '12px 14px' }}>{result.note}</p>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          <a className="st-btn st-btn-line" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
            style={{ width: '100%', boxSizing: 'border-box' }} onClick={openLine}>
            <IconChat /> この内容でLINE相談する
          </a>
          <button className="st-btn st-btn-ghost" onClick={copySummary} style={{ width: '100%', boxSizing: 'border-box' }}>
            <IconCopy /> {copied ? 'コピーしました' : '内容をコピーする'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: C.mute, lineHeight: 1.9, marginTop: 14, textAlign: 'center' }}>
          LINEを開くと同時に、この内容をコピーします。トークに貼り付けて送信してください。<br />
          LINEをお使いでない場合は <a href={`mailto:${STUDIO.email}?subject=${encodeURIComponent('【CORE Studio】制作のご相談')}`} style={{ color: C.ink }}>{STUDIO.email}</a> でも承ります。
        </p>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button onClick={resetAll}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: C.mute, textDecoration: 'underline', minHeight: 44, fontFamily: SANS }}>
            最初からやり直す
          </button>
        </div>
      </Band>
    );
  }

  const def = stepDefs[step];
  return (
    <Band>
      <H2 en="Contact" sub="6つの質問にお答えいただくと、最適なプランと概算をその場でご確認いただけます。">お問い合わせ</H2>
      {/* 続きから開いたことを黙って隠さない。前の答えのまま進むか、やり直すかを選べるようにする */}
      {resumed && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
          background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: C.body, lineHeight: 1.8 }}>前回の続きから表示しています。</span>
          <button onClick={resetAll}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: C.ink, fontWeight: 600, textDecoration: 'underline', minHeight: 44, padding: 0, fontFamily: SANS }}>
            最初からやり直す
          </button>
        </div>
      )}

      {/* 進捗 */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
        {stepDefs.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? C.gold : C.line }} />
        ))}
      </div>
      <div className="st-card">
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 8 }}>質問 {step + 1} / {stepDefs.length}</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 16, lineHeight: 1.6 }}>{def.title}</div>
        {def.body}
        {step > 0 && (
          <button onClick={() => setStep((step - 1) as WizardStep)}
            style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: C.mute, textDecoration: 'underline', minHeight: 44, padding: 0, fontFamily: SANS }}>
            ひとつ戻る
          </button>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: C.mute, marginTop: 16, lineHeight: 1.9, textAlign: 'center' }}>
        質問に答えず直接ご相談いただいても構いません — <a href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.ink, fontWeight: 600 }}>LINEで無料相談</a>
      </p>
    </Band>
  );
}

function ChoiceGrid<T extends string>({ items, value, onPick }: {
  items: Array<{ v: T; label: string }>;
  value: T | null;
  onPick: (v: T) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map(it => (
        <button key={it.v} className="st-chip" data-on={value === it.v} onClick={() => onPick(it.v)} style={{ width: '100%' }}>
          {it.label}
        </button>
      ))}
    </div>
  );
}
