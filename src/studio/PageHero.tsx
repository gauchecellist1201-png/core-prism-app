// ============================================================
// CORE Studio — 下層ページ共通の見せ場 (2026-09-04 全面刷新)
//
// サイト制作 / 受託開発 / 運用 / 会社案内 / お問い合わせ の5ページは、
// 「760px の白い1段組にチップとカード1枚」で、制作会社の顔として弱かった
// (オーナー指摘「あまりに普通すぎる」)。
// 5ページとも映像タブと同じ暗部のヒーローで始め、1160px の編集レイアウトで組み直す。
// ここには 5ページが共有する CSS (.sp-*) と、ヒーロー / FAQ / 自社プロダクト一覧の部品だけを置く。
// 文言・価格は plans.ts (正本) から読む。ここで新しい数字を作らない。
// ============================================================
import { useState, type ReactNode } from 'react';
import { C, D, SERIF, SANS } from './theme';
import { SUITE_ALL, suiteService } from '../corporate/suiteData';

export type Fact = { v: string; l: string };

const PAGE_CSS = `
  /* ── ヒーロー (暗部) ─────────────────────────────────────────
     映像タブ・ホームと同じ「ぼかした画を敷き、その上に立つ」構成。
     見出しに opacity:0 の入場演出は付けない (ページが隠れたまま読み込まれると消えたままになる)。 */
  .sp-hero { position: relative; background: ${D.bg}; color: #FFFFFF; overflow: hidden; isolation: isolate; }
  .sp-hero-amb { position: absolute; inset: -12%; z-index: 0; pointer-events: none;
    background-position: center; background-size: cover;
    filter: blur(70px) saturate(1.1) brightness(0.3); transform: scale(1.1); }
  .sp-hero::before { content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background: linear-gradient(180deg, rgba(11,11,12,0.55) 0%, rgba(11,11,12,0.2) 45%, rgba(11,11,12,0.92) 100%); }
  .sp-hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr; gap: 30px; padding: 40px 0 40px; }
  .sp-hero-grid[data-solo="true"] { max-width: 820px; }
  .sp-h1 { font-family: ${SERIF}; font-size: clamp(30px, 4.6vw, 56px); font-weight: 700; line-height: 1.32;
    letter-spacing: 0.02em; color: #FFFFFF; margin: 14px 0 0; text-shadow: 0 2px 24px rgba(0,0,0,0.45); }
  .sp-h1[data-size="compact"] { font-size: clamp(27px, 3.7vw, 46px); }
  .sp-lead { font-size: 15px; line-height: 2; color: ${D.body}; margin: 18px 0 0; max-width: 560px; }
  .sp-hero-cta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 26px; }
  .sp-hero-note { font-size: 12px; color: ${D.mute}; margin: 12px 0 0; line-height: 1.8; letter-spacing: 0.02em; }
  .sp-facts { list-style: none; margin: 30px 0 0; padding: 22px 0 0; border-top: 1px solid ${D.line};
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; }
  .sp-fact b { display: block; font-family: ${SERIF}; font-size: 22px; font-weight: 700; color: #FFFFFF; line-height: 1.3; letter-spacing: 0.02em; }
  .sp-fact span { display: block; font-size: 11.5px; color: ${D.mute}; letter-spacing: 0.04em; margin-top: 4px; }
  .sp-visual { position: relative; min-width: 0; }
  @media (min-width: 960px) {
    .sp-hero-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 46%); align-items: center; column-gap: 48px;
      min-height: min(calc(100dvh - 150px), 660px); padding: 56px 0 52px; }
    .sp-hero-grid[data-solo="true"] { grid-template-columns: 1fr; min-height: 0; padding: 60px 0 48px; }
    .sp-hero::before { background: linear-gradient(90deg, rgba(11,11,12,0.86) 0%, rgba(11,11,12,0.5) 50%, rgba(11,11,12,0.25) 100%); }
  }
  @media (min-width: 1200px) { .sp-facts { grid-template-columns: repeat(4, auto); justify-content: start; gap: 14px 40px; } }

  /* ── 章の共通部品 ── */
  .sp-grid2 { display: grid; gap: 16px; grid-template-columns: 1fr; }
  @media (min-width: 860px) { .sp-grid2 { grid-template-columns: 1fr 1fr; } }
  .sp-grid3 { display: grid; gap: 16px; grid-template-columns: 1fr; }
  @media (min-width: 860px) { .sp-grid3 { grid-template-columns: repeat(3, 1fr); } }
  .sp-cta { border: 1px solid ${C.goldLine}; border-radius: 18px; padding: clamp(36px, 5vw, 60px) 22px; text-align: center;
    background: #FFFFFF; max-width: 860px; margin: 0 auto; }
  .sp-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 7px; }
  .sp-list li { display: flex; gap: 8px; font-size: 13.5px; line-height: 1.7; color: ${C.body}; }
  .sp-best { background: ${C.alt}; border-left: 3px solid ${C.gold}; border-radius: 4px; padding: 10px 13px; font-size: 13px; line-height: 1.85; color: ${C.body}; }
  .sp-best b { color: ${C.ink}; font-weight: 600; }
  .sp-shot { position: relative; aspect-ratio: 16 / 10; overflow: hidden; border-radius: 14px; border: 1px solid ${C.line}; background: ${C.alt}; }
  .sp-shot img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .sp-pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .sp-pill { font-family: ${SANS}; font-size: 12.5px; font-weight: 600; letter-spacing: 0.04em; color: ${D.ink};
    border: 1px solid ${D.line}; background: ${D.raise}; border-radius: 999px; padding: 8px 14px; }

  /* ── 実物のスクリーンショットを3Dに重ねた束 (サイト制作のヒーロー) ──
     写真素材は置かない (ヒーローは実機のUI)。公開中のサイト4件を奥から手前へ重ね、
     translate だけをゆっくり上下させる (transform は角度で使うので、別プロパティの translate で浮かせる)。 */
  .sp-deck { position: relative; height: clamp(250px, 66vw, 430px); perspective: 1400px; }
  @media (min-width: 960px) { .sp-deck { height: 430px; } }
  .sp-deck-card { position: absolute; display: block; width: 62%; aspect-ratio: 16 / 10; border-radius: 10px; overflow: hidden;
    background: #000; border: 1px solid rgba(255,255,255,0.16); text-decoration: none;
    box-shadow: 0 40px 80px -30px rgba(0,0,0,0.95), 0 0 0 1px rgba(0,0,0,0.5);
    transform: rotateY(-16deg) rotateX(6deg); }
  .sp-deck-card:nth-of-type(1) { left: 0; top: 0; z-index: 1; }
  .sp-deck-card:nth-of-type(2) { left: 12%; top: 14%; z-index: 2; }
  .sp-deck-card:nth-of-type(3) { left: 24%; top: 28%; z-index: 3; }
  .sp-deck-card:nth-of-type(4) { left: 36%; top: 42%; z-index: 4; }
  .sp-deck-card img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .sp-deck-cap { position: absolute; left: 10px; bottom: 10px; font-size: 10.5px; letter-spacing: 0.08em; color: #FFFFFF;
    background: rgba(8,8,9,0.6); padding: 4px 9px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.25); white-space: nowrap; }
  @media (prefers-reduced-motion: no-preference) {
    .sp-deck-card { animation: sp-float 7s ease-in-out infinite; }
    .sp-deck-card:nth-of-type(2) { animation-delay: -1.7s; }
    .sp-deck-card:nth-of-type(3) { animation-delay: -3.4s; }
    .sp-deck-card:nth-of-type(4) { animation-delay: -5.1s; }
    @keyframes sp-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -9px; } }
  }
  @media (hover: hover) and (pointer: fine) {
    .sp-deck-card { transition: transform 700ms cubic-bezier(.2,.7,.3,1), border-color 240ms ease; }
    .sp-deck:hover .sp-deck-card { transform: rotateY(-8deg) rotateX(3deg); }
    .sp-deck-card:hover { border-color: ${D.gold}; z-index: 9; }
  }

  /* ── 4プランを横に並べた価格の段 (サイト制作) ── */
  .sp-ladder { display: grid; gap: 16px; grid-template-columns: 1fr; align-items: stretch; }
  @media (min-width: 700px) { .sp-ladder { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1040px) { .sp-ladder { grid-template-columns: repeat(4, 1fr); gap: 14px; } }
  .sp-col { position: relative; display: flex; flex-direction: column; gap: 12px; background: #FFFFFF;
    border: 1px solid ${C.line}; border-radius: 18px; padding: 26px 22px 22px; scroll-margin-top: 130px; }
  .sp-col[data-featured="true"] { border: 1.5px solid ${C.goldLine}; box-shadow: 0 30px 60px -40px rgba(17,24,39,0.45); }
  @media (min-width: 1040px) { .sp-col[data-featured="true"] { transform: translateY(-12px); } }
  .sp-col-tag { position: absolute; top: -12px; left: 20px; padding: 4px 11px; border-radius: 999px; background: ${C.ink};
    color: #FFFFFF; font-size: 10.5px; letter-spacing: 0.16em; font-weight: 600; }
  .sp-col-name { font-family: ${SERIF}; font-size: 22px; font-weight: 700; letter-spacing: 0.06em; color: ${C.ink}; }
  .sp-col-price { font-family: ${SERIF}; font-size: clamp(26px, 2.2vw, 30px); font-weight: 700; color: ${C.ink}; line-height: 1.2; }
  .sp-col-lead { font-size: 14px; font-weight: 600; color: ${C.ink}; line-height: 1.8; }
  .sp-col-scope { font-size: 13px; line-height: 1.85; color: ${C.body}; margin: 0; }
  .sp-col-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .sp-col-meta span { font-size: 12px; color: ${C.body}; background: ${C.alt}; border-radius: 6px; padding: 5px 9px; }
  .sp-col-sub { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; color: ${C.mute}; margin-top: 4px; }
  .sp-ex { margin-top: auto; display: block; text-decoration: none; color: ${C.ink}; border: 1px solid ${C.line}; border-radius: 12px; overflow: hidden; }
  .sp-ex-shot { display: block; position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: ${C.alt}; }
  .sp-ex-shot img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .sp-ex-cap { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; font-size: 12px; line-height: 1.5; }
  @media (hover: hover) and (pointer: fine) {
    .sp-ex { transition: border-color 200ms ease; }
    .sp-ex:hover { border-color: ${C.gold}; }
    .sp-ex-shot img { transition: transform 620ms cubic-bezier(.2,.7,.3,1); }
    .sp-ex:hover .sp-ex-shot img { transform: scale(1.05); }
  }

  /* ── 迷ったら (条件 → プラン) ── */
  .sp-choose { display: grid; gap: 10px; }
  @media (min-width: 860px) { .sp-choose { grid-template-columns: 1fr 1fr; } }
  .sp-choose-row { display: flex; align-items: center; gap: 14px; background: #FFFFFF; border: 1px solid ${C.line}; border-radius: 14px;
    padding: 16px 18px; text-align: left; cursor: pointer; font-family: ${SANS}; color: ${C.body}; width: 100%; box-sizing: border-box; }
  .sp-choose-row b { font-family: ${SERIF}; font-size: 17px; color: ${C.ink}; letter-spacing: 0.04em; flex: 0 0 auto; margin-left: auto; }
  .sp-choose-row span { font-size: 14px; line-height: 1.7; }
  .sp-choose-row:hover { border-color: ${C.goldLine}; }

  /* ── 工程の時間軸 (6工程を1本の線で) ── */
  .sp-tl { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; position: relative; }
  .sp-tl li { position: relative; display: grid; grid-template-columns: 44px 1fr; gap: 14px; align-items: start; }
  .sp-tl-no { width: 44px; height: 44px; border-radius: 999px; background: #FFFFFF; border: 1.5px solid ${C.gold};
    display: inline-flex; align-items: center; justify-content: center; font-family: ${SERIF}; font-weight: 700;
    color: ${C.goldText}; font-size: 15px; position: relative; z-index: 1; }
  .sp-tl b { display: block; font-size: 15px; color: ${C.ink}; margin-top: 10px; }
  .sp-tl p { margin: 6px 0 0; font-size: 13px; line-height: 1.85; color: ${C.body}; }
  @media (min-width: 960px) {
    .sp-tl { grid-template-columns: repeat(6, 1fr); gap: 12px; }
    .sp-tl li { grid-template-columns: 1fr; }
    .sp-tl::before { content: ''; position: absolute; left: 22px; right: 22px; top: 22px; height: 1px; background: ${C.goldLine}; }
  }

  /* ── 価格の目盛り (受託開発)。対数の横軸に4つの Tier の幅を置く ── */
  .sp-scale { border-top: 1px solid ${C.line}; }
  .sp-scale-row { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 14px; align-items: center; padding: 14px 0; border-bottom: 1px solid ${C.line}; }
  @media (min-width: 700px) { .sp-scale-row { grid-template-columns: 150px minmax(0, 1fr); } }
  .sp-scale-row[data-axis="true"] { border-bottom: none; padding: 4px 0 0; }
  .sp-scale-name { font-family: ${SERIF}; font-size: 17px; font-weight: 700; color: ${C.ink}; }
  .sp-scale-name small { display: block; font-family: ${SANS}; font-size: 12px; font-weight: 500; color: ${C.mute}; margin-top: 2px; }
  /* 狭い画面では帯の中に期間が入りきらない (実測: 「2週間〜1.5」で切れた) ので、帯の文字は消して左の列に出す */
  .sp-scale-name em { display: block; font-family: ${SANS}; font-style: normal; font-size: 11.5px; color: ${C.body}; margin-top: 2px; }
  @media (min-width: 700px) { .sp-scale-name em { display: none; } }
  .sp-scale-track { position: relative; height: 30px; }
  .sp-scale-bar { position: absolute; top: 3px; height: 24px; border-radius: 6px; background: linear-gradient(90deg, ${C.gold}, #d9be7a);
    display: flex; align-items: center; padding: 0 10px; font-size: 11.5px; font-weight: 700; color: #1b1608; white-space: nowrap; overflow: hidden; box-sizing: border-box; }
  @media (max-width: 699px) { .sp-scale-bar { color: transparent; } }
  .sp-scale-axis { position: relative; height: 20px; }
  .sp-scale-tick { position: absolute; top: 0; transform: translateX(-50%); font-size: 11px; color: ${C.mute}; white-space: nowrap; }
  .sp-scale-tick[data-edge="start"] { transform: none; }
  .sp-scale-tick[data-edge="end"] { transform: translateX(-100%); }
  @media (max-width: 599px) { .sp-scale-tick[data-minor="true"] { display: none; } }

  /* ── 自社プロダクト (暗地) ── */
  .sp-prod { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
  @media (min-width: 860px) { .sp-prod { grid-template-columns: repeat(4, 1fr); } }
  .sp-prod-card { display: block; background: ${D.raise}; border: 1px solid ${D.line}; border-radius: 14px; padding: 16px 16px 14px;
    color: ${D.body}; text-decoration: none; transition: border-color 200ms ease; }
  .sp-prod-card:hover { border-color: ${D.goldLine}; }
  .sp-prod-card b { display: block; font-size: 12.5px; color: #FFFFFF; margin-top: 12px; }
  .sp-prod-card p { margin: 6px 0 0; font-size: 12px; line-height: 1.75; color: ${D.mute}; }

  /* ── 公開中の業務システム2件を重ねた舞台 (受託開発のヒーロー) ── */
  .sp-stage { position: relative; height: clamp(230px, 62vw, 400px); }
  @media (min-width: 960px) { .sp-stage { height: 400px; } }
  .sp-stage-a, .sp-stage-b { position: absolute; display: block; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.16);
    background: #000; box-shadow: 0 40px 80px -30px rgba(0,0,0,0.95); aspect-ratio: 16 / 10; text-decoration: none; }
  .sp-stage-a { left: 0; top: 0; width: 78%; z-index: 1; }
  .sp-stage-b { right: 0; bottom: 0; width: 58%; z-index: 2; }
  .sp-stage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; }
  @media (prefers-reduced-motion: no-preference) {
    .sp-stage-a { animation: sp-float 8s ease-in-out infinite; }
    .sp-stage-b { animation: sp-float 8s ease-in-out infinite; animation-delay: -4s; }
  }

  /* ── 運用サイクルの環 ── */
  .sp-ring-wrap { padding: 24px 44px; }
  .sp-ring { position: relative; width: min(100%, 360px); aspect-ratio: 1; margin: 0 auto; }
  .sp-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .sp-ring-spin { transform-origin: 50% 50%; }
  @media (prefers-reduced-motion: no-preference) { .sp-ring-spin { animation: sp-spin 48s linear infinite; } }
  @keyframes sp-spin { to { transform: rotate(360deg); } }
  .sp-ring-node { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 5px; text-align: center; width: 110px; }
  .sp-ring-node i { display: block; width: 12px; height: 12px; border-radius: 999px; background: ${D.gold}; box-shadow: 0 0 0 7px rgba(212,169,79,0.16); }
  .sp-ring-node b { font-family: ${SERIF}; font-size: 15px; color: #FFFFFF; text-shadow: 0 2px 12px rgba(0,0,0,0.6); }
  .sp-ring-node span { font-size: 10.5px; color: ${D.mute}; letter-spacing: 0.08em; }
  .sp-ring-center { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center; width: 60%; }
  .sp-cad { display: grid; gap: 12px; }
  @media (min-width: 860px) { .sp-cad { grid-template-columns: repeat(3, 1fr); } }

  /* ── 会社案内 ── */
  .sp-portrait { position: relative; width: min(100%, 360px); margin: 0 auto; aspect-ratio: 3 / 4; border-radius: 18px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.16); box-shadow: 0 44px 90px -40px rgba(0,0,0,0.95); background: ${D.raise}; }
  .sp-portrait img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sp-portrait::after { content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(180deg, rgba(11,11,12,0) 60%, rgba(11,11,12,0.82) 100%); }
  .sp-portrait-name { position: absolute; left: 18px; right: 18px; bottom: 16px; z-index: 1; }
  .sp-portrait-name b { display: block; font-family: ${SERIF}; font-size: 18px; color: #FFFFFF; }
  .sp-portrait-name span { display: block; font-size: 11px; letter-spacing: 0.14em; color: ${D.gold}; text-transform: uppercase; margin-bottom: 4px; }
  .sp-quote { font-family: ${SERIF}; font-size: clamp(19px, 2.2vw, 26px); font-weight: 700; line-height: 1.8; color: ${C.ink}; margin: 0; }
  .sp-msg { font-size: 14.5px; line-height: 2.15; color: ${C.body}; margin: 18px 0 0; }
  .sp-film { position: relative; width: min(100%, 300px); aspect-ratio: 9 / 16; border-radius: 18px; overflow: hidden; background: #000;
    border: 1px solid ${C.line}; box-shadow: 0 34px 70px -44px rgba(0,0,0,0.9); margin: 0 auto; }
  .sp-film video, .sp-film img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .sp-film-play { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 72px; height: 72px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.5); background: rgba(11,11,12,0.55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2; }
  .sp-film-cap { position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 1; color: #FFFFFF; font-size: 11px; letter-spacing: 0.1em; text-shadow: 0 2px 10px rgba(0,0,0,0.7); }
  .sp-path { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; position: relative; }
  .sp-path li { position: relative; display: grid; grid-template-columns: 44px 1fr; gap: 14px; align-items: start; }
  .sp-path b { display: block; font-family: ${SERIF}; font-size: 17px; color: ${C.ink}; margin-top: 9px; }
  .sp-path p { margin: 5px 0 0; font-size: 13px; line-height: 1.85; color: ${C.body}; }
  @media (min-width: 860px) {
    .sp-path { grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .sp-path li { grid-template-columns: 1fr; }
    .sp-path::before { content: ''; position: absolute; left: 22px; right: 22px; top: 22px; height: 1px; background: ${C.goldLine}; }
  }
  .sp-dl { display: grid; grid-template-columns: 1fr; }
  .sp-dl > div { display: grid; grid-template-columns: 92px 1fr; gap: 14px; padding: 14px 0; border-bottom: 1px solid ${C.line}; font-size: 14px; line-height: 1.9; }
  .sp-dl dt { color: ${C.mute}; font-weight: 600; margin: 0; }
  .sp-dl dd { color: ${C.body}; margin: 0; overflow-wrap: anywhere; }
  .sp-dl dd a { color: ${C.ink}; }
  @media (min-width: 860px) { .sp-dl { grid-template-columns: 1fr 1fr; column-gap: 44px; } }
  .sp-place { position: relative; border-radius: 18px; overflow: hidden; min-height: 280px; background: #000; display: flex; align-items: flex-end; }
  .sp-place img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(0.72); }
  .sp-place::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(11,11,12,0.1) 0%, rgba(11,11,12,0.85) 100%); }
  .sp-place-copy { position: relative; z-index: 1; padding: clamp(28px, 5vw, 48px); color: #FFFFFF; }

  /* ── お問い合わせ ── */
  .sp-contact { display: grid; gap: 22px; grid-template-columns: 1fr; align-items: start; }
  @media (min-width: 960px) { .sp-contact { grid-template-columns: minmax(0, 1fr) 360px; gap: 32px; } .sp-side { position: sticky; top: 124px; } }
  .sp-wiz { background: #FFFFFF; border: 1px solid ${C.line}; border-radius: 20px; padding: clamp(22px, 3vw, 34px); box-shadow: 0 30px 60px -48px rgba(17,24,39,0.35); }
  .sp-wiz-q { font-family: ${SERIF}; font-size: clamp(19px, 2.2vw, 24px); font-weight: 700; color: ${C.ink}; line-height: 1.6; margin: 8px 0 20px; }
  .sp-opts { display: grid; gap: 10px; }
  @media (min-width: 640px) { .sp-opts[data-cols="2"] { grid-template-columns: 1fr 1fr; } }
  .sp-opt { display: flex; align-items: center; gap: 14px; width: 100%; box-sizing: border-box; min-height: 58px; padding: 14px 16px; border-radius: 12px;
    border: 1px solid #C9CDD4; background: #FFFFFF; color: ${C.ink}; font-family: ${SANS}; font-size: 14.5px; text-align: left; cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease; }
  .sp-opt:hover { border-color: ${C.gold}; }
  .sp-opt[data-on="true"] { border: 1.5px solid ${C.gold}; background: #FBF8F2; font-weight: 600; }
  .sp-opt-no { font-family: ${SERIF}; font-size: 13px; color: ${C.goldText}; font-weight: 700; flex: 0 0 auto; width: 22px; }
  .sp-opt-arrow { margin-left: auto; color: ${C.mute}; display: inline-flex; flex: 0 0 auto; }
  .sp-progress { display: flex; gap: 5px; margin: 0 0 18px; }
  .sp-progress i { flex: 1; height: 3px; border-radius: 2px; background: ${C.line}; }
  .sp-progress i[data-on="true"] { background: ${C.gold}; }
  .sp-side-card { background: ${D.bg}; color: ${D.body}; border-radius: 20px; padding: 26px 24px; }
  .sp-steps { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 14px; }
  .sp-steps li { display: grid; grid-template-columns: 30px 1fr; gap: 12px; align-items: start; }
  .sp-steps b { display: block; color: #FFFFFF; font-size: 14px; margin-top: 5px; }
  .sp-steps p { margin: 3px 0 0; font-size: 12.5px; line-height: 1.8; color: ${D.mute}; }
  .sp-steps i { width: 30px; height: 30px; border-radius: 999px; border: 1px solid ${D.goldLine}; display: inline-flex; align-items: center; justify-content: center;
    font-family: ${SERIF}; font-style: normal; font-weight: 700; font-size: 12px; color: ${D.gold}; }
  .sp-quote-doc { border: 1px solid ${C.goldLine}; border-radius: 20px; overflow: hidden; background: #FFFFFF; box-shadow: 0 30px 60px -48px rgba(17,24,39,0.4); }
  .sp-quote-head { background: ${D.bg}; color: #FFFFFF; padding: 26px clamp(20px, 3vw, 32px); display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
  .sp-quote-body { padding: clamp(20px, 3vw, 32px); }
  .sp-quote-price { font-family: ${SERIF}; font-size: clamp(28px, 4vw, 40px); font-weight: 700; color: #FFFFFF; line-height: 1.2; }
  .sp-quote-dl { display: grid; grid-template-columns: 1fr; gap: 0; margin: 0; }
  .sp-quote-dl > div { display: grid; grid-template-columns: 110px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid ${C.line}; font-size: 13.5px; line-height: 1.8; }
  .sp-quote-dl dt { color: ${C.mute}; margin: 0; }
  .sp-quote-dl dd { color: ${C.ink}; margin: 0; }
  @media (min-width: 640px) { .sp-quote-dl { grid-template-columns: 1fr 1fr; column-gap: 28px; } }

  @media (prefers-reduced-motion: reduce) {
    .sp-deck-card, .sp-stage-a, .sp-stage-b, .sp-ring-spin { animation: none !important; }
    .sp-deck-card, .sp-ex, .sp-ex-shot img, .sp-prod-card { transition: none !important; }
  }
`;

