"use client";
// ============================================================
// CoreDock — 5アプリを「ひとつのブレーン」に感じさせる共通モバイル・ドック
//
// どのアプリ(Prism/Iris/Resonance/Lume/Guild)に置いても、小さな“Core”の鼓動が
// 常駐。タップで 5 アプリ＋Core ホームのスイッチャーが開き、identity/文脈を
// 持ち越して(別ドメインでも)シームレスに行き来できる。
//
// 設計: モバイル最優先(タップ44px / safe-area / prefers-reduced-motion 尊重 /
//        OS絵文字なし=自前SVG)。依存は React と Tailwind のみ。Next.js("use client")
//        でも Vite でもそのまま動く。
//
// 【2026-07-09】「操作中にCOREタブが文字に被って邪魔」という声を受け、丸い小さな
// FABに変更しドラッグで自由な位置に動かせるようにした。動かした位置は端末に
// 記憶され、次回以降もそこに出る。動かしていない間の既定位置は左下(中央の
// チャット入力バー・右下の常駐FAB群のどちらとも重ならない場所)。
//
// 置き方: 各アプリのルート(layout / App)末尾に <CoreDock current="resonance" /> を1行。
// ============================================================
import { useEffect, useRef, useState } from "react";
import { withCoreHandoff, readCoreHandoff, type CoreAppKey } from "./coreLink";
import { useCoveredByModal } from "../hooks/useCoveredByModal";

type App = { key: Exclude<CoreAppKey, "core">; name: string; tag: string; color: string; url: string };

const APPS: App[] = [
  { key: "prism",     name: "Prism",     tag: "考える、司令塔",     color: "#a78bfa", url: "https://core-prism-app.vercel.app/?lp=1" },
  { key: "iris",      name: "Iris",      tag: "Instagram を魅せる", color: "#E1306C", url: "https://core-prism-app.vercel.app/iris" },
  { key: "resonance", name: "Resonance", tag: "LINE で届ける",       color: "#06C755", url: "https://resonancebot-ivory.vercel.app/lp" },
  { key: "lume",      name: "Lume",      tag: "リンクをひとつに",    color: "#FFA42A", url: "https://lume-deploy-five.vercel.app/" },
  { key: "guild",     name: "Guild",     tag: "貢献で動く組織",      color: "#2dd4bf", url: "https://guild-gauches-projects.vercel.app/" },
];

