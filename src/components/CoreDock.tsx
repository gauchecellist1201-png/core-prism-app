"use client";
// ============================================================
// CoreDock — 5アプリを「ひとつのブレーン」に感じさせる共通モバイル・ドック
//
// どのアプリ(Prism/Iris/Resonance/Lume/Guild)に置いても、画面下中央に
// 小さな“Core”の鼓動が常駐。タップで 5 アプリ＋Core ホームのスイッチャーが開き、
// identity/文脈を持ち越して(別ドメインでも)シームレスに行き来できる。
//
// 設計: モバイル最優先(タップ44px / safe-area / prefers-reduced-motion 尊重 /
//        OS絵文字なし=自前SVG)。依存は React と Tailwind のみ。Next.js("use client")
//        でも Vite でもそのまま動く。
//
// 置き方: 各アプリのルート(layout / App)末尾に <CoreDock current="resonance" /> を1行。
// ============================================================
import { useEffect, useState } from "react";
import { withCoreHandoff, readCoreHandoff, type CoreAppKey } from "./coreLink";

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

export function CoreDock({ current }: { current: App["key"] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const h = readCoreHandoff();
    if (h?.name) setName(h.name);
  }, []);

  // 表示順: 現在のアプリは先頭に出さず、行き先だけを並べる
  const others = APPS.filter((a) => a.key !== current);
  const me = APPS.find((a) => a.key === current);

  const go = (a: App) => {
    if (typeof window !== "undefined") window.location.href = withCoreHandoff(a.url, current);
  };

  return (
    <>
      {/* 常駐ドック(下部中央・safe-area・タップ44px) */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Core ── アプリを切り替える"
        className="fixed left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#0b0e18]/90 px-4 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur transition active:scale-95"
        // 既存の下部UI（中央のBottomChatDock入力バー / 左下SuggestionFab・右下QuickAskFab）と
        // 重ならないよう、中央ドックは1段上に浮かせる（chat入力バー≒56px + 余白）。
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)", minHeight: 48 }}
      >
        <CoreMark beat />
        <span className="text-[13px] font-semibold tracking-[0.16em]">CORE</span>
        {me && <span className="h-1.5 w-1.5 rounded-full" style={{ background: me.color, boxShadow: `0 0 8px ${me.color}` }} />}
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
              一つのブレーンが、5つの仕事を束ねます。<br />行き来しても、あなたの文脈はそのまま引き継がれます。
            </p>
          </div>
        </div>
      )}
    </>
  );
}
