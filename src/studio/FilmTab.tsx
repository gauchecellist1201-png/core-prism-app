// ============================================================
// CORE Studio — 映像制作タブ (/studio#film)
// 白基調のスタジオサイトの中で、映像の章だけを暗部に落とす編集構成。
// ヒーロー / ショーケース / 思想 / 最終CTA = 暗、料金・工程・制作物 = 白。
// 文言・価格は film.ts に集約。ここにはレイアウトと導線だけを書く。
// ============================================================
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { C, D, SERIF, SANS } from './theme';
import { Band, H2, Note, IconCheck, IconChat, IconCopy } from './ui';
import { STUDIO, CONTACT, COMPANY } from './plans';
import {
  FILM, FILM_PLANS, MONTHLY_LEAD, MONTHLY_PLANS, MONTHLY_TERMS, MONTHLY_SPEC,
  PLAN_LADDER, PRICE_NOTE, PRICE_WHY, VALUE, monthlySavings, yen,
  TRIAL_OFFER, CAMPAIGN, isCampaignLive, offPercent,
  PRICING_MODES, PRICING_LEAD, planMatrix, type PricingMode, type FilmPlan,
  FILM_WORKS, FILM_PROCESS, PROCESS_STATEMENT, START_STEPS, REVISION, TERMS, AI_TERMS,
  FILM_FAQ, FILM_CTA, INQUIRY_FIELDS, FILM_MENU, MENU_LEAD,
  menuPriceParts, menuSpecLabel, menuTarget,
} from './film';
// ---- 計測 ----
// 以前はここで logEvent() を呼ぶだけだった = 記録は訪問者自身の localStorage に
// 溜まるだけで、CORE 側には 1 件も届いていなかった。track() は手元にも残しつつ
// /api/track/studio へビーコンを飛ばす (外部サービスは追加しない)。
import { track } from './track';

// 遠い行き先へ smooth を指定するとブラウザが移動そのものを諦め、押しても何も起きない
// (実測: ヒーローから 10,700px 下の相談欄へ smooth 指定 → scrollY が 0 のまま)。
// index.css に html { scroll-behavior: smooth } があるため 'auto' も smooth に化ける。
// 距離が離れている時は 'instant' を明示して即時ジャンプさせる。
// 固定ヘッダーのぶんだけ手前で止める。高さを決め打ちにすると、ヘッダーが実測115pxなのに
// 80px しか避けず、着地点が毎回35px ヘッダーの下に潜る (目次の「料金」も同じ症状だった)。
// タブ行の折り返しで高さが変わるので、押した時点で測る。
const headerOffset = () => {
  const r = document.querySelector('header')?.getBoundingClientRect();
  return r && r.height > 0 ? r.height + 12 : 92;
};

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerOffset());
  const far = Math.abs(top - window.scrollY) > 2000;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top, behavior: far || reduced ? 'instant' : 'smooth' });
};