// ── 各アプリの本物ブランドロゴ(自前SVG・色は各ロゴのグラデ内蔵) ───────────────
const HEX: [number, number][] = [[32, 8], [53, 20], [53, 44], [32, 56], [11, 44], [11, 20]];
function Glyph({ k }: { k: App["key"] }) {
  if (k === "prism") return (
    <svg width="22" height="22" viewBox="0 0 100 100" fill="none" aria-hidden>
      <polygon points="50,5 30,55 50,55" fill="#C13584" /><polygon points="50,5 50,55 65,32" fill="#7B2CBF" /><polygon points="65,32 50,55 78,55" fill="#06A77D" /><polygon points="65,32 78,55 88,38" fill="#118AB2" /><polygon points="30,55 50,55 40,75" fill="#E1306C" /><polygon points="50,55 78,55 60,75" fill="#833AB4" /><polygon points="10,92 30,55 40,75" fill="#FFD60A" /><polygon points="10,92 40,75 60,75" fill="#F77F00" /><polygon points="60,75 78,55 90,92" fill="#06A77D" />
    </svg>);
  if (k === "iris") return (
    <svg width="22" height="22" viewBox="0 0 100 100" fill="none" aria-hidden>
      <defs><linearGradient id="cd-iris" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#FF8A1A" /><stop offset="0.5" stopColor="#E1306C" /><stop offset="1" stopColor="#833AB4" /></linearGradient></defs>
      <g stroke="url(#cd-iris)" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round">
        {[0, 60, 120, 180, 240, 300].map((r) => (<g key={r} transform={`rotate(${r} 50 50)`}><path d="M 50 12 C 42 24, 42 38, 50 50 C 58 38, 58 24, 50 12 Z" /></g>))}
      </g>
    </svg>);
  if (k === "resonance") return (
    <svg width="22" height="22" viewBox="0 0 100 100" fill="none" aria-hidden>
      <defs><linearGradient id="cd-reso" x1="0" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#06C755" /><stop offset="0.55" stopColor="#14B8A6" /><stop offset="1" stopColor="#0EA5E9" /></linearGradient></defs>
      <g stroke="url(#cd-reso)" strokeWidth="4" fill="none" strokeLinecap="round"><path d="M 28 50 A 22 22 0 0 1 50 72" /><path d="M 28 34 A 38 38 0 0 1 66 72" opacity="0.7" /><path d="M 28 18 A 54 54 0 0 1 82 72" opacity="0.45" /></g>
      <circle cx="28" cy="72" r="6" fill="url(#cd-reso)" />
    </svg>);
  if (k === "lume") return (
    <svg width="22" height="22" viewBox="0 0 100 100" fill="none" aria-hidden>
      <defs><linearGradient id="cd-lume" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#FFD86B" /><stop offset="0.45" stopColor="#FFA42A" /><stop offset="1" stopColor="#FF7A18" /></linearGradient></defs>
      <rect x="4" y="4" width="92" height="92" rx="26" fill="url(#cd-lume)" /><circle cx="50" cy="44" r="17" fill="#fff" /><circle cx="44" cy="38" r="4.5" fill="#fff" />
    </svg>);
  // guild: 六角ネットワーク
  return (
    <svg width="22" height="22" viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs><linearGradient id="cd-guild" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop stopColor="#5eead4" /><stop offset="0.55" stopColor="#22d3ee" /><stop offset="1" stopColor="#2dd4bf" /></linearGradient></defs>
      <g stroke="url(#cd-guild)"><path d="M32 4 56 18 56 46 32 60 8 46 8 18Z" strokeWidth="2.4" strokeLinejoin="round" fill="rgba(45,212,191,0.06)" />{HEX.map(([x, y], i) => (<line key={i} x1="32" y1="32" x2={x} y2={y} strokeWidth="1.4" opacity="0.7" />))}</g>
      {HEX.map(([x, y], i) => (<circle key={i} cx={x} cy={y} r="3" fill="url(#cd-guild)" />))}
      <circle cx="32" cy="32" r="5" fill="url(#cd-guild)" />
    </svg>);
}

// 中央の Core マーク(脈打つ核)
function CoreMark({ size = 26, beat }: { size?: number; beat: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="12" rx="10" ry="3.8" stroke="#7DD3FC" strokeWidth="1.2" transform="rotate(-24 12 12)" opacity=".9" />
      <ellipse cx="12" cy="12" rx="10" ry="3.8" stroke="#38BDF8" strokeWidth="1" transform="rotate(34 12 12)" opacity=".55" />
      <circle cx="12" cy="12" r="3.4" fill="#BAE6FD" className={beat ? "motion-safe:animate-pulse" : ""} />
    </svg>
  );
}

// ── ドラッグで自由に動かせる位置の永続化 ─────────────────────────────
// v2: レーン再設計(2026-07-26)以前の保存位置は右パネル/サイドバーに被る場所が
// 多かったため、一度だけ既定位置(被りゼロのレーン内)へリセットする。
const POS_KEY = "core_dock_pos_v2";
const DOCK_SIZE = 52;
const EDGE_MARGIN = 14;
const DRAG_THRESHOLD = 6; // これ未満の移動は「タップ」扱い

// ── 進入禁止の「帯」を実測する(2026-07-27) ─────────────────────────────
// これまで上部の禁止帯を 120px の決め打ちにしていたが、帯の高さはアプリごとに違う。
// Iris のヘッダー(ロゴ行＋タブ行)は実測 183px あり、120px ではオーブがタブ行の上に
// 乗って 1 つ目のタブ(「リールを作る」)を完全に覆っていた(375px 実測)。
// 画面に実際に出ている固定/追従の帯を測って、その下からを可動域にする。
// クラス名で探してはいけない: Prism の下部バーには目印のクラスが無く(実測)、
// 名前の一覧で探すと「一覧に載っているアプリだけ直る」ことになる。
// 見た目の条件(画面幅いっぱい・固定/追従・上か下の 1/4 に居る)だけで判定する。
const BAND_SCAN_LIMIT = 4000; // 走査の上限(重い画面でも固まらせない)

type Bands = { top: number; bottom: number; els: HTMLElement[] };

