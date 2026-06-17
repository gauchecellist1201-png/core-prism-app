// ============================================================
// CoreCreditsPanel — CORE Credits（ユーティリティ・ポイント）の確認/利用パネル。
// 残高・ランク・貯める方法・使い道（実際に動く特典）・履歴を表示。
// 利用特典は既存の extendTrial（トライアル延長）に接続＝必ず動く。
// ============================================================
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import {
  getBalance, getHistory, rankFor, spend, hasClaimed, type CreditEntry,
} from "../lib/coreCredits";
import { extendTrial } from "../lib/billing";
import { notifyInApp } from "../lib/inAppNotify";

// ブランド基調のパープル（--mi-accent: #8E5CFF）に統一
const ACCENT = "#8E5CFF";

// 貯める方法（一覧表示用。onceKey があれば「獲得済み」を判定）
const EARN_WAYS: { label: string; amount: number; onceKey?: string; note?: string }[] = [
  { label: "はじめての設定を完了", amount: 100, onceKey: "onboarding" },
  { label: "毎日ひらく（ログインボーナス）", amount: 5, note: "1日1回" },
  { label: "改善提案・フィードバックを送る", amount: 50, onceKey: "feedback_first", note: "初回" },
];

// 使い道（実際に動く特典のみ。表示した機能は必ず動く）
const REDEEMS: { key: string; label: string; desc: string; cost: number; run: () => boolean }[] = [
  { key: "trial7", label: "無料期間 +7日", desc: "今のトライアルを7日のばす", cost: 300, run: () => !!extendTrial(7) },
  { key: "trial30", label: "無料期間 +30日", desc: "じっくり使うなら30日のばす", cost: 1000, run: () => !!extendTrial(30) },
];

export default function CoreCreditsPanel({ onClose }: { onClose: () => void }) {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<CreditEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBalance(getBalance());
    setHistory(getHistory(20));
  }, []);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("core-credits-changed", h);
    return () => window.removeEventListener("core-credits-changed", h);
  }, [refresh]);

  const { rank, next, toNext } = rankFor(balance);
  const prevMin = rank.min;
  const span = next ? next.min - prevMin : 1;
  const progress = next ? Math.min(1, (balance - prevMin) / span) : 1;

  const redeem = (r: (typeof REDEEMS)[number]) => {
    if (balance < r.cost || busy) return;
    setBusy(r.key);
    try {
      const ok = r.run();
      if (ok && spend(`redeem:${r.key}`, r.label, r.cost)) {
        notifyInApp({ kind: "success", title: `「${r.label}」と交換しました`, body: `${r.cost} クレジットを使いました。` });
        refresh();
      } else {
        notifyInApp({ kind: "warn", title: "交換できませんでした", body: "時間をおいて、もう一度お試しください。" });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(6,6,14,0.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        style={{
          width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto",
          background: "var(--bg-2, #0b0b16)", border: "1px solid var(--border)", borderRadius: "18px 18px 0 0",
          padding: "20px 18px max(20px, env(safe-area-inset-bottom))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", color: "var(--fg-strong)" }}>CORE Credits</span>
          <button onClick={onClose} aria-label="閉じる" style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--fg-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={20} strokeWidth={2.2} /></button>
        </div>

        {/* 残高＋ランク */}
        <div style={{ background: `linear-gradient(135deg, ${ACCENT}22, ${ACCENT}08)`, border: `1px solid ${ACCENT}44`, borderRadius: 16, padding: "18px 18px 16px" }}>
          <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>いまの残高</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: "var(--fg-strong)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {balance.toLocaleString()} <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg-muted)" }}>クレジット</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: rank.color, padding: "3px 10px", borderRadius: 999, background: `${rank.color}1f`, border: `1px solid ${rank.color}55` }}>{rank.name}</span>
            {next && <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>次の{next.name}まで あと {toNext.toLocaleString()}</span>}
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.1)", marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${progress * 100}%`, height: "100%", background: `linear-gradient(90deg, ${rank.color}, ${next?.color ?? rank.color})` }} />
          </div>
        </div>

        {/* 使い道 */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--fg-muted)", letterSpacing: "0.06em", marginBottom: 8 }}>使う</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {REDEEMS.map((r) => {
              const can = balance >= r.cost && !busy;
              return (
                <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "var(--surface-3)", border: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg-strong)" }}>{r.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 2 }}>{r.desc}</div>
                  </div>
                  <button
                    onClick={() => redeem(r)}
                    disabled={!can}
                    style={{ flexShrink: 0, minHeight: 40, padding: "0 14px", borderRadius: 10, border: "none", fontSize: 12.5, fontWeight: 800, cursor: can ? "pointer" : "default", background: can ? ACCENT : "rgba(255,255,255,0.08)", color: can ? "#0a0a0f" : "var(--fg-muted)" }}
                  >
                    {busy === r.key ? "交換中…" : `${r.cost} と交換`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 貯める方法 */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--fg-muted)", letterSpacing: "0.06em", marginBottom: 8 }}>貯める</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {EARN_WAYS.map((w, i) => {
              const done = w.onceKey ? hasClaimed(w.onceKey) : false;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "#34D399" : "rgba(255,255,255,0.1)", color: done ? "#0a0a0f" : "transparent" }}>{done && <Check size={12} strokeWidth={3} />}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--fg)", textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>{w.label}{w.note && <span style={{ fontSize: 10.5, color: "var(--fg-subtle)", marginLeft: 6 }}>{w.note}</span>}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: ACCENT }}>+{w.amount}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 履歴 */}
        {history.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--fg-muted)", letterSpacing: "0.06em", marginBottom: 8 }}>履歴</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {history.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 12.5, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: e.amount >= 0 ? "#34D399" : "var(--fg-muted)", flexShrink: 0 }}>{e.amount >= 0 ? "+" : ""}{e.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ fontSize: 10.5, color: "var(--fg-subtle)", margin: "16px 2px 0", lineHeight: 1.6 }}>
          CORE Credits は CORE 内でのみ使えるポイントです（換金・第三者への譲渡はできません）。
        </p>
      </motion.div>
    </div>
  );
}