// ============================================================
export default function FilmTab() {
  useScrollDepth();

  // FAQPage の構造化データ (ここで実際に画面へ出している FILM_FAQ と同じ質問・同じ答えだけを渡す)。
  // StudioSite側の studioJsonLd() は home の STUDIO_FAQ だけを持つので、film タブでは
  // ここで自分のぶんを足す (離脱時に必ず片付ける)。
  useEffect(() => {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'film-faq-jsonld';
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FILM_FAQ.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  // 発注の形 (単発 / 月額) は料金セクションの外からも切り替える。
  // 目次の「月額プラン」から飛んだのに単発のカードが出ている、という食い違いを作らないため、
  // 状態は Pricing ではなくページ側で持つ。
  const [pricingMode, setPricingMode] = useState<PricingMode>('once');
  // 早見表の行から「そのプランの内訳」を直接開くため、開くプランもページ側で持つ。
  // 押した行と関係のないプランが開いていると、運ばれた先で読む場所を探し直すことになる。
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  const showPricing = (m: PricingMode) => {
    setPricingMode(m);
    // 状態を反映した後の座標でないと着地点がずれる (rAF は非表示タブで呼ばれないため setTimeout)
    window.setTimeout(() => scrollToId('film-pricing'), 0);
  };

  // 早見表の行 → 該当プランの内訳。単発は詳細を開いてそこまで運び、月額は料金表の頭へ。
  const showPlan = (m: PricingMode, plan?: string) => {
    setPricingMode(m);
    setOpenPlan(plan ?? null);
    window.setTimeout(() => scrollToId(plan ? `film-plan-${plan}` : 'film-pricing'), 0);
  };

  return (
    <div>
      <style>{`
        .fm-rv { transition: opacity 620ms ease, transform 620ms ease; }
        .fm-rv[data-rv="pending"] { opacity: 0; transform: translateY(14px); }
        .fm-rv[data-rv="in"] { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          .fm-rv, .fm-rv[data-rv="pending"] { opacity: 1 !important; transform: none !important; transition: none; }
        }
        .fm-scroller { display: flex; justify-content: safe center; gap: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory; padding: 4px 20px 18px; scrollbar-width: none; }
        .fm-scroller::-webkit-scrollbar { display: none; }
        .fm-shot { flex: 0 0 auto; width: min(74vw, 268px); scroll-snap-align: center; }
        @media (min-width: 900px) { .fm-shot { width: 232px; } }
        .fm-frame { position: relative; width: 100%; border-radius: 12px; overflow: hidden;
          border: 1px solid ${D.line};
          background:
            radial-gradient(120% 62% at 28% 16%, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0) 62%),
            linear-gradient(160deg, #1e1e23 0%, #101013 58%, #0c0c0f 100%); }
        /* 粒子。装飾なので必ずタップを透過させる */
        .fm-frame::after { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.16'/%3E%3C/svg%3E"); }
        .fm-frame img, .fm-frame video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .fm-grid3 { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 700px) { .fm-grid3 { grid-template-columns: repeat(3, 1fr); } }
        .fm-tag { display: inline-flex; align-items: center; min-height: 34px; padding: 6px 13px; border-radius: 999px;
          border: 1px solid ${D.goldLine}; color: ${D.gold}; font-size: 12.5px; letter-spacing: 0.06em; }
        .fm-btn-light { background: #06C755; color: ${C.ink}; border: 1px solid #06C755; }
        .fm-btn-light:hover { opacity: 0.86; }
        /* ヒーローの主ボタン = 料金表へ。LINE(緑)と並べても役割が混ざらない色にする。
           2026-08-27: 1画面目で最初に押させたいのは相談ではなく金額の確認なので、
           こちらを主(塗り)、LINEを副(枠線)に入れ替えた */
        .fm-btn-gold { background: ${D.gold}; color: #17130A; border: 1px solid ${D.gold}; font-weight: 700; }
        .fm-btn-gold:hover { opacity: 0.88; }
        .fm-btn-outline { background: transparent; color: #FFFFFF; border: 1px solid rgba(255,255,255,0.5); font-weight: 600; }
        .fm-btn-outline:hover { border-color: ${D.gold}; }
        .fm-rule { border: none; border-top: 1px solid ${C.line}; margin: 0; }
        .fm-reassure { display: flex; gap: 10px; flex-wrap: wrap; }
        .fm-reassure-item { font-size: 12px; color: ${D.mute}; display: inline-flex; align-items: center; gap: 6px; }
        .fm-why-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 700px) { .fm-why-grid { grid-template-columns: repeat(3, 1fr); } }
        .fm-audience-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 700px) { .fm-audience-grid { grid-template-columns: repeat(3, 1fr); } }
        .fm-decision-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 640px) { .fm-decision-grid { grid-template-columns: repeat(2, 1fr); } }
        .fm-works-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 700px) { .fm-works-grid { grid-template-columns: repeat(3, 1fr); } }
        .fm-faq-item { border-top: 1px solid ${C.line}; }
        .fm-faq-btn { width: 100%; min-height: 52px; background: none; border: none; cursor: pointer; text-align: left;
          padding: 14px 2px; font-size: 14px; font-weight: 600; color: ${C.ink}; font-family: ${SANS};
          display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        /* 章の目次。長い1枚ものを上から順に読ませない (法人は必要な章だけ見る) */
        .fm-nav { display: flex; gap: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch;
          scrollbar-width: none; padding: 2px 20px 0; }
        .fm-nav::-webkit-scrollbar { display: none; }
        /* 目次の項目は44px。7項目あり、指で押し損ねると別の章へ飛ばされる */
        .fm-nav-item { flex: 0 0 auto; min-height: 44px; display: inline-flex; align-items: center; padding: 11px 14px;
          border-radius: 999px; border: 1px solid ${D.line}; background: transparent; cursor: pointer;
          color: ${D.body}; font-size: 12.5px; font-family: ${SANS}; letter-spacing: 0.04em; white-space: nowrap;
          transition: border-color 140ms ease, color 140ms ease; }
        .fm-nav-item:hover { border-color: ${D.goldLine}; color: ${D.ink}; }
        /* 想定顧客・選び方の圧縮グリッド (1行1件の縦積みをやめる) */
        .fm-chip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        @media (min-width: 640px) { .fm-chip-grid { grid-template-columns: repeat(3, 1fr); } }
        .fm-terms-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 700px) { .fm-terms-grid { grid-template-columns: 1fr 1fr; } }
        /* ヒーロー直下の数字バー。375pxで2列、広い画面で4列。
           1列に落とすと4行=約210pxを食い、CTAが1画面目から押し出される */
        .fm-proof { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: ${D.line};
          border: 1px solid ${D.line}; border-radius: 12px; overflow: hidden; }
        @media (min-width: 700px) { .fm-proof { grid-template-columns: repeat(4, 1fr); } }
        .fm-proof-item { background: ${D.bg}; padding: 14px 14px 13px; }
        .fm-proof-value { font-size: 19px; font-weight: 700; color: ${D.gold}; line-height: 1.35; letter-spacing: 0.01em; }
        .fm-proof-label { font-size: 11px; color: ${D.mute}; line-height: 1.6; margin-top: 5px; letter-spacing: 0.02em; }
        /* 相場との対比表。狭い画面では表を横に潰さず、1件=1ブロックの縦積みに切り替える
           (3列を375pxに押し込むと各セルが5〜6行に折れて読めなくなる) */
        .fm-cmp { display: grid; gap: 12px; }
        .fm-cmp-group { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: ${C.ink};
          margin: 14px 2px 0; display: flex; align-items: center; gap: 8px; }
        /* 群の見出しは文字を大きくするより、金の短い線を頭に付けたほうが「章が変わった」が速く伝わる */
        .fm-cmp-group::before { content: ''; width: 14px; height: 2px; background: ${C.gold}; flex: 0 0 auto; }
        .fm-cmp-head + .fm-cmp-group { margin-top: 0; }
        .fm-cmp-head { display: none; }
        .fm-cmp-row { border: 1px solid ${C.line}; border-radius: 10px; background: #FFFFFF; overflow: hidden; }
        .fm-cmp-row[data-hl="1"] { border-color: ${C.goldLine}; }
        .fm-cmp-item { font-size: 14.5px; font-weight: 700; color: ${C.ink}; line-height: 1.6;
          padding: 12px 15px; background: ${C.alt}; border-bottom: 1px solid ${C.line}; }
        /* 2026-08-27: 狭い画面でも左右に並べる。
           以前は「2列に割ると1セルが5〜6行に折れて読めない」として上下に積んでいたが、
           その結果 7行の表が1画面半 (実測1,050px) を占め、比較が一望できなくなっていた。
           文字を14.5px→13pxに落として2列に戻すと、最も長い値でも3行に収まり、
           「相場 と CORE を横に並べて見る」という表本来の読み方が成立する。 */
        .fm-cmp-vals { display: grid; grid-template-columns: 1fr 1fr; }
        .fm-cmp-val { padding: 10px 12px; font-size: 13px; line-height: 1.65; color: ${C.mute}; }
        .fm-cmp-val + .fm-cmp-val { border-left: 1px solid ${C.line}; }
        .fm-cmp-val--core { background: rgba(168,130,60,0.07); color: ${C.ink}; font-weight: 700;
          display: flex; align-items: flex-start; gap: 6px; }
        .fm-cmp-cap { display: block; font-size: 10.5px; letter-spacing: 0.06em; color: ${C.mute};
          margin-bottom: 3px; font-weight: 600; }
        .fm-cmp-val--core .fm-cmp-cap { color: ${C.goldText}; }
        @media (min-width: 760px) {
          /* 3列の表に組み替える。列見出しは1度だけ出し、各セルの小見出しは
             読み上げにだけ残す (display:none にすると支援技術からも列名が消える) */
          .fm-cmp { gap: 0; border: 1px solid ${C.line}; border-radius: 12px; overflow: hidden;
            background: #FFFFFF; }
          .fm-cmp-group { grid-column: 1 / -1; margin: 0; padding: 11px 18px 10px; background: ${C.alt};
            border-top: 1px solid ${C.line}; }
          /* CORE列は読ませたい側なので、相場列より広く取って折り返しを起こさせない
             (「料金に込み (STANDARD以上)」が2行に折れるとチェックの位置がずれて読みにくい) */
          .fm-cmp-head, .fm-cmp-row { display: grid; grid-template-columns: 1.05fr 0.92fr 1.2fr; align-items: stretch; }
          .fm-cmp-head { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: ${C.mute}; }
          .fm-cmp-head > * { padding: 13px 18px; }
          .fm-cmp-head > *:last-child { color: ${C.goldText}; background: rgba(168,130,60,0.07); }
          .fm-cmp-row { border: 0; border-radius: 0; border-top: 1px solid ${C.line}; }
          .fm-cmp-row[data-hl="1"] { border-color: ${C.line}; }
          .fm-cmp-item { background: transparent; border-bottom: 0; padding: 15px 18px; display: flex; align-items: center; }
          .fm-cmp-vals { display: contents; }
          .fm-cmp-val { padding: 15px 18px; border-top: 0; }
          .fm-cmp-val + .fm-cmp-val { border-top: 0; border-left: 0; }
          .fm-cmp-val--core { align-items: center; }
          .fm-cmp-cap { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
            overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
        }
        /* 差が生まれる理由。番号を大きく置いて、3枚が「読み物」でなく「3つの理由」に見えるようにする */
        .fm-why { border: 1px solid ${C.line}; border-radius: 12px; background: #FFFFFF;
          padding: 18px 18px 17px; border-top: 3px solid ${C.gold}; }
        .fm-why-no { font-family: ${SERIF}; font-size: 22px; font-weight: 700; color: ${C.goldText};
          line-height: 1; letter-spacing: 0.02em; }
        .fm-why-title { font-size: 15.5px; font-weight: 700; color: ${C.ink}; line-height: 1.6; margin: 9px 0 7px; }
        .fm-why-body { font-size: 13.5px; line-height: 1.95; color: ${C.body}; margin: 0; }
        /* 工程の6ステップ。長い説明文は書かず、番号+見出しだけの帯にして
           「丸投げでなく工程を踏んでいる」ことだけを短く示す (詳細は書くと動画と重複する)。 */
        .fm-process-row { display: flex; gap: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch;
          scrollbar-width: none; padding-bottom: 2px; }
        .fm-process-row::-webkit-scrollbar { display: none; }
        /* 2026-08-27: 暗部 (ヒーロー直下) から明部 (制作と発注の流れ) へ移したので、
           線と文字を白地の配色に差し替える。暗部の配色のままだと、
           #F7F7F5 の上で薄い灰色の枠に薄い灰色の文字になり、実測コントラストが落ちる */
        .fm-process-step { flex: 0 0 auto; display: flex; align-items: center; gap: 8px;
          padding: 9px 13px; border-radius: 999px; border: 1px solid ${C.line};
          background: #FFFFFF; white-space: nowrap; }
        .fm-process-no { font-size: 10.5px; font-weight: 700; color: ${C.goldText}; letter-spacing: 0.04em; }
        .fm-process-title { font-size: 12px; color: ${C.ink}; letter-spacing: 0.02em; }
        /* プランの仕様。左に項目・右に中身。375pxでは項目名が折り返すと読めなくなるので
           左は固定幅にし、長い値だけを折り返させる */
        .fm-spec { display: grid; gap: 0; border-top: 1px solid ${C.line}; margin-top: 12px; }
        .fm-spec-row { display: grid; grid-template-columns: 84px 1fr; gap: 10px;
          padding: 9px 0; border-bottom: 1px solid ${C.line}; align-items: start; }
        .fm-spec-key { font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; color: ${C.mute}; line-height: 1.7; }
        .fm-spec-val { font-size: 13px; line-height: 1.75; color: ${C.ink}; font-weight: 600; }
        /* 「この価格になる理由」。金額の隣で読ませたいので、カード内で色を変えて浮かせる。
           ValueTable の .fm-why (3つの理由カード) とは別物。同じ名前にすると
           後から書いたほうが両方に当たるので、名前を分けておく */
        .fm-priceway { margin-top: 14px; padding: 13px 14px; border-radius: 4px;
          background: ${C.alt}; border: 1px solid ${C.goldLine}; }
        .fm-priceway-key { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: ${C.goldText}; margin-bottom: 7px; }
        .fm-priceway-body { font-size: 12.5px; line-height: 1.95; color: ${C.body}; margin: 0; }
        /* 月額に切り替えた場合の差額。3列 (単発合計 / 月額 / 差額) */
        .fm-save { display: grid; gap: 10px; }
        @media (min-width: 700px) { .fm-save { grid-template-columns: repeat(3, 1fr); } }

        /* ── 料金セクション ─────────────────────────────────
           3プランを並べて比べる章なので、ここだけ本文幅 (760px) より広く取る。
           ただし広げすぎると1行が60字を超えて日本語が読みにくくなるので 900px で止め、
           長い散文には .fm-prose で別途上限を掛ける */
        @media (min-width: 900px) { #film-pricing .st-inner { max-width: 900px; } }
        .fm-prose { max-width: 720px; }

        /* 発注の形。2026-08-27 改編 (オーナー指摘「月額のサブスクもちゃんとわかるように」)。
           旧版は「1本ずつ / 毎月つづける」の2語 + 価格帯だけの小さなスイッチで、
           押すまで月額の中身 (本数・初期費用・最低契約期間) が一切見えなかった。
           つまり月額プランの存在自体が、スクロールしただけの人には伝わらない。
           そこで両方の条件を常に並べて出し、押すのは「どちらを詳しく見るか」だけにする。 */
        .fm-mode { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 640px) { .fm-mode { grid-template-columns: 1fr 1fr; gap: 12px; } }
        .fm-mode-btn { display: flex; flex-direction: column; height: 100%; width: 100%; box-sizing: border-box;
          text-align: left; cursor: pointer; font-family: ${SANS}; padding: 17px 17px 16px; border-radius: 14px;
          background: #FFFFFF; border: 1px solid ${C.line};
          transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease; }
        .fm-mode-btn:hover { border-color: ${C.gold}; }
        .fm-mode-btn[data-on="true"] { border: 1.5px solid ${C.gold}; background: #FBF8F2;
          box-shadow: 0 14px 34px -24px rgba(17,24,39,0.4); }
        .fm-mode-badge { display: inline-flex; align-items: center; align-self: flex-start; padding: 4px 10px;
          border-radius: 999px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em;
          background: ${C.alt}; color: ${C.mute}; border: 1px solid ${C.line}; }
        /* サブスク側だけ地の色を変える。「都度払い」と同じ見た目にすると、
           2枚が同じ商品の色違いに見えて、月額という別の買い方だと気づかれない */
        .fm-mode-btn[data-mode="monthly"] .fm-mode-badge { background: ${C.ink}; color: #FFFFFF; border-color: ${C.ink}; }
        .fm-mode-label { display: block; font-size: 15px; font-weight: 700; color: ${C.ink}; line-height: 1.5; margin-top: 11px; }
        .fm-mode-hint { display: block; font-family: ${SERIF}; font-size: clamp(24px, 6.4vw, 29px); font-weight: 700;
          color: ${C.ink}; line-height: 1.25; margin-top: 6px; letter-spacing: 0.01em; }
        .fm-mode-unit { display: block; font-size: 11.5px; color: ${C.mute}; margin-top: 5px; line-height: 1.7; }
        .fm-mode-points { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 5px; }
        .fm-mode-point { display: flex; gap: 7px; font-size: 12.5px; line-height: 1.6; color: ${C.body}; }
        /* 押した先が「下に開く」ことを、押す前に見せる。タブに見えないと2枚とも読まれない */
        .fm-mode-foot { margin-top: auto; padding-top: 14px; display: flex; align-items: center; gap: 7px;
          font-size: 12.5px; font-weight: 700; color: ${C.goldText}; letter-spacing: 0.02em; }
        .fm-mode-btn[data-on="true"] .fm-mode-foot { color: ${C.ink}; }
        .fm-mode-caret { transition: transform 140ms ease; }
        .fm-mode-btn[data-on="true"] .fm-mode-caret { transform: rotate(90deg); }

        /* 早見カード。1枚で1画面を使い切らないよう、金額・向く相手・作れるものだけに絞る。
           仕様の全項目は下の比較表で見せる */
        .fm-pick { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 760px) { .fm-pick { grid-template-columns: repeat(3, 1fr); align-items: stretch; } }
        .fm-pick-card { display: flex; flex-direction: column; height: 100%; box-sizing: border-box;
          background: #FFFFFF; border: 1px solid ${C.line}; border-radius: 14px; padding: 20px 18px; }
        .fm-pick-card[data-featured="true"] { border: 1.5px solid ${C.gold}; box-shadow: 0 14px 34px -22px rgba(17,24,39,0.34); }
        /* バッジの有無で見出しの高さがずれると、3枚の金額が一直線に並ばない。
           バッジが無い列にも同じ高さの行を確保する */
        /* バッジ列だけ見出しが下がると3枚の金額が揃わない。min-height では揃わなかった
           (inline-flex のバッジが行ボックスを作り、ディセンダ分だけ 24px→26.75px に伸びる)。
           flex にして行ボックスごと消し、高さを固定する */
        .fm-pick-badgerow { display: flex; align-items: center; height: 26px; margin-bottom: 10px; }
        /* 縦積みになる幅では3枚が横に並ばないので、揃える相手がいない。
           バッジの無いカードで32px を空けておく意味がなくなるため畳む */
        @media (max-width: 759px) { .fm-pick-badgerow:empty { display: none; } }
        .fm-pick-badge { display: inline-flex; align-items: center; padding: 4px 10px;
          border-radius: 999px; background: ${C.gold}; color: #FFFFFF; font-size: 10.5px; font-weight: 700;
          letter-spacing: 0.14em; }
        /* 初回限定のバッジは「おすすめ」(金)と役割が違う。同じ金にすると
           3枚のうち2枚が金のバッジになり、どちらが推奨なのか分からなくなる。
           限定は主張ではなく条件なので、地の色を濃紺にして静かに置く */
        .fm-pick-badge[data-offer="true"] { background: ${C.ink}; }
        /* 通常価格 → 初回価格。取り消し線の金額と割引額を1行に置く。
           「50%OFF」のような丸めた数字は書かない (¥89,800→¥49,800 は 44%) */
        .fm-pick-was { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .fm-pick-was-price { font-size: 13.5px; color: ${C.mute}; text-decoration: line-through;
          text-decoration-thickness: 1px; }
        .fm-pick-was-off { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: ${C.goldText};
          border: 1px solid ${C.gold}; border-radius: 4px; padding: 2px 6px; }
        /* 取り消し線の行が入る列だけ金額が下がると3枚の金額が揃わないので、
           その行があるカードは price の上余白を詰めて相殺する */
        .fm-pick-was + .fm-pick-price { margin-top: 4px; }
        .fm-pick-offnote { font-size: 11.5px; line-height: 1.7; color: ${C.mute}; margin-top: 6px; }
        /* 月額カードの「1本ずつなら」比較。お得感はここで数字だけで出す */
        .fm-pick-save { font-size: 12px; line-height: 1.7; color: ${C.goldText}; font-weight: 600;
          background: rgba(168,130,60,0.08); border-radius: 8px; padding: 8px 10px; margin-top: 10px; }
        .fm-pick-save s { color: ${C.mute}; font-weight: 400; text-decoration-thickness: 1px; }
        /* TRIAL / STANDARD は欧文なので字間を開けたほうが締まるが、
           同じ字間を「月4本」に掛けると分かち書きに見えて読みにくい */
        .fm-pick-name { font-family: ${SERIF}; font-size: 18px; font-weight: 700; letter-spacing: 0.1em; color: ${C.ink}; }
        .fm-pick-name[data-ja="true"] { letter-spacing: 0.02em; font-size: 19px; }
        /* プラン名 (TRIAL 等) は符丁としてだけ残すので、欧文の字間を開けて小さく置く */
        .fm-pick-unit { font-size: 11px; color: ${C.mute}; margin-top: 4px; letter-spacing: 0.14em; font-weight: 600; }
        .fm-pick-price { font-family: ${SERIF}; font-size: clamp(28px, 7vw, 34px); font-weight: 700;
          color: ${C.ink}; line-height: 1.25; letter-spacing: 0.01em; margin-top: 10px; }
        .fm-pick-tax { font-size: 11.5px; color: ${C.mute}; margin-top: 4px; letter-spacing: 0.02em; }
        .fm-pick-fit { font-size: 12.5px; line-height: 1.8; color: ${C.goldText}; font-weight: 600;
          margin: 13px 0 0; padding-top: 13px; border-top: 1px solid ${C.line}; }
        .fm-pick-body { font-size: 12.5px; line-height: 1.85; color: ${C.body}; margin: 9px 0 0; }
        .fm-pick-uses { list-style: none; padding: 0; margin: 11px 0 0; display: grid; gap: 6px; }
        .fm-pick-use { display: flex; gap: 7px; font-size: 12.5px; line-height: 1.65; color: ${C.body}; }
        /* CTA を3枚の同じ高さに揃える。上の文章量が違っても、押す場所は一直線に並ぶ */
        .fm-pick-foot { margin-top: auto; padding-top: 16px; }
        /* 既定の左右30pxのままだと、279px幅のカードで「要件を伝えて見積りを取る」が
           2行に折れて、そのカードだけボタンが21px上にずれる。全幅ボタンに30pxは要らない */
        .fm-pick-foot .st-btn { padding-left: 14px; padding-right: 14px; }
        .fm-pick-more { display: flex; align-items: center; justify-content: center; min-height: 44px;
          font-size: 12.5px; color: ${C.mute}; background: none; border: none; cursor: pointer;
          font-family: ${SANS}; width: 100%; }
        .fm-pick-more:hover { color: ${C.ink}; }

        /* 何が違うかの比較表。375px では4列が入らないので横スクロールにし、
           項目名の列だけを左に貼り付けて、どの行を見ているか分からなくならないようにする */
        .fm-mx-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin;
          border: 1px solid ${C.line}; border-radius: 12px; background: #FFFFFF; }
        /* 項目列142px + プラン列148px×3 = 586px。min-width をそれ未満にすると
           狭い画面で列が縮められ、指定した最小幅が効かなくなる */
        .fm-mx { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 600px; }
        .fm-mx th, .fm-mx td { text-align: left; vertical-align: top; padding: 12px 14px;
          border-bottom: 1px solid ${C.line}; font-weight: 400; }
        .fm-mx tr:last-child th, .fm-mx tr:last-child td { border-bottom: none; }
        /* 「広告への二次利用」が2行に折れない幅。狭い画面では下で 92px に詰める */
        .fm-mx-corner, .fm-mx-key { position: sticky; left: 0; z-index: 2; background: ${C.alt};
          border-right: 1px solid ${C.line}; width: 142px; min-width: 142px;
          font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; color: ${C.mute}; line-height: 1.7; }
        .fm-mx-head { background: ${C.alt}; }
        .fm-mx-plan { min-width: 148px; }
        /* 列見出しは「20秒 1本」。和文なので字間は詰める (欧文用の 0.08em は分かち書きに見える) */
        .fm-mx-plan-name { font-family: ${SERIF}; font-size: 14.5px; font-weight: 700; letter-spacing: 0.02em; color: ${C.ink}; }
        .fm-mx-plan-price { font-family: ${SERIF}; font-size: 17px; font-weight: 700; color: ${C.ink}; margin-top: 3px; }
        .fm-mx-plan-unit { font-size: 11px; color: ${C.mute}; margin-top: 2px; }
        .fm-mx td { font-size: 13px; line-height: 1.75; color: ${C.ink}; }
        .fm-mx-col-featured { background: rgba(168,130,60,0.06); }
        .fm-mx tr[data-em="1"] td { font-weight: 700; }
        .fm-mx-note { font-size: 11.5px; color: ${C.mute}; margin: 0 2px 8px; line-height: 1.8;
          display: flex; align-items: center; gap: 6px; }
        /* 横スクロールが要るのは列が入りきらない幅だけ。入る幅では案内自体を消す */
        @media (min-width: 760px) { .fm-mx-scrollhint { display: none; } }
        /* 狭い画面では1セルが2〜3行に折れて表が2画面ぶんに伸びる。
           行間と余白を詰めて、指1本で端から端まで見渡せる高さに寄せる */
        @media (max-width: 759px) {
          .fm-mx th, .fm-mx td { padding: 10px 12px; }
          .fm-mx td { font-size: 12.5px; line-height: 1.6; }
          .fm-mx-corner, .fm-mx-key { width: 92px; min-width: 92px; font-size: 11px; line-height: 1.55; }
          .fm-mx-plan { min-width: 142px; }
        }
        /* ヒーロー = 縦型の映像そのもの。文字は一切かぶせず、映像の下に置く
           (2026-08-22 オーナー指示「映像をドーンと出し、文字はその下」)。
           素材は 1080x1920 の縦型。切り抜くと画の大半が捨てられるので、
           スマホでは画面幅いっぱい × 9:16 をそのまま出す (crop 0)。
           1画面目からはみ出すぶんは、常時出ている固定下部CTAで受ける。 */
        .fm-hero { position: relative; width: 100%; background: #000;
          display: flex; justify-content: center; overflow: hidden; }
        /* 2026-08-29 第3版 — オーナー指摘「iPhoneで動画のトップが切れて、綺麗に出ていない」。
           第2版 (100dvh - 420px、375x812実測392px) は見出し+金額を1画面目に収める代わりに
           映像を横375pxに対して392pxの箱へ押し込めていた。9:16素材(720x1280)をcoverで
           392px高に詰めると天地とも137pxずつ切り取られ、被写体の上半分が消えて見えていた。
           見出しを1画面目に収める効果より「映像が主役として綺麗に見える」を優先し、
           高さの上限は撤廃 (aspect-ratio 9:16 のまま crop 0 で表示)。375x812実測で
           映像は667px (画面の82%) になり、ヘッダーと合わせてほぼ全画面をドンと使う。
           見出し・金額は映像のすぐ下へ続けてスクロールで見せる (2026-08-22 オーナー指示
           「映像をドーンと出し、文字はその下」に戻す形)。100dvh の上限は
           横長ウィンドウ等 極端に縦が短い環境で映像が画面より高くなるのを防ぐ安全網のみ。 */
        .fm-hero-frame { position: relative; z-index: 2; width: 100%; aspect-ratio: 9 / 16;
          max-height: 100dvh; overflow: hidden; background: #000; }
        /* 広い画面 — 縦型を横に引き伸ばす/切り抜くと必ず崩れるので、
           画そのものは縦型のまま中央に立て、両脇の余白は同じ画をぼかして敷く。
           黒い空き地にするより「その映像の中に居る」画面になる。 */
        .fm-hero-amb { display: none; }
        @media (min-width: 700px) {
          /* 広い画面は縦型を丸ごと立てられるので、狭い画面用の上限は解除する */
          .fm-hero-frame { width: auto; height: min(calc(100dvh - 132px), 860px); max-height: none;
            box-shadow: 0 30px 90px rgba(0,0,0,0.62); }
          .fm-hero-amb { display: block; position: absolute; inset: -10%; z-index: 0;
            background: url('/studio/film/hero-reel-poster.jpg') center / cover no-repeat;
            filter: blur(52px) saturate(1.15) brightness(0.42); transform: scale(1.06); }
          .fm-hero::after { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none;
            background: radial-gradient(115% 78% at 50% 42%, rgba(11,11,12,0) 34%, rgba(11,11,12,0.78) 100%); }
        }
        .fm-hero video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        /* 自動再生が拒否された端末 (低電力モード等) では静止画のまま何も起きないので、
           停止中だけ再生ボタンを出す */
        .fm-hero-play { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          width: 76px; height: 76px; border-radius: 999px; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.5); background: rgba(11,11,12,0.55);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          color: #FFFFFF; display: flex; align-items: center; justify-content: center; }
        .fm-hero-label { margin: 0 0 8px; }
        .fm-hero-h1 { font-size: clamp(27px, 7.4vw, 44px); font-weight: 700; line-height: 1.4;
          letter-spacing: 0.02em; margin: 0; color: #FFFFFF; }
        .fm-hero-sub { font-size: 13.5px; line-height: 1.95; color: ${D.body}; margin: 18px 0 0; max-width: 560px; }
        /* 音の切り替え。映像の上、右上の角 (顔にかぶらない位置) */
        .fm-hero-sound { position: absolute; top: 14px; right: 16px; min-height: 44px; padding: 10px 16px;
          border-radius: 999px; cursor: pointer; border: 1px solid rgba(255,255,255,0.34);
          background: rgba(11,11,12,0.52); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          color: #FFFFFF; font-family: ${SANS}; font-size: 12px; letter-spacing: 0.04em; }
        .fm-hero-sound:hover { border-color: ${D.gold}; color: ${D.gold}; }
        .fm-hero-note { font-size: 12px; color: ${D.mute}; letter-spacing: 0.02em; margin: 16px 0 0; line-height: 1.8; }
        /* ヒーローの金額。2つを横に並べる (縦に積むとCTAが1画面目から押し出される) */
        .fm-heroprice { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: ${D.line};
          border: 1px solid ${D.line}; border-radius: 12px; overflow: hidden; margin-top: 14px; }
        .fm-heroprice-item { background: ${D.bg}; padding: 13px 14px 12px; }
        .fm-heroprice-value { font-size: 21px; font-weight: 700; color: ${D.gold}; line-height: 1.3; letter-spacing: 0.01em; }
        .fm-heroprice-label { font-size: 11px; color: ${D.mute}; line-height: 1.65; margin-top: 5px; letter-spacing: 0.02em; }

        /* ── 料金早見表 ─────────────────────────────────
           1行 = 1つの用途。左に「何が届くか」、右に「いくらか」。
           金額を右端で縦一列に揃えることが、この表の唯一の目的。
           カードの2列グリッドに戻してはいけない (金額の高さがカードごとにずれて比較できなくなる)。 */
        .fm-pm { display: grid; gap: 0; border: 1px solid ${D.line}; border-radius: 14px;
          overflow: hidden; background: ${D.raise}; }
        .fm-pm-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          width: 100%; box-sizing: border-box; text-align: left; cursor: pointer; font-family: ${SANS};
          background: transparent; border: none; border-top: 1px solid ${D.line}; padding: 15px 15px 14px;
          transition: background 140ms ease; }
        .fm-pm-row:first-child { border-top: none; }
        .fm-pm-row:hover { background: rgba(255,255,255,0.035); }
        .fm-pm-main { display: block; flex: 1 1 auto; min-width: 0; }
        .fm-pm-title { display: block; font-family: ${SERIF}; font-size: 16px; font-weight: 700;
          color: ${D.ink}; line-height: 1.45; letter-spacing: 0.02em; }
        .fm-pm-spec { display: block; font-size: 11.5px; color: ${D.gold}; line-height: 1.6;
          margin-top: 4px; letter-spacing: 0.02em; }
        .fm-pm-body { display: block; font-size: 12px; color: ${D.body}; line-height: 1.75; margin-top: 6px; }
        /* 金額の列。375px で最長の「月 ¥228,000〜」(実測112px) が折り返さない幅を固定で確保する。
           auto にすると左の説明文が長い行だけ金額が2行に折れ、桁が揃わなくなる。
           揃わない金額は比べられない = この表の目的そのものが壊れる */
        .fm-pm-price { flex: 0 0 auto; width: 130px; text-align: right; }
        .fm-pm-price-main { display: block; font-size: 18px; font-weight: 700; color: ${D.ink};
          line-height: 1.3; letter-spacing: 0.01em; white-space: nowrap; }
        .fm-pm-price-sub { display: block; font-size: 10.5px; color: ${D.mute}; line-height: 1.55; margin-top: 4px; }
        .fm-pm-more { display: inline-flex; align-items: center; gap: 3px; margin-top: 8px;
          font-size: 10.5px; color: ${D.gold}; letter-spacing: 0.03em; }
        @media (min-width: 700px) {
          .fm-pm-row { align-items: center; padding: 18px 20px; }
          .fm-pm-title { font-size: 17px; }
          .fm-pm-price { width: 190px; }
          .fm-pm-price-main { font-size: 22px; }
        }
        .fm-pm-note { font-size: 11.5px; line-height: 1.85; color: ${D.mute}; margin: 12px 2px 0; }

        /* 全プラン共通の条件。項目名と値の2段を1組にして、375pxで2列 = 3行に収める */
        .fm-common { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px; margin-top: 22px;
          padding-top: 20px; border-top: 1px solid ${D.line}; }
        @media (min-width: 700px) { .fm-common { grid-template-columns: repeat(3, 1fr); gap: 16px 20px; } }
        /* 見出しは列をまたいで1行使う。無いと、表の注記の続きに見えて
           「これは全プラン共通の話だ」が伝わらない */
        .fm-common-head { grid-column: 1 / -1; font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
          color: ${D.gold}; line-height: 1.5; margin-bottom: 2px; }
        .fm-common-label { font-size: 10.5px; color: ${D.mute}; letter-spacing: 0.06em; line-height: 1.5; }
        .fm-common-value { display: flex; align-items: flex-start; gap: 5px; font-size: 12.5px; font-weight: 700;
          color: ${D.ink}; line-height: 1.55; margin-top: 4px; }

        .fm-sticky-cta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: none;
          padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: rgba(11,11,12,0.92);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-top: 1px solid ${D.line}; }
        @media (max-width: 767px) { .fm-sticky-cta { display: block; } .fm-sticky-pad { height: 68px; } }
      `}</style>

      {/* 章の並び (2026-08-27 第2版)。
          オーナー指摘「まだ分かりにくい。特にiPhoneで、どんなものがいくらで作れるのかを」。

          第1版は「作れるもの(用途)」と「料金(尺別3プラン)」を別々の章に置いていたため、
          「採用動画はいくらか」に答えるには2章を突き合わせる必要があった。
          第2版では 用途・仕様・金額を1行にした料金早見表を映像の直後に置き、
          その1章だけで「何が、いくらで」が完結するようにしている。

          並びは 実物(映像) → 何がいくらか(早見表) → 目次 → 本当に作れるのか(実績) →
          金額の内訳(料金) → 誰がどう作り、どう頼むか(制作と発注の流れ) → 条件・FAQ → 相談。
          目次を早見表の後ろに置いてあるのは、目次が先にあると
          いちばん見せたい早見表が1スクロール遠のくため。 */}
      <FilmHero />
      <PriceMenu onPick={showPlan} />
      <SectionNav onPricing={showPricing} />
      <FilmWorks />
      <Pricing mode={pricingMode} onMode={setPricingMode} openPlan={openPlan} onOpenPlan={setOpenPlan} />
      <HowWeWork />
      <Terms />
      <Faq />
      <div className="fm-sticky-pad" />
      <FinalCta />
      <MobileStickyCta />
    </div>
  );
}

// ---- スクロール深度 (25/50/75/100%) ----
function useScrollDepth() {
  useEffect(() => {
    const hit = new Set<number>();
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.round((window.scrollY / max) * 100);
      for (const mark of [25, 50, 75, 100]) {
        if (pct >= mark && !hit.has(mark)) {
          hit.add(mark);
          track('studio_film_scroll_depth', { depth: mark });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
}

// ---- スクロール出現 ----
// 背面タブでは IntersectionObserver が発火せず opacity:0 のまま固まるため、
// 安全網として一定時間後に必ず全部出す。JS が無い/動かない場合は最初から見えている。
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') return;

    el.dataset.rv = 'pending';
    const show = () => { el.dataset.rv = 'in'; };
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { show(); io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);

    const safety = window.setTimeout(() => { show(); io.disconnect(); }, 2600);
    return () => { window.clearTimeout(safety); io.disconnect(); };
  }, []);

  return <div ref={ref} className="fm-rv" style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

// ---- スマホ専用の固定下部CTA。最終CTAセクション (id=film-inquiry) に入ったら隠す
// (常時表示だと、そこにある本来のLINEボタン・相談フォームの入力欄に重なるため) ----
function MobileStickyCta() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById('film-inquiry');
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) setHidden(e.isIntersecting);
    }, { rootMargin: '0px' });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  if (hidden) return null;

  return (
    <div className="fm-sticky-cta">
      <a className="st-btn fm-btn-light" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '11px 20px' }}
        onClick={() => track('studio_film_sticky_cta', { to: 'line' })}>
        <IconChat /> {CONTACT.lineLabel}
      </a>
    </div>
  );
}