function scanBands(): Bands {
  const out: Bands = { top: 0, bottom: 0, els: [] };
  if (typeof document === "undefined") return out;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const all = document.body.querySelectorAll<HTMLElement>("*");
  const n = Math.min(all.length, BAND_SCAN_LIMIT);
  for (let i = 0; i < n; i++) {
    const el = all[i];
    const s = getComputedStyle(el);
    if (s.position !== "fixed" && s.position !== "sticky") continue;
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    // 飾り(背景グラデ等)は「奥に置かれている」ことで見分ける。
    // pointer-events:none で弾いてはいけない: Prism の下部バーは
    // 外枠が pointer-events:none・中身だけ auto という作りで、
    // それで弾くとバーが見つからずオーブが乗り上げる(実測 2026-07-27)。
    if (Number(s.zIndex) < 0) continue;
    const r = el.getBoundingClientRect();
    // 画面幅いっぱいに近い「帯」だけを対象にする(小さなFABは避けなくてよい)
    if (r.width < vw * 0.6 || r.height < 24 || r.height > vh * 0.5) continue;
    // 上の帯 = 画面の上 1/4 に居るもの。「上端に触れているか」で判定してはいけない:
    // Iris はサンプル帯(上端)に押されてヘッダーが top=60 から始まるため、
    // 上端判定だとヘッダー(＝タブ行)が数えられず素通りしてしまう(実測)。
    if (r.top < vh * 0.25 && r.bottom > 0) { out.top = Math.max(out.top, r.bottom); out.els.push(el); }
    // 下の帯 = 画面の下 1/4 に居るもの(下部ドックの上に入力バーが重なる形も拾う)
    else if (r.bottom > vh * 0.75 && r.top < vh) { out.bottom = Math.max(out.bottom, vh - r.top); out.els.push(el); }
  }
  out.top = Math.max(0, Math.round(out.top));
  out.bottom = Math.max(0, Math.round(out.bottom));
  return out;
}

// ── 全画面のモーダル(オンボーディング等)が出ている間は引っ込む(2026-07-29) ────
// Prism の初回オンボーディング(fixed inset-0 z-70)より丸ボタン(z-80)が上に出るため、
// 新規ユーザーが最初に見る画面でカードの左下隅と「← 戻る」に被っていた(375px 実測)。
// Lume で採った「ウィザードが出ている間はドックを隠す」と同じ考え方を、
// クラス名に頼らず“見た目の条件”で判定する。
// 2026-07-31: 同じ画面に浮いている他の常駐ボタン(Prism のマイクFAB)でも使えるよう
// `hooks/useCoveredByModal` へ切り出した(判定・間引きの仕様はそのまま)。


// ── 中身に被らない置き場所を実測で選ぶ（2026-08-01・GUILD から移植） ───────────
// 帯（ヘッダー・下部ドック）を避けるだけでは足りない。帯の間の“本文”の上に
// 丸ボタンが乗ると、数字や見出しが読めなくなる（実測：Iris の成果カードの
// 「4本 キャプション」が丸ボタンで隠れていた 2026-08-01）。
//
// 測るのは要素の箱ではなく **文字が実際に描かれている行の箱**。要素の箱で数えると
// カードの余白まで「埋まっている」ことになり、空きがゼロ＝画面の一番上へ逃げてしまう。
const INK_LIMIT = 1200; // 重い画面でも固まらせない上限

type Ink = { r: DOMRect; w: number };

function inkRects(exclude: Element | null): Ink[] {
  const out: Ink[] = [];
  if (typeof document === "undefined") return out;
  const vh = window.innerHeight;
  const inView = (r: DOMRect) => r.bottom > 0 && r.top < vh;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n && out.length < INK_LIMIT; n = walker.nextNode()) {
    if (!(n.textContent ?? "").trim()) continue;
    const parent = (n as Text).parentElement;
    if (!parent || (exclude && exclude.contains(parent))) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width > 2 && r.height > 2 && inView(r)) out.push({ r, w: 3 });
    }
  }
  for (const el of document.querySelectorAll("a,button,input,textarea,select")) {
    if (out.length >= INK_LIMIT) break;
    if (exclude && exclude.contains(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 8 && r.height > 8 && inView(r)) out.push({ r, w: 10 });
  }
  return out;
}

/**
 * minY..maxY の範囲で、いちばん覆わない置き場所を選ぶ。
 * 「空きを探す」ではなく「いちばん覆わない場所を選ぶ」のは、文字が画面いっぱいの
 * 画面でも破綻させないため（空きゼロで既定位置に戻すと、隠したくない物の上に戻る）。
 */