export const PageStyle = () => <style>{PAGE_CSS}</style>;

// ---- 暗部のヒーロー ----
export function PageHero({ en, title, lead, facts, visual, amb, cta, note, size }: {
  en: string;
  title: ReactNode;
  /** 見出しが長い時 (1行に9文字以上) は compact。1440px で「く、」だけが折れて残るのを防ぐ */
  size?: 'compact';
  lead: string;
  facts: Fact[];
  /** 右に立てる実物 (実機UI・実在の人物のみ。イメージ写真は置かない) */
  visual?: ReactNode;
  /** 背景にぼかして敷く画 (visual と同じ素材を使う) */
  amb?: string;
  cta?: ReactNode;
  note?: string;
}) {
  return (
    <section className="sp-hero">
      {amb && <div className="sp-hero-amb" style={{ backgroundImage: `url(${amb})` }} aria-hidden />}
      <div className="st-inner st-wide sp-hero-grid" data-solo={!visual}>
        <div>
          <div className="st-label" style={{ color: D.gold }}>{en}</div>
          <h1 className="sp-h1" data-size={size}>{title}</h1>
          <p className="sp-lead">{lead}</p>
          {cta && <div className="sp-hero-cta">{cta}</div>}
          {note && <p className="sp-hero-note">{note}</p>}
          <ul className="sp-facts">
            {facts.map(f => (
              <li key={f.l} className="sp-fact"><b>{f.v}</b><span>{f.l}</span></li>
            ))}
          </ul>
        </div>
        {visual && <div className="sp-visual">{visual}</div>}
      </div>
    </section>
  );
}