// ============================================================
// ヒーローの映像。ページの最初に置く「これを作ります」の実物。
// 音は既定で切る (自動再生の条件であり、無音でないと再生自体が拒否される)。
// 自動再生は端末側の事情 (低電力モード/データセーバー/背面タブ) で普通に拒否される。
// その時に何も起きない静止画で終わらせないため、停止中は必ず再生ボタンを出す。
// ============================================================
function FilmHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
    if (!next) void v.play().catch(() => {});
    track('studio_film_hero_reel_sound', { muted: next });
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    const wasPaused = v.paused;
    if (wasPaused) void v.play().catch(() => {});
    else v.pause();
    track('studio_film_hero_reel_play', { play: wasPaused });
  };

  return (
    <section style={{ background: D.bg, paddingBottom: 44 }}>
      {/* 映像そのものがヒーロー。文字は重ねず、下の帯に置く。
          素材は縦型なので、切り抜かずに画面幅いっぱいの 9:16 で出す。 */}
      <div className="fm-hero">
        <div className="fm-hero-amb" aria-hidden="true" />
        <div className="fm-hero-frame">
          <video
            ref={videoRef}
            src="/studio/film/hero-reel.mp4"
            poster="/studio/film/hero-reel-poster.jpg"
            autoPlay muted loop playsInline preload="metadata"
            aria-label="CORE Studio が制作した映像"
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            onLoadedData={e => setPaused(e.currentTarget.paused)}
          />
          {paused && (
            <button type="button" className="fm-hero-play" onClick={togglePlay} aria-label="映像を再生する">
              <svg width="26" height="30" viewBox="0 0 26 30" aria-hidden="true">
                <path d="M2 2 L24 15 L2 28 Z" fill="currentColor" />
              </svg>
            </button>
          )}
          <button type="button" className="fm-hero-sound" onClick={toggleSound} aria-pressed={!muted}>
            {muted ? '音を出す' : '音を消す'}
          </button>
        </div>
      </div>

      {/* 2026-08-27 第2版 — 映像の下は「見出し・金額・押す場所」の3つだけにした。
          旧版はここに 用途チップ6個 + 数字4つ + 条件5つ が続いて 574px あり、
          ヒーローだけで2画面 (1,594px) を使っていた。用途と金額は直後の早見表で
          セットにして出すほうが速いので、ここでは重複させない。 */}
      <div className="st-inner" style={{ paddingTop: 20 }}>
        <div className="st-label fm-hero-label" style={{ color: D.gold }}>{FILM.label}</div>
        <h1 className="st-serif fm-hero-h1" style={{ whiteSpace: 'pre-line' }}>{FILM.hero}</h1>

        {/* 金額は見出しの直後。間に1文でも挟むと 375x812 で固定CTAの下に落ちる。
            「いくらから頼めるのか」が分からないまま2画面スクロールさせない */}
        <div className="fm-heroprice">
          {FILM.heroPrice.map(p => (
            <div key={p.label} className="fm-heroprice-item">
              <div className="st-serif fm-heroprice-value">{p.value}</div>
              <div className="fm-heroprice-label">{p.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button className="st-btn fm-btn-gold" onClick={() => { track('studio_film_hero_cta', { to: 'menu' }); scrollToId('film-menu'); }}>
            {FILM.heroCtaSub}
          </button>
          <a className="st-btn fm-btn-outline" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => track('studio_film_hero_cta', { to: 'line' })}>
            <IconChat /> {FILM.heroCta}
          </a>
        </div>

        <p className="fm-hero-sub">{FILM.heroSub}</p>
        <p className="fm-hero-note">この映像はすべてAIで制作しました。撮影はしていません。</p>
      </div>
    </section>
  );
}

// ============================================================
// 章の目次 — 20画面近い1枚ものを、必要な章から読めるようにする
// ============================================================
// mode を持つ項目は、飛ぶ前に料金セクションの表示を切り替える。
// 「月額プラン」を押したのに単発のカードが出ている、という食い違いを作らない。
const NAV_ITEMS: Array<{ id: string; label: string; mode?: PricingMode }> = [
  { id: 'film-menu', label: '料金早見表' },
  { id: 'film-works', label: '制作実績' },
  { id: 'film-pricing', label: '1本ずつの料金', mode: 'once' },
  { id: 'film-pricing', label: '月額プラン', mode: 'monthly' },
  { id: 'film-start', label: '制作と発注の流れ' },
  { id: 'film-terms', label: 'お取引の条件' },
  { id: 'film-faq', label: 'よくある質問' },
];

function SectionNav({ onPricing }: { onPricing: (m: PricingMode) => void }) {
  return (
    <nav aria-label="このページの目次" style={{ background: D.bg, paddingBottom: 30 }}>
      <div className="fm-nav">
        {NAV_ITEMS.map(n => (
          <button key={n.label} type="button" className="fm-nav-item"
            onClick={() => {
              track('studio_film_nav', { to: n.id, mode: n.mode });
              if (n.mode) onPricing(n.mode);
              else scrollToId(n.id);
            }}>
            {n.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ============================================================
// 料金早見表 — 2026-08-27 第2版。このページの中心。
//
// オーナー指摘「まだ分かりにくい。特にiPhoneで、どんなものがいくらで作れるのかを」。
//
// 直したかった構造上の問題:
//   「用途」(作れるもの = 日本語の6枚カード) と「金額」(TRIAL/STANDARD/PREMIUM = 尺の3プラン) が
//   別々の章・別々の軸に分かれていた。読む人は用途を読んでから 2,300px 下の料金表まで運ばれ、
//   そこで初めて英語のプラン名と尺だけの表に出会う。つまり「採用動画はいくらか」に答えるには、
//   2つの章を頭の中で突き合わせる作業が要った。
//   → 用途・仕様・金額を1行にまとめ、1つの表にする。6行を上から下へ1度読めば答えが出る。
//
// 6枚のカード(2列グリッド)をやめて表にした理由:
//   カードだと金額がカードごとに違う高さに出るため、375px では6つの金額が縦に揃わない。
//   揃わない金額は比べられない。表にすると金額が右端で1列に揃い、走査が1回で終わる。
//
// ここに映像は貼らない (film.ts の FILM_MENU のコメント参照。手持ちの参考映像には
// 実写素材が混ざっており「撮影をしない」という主張と食い違う。実映像は制作実績だけで見せる)。
// ============================================================
function PriceMenu({ onPick }: { onPick: (mode: PricingMode, plan?: string) => void }) {
  return (
    <section id="film-menu" style={{ background: D.bg, padding: '4px 0 48px', scrollMarginTop: 96 }}>
      <div className="st-inner">
        <Reveal>
          <div className="st-label" style={{ color: D.gold, marginBottom: 12 }}>{MENU_LEAD.en}</div>
          <h2 className="st-serif" style={{ fontSize: 'clamp(21px, 5.4vw, 27px)', fontWeight: 700, color: D.ink, margin: 0, lineHeight: 1.55 }}>
            {MENU_LEAD.title}
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.95, color: D.body, margin: '10px 0 0', maxWidth: 620 }}>{MENU_LEAD.sub}</p>
        </Reveal>

        <Reveal delay={60}>
          <div className="fm-pm" style={{ marginTop: 18 }}>
            {FILM_MENU.map(m => {
              const price = menuPriceParts(m.basis);
              const target = menuTarget(m.basis);
              return (
                // 行そのものを押せるようにする。金額の隣に「詳しく」のリンクを置くと、
                // 375px では金額が押しづらい幅に痩せる。行全体が当たり判定なら指で外さない。
                <button key={m.id} type="button" className="fm-pm-row"
                  onClick={() => { track('studio_film_menu_row', { id: m.id, mode: target.mode }); onPick(target.mode, target.plan); }}>
                  <span className="fm-pm-main">
                    <span className="fm-pm-title">{m.title}</span>
                    <span className="fm-pm-spec">{menuSpecLabel(m.basis)}</span>
                    <span className="fm-pm-body">{m.body}</span>
                  </span>
                  <span className="fm-pm-price">
                    <span className="st-serif fm-pm-price-main">{price.main}</span>
                    {price.sub && <span className="fm-pm-price-sub">{price.sub}</span>}
                    <span className="fm-pm-more" aria-hidden>
                      内訳を見る
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="fm-pm-note">{MENU_LEAD.note}</p>
        </Reveal>

        {/* 表の直下に「どの金額にも共通してついてくるもの」を1度だけ置く。
            各行に同じ注記を6回書くと表が読めなくなり、章を分けると金額から離れて読まれない。 */}
        <Reveal delay={100}>
          <div className="fm-common">
            <div className="fm-common-head">どの金額にも共通して含まれます</div>
            {FILM.common.map(c => (
              <div key={c.label} className="fm-common-item">
                <div className="fm-common-label">{c.label}</div>
                <div className="fm-common-value"><IconCheck color={D.gold} />{c.value}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================
// 制作と発注の流れ — 2026-08-27 第2版で「はじめかた(3ステップ)」と
// 「誰が作るか(制作6工程 + 窓口の実名)」を1章に統合した。
//
// 統合した理由:
//   分かれていた頃は、料金の前に工程6ステップ(917px)、料金の後にはじめかた3ステップ(814px)
//   と、同じ「頼んだら何が起きるか」の話が料金を挟んで2ヶ所に散っていた。
//   iPhone では合計2.1画面ぶんあり、しかもどちらも読み終わってから
//   「で、結局どっちの手順の話だったか」が残らない。
//   発注側の3ステップ → 受注後の当社6工程 → 窓口の実名、の順に1本の線として並べる。
// ============================================================
function HowWeWork() {
  return (
    <Band alt pad="48px 0" id="film-start">
      <Reveal>
        <div className="st-label" style={{ marginBottom: 12 }}>How It Works</div>
        <h2 className="st-serif" style={{ fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.6 }}>
          ご相談から納品までの流れ
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: '10px 0 0', maxWidth: 620 }}>
          お見積りのご提示までは無料です。ご連絡からご発注までに、費用が発生することはありません。
        </p>
      </Reveal>

      {/* 1. 発注を検討する側の3ステップ */}
      <Reveal delay={60}>
        <div className="fm-grid3" style={{ marginTop: 20 }}>
          {START_STEPS.map(s => (
            <div key={s.no} className="fm-why">
              <div className="fm-why-no">{s.no}</div>
              <div className="fm-why-title">{s.title}</div>
              <p className="fm-why-body">{s.body}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.goldText, margin: '10px 0 0', letterSpacing: '0.02em' }}>{s.time}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* 2. ご発注後に当社が踏む6工程。宣言 + 見出しだけに留める (詳細は書くと映像と重複する) */}
      <Reveal delay={100}>
        <div style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${C.line}` }}>
          <p className="st-serif" style={{ fontSize: 'clamp(17px, 4.2vw, 21px)', fontWeight: 700, lineHeight: 1.65, color: C.ink, margin: 0 }}>
            {PROCESS_STATEMENT.title}
          </p>
          <p className="fm-prose" style={{ fontSize: 13, lineHeight: 1.95, color: C.body, margin: '10px 0 0' }}>
            {PROCESS_STATEMENT.body}
          </p>
          <div className="fm-process-row" style={{ marginTop: 18 }}>
            {FILM_PROCESS.map(s => (
              <div key={s.no} className="fm-process-step">
                <span className="fm-process-no">{s.no}</span>
                <span className="fm-process-title">{s.title}</span>
              </div>
            ))}
          </div>
          {/* TRIALは「03 書く」にあたる台本・絵コンテを含まないため、標準工程である旨を明記する
              (Codexレビュー指摘: 断りなく並べるとTRIAL購入者が台本込みと誤解する) */}
          <p style={{ fontSize: 11, lineHeight: 1.85, color: C.mute, margin: '10px 0 0' }}>{PROCESS_STATEMENT.note}</p>
        </div>
      </Reveal>

      {/* 3. 誰が窓口を持つか、実名で名乗る。AI動画という業態では「結局だれが責任を持つのか」が
          発注側の最大の不安点になる。会社案内タブに埋もれさせず、流れの最後に置く。 */}
      <Reveal delay={140}>
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.line}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px 16px' }}>
          <span className="st-serif" style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{COMPANY.repName}</span>
          <span style={{ fontSize: 12, color: C.mute }}>{COMPANY.repTitle} — 企画からご発注後の窓口まで担当します</span>
          <a href={`mailto:${STUDIO.email}`} style={{ fontSize: 12, color: C.mute, textDecoration: 'underline', textUnderlineOffset: 2, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
            {STUDIO.email}
          </a>
        </div>
      </Reveal>
    </Band>
  );
}

// ============================================================
// 費用の構造 — 「お得かどうか」を読む人に計算させない章。
//
// 2026-08-23 オーナー指示で料金表の直後へ移動。自社の金額を先に見せ、
//   (1) 相場との差 → (2) その差が生まれる理由 → (3) 実写のほうが良い場合
// の順で受ける。理由 (2) を挟まずに安さだけを見せると、品質への不信に変わる。
// ============================================================
function ValueTable() {
  return (
    <Reveal>
      <div style={{ marginBottom: 22 }}>
        <h3 className="st-serif" style={{ fontSize: 'clamp(20px, 4.6vw, 24px)', fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {VALUE.title}
        </h3>
        <p className="fm-prose" style={{ fontSize: 14, lineHeight: 2, color: C.body, margin: '12px 0 0' }}>{VALUE.lead}</p>
      </div>

      <div className="fm-cmp">
        <div className="fm-cmp-head" aria-hidden>
          <div>{VALUE.tableHead.item}</div>
          <div>{VALUE.tableHead.market}</div>
          <div>{VALUE.tableHead.core}</div>
        </div>
        {VALUE.table.map((row, i) => (
          <Fragment key={row.item}>
            {/* 7行を一息に読ませない。制作費 / 上乗せ費用 / 条件 の3つに割ると、
                どこを比べている行なのかが1行ずつ判断しなくても分かる */}
            {row.group !== VALUE.table[i - 1]?.group && <div className="fm-cmp-group">{row.group}</div>}
            <div className="fm-cmp-row" data-hl={row.highlight ? '1' : undefined}>
              <div className="fm-cmp-item">{row.item}</div>
              <div className="fm-cmp-vals">
                <div className="fm-cmp-val"><span className="fm-cmp-cap">{VALUE.tableHead.market}</span>{row.market}</div>
                <div className="fm-cmp-val fm-cmp-val--core">
                  {row.highlight && <IconCheck />}
                  <span><span className="fm-cmp-cap">{VALUE.tableHead.core}</span>{row.core}</span>
                </div>
              </div>
            </div>
          </Fragment>
        ))}
      </div>
      <p className="fm-prose" style={{ fontSize: 12.5, lineHeight: 1.9, color: C.mute, margin: '12px 2px 0' }}>{VALUE.tableNote}</p>

      <div style={{ marginTop: 34 }}>
        <h4 className="st-serif" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: '0 0 14px', lineHeight: 1.6 }}>
          {VALUE.reasonsTitle}
        </h4>
        <div className="fm-grid3">
          {VALUE.reasons.map(r => (
            <div key={r.no} className="fm-why">
              <div className="fm-why-no">{r.no}</div>
              <div className="fm-why-title">{r.title}</div>
              <p className="fm-why-body">{r.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 22, background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '17px 18px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 7, lineHeight: 1.6 }}>{VALUE.honest.title}</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: 0 }}>{VALUE.honest.body}</p>
      </div>
    </Reveal>
  );
}

// 月額プランに切り替えた場合の実額差。手打ちの数字は価格改定で必ず食い違うため
// monthlySavings() で FILM_PLANS / MONTHLY_PLANS の実データから計算する。
function MonthlySavingsTable() {
  return (
    <Reveal>
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{VALUE.monthly.title}</div>
        <p style={{ fontSize: 12, lineHeight: 1.85, color: C.mute, margin: '0 0 12px' }}>{VALUE.monthly.body}</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {MONTHLY_PLANS.map(m => {
            const s = monthlySavings(m);
            return (
              <div key={m.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: '#FFFFFF', padding: '12px 14px', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, minWidth: 62 }}>{m.volume}</div>
                <div style={{ fontSize: 12, color: C.mute }}>{VALUE.monthly.colOneOff} <b style={{ color: C.ink }}>¥{s.oneOffTotal.toLocaleString('ja-JP')}</b></div>
                <div style={{ fontSize: 12, color: C.mute }}>{VALUE.monthly.colMonthly} <b style={{ color: C.ink }}>{m.price}</b></div>
                {/* 2026-08-24: 比較の基準を 20秒1本の通常価格 ¥89,800 に変えたため、
                    「規格の異なる比較を値引きに見せている」という旧指摘には当たらなくなった
                    (月額の1本は20〜30秒で、単発20秒より仕様は上。差は過大ではなく控えめ)。
                    ゆえに割合も出す。percent は切り捨て済み。 */}
                <div style={{ fontSize: 12, color: C.goldText, fontWeight: 700 }}>
                  {VALUE.monthly.colDiff} ¥{s.diff.toLocaleString('ja-JP')}（{s.percent}%）
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11.5, lineHeight: 1.85, color: C.mute, margin: '10px 0 0' }}>{VALUE.monthly.note}</p>
      </div>
    </Reveal>
  );
}

// ============================================================
// お取引の条件 — 修正規定・権利・NDA・支払・納期。
// 発注前に法人が確認する事項が1章も無かったため新設した。
// カード22枚あり、既定で開いていると買う判断の直前に壁になるため折りたたむ。
// ============================================================
function TermRows({ rows }: { rows: readonly { label: string; body: string }[] }) {
  return (
    <div className="fm-terms-grid">
      {rows.map(r => (
        <div key={r.label} style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: '#FFFFFF', padding: '16px 17px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, lineHeight: 1.6, marginBottom: 6 }}>{r.label}</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.body, margin: 0 }}>{r.body}</p>
        </div>
      ))}
    </div>
  );
}

// 折りたたみ。details/summary を使うとブラウザ既定の三角と行の高さが混ざるので、
// 44px を確保したボタンと状態表示を自前で持つ。
function Disclosure({ title, note, children, defaultOpen = false }: {
  title: string; note?: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: '#FFFFFF', overflow: 'hidden' }}>
      <button type="button" aria-expanded={open}
        onClick={() => { setOpen(v => !v); if (!open) track('studio_film_terms_open', { section: title }); }}
        style={{
          width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '15px 17px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontFamily: SANS,
        }}>
        <span>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.ink, lineHeight: 1.6 }}>{title}</span>
          {note && <span style={{ display: 'block', fontSize: 12, color: C.mute, lineHeight: 1.7, marginTop: 3 }}>{note}</span>}
        </span>
        <span aria-hidden style={{ color: C.goldText, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{ padding: '0 17px 20px', borderTop: `1px solid ${C.line}`, paddingTop: 18 }}>{children}</div>}
    </div>
  );
}

function Terms() {
  return (
    <Band pad="56px 0" id="film-terms">
      <Reveal>
        <H2 en="Terms & Conditions" sub="修正の範囲、権利の帰属、支払条件、AI制作特有の論点まで、発注前にご確認いただく事項をすべて公開しています。稟議に必要な項目は、この3つに揃えています。">
          お取引の条件
        </H2>
      </Reveal>

      <div style={{ display: 'grid', gap: 12 }}>
        <Disclosure title={REVISION.title} note={REVISION.lead}>
          <TermsRevision />
        </Disclosure>
        <Disclosure title={TERMS.title} note={TERMS.lead}>
          <TermRows rows={TERMS.rows} />
        </Disclosure>
        <Disclosure title={AI_TERMS.title} note={AI_TERMS.lead}>
          <TermRows rows={AI_TERMS.rows} />
        </Disclosure>
      </div>
    </Band>
  );
}

function TermsRevision() {
  return (
    <>
      <Reveal>
        <div className="st-card st-card-featured" style={{ background: '#FFFFFF' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 7 }}>{REVISION.unit.title}</div>
          <p style={{ fontSize: 13, lineHeight: 1.95, color: C.body, margin: 0 }}>{REVISION.unit.body}</p>
        </div>
      </Reveal>

      {/* プラン別の回数 */}
      <Reveal>
        <div style={{ marginTop: 16, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', background: '#FFFFFF' }}>
          {REVISION.rules.map((r, i) => (
            <div key={r.plan} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', padding: '13px 16px', borderTop: i === 0 ? 'none' : `1px solid ${C.line}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, letterSpacing: '0.06em', minWidth: 96 }}>{r.plan}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.goldText, minWidth: 54 }}>{r.count}</div>
              <p style={{ fontSize: 12.5, lineHeight: 1.8, color: C.body, margin: 0, flex: '1 1 200px' }}>{r.note}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* 範囲 / 対象外 */}
      <div className="fm-terms-grid" style={{ marginTop: 16 }}>
        <Reveal>
          <div style={{ height: '100%', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 12, background: '#FFFFFF', padding: '18px 17px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 11 }}>{REVISION.included.title}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {REVISION.included.items.map(x => (
                <li key={x} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.75, color: C.body }}><IconCheck />{x}</li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={60}>
          <div style={{ height: '100%', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 12, background: '#FFFFFF', padding: '18px 17px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 11 }}>{REVISION.excluded.title}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {REVISION.excluded.items.map(x => (
                <li key={x} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.75, color: C.body }}>
                  <span aria-hidden style={{ color: C.mute, flexShrink: 0, marginTop: 2 }}>—</span>{x}
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 12, lineHeight: 1.85, color: C.mute, margin: '11px 0 0' }}>{REVISION.excluded.note}</p>
          </div>
        </Reveal>
      </div>

      {/* 速さ・期限・お願い */}
      <div className="fm-terms-grid" style={{ marginTop: 12 }}>
        {[REVISION.speed, REVISION.window, REVISION.ask].map((b, i) => (
          <Reveal key={b.title} delay={i * 50}>
            <div style={{ height: '100%', boxSizing: 'border-box', background: C.bg, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '14px 15px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 5 }}>{b.title}</div>
              <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.body, margin: 0 }}>{b.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

    </>
  );
}

// ============================================================
// 選び方 — 旧「あなたにはこれ」+「迷った人向け分岐」+「こんな方の映像を」の統合。
// 3章とも問いは1つ (自分に合うか / どれを選ぶか) だったので、1章にまとめて縦の長さを詰める。
// ============================================================
// ============================================================
// 主力商品 — AI SHORT DRAMA
// ============================================================
// ============================================================
// 制作工程
// ============================================================
// ============================================================
// Stripe決済ボタン (未設定/失敗時はLINE相談へ自動フォールバック)
// ============================================================
function FilmCheckoutButton({ plan, mode, label }: { plan: string; mode: 'payment' | 'subscription'; label: string }) {
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    track('studio_film_checkout_start', { plan, mode });
    try {
      const resp = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, brand: 'film', mode }),
      });
      if (resp.status === 503) {
        track('studio_film_checkout_fallback', { plan });
        window.open(CONTACT.lineUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      const data: { url?: string } = await resp.json().catch(() => ({}));
      if (data.url) window.location.href = data.url;
      else window.open(CONTACT.lineUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.open(CONTACT.lineUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="st-btn st-btn-primary" style={{ width: '100%', boxSizing: 'border-box' }} onClick={go} disabled={busy}>
      {busy ? '決済ページを開いています…' : label}
    </button>
  );
}

// ============================================================
// 料金
//
// 2026-08-23 全面改編 (オーナー指示「値段が分かりやすいものを一番上に」)。
// 旧構成は TRIAL の詳細カード (仕様8行 + 価格の理由 + 含む/含まない) がいきなり先頭にあり、
// スマホでは1枚で1画面を使い切るため、3つの金額を並べて比べる画面が最後まで現れなかった。
// 新構成: 発注の形を選ぶ → 3つの金額 → 何が違うか (比較表) → 詳細 (折りたたみ) → 相場との差。
// 詳細を消したのではなく、買う判断に要る順に並べ直して、要る人だけが開く形にしている。
// ============================================================

// ---- 発注の形。単発と月額サブスクの条件を、押す前から両方見せる ----
function ModeSwitch({ mode, onPick }: { mode: PricingMode; onPick: (m: PricingMode) => void }) {
  return (
    <div className="fm-mode" aria-label="発注の形">
      {PRICING_MODES.map(m => {
        const on = mode === m.id;
        // role="tab" は使わない。矢印キーでの移動と roving tabindex まで実装しないと
        // タブの約束を破ることになる。ここは「押すと下の表示が入れ替わる2つのボタン」なので
        // aria-pressed で状態を伝え、aria-controls で行き先だけを示す。
        return (
          <button key={m.id} type="button" className="fm-mode-btn" data-on={on} data-mode={m.id}
            aria-pressed={on} aria-controls="film-pricing-panel" id={`film-pricing-tab-${m.id}`}
            onClick={() => onPick(m.id)}>
            <span className="fm-mode-badge">{m.badge}</span>
            <span className="fm-mode-label">{m.label}</span>
            <span className="fm-mode-hint">{m.hint}</span>
            <span className="fm-mode-unit">{m.unit}</span>
            <ul className="fm-mode-points">
              {m.points.map(p => <li key={p} className="fm-mode-point"><IconCheck />{p}</li>)}
            </ul>
            <span className="fm-mode-foot">
              <svg className="fm-mode-caret" width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m9 18 6-6-6-6" />
              </svg>
              {on ? '下に表示しています' : m.cta}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---- 早見カード (単発)。金額・向く相手・作れるものだけに絞る。仕様の全項目は下の比較表 ----
function PlanPickCards({ onDetail }: { onDetail: (id: string) => void }) {
  // 期限を過ぎたら、割引の表示ごと消す。期限切れの「33%OFF」が残るのが一番まずい。
  // TRIAL は日付ではなく「初めてのお取引」という条件つきなので、期限とは無関係に出し続ける。
  const live = isCampaignLive();
  return (
    <div className="fm-pick">
      {FILM_PLANS.map(p => {
        const isTrial = p.id === 'trial';
        const showOffer = !!p.listPriceYen && (isTrial || live);
        const off = p.listPriceYen ? offPercent(p.listPriceYen, p.priceYen) : 0;
        return (
        <div key={p.id} className="fm-pick-card" data-featured={p.featured ? 'true' : undefined}>
          <div className="fm-pick-badgerow">
            {p.featured && <span className="fm-pick-badge">おすすめ</span>}
            {showOffer && (
              <span className="fm-pick-badge" data-offer="true">
                {isTrial ? TRIAL_OFFER.badge : CAMPAIGN.badge}
              </span>
            )}
          </div>
          {/* 2026-08-27 第2版: 見出しを英語のプラン名から「20秒 1本」に入れ替えた。
              初めて見る人にとって TRIAL / STANDARD / PREMIUM は何が届くかを1文字も語らない。
              プラン名は問い合わせ時の符丁として要るので、小さく残す */}
          <div className="fm-pick-name" data-ja="true">{p.unit}</div>
          <div className="fm-pick-unit">{p.name}</div>
          {/* 通常価格を先に見せてから、実際にお支払いいただく額を主役の大きさで出す。
              取り消し線だけを置いて割引額を書かないと、いくら安いのかを読む人に計算させることになる */}
          {showOffer && (
            <div className="fm-pick-was">
              <span className="fm-pick-was-price">通常 {p.listPrice}</span>
              <span className="fm-pick-was-off">
                {off}%OFF ／ {yen((p.listPriceYen ?? 0) - p.priceYen)} 引き
              </span>
            </div>
          )}
          <div className="fm-pick-price">{p.price}</div>
          <div className="fm-pick-tax">税込 ／ 初稿まで {p.delivery}</div>
          {showOffer && p.offerNote && <div className="fm-pick-offnote">{p.offerNote}</div>}
          <p className="fm-pick-fit">{p.fit}</p>
          {/* 「何ができるか」を仕様より先に置く。尺とカット数だけでは用途が想像できない */}
          <ul className="fm-pick-uses">
            {p.useCases.map(u => <li key={u} className="fm-pick-use"><IconCheck />{u}</li>)}
          </ul>
          <div className="fm-pick-foot">
            {p.checkout ? (
              <FilmCheckoutButton plan={p.id} mode="payment" label={p.cta} />
            ) : (
              <a className="st-btn st-btn-primary" style={{ width: '100%', boxSizing: 'border-box' }}
                href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
                onClick={() => track('studio_film_pricing_cta', { plan: p.id, to: 'line' })}>
                <IconChat /> {p.cta}
              </a>
            )}
            <button type="button" className="fm-pick-more" onClick={() => onDetail(p.id)}>
              含まれるものを見る
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}

// ---- 早見カード (月額)。違うのは本数だけなので、1本あたりの金額を主役にする ----
function MonthlyPickCards() {
  return (
    <div className="fm-pick">
      {MONTHLY_PLANS.map(m => (
        <div key={m.id} className="fm-pick-card" data-featured={m.featured ? 'true' : undefined}>
          <div className="fm-pick-badgerow">
            {m.featured && <span className="fm-pick-badge">おすすめ</span>}
          </div>
          {/* '4 VIDEOS' をそのまま出すと本数が一瞬で読めない。count から日本語を組む */}
          <div className="fm-pick-name" data-ja="true">月{m.count}本</div>
          <div className="fm-pick-unit">1本 20〜30秒</div>
          <div className="fm-pick-price">{m.price}</div>
          <div className="fm-pick-tax">税込 ／ 月々のお支払い</div>
          <p className="fm-pick-fit">{m.unitPrice}</p>
          {/* 「1本ずつ頼んだほうが安いのでは」という疑いは、月額の金額を見た瞬間に生まれる。
              疑いが生まれる場所と同じ場所で、20秒1本の通常価格 × 本数と並べて否定する */}
          <div className="fm-pick-save">
            1本ずつなら <s>{yen(monthlySavings(m).oneOffTotal)}</s>（20秒 ¥89,800 × {m.count}本）
            <br />このプランなら {yen(monthlySavings(m).diff)} 分が浮きます
          </div>
          <p className="fm-pick-body">{m.body}</p>
          <div className="fm-pick-foot">
            <FilmCheckoutButton plan={m.id} mode="subscription" label="この本数で契約する" />
            <a href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer" className="fm-pick-more"
              style={{ textDecoration: 'none' }}
              onClick={() => track('studio_film_pricing_cta', { plan: m.id, to: 'line' })}>
              本数を相談してから決める
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- 何が違うかの比較表。行は film.ts の仕様から組む (手書きの表は必ず古くなる) ----
function PlanMatrix() {
  const rows = useMemo(() => planMatrix(), []);
  return (
    <>
      {/* 案内は表より先に出す。表を読み始めてから下で気づいても遅い */}
      <p className="fm-mx-note fm-mx-scrollhint">
        <span aria-hidden>↔</span>表は横にスクロールすると、3つのプランを並べて比べられます。
      </p>
      <div className="fm-mx-wrap">
        <table className="fm-mx">
          <thead>
            <tr className="fm-mx-head">
              <th scope="col" className="fm-mx-corner">項目</th>
              {FILM_PLANS.map(p => (
                <th key={p.id} scope="col" className={`fm-mx-plan${p.featured ? ' fm-mx-col-featured' : ''}`}>
                  <div className="fm-mx-plan-name">{p.unit}</div>
                  <div className="fm-mx-plan-price">{p.price}</div>
                  <div className="fm-mx-plan-unit">
                    {p.name}
                    {p.listPrice && (p.id === 'trial' || isCampaignLive()) && (
                      <><br />通常 {p.listPrice}／{p.id === 'trial' ? TRIAL_OFFER.badge : CAMPAIGN.badge}</>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} data-em={r.emphasis ? '1' : undefined}>
                <th scope="row" className="fm-mx-key">{r.label}</th>
                {r.values.map((v, i) => (
                  <td key={FILM_PLANS[i].id} className={FILM_PLANS[i].featured ? 'fm-mx-col-featured' : undefined}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---- プランの詳細 (既定は閉じる)。買う判断の直前に22行の仕様を壁として置かない ----
function PlanDetail({ p, open, onToggle }: { p: FilmPlan; open: boolean; onToggle: () => void }) {
  return (
    <div id={`film-plan-${p.id}`}
      style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: '#FFFFFF', overflow: 'hidden', scrollMarginTop: 96 }}>
      <button type="button" aria-expanded={open} onClick={onToggle}
        style={{
          width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '15px 17px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontFamily: SANS,
        }}>
        <span>
          <span className="st-serif" style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.ink, letterSpacing: '0.02em' }}>
            {p.unit} <span style={{ letterSpacing: 'normal', color: C.mute, fontWeight: 400, fontSize: 12.5 }}>
              {p.listPrice && (p.id === 'trial' || isCampaignLive()) && <s style={{ marginRight: 5 }}>{p.listPrice}</s>}{p.price} ／ {p.name}
            </span>
          </span>
          <span style={{ display: 'block', fontSize: 12, color: C.mute, lineHeight: 1.7, marginTop: 4 }}>{p.lead}</span>
        </span>
        <span aria-hidden style={{ color: C.goldText, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ padding: '18px 17px 20px', borderTop: `1px solid ${C.line}` }}>
          {/* 2026-08-24: ボタンの文言を「含まれるものを見る」に変えたので、
              開いた先も含まれるものから始める。価格の理由は読みたい人が最後に読む位置へ移した */}
          <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.1em', color: C.mute, margin: '0 0 8px' }}>含まれるもの</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {p.includes.map(x => (
              <li key={x} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{x}</li>
            ))}
          </ul>

          {/* 含まれないもの。書かない見積りは必ず後で揉める。書くこと自体が信頼になる */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.1em', color: C.mute, marginBottom: 8 }}>含まれないもの</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 5 }}>
              {p.excludes.map(x => (
                <li key={x} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.7, color: C.mute }}>
                  <span aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>—</span>{x}
                </li>
              ))}
            </ul>
          </div>

          {/* 価格の理由。書かないと、金額の差が値付けの気分に見える */}
          <div className="fm-priceway">
            <div className="fm-priceway-key">この価格になる理由</div>
            <p className="fm-priceway-body">{p.why}</p>
          </div>

          <div style={{ marginTop: 18 }}>
            {p.checkout ? (
              <>
                <FilmCheckoutButton plan={p.id} mode="payment" label={p.cta} />
                {/* 決済ボタンの控え。実測19pxだったので、44pxの当たりを確保する */}
                <a href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, textAlign: 'center', fontSize: 12.5, color: C.mute, marginTop: 4 }}
                  onClick={() => track('studio_film_pricing_cta', { plan: p.id, to: 'line' })}>
                  発注前に要件を相談する
                </a>
              </>
            ) : (
              <a className="st-btn st-btn-primary" style={{ width: '100%', boxSizing: 'border-box' }}
                href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
                onClick={() => track('studio_film_pricing_cta', { plan: p.id, to: 'line' })}>
                <IconChat /> {p.cta}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// openPlan はページ側が持つ。料金早見表の行から「そのプランの内訳」を直接開くため、
// この章の内部状態にしておくと外から開けない。
function Pricing({ mode, onMode, openPlan, onOpenPlan }: {
  mode: PricingMode; onMode: (m: PricingMode) => void;
  openPlan: string | null; onOpenPlan: (id: string | null) => void;
}) {
  const setOpenPlan = onOpenPlan;

  const pickMode = (m: PricingMode) => {
    if (m === mode) return;
    onMode(m);
    track('studio_film_pricing_mode', { mode: m });
  };

  // 開くだけだと、画面のどこが変わったのか分からないまま置き去りになる。
  // 開いた先まで運ぶ。描画が終わってからでないと行き先の座標が取れないので1拍待つ
  // (rAF は画面が隠れている間は呼ばれないため setTimeout を使う)。
  const openDetail = (id: string) => {
    setOpenPlan(id);
    track('studio_film_plan_detail', { plan: id });
    window.setTimeout(() => scrollToId(`film-plan-${id}`), 0);
  };

  return (
    <Band pad="56px 0" id="film-pricing">
      <Reveal>
        <H2 en="Pricing" sub="発注の形をお選びください。金額・納期・含まれるものを、この章にすべて記載しています。">料金</H2>
      </Reveal>

      {/* 1. 発注の形。単発と月額サブスクの条件を両方出したうえで、詳しく見る側を選んでもらう */}
      <Reveal>
        <ModeSwitch mode={mode} onPick={pickMode} />
      </Reveal>

      <div id="film-pricing-panel" role="group" aria-labelledby={`film-pricing-tab-${mode}`}>
      <Reveal>
        <p className="fm-prose" style={{ fontSize: 13, lineHeight: 1.95, color: C.body, margin: '20px 2px 0' }}>
          {PRICING_LEAD[mode]}
        </p>
      </Reveal>

      {/* 2. 3つの金額。ここまでを1画面目に収める */}
      <div style={{ marginTop: 20 }}>
        {mode === 'once' ? <PlanPickCards onDetail={openDetail} /> : <MonthlyPickCards />}
      </div>

      {/* 初回価格の根拠と枠。安さの理由を書かずに割引だけを出すと、品質への不信にしかならない。
          「残り◯枠」のような検証できないカウンターは置かず、守れる条件だけを静かに書く */}
      {mode === 'once' && (
        <Reveal>
          <div className="st-card" style={{ marginTop: 14, background: '#FFFFFF' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
              いまの価格について
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.body, margin: 0 }}>
              <b style={{ color: C.ink }}>TRIAL（20秒）</b> — {TRIAL_OFFER.why}
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.85, color: C.mute, margin: '6px 0 0' }}>
              {TRIAL_OFFER.limit}。{TRIAL_OFFER.quota}
            </p>
            {isCampaignLive() && (
              <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.body, margin: '12px 0 0', paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                <b style={{ color: C.ink }}>STANDARD・PREMIUM</b> — 開設にあたり、{CAMPAIGN.untilLabel} のご発注分までを現行価格でお引き受けしています。
                {CAMPAIGN.nextLabel} 以降は、STANDARD ¥192,000・PREMIUM ¥385,000 に改定します。
                <span style={{ color: C.mute }}>（すでにご発注いただいた制作は、改定後も当初の金額のまま進めます）</span>
              </p>
            )}
          </div>
        </Reveal>
      )}

      {mode === 'once' ? (
        <>
          {/* 3. 何が違うのか。3枚のカードを読み比べさせず、1つの表で差だけを見せる */}
          <Reveal>
            <div style={{ marginTop: 40 }}>
              <h3 className="st-serif" style={{ fontSize: 19, fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.6 }}>
                {PLAN_LADDER.title}
              </h3>
              <p className="fm-prose" style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: '10px 0 16px' }}>
                {PLAN_LADDER.body}
              </p>
              <PlanMatrix />
              {/* 2026-08-27: 表の直後に散文を1段落置くと、比較を終えた人の視線が
                  もう一度読み物に戻される。読みたい人だけが開く形に落とす */}
              <div style={{ marginTop: 14 }}>
                <Disclosure title="制作費は何で決まりますか？" note="尺ではなく、カット数と設計の工程で決まります。">
                  <p style={{ fontSize: 13, lineHeight: 1.95, color: C.body, margin: 0 }}>{PRICE_WHY}</p>
                </Disclosure>
              </div>
            </div>
          </Reveal>

          {/* 4. 詳細。要る人だけが開く */}
          <Reveal>
            <div style={{ marginTop: 36 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 12 }}>
                プランごとの詳細
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {FILM_PLANS.map(p => (
                  <PlanDetail key={p.id} p={p} open={openPlan === p.id}
                    onToggle={() => setOpenPlan(openPlan === p.id ? null : p.id)} />
                ))}
              </div>
            </div>
          </Reveal>
        </>
      ) : (
        <>
          {/* 月額。1本あたりが単発の半額以下に見えるので、仕様と理由を必ずここに置く */}
          <Reveal>
            <div style={{ marginTop: 40 }}>
              <div className="st-label" style={{ marginBottom: 10 }}>{MONTHLY_LEAD.en}</div>
              <h3 className="st-serif" style={{ fontSize: 19, fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.6 }}>{MONTHLY_LEAD.title}</h3>
              <p className="fm-prose" style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: '10px 0 0' }}>{MONTHLY_LEAD.body}</p>
            </div>
          </Reveal>

          <Reveal>
            <div className="st-card" style={{ marginTop: 18, background: '#FFFFFF' }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 10 }}>{MONTHLY_SPEC.title}</div>
              <div className="fm-spec" style={{ marginTop: 0 }}>
                {MONTHLY_SPEC.rows.map(s => (
                  <div key={s.label} className="fm-spec-row">
                    <div className="fm-spec-key">{s.label}</div>
                    <div className="fm-spec-val">{s.value}</div>
                  </div>
                ))}
              </div>
              {/* 「なぜ単発より安いのか」は買う前に必ず湧く疑問だが、
                  400字の散文を仕様表の直後に置くと表を読み終えた勢いが止まる。折りたたむ */}
              <div style={{ marginTop: 14 }}>
                <Disclosure title="1本あたりが単発より安い理由" note="値引きではなく、初月の設計を翌月から使い回せるためです。">
                  <p style={{ fontSize: 13, lineHeight: 1.95, color: C.body, margin: 0 }}>{MONTHLY_SPEC.why}</p>
                </Disclosure>
              </div>
              <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.1em', color: C.mute, marginBottom: 8 }}>含まれないもの</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 5 }}>
                  {MONTHLY_SPEC.excludes.map(x => (
                    <li key={x} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.7, color: C.mute }}>
                      <span aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>—</span>{x}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>

          <MonthlySavingsTable />

          <Reveal>
            <div className="st-card" style={{ marginTop: 18, background: '#FFFFFF' }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 10 }}>継続プランの条件</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {MONTHLY_TERMS.map(t => (
                  <li key={t} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{t}</li>
                ))}
              </ul>
              <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.mute, margin: '12px 0 0' }}>
                合わないと感じた月で停止できます。続ける理由が毎月あることを、私たちの側の条件にしています。
              </p>
            </div>
          </Reveal>
        </>
      )}
      </div>

      {/* 5. 相場との差。2026-08-27 第2版で折りたたみに変えた。
          自社の金額を見た後に置く順番は正しかったが、常時開いていると
          375px で 1,800px (2.2画面) の読み物が金額とCTAの間に挟まる。
          「高いのか安いのか」を確かめたい人だけが開けばよい。見出しで中身が分かるようにしておく。 */}
      <div style={{ marginTop: 36 }}>
        <Disclosure title="相場と比べていくらか" note="一般的な実写制作との費用の違いと、その差が生まれる理由。">
          <ValueTable />
        </Disclosure>
      </div>

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <a className="st-btn st-btn-ghost" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
          onClick={() => track('studio_film_pricing_cta', { plan: mode, to: 'line' })}>
          <IconChat /> どれを選ぶか相談する
        </a>
        <Note>{PRICE_NOTE}</Note>
      </div>
    </Band>
  );
}

// ============================================================
// 制作実績
// ============================================================
function WorkCard({ w }: { w: (typeof FILM_WORKS)[number] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const play = () => { videoRef.current?.play().then(() => setPlaying(true)).catch(() => {}); };
  const pause = () => { videoRef.current?.pause(); setPlaying(false); };
  const toggle = () => { if (playing) pause(); else play(); };

  return (
    <article className="fm-shot">
      {w.videoUrl ? (
        <button type="button" onClick={toggle} onMouseEnter={play} onMouseLeave={pause}
          aria-label={`${w.client} の制作事例を${playing ? '止める' : '再生する'}`}
          style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
          <div className="fm-frame" style={{ aspectRatio: '9 / 16' }}>
            <video ref={videoRef} src={w.videoUrl} poster={w.poster} muted loop playsInline preload="none" aria-hidden />
          </div>
        </button>
      ) : w.poster ? (
        <div className="fm-frame" style={{ aspectRatio: '9 / 16' }}><img src={w.poster} alt={`${w.client} の制作事例`} loading="lazy" /></div>
      ) : null}
      <div style={{ marginTop: 12 }}>
        <div className="st-label" style={{ fontSize: 10, marginBottom: 4 }}>{w.category}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{w.client}</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.8, color: C.body, margin: '6px 0 0' }}>{w.purpose}</p>
        {w.result && <p style={{ fontSize: 12.5, lineHeight: 1.8, color: C.goldText, margin: '4px 0 0', fontWeight: 600 }}>{w.result}</p>}
        {w.url && (
          <a href={w.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 11.5, color: C.body, textDecoration: 'underline', textUnderlineOffset: 2 }}>
            {w.client} 公式サイト ↗
          </a>
        )}
      </div>
    </article>
  );
}

// 9:16 の縦型を1列で積むとスマホで3本 = 約2,300px を占めるため、ショーケースと同じ横スクロールに揃える。
// 2026-08-27: 先頭にあったイベントブランディングの説明 (1段落) は撤去した。
// 同じ内容を「作れるもの」の1行に畳んであり、ここに残すと同じ話を2度読ませることになる。
function FilmWorks() {
  return (
    <section id="film-works" style={{ background: C.alt, padding: '56px 0', scrollMarginTop: 96 }}>
      <div className="st-inner">
        <Reveal><H2 en="Works" sub="すべて当社が制作し、実際に納品した映像です。掲載は貴社の許可をいただいたもののみで、非公開のご希望があれば一切掲載しません。">制作実績</H2></Reveal>
      </div>
      <Reveal delay={60}>
        <div className="fm-scroller">
          {FILM_WORKS.map(w => <WorkCard key={w.id} w={w} />)}
        </div>
      </Reveal>
    </section>
  );
}

// ============================================================
// 象徴商品
// ============================================================
// ============================================================

// ============================================================
// FAQ
// ============================================================
function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Band alt pad="56px 0" id="film-faq">
      <Reveal><H2 en="FAQ" sub="ご相談前によくいただくご質問です。">よくある質問</H2></Reveal>
      <div>
        {FILM_FAQ.map((f, i) => (
          <div key={f.q} className="fm-faq-item">
            <button className="fm-faq-btn" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span>Q. {f.q}</span>
              <span style={{ color: C.goldText, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: '0 0 16px' }}>{f.a}</p>}
          </div>
        ))}
      </div>
    </Band>
  );
}

// ============================================================
// 思想
// ============================================================
// ============================================================
// 最終CTA + 相談メモ (4問 → LINEに貼れる形でコピー)
// ============================================================
function FinalCta() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  const answeredCount = Object.keys(answers).length;

  const pick = (field: string, value: string) => {
    if (!startedRef.current) { startedRef.current = true; track('studio_film_inquiry_start'); }
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  // 選んだものだけを載せる。未選択を「未選択」と並べるとLINEに貼った時に見苦しい。
  const summaryText = useMemo(() => {
    const lines = ['映像制作の相談です。'];
    for (const f of INQUIRY_FIELDS) {
      if (answers[f.id]) lines.push(`・${f.question}: ${answers[f.id]}`);
    }
    return lines.join('\n');
  }, [answers]);

  // クリップボードは埋め込み・権限拒否の環境で普通に失敗する。
  // 黙って何も起きないと「押したのに動かない」になるので、必ず手で拾える形に落とす。
  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt('以下をコピーして、LINEのトークに貼り付けてください', summaryText.replace(/\n/g, ' / '));
    }
  };

  // LINEを開く前に、選んだ内容をクリップボードへ。貼るだけで話が始まる状態にする。
  const openLine = () => {
    track('studio_film_inquiry_submit', { answered: answeredCount, to: 'line' });
    if (answeredCount > 0) void copySummary();
  };

  return (
    <section id="film-inquiry" style={{ background: D.bg, padding: '56px 0 64px', scrollMarginTop: 96 }}>
      <div className="st-inner">
        <Reveal>
          <h2 className="st-serif" style={{ fontSize: 'clamp(24px, 6.6vw, 34px)', fontWeight: 700, lineHeight: 1.55, color: D.ink, margin: 0, whiteSpace: 'pre-line' }}>
            {FILM_CTA.title}
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 2.05, color: D.body, margin: '18px 0 0', maxWidth: 560 }}>{FILM_CTA.body}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            {FILM_CTA.tags.map(t => <span key={t} className="fm-tag">{t}</span>)}
          </div>
          <div className="fm-reassure" style={{ marginTop: 18 }}>
            {FILM_CTA.reassure.map(t => (
              <span key={t} className="fm-reassure-item"><IconCheck color={D.gold} />{t}</span>
            ))}
          </div>
        </Reveal>

        {/* 4問。すべて任意で、1つも選ばずにLINEへ進める */}
        <div style={{ marginTop: 34, background: D.raise, border: `1px solid ${D.line}`, borderRadius: 14, padding: '24px 20px' }}>
          <div style={{ fontSize: 12.5, color: D.mute, marginBottom: 20, lineHeight: 1.8 }}>
            選んでおくと、LINEを開いたときに貼るだけで話が始まります。すべて任意で、飛ばしてそのままLINEに進んでも構いません。
          </div>
          {INQUIRY_FIELDS.map(f => (
            <fieldset key={f.id} style={{ border: 'none', padding: 0, margin: '0 0 22px' }}>
              <legend style={{ fontSize: 13.5, fontWeight: 700, color: D.ink, padding: 0, marginBottom: 10 }}>{f.question}</legend>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {f.options.map(o => {
                  const on = answers[f.id] === o;
                  return (
                    <button key={o} type="button" onClick={() => pick(f.id, o)} aria-pressed={on}
                      style={{
                        minHeight: 46, padding: '11px 15px', borderRadius: 8, cursor: 'pointer', fontFamily: SANS,
                        fontSize: 13.5, textAlign: 'left', transition: 'border-color 140ms ease',
                        border: on ? `1.5px solid ${D.gold}` : `1px solid ${D.line}`,
                        background: on ? 'rgba(212,169,79,0.12)' : 'transparent',
                        color: on ? D.ink : D.body, fontWeight: on ? 600 : 400,
                      }}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
            <a className="st-btn fm-btn-light" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
              style={{ width: '100%', boxSizing: 'border-box' }} onClick={openLine}>
              <IconChat /> {CONTACT.lineLabel}
            </a>
            {answeredCount > 0 && (
              <button className="st-btn fm-btn-outline" onClick={() => { void copySummary(); }} style={{ width: '100%', boxSizing: 'border-box' }}>
                <IconCopy /> {copied ? 'コピーしました' : '選んだ内容をコピーする'}
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, color: D.mute, lineHeight: 1.9, marginTop: 14, textAlign: 'center' }}>
            {answeredCount > 0
              ? 'LINEを開くと同時に、選んだ内容をコピーします。トークに貼り付けて送信してください。'
              : CONTACT.lineNote}
            <br />
            LINEをお使いでない場合は、メールでも承ります。<br />
            <a href={`mailto:${STUDIO.email}?subject=${encodeURIComponent('【CORE Studio】映像制作のご相談')}`}
              style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: D.body, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              {STUDIO.email}
            </a>
          </p>
        </div>

        <div className="st-serif" style={{ fontSize: 13, color: D.mute, textAlign: 'center', marginTop: 24, letterSpacing: '0.12em', fontFamily: SERIF }}>
          CORE STUDIO — FILM &amp; MOTION
        </div>
      </div>
    </section>
  );
}