function leastCoveringPos(
  minY: number,
  maxY: number,
  exclude: Element | null,
  /** いま居る場所。ここが何も覆っていなければ動かさない（読んでいる最中に飛び回らせない）。 */
  current?: { x: number; y: number } | null,
): { x: number; y: number } | null {
  const inks = inkRects(exclude);
  if (!inks.length) return null; // まだ描画されていない＝判断材料が無い
  const columns = [EDGE_MARGIN, window.innerWidth - DOCK_SIZE - EDGE_MARGIN];
  const cost = (x: number, y: number) => {
    let total = 0;
    for (const { r, w } of inks) {
      const ow = Math.min(r.right, x + DOCK_SIZE) - Math.max(r.left, x);
      const oh = Math.min(r.bottom, y + DOCK_SIZE) - Math.max(r.top, y);
      if (ow > 0 && oh > 0) total += ow * oh * w;
    }
    return total;
  };
  const currentCost = current ? cost(current.x, current.y) : Number.POSITIVE_INFINITY;
  if (currentCost === 0) return current ?? null; // 何も隠していない＝動かす理由がない

  let best: { x: number; y: number; c: number } | null = null;
  // 下から上へ。同じ高さでは左→右（「左であること」より「下であること」を優先）。
  for (let y = maxY; y >= minY; y -= 8) {
    for (const x of columns) {
      const c = cost(x, y);
      if (c === 0) return { x, y };
      if (!best || c < best.c) best = { x, y, c };
    }
  }
  // 今より良くならないなら動かさない（意味のない移動を見せない）。
  if (!best || best.c >= currentCost) return current ?? null;
  return { x: best.x, y: best.y };
}

function clampPos(x: number, y: number, bottomClearance = 0) {
  // モバイルは上部=ヘッダー帯(タイトル/タブ行/サンプル帯)を進入禁止に。
  // ドラッグ保存位置が左上に残ってヘッダーの文字やタブに被る事故を構造的に防ぐ(オーナー指示 2026-07-17)。
  const mobile = window.innerWidth < 768;
  const bands = mobile ? scanBands() : { top: 0, bottom: 0, els: [] };
  const minY = mobile ? Math.max(120, bands.top + 8) : EDGE_MARGIN;
  // 下も同じ考え方で実測し、指定された bottomClearance と大きい方を採る。
  const bottom = Math.max(bottomClearance, mobile ? bands.bottom + 8 : 0);
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - DOCK_SIZE - EDGE_MARGIN);
  const maxY = Math.max(minY, window.innerHeight - DOCK_SIZE - EDGE_MARGIN - bottom);
  return { x: Math.min(Math.max(x, EDGE_MARGIN), maxX), y: Math.min(Math.max(y, minY), maxY) };
}
function defaultPos(bottomClearance = 0) {
  // 既定位置:
  //  デスクトップ(≥768)= 右上のFABレーン内(テーマ切替の下)。左下だとサイドバーの
  //  メニュー項目に必ず被る(実測 2026-07-26)。レーンは専用の土地なので被りゼロ。
  //  モバイル= 従来どおり左下(中央チャットバー・右下FAB群と重ならない)。
  if (window.innerWidth >= 768) {
    return clampPos(window.innerWidth - DOCK_SIZE - EDGE_MARGIN, 110, bottomClearance);
  }
  return clampPos(EDGE_MARGIN, window.innerHeight - DOCK_SIZE - EDGE_MARGIN - 74, bottomClearance);
}
// 保存された「素の」位置(帯を避ける前)。避け直しは毎回ここから測る。
function loadRawPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x !== "number" || typeof p?.y !== "number") return null;
    return { x: p.x, y: p.y };
  } catch { return null; }
}
function savePos(x: number, y: number) {
  try { localStorage.setItem(POS_KEY, JSON.stringify({ x, y })); } catch { /* noop */ }
}