// ---- 開閉する Q&A (ホーム・サイト制作で共用) ----
// 1問目だけ開いておく。全部閉じた状態だと「質問の見出しが並んだだけ」に見え、
// ここに答えがあること自体が伝わらない。
export function Faq({ items }: { items: Array<{ q: string; a: string; tag?: string }> }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="st-card" style={{ padding: '6px 22px' }}>
      {items.map((f, i) => (
        <div key={`${f.tag ?? ''}${f.q}`} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.line}` }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            style={{ width: '100%', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              padding: '14px 0', fontSize: 14, fontWeight: 600, color: C.ink, fontFamily: SANS,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, lineHeight: 1.7 }}>
            <span>
              {f.tag && <span className="st-serif" style={{ color: C.goldText, fontSize: 12, letterSpacing: '0.08em', marginRight: 10 }}>{f.tag}</span>}
              {f.q}
            </span>
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

// ---- 自社プロダクト (suiteData が正本。本数も並びもここから数える) ----
export function ProductsGrid() {
  return (
    <div className="sp-prod">
      {SUITE_ALL.map(m => {
        const s = suiteService(m.key);
        const Logo = s.Logo;
        return (
          <a key={m.key} className="sp-prod-card" href={s.url} target="_blank" rel="noopener noreferrer">
            <Logo size={22} />
            <b>{m.dept}</b>
            <p>{m.line}</p>
          </a>
        );
      })}
    </div>
  );
}

// ---- 章末の相談枠 ----
export function ClosingCta({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="sp-cta">
      <div className="st-label" style={{ marginBottom: 12 }}>Contact</div>
      <div className="st-serif" style={{ fontSize: 'clamp(20px, 2.4vw, 26px)', fontWeight: 700, color: C.ink, lineHeight: 1.7 }}>{title}</div>
      <p style={{ fontSize: 13.5, color: C.body, margin: '10px auto 22px', lineHeight: 2, maxWidth: 560 }}>{body}</p>
      {children}
    </div>
  );
}