export function CoreDock({
  current,
  bottomClearance = 0,
  zIndex = 80,
}: {
  current: App["key"];
  /** LP等で下部の sticky CTA / footer リンクと重ならないよう、画面下端からこの分だけ上に押し上げる(px) */
  bottomClearance?: number;
  /** LP表示中は sticky CTA(z=60) より下げたい等、重なり順を調整できる */
  zIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  // 全画面モーダル(オンボ等)が出ている間は引っ込む。閉じれば自動で戻る。
  const hidden = useCoveredByModal(btnRef);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  // 自分でドラッグして置き場所を決めたか(＝既定位置に戻してはいけないか)
  const userMovedRef = useRef(false);
  // 自分で決めた「素の」置き場所。避け直しは毎回ここから測る。
  // 今の位置から挟み直すと、帯に押し上げられた位置がそのまま新しい基準になり、
  // 帯が引っ込んでも下に戻れず、じりじり上へ登っていく(2026-07-29)。
  const savedRef = useRef<{ x: number; y: number } | null>(null);
  // 自分で動かしていない人のための「実測で選んだ既定位置」。
  // スクロールのたびに測り直すと丸ボタンが読んでいる最中に飛び回るので、
  // ここは**最初と画面サイズが変わった時だけ**測る。
  const autoBaseRef = useRef<{ x: number; y: number } | null>(null);

  // 置き場所を測り直す(帯の出入り・画面サイズ変化・スクロール停止のたび)。
  // 自分で動かしていれば「保存した素の位置」から、動かしていなければ既定位置から。
  const clearanceRef = useRef(bottomClearance);
  clearanceRef.current = bottomClearance;
  const reposition = () => {
    if (dragRef.current) return; // ドラッグ中は指の下から逃がさない
    const c = clearanceRef.current;
    const base = userMovedRef.current ? savedRef.current : autoBaseRef.current;
    setPos(base ? clampPos(base.x, base.y, c) : defaultPos(c));
  };

  // 本文に被らない既定位置を測り直す（モバイルのみ・自分で動かした人には効かせない）。
  const remeasureAutoBase = () => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) { autoBaseRef.current = null; return; } // PCは右上のFABレーン固定
    if (userMovedRef.current) return;
    const c = clearanceRef.current;
    const bands = scanBands();
    const minY = Math.max(120, bands.top + 8);
    const maxY = Math.max(minY, window.innerHeight - DOCK_SIZE - EDGE_MARGIN - Math.max(c, bands.bottom + 8));
    const now = btnRef.current
      ? { x: btnRef.current.getBoundingClientRect().left, y: btnRef.current.getBoundingClientRect().top }
      : null;
    const found = leastCoveringPos(minY, maxY, btnRef.current, now);
    if (found) {
      autoBaseRef.current = found;
      setPos(clampPos(found.x, found.y, c));
    }
  };

  useEffect(() => {
    const h = readCoreHandoff();
    if (h?.name) setName(h.name);
    const raw = loadRawPos();
    userMovedRef.current = raw !== null;
    savedRef.current = raw;
    setPos(raw ? clampPos(raw.x, raw.y, bottomClearance) : defaultPos(bottomClearance));

    // 画面の中身は少し遅れて確定する（画像・フォント・あとから届く一覧）。
    // 落ち着くまで数回測り直し、6秒で打ち切る（読んでいる最中に動き続けない）。
    const settleTimers: number[] = [];
    if (!raw) {
      for (const ms of [120, 700, 1800, 3500]) settleTimers.push(window.setTimeout(remeasureAutoBase, ms));
    }
    // ★2026-07-27 根治: これまで resize で「今の位置を挟み直す」だけだったため、
    //   画面が一瞬でも縦に短い状態(横向き・分割表示・小さいウィンドウ・読み込み直後)で
    //   位置が上限まで押し上げられると、画面が広がっても二度と戻らずヘッダー帯に
    //   貼り付いたままになっていた(＝タブが押せない)。
    //   自分でドラッグしていない間は、そのつど既定位置を計算し直す。
    const onResize = () => { remeasureAutoBase(); reposition(); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      settleTimers.forEach(clearTimeout);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomClearance]);

  // 帯は「大きさが変わる」だけでなく「あとから滑り込んでくる」。
  // Prism の下部サマリー(オンボ完了/件数)はスクロールで画面外から上がってくるので、
  // 読み込み時に測った可動域のままだと丸ボタンがその上に居座り、数字を隠す
  // (「0 件」「合計 7 件」が読めない＝375px 実測 2026-07-29)。スクロールが止まったら測り直す。
  useEffect(() => {
    if (typeof window === "undefined") return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (dragRef.current) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        // 帯だけでなく本文も見る。スクロールで数字がボタンの下に入ってくるため
        // （Iris の成果カードの「4本」が隠れていた・2026-08-01 実測）。
        // 今の場所が何も覆っていなければ leastCoveringPos が現状維持を返すので、
        // 読んでいる最中に飛び回ることはない。
        remeasureAutoBase();
        reposition();
      }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomClearance]);

  // 帯(ヘッダー/下部ドック)はタブ切替や表示条件で高さが変わるので、
  // 変わったら可動域を測り直して被りを防ぐ。ドラッグ中は動かさない。
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    if (window.innerWidth >= 768) return; // 帯を避けるのはモバイルだけ
    const targets = scanBands().els;
    if (!targets.length) return;
    const ro = new ResizeObserver(() => reposition());
    targets.forEach((t) => ro.observe(t));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomClearance, current]);

  // 表示順: 現在のアプリは先頭に出さず、行き先だけを並べる
  const others = APPS.filter((a) => a.key !== current);
  const me = APPS.find((a) => a.key === current);

  const go = (a: App) => {
    if (typeof window !== "undefined") window.location.href = withCoreHandoff(a.url, current);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) d.moved = true;
    if (d.moved) setPos(clampPos(d.baseX + dx, d.baseY + dy, bottomClearance));
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (d && d.moved) {
      userMovedRef.current = true;
      autoBaseRef.current = null; // 本人が決めた場所が正。以後こちらで選び直さない
      setPos((p) => {
        if (p) {
          savedRef.current = { x: p.x, y: p.y };
          savePos(p.x, p.y);
        }
        return p;
      });
    } else {
      // 動いていなければタップ = スイッチャーを開く
      setOpen(true);
    }
  };

  if (!pos) return null; // 初回マウント(位置未確定)は描画しない=SSRとの不一致回避

  return (
    <>
      {/* 常駐ドック(ドラッグ可能な円形FAB・safe-area・タップ44px以上) */}
      <button
        ref={btnRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Core ── アプリを切り替える(ドラッグで移動できます)"
        className="fixed flex items-center justify-center rounded-full border border-white/15 bg-[#0b0e18]/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur active:scale-95"
        style={{
          zIndex,
          left: pos.x,
          top: pos.y,
          width: DOCK_SIZE,
          height: DOCK_SIZE,
          touchAction: "none",
          // 全画面モーダルの上には出さない(スイッチャーを開いている間は自分が主役なので出す)
          display: hidden && !open ? "none" : undefined,
          transition: dragging ? "none" : "left .15s ease, top .15s ease",
        }}
      >
        <CoreMark beat={!dragging} />
        {me && (
          <span
            className="absolute right-1 top-1 h-2 w-2 rounded-full"
            style={{ background: me.color, boxShadow: `0 0 6px ${me.color}` }}
          />
        )}
      </button>

      {/* スイッチャー(ボトムシート) */}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-[460px] rounded-t-[22px] border border-white/10 bg-[#0b0e18] p-4 motion-safe:animate-[coredock-up_.28s_cubic-bezier(.2,.8,.2,1)]"
            style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{"@keyframes coredock-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}"}</style>

            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CoreMark beat />
                <div>
                  <div className="text-[13px] font-semibold tracking-[0.14em] text-white">CORE — ひとつのブレーン</div>
                  <div className="text-[11px] text-white/45">{name ? `${name} さん、` : ""}5つのサービスを行き来できます</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="閉じる" className="flex h-11 w-11 items-center justify-center rounded-xl text-white/50 active:scale-90" style={{ minWidth: 44 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {others.map((a) => (
                <button
                  key={a.key}
                  onClick={() => go(a)}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-left transition active:scale-[0.99]"
                  style={{ minHeight: 60 }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `radial-gradient(circle at 50% 30%, ${a.color}26, transparent 70%)`, border: `1px solid ${a.color}44` }}>
                    <Glyph k={a.key} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-white">{a.name}</span>
                    <span className="block text-[12px] text-white/50">{a.tag}</span>
                  </span>
                  <span className="text-white/30" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">
              一つのブレーンが、5つの仕事を束ねます。<br />行き来しても、あなたの文脈はそのまま引き継がれます。<br />
              <span className="text-white/25">丸いCoreボタンはドラッグで好きな位置に動かせます。</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
