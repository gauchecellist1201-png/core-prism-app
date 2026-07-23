// ============================================================
// CORE Pulse — ヘルスケア特化型AIコンシェルジュ (単体ブランド)
//
// Prism のヘルスケア機能を「機能過多を防ぐため」単体サービスへ切り出したもの。
// ターゲット: 女性のライフステージ・予防医学に関心がある層。
// ITに詳しくなくても直感的にわかる「やさしい日本語」を最優先する。
//
// デザイン言語 (2026-07-22 大刷新「プレミアム・ヘルステック」):
//   Whoop / Oura 級の「デバイスと繋がるテック製品」感 × 女性向けヘルスケアの品。
//   - パレット: 深い夜色 #0D0A0F〜#1A1218 のダークベースに、
//     ピンク #FF5C8A / ローズ #E8859E のネオングロー(淡く上品に)。
//     ローズベージュ #C9A192 は線・ラベルの流儀として残す
//   - タイポ: 見出し=Noto Serif JP(明朝)。数値=細身(200-300)・特大・tabular-nums・
//     ピンクのソフトグロー(text-shadow)で発光
//   - 形: ガラス質カード(白4-6%+blur)+1pxピンク罫+角丸24px。ホバー/タップで浮く・弾む
//   - 主役: 「きょうの調子」大径リング。鼓動のようにゆっくり呼吸する光+スコアのカウントアップ
//   - 信頼: データの扱い明記 / 医療機器でない旨 / 記録=専門家相談の確かな資料
//
// 構成 (1画面完結タブ型):
//   LP (未入場) → きょう / 記録 / つながる / 設定
//
// 再利用している既存資産:
//   - useHealth (localStorage PHR・デモデータ生成) … Prism と同じ保存場所なので
//     「Prism をお使いの方はそのままのデータで使えます」が自然に成立する
//   - detectAnomalies (統計的な変化検知)
//   - /api/health/ingest (Apple Watch ショートカット同期・本番実測済)
//   - webBluetoothHR / healthLiveSession (心拍計ライブ計測・保存)
//
// ルール: 絵文字UI禁止 / 375px見切れゼロ / コントラスト4.5:1厳守 /
//         fetch はタイムアウト付き / loading は必ず finally で解除
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HeartPulse, Moon, Footprints, Sun, NotebookPen, Settings, Bluetooth,
  Smartphone, Check, Copy, Trash2, Mail, ArrowRight, ShieldCheck, Activity,
  Loader2, AlertTriangle, Droplets, ChevronRight, Smile, Meh, Frown, SmilePlus,
  RefreshCw, Info, Lock, FileText, Stethoscope, TrendingUp, TrendingDown, Minus,
  CalendarDays, Compass,
} from 'lucide-react';
import { useHealth } from '../hooks/useHealth';
import { PulseLogo } from '../components/Logo';
import { detectAnomalies, type HealthAnomaly } from '../data/healthAnomaly';
import type { DailyHealth } from '../types/health';
import { fetchWithTimeout, isAbort } from '../lib/fetchWithTimeout';
import { scorePulseDay, scoreLastDays, SCORE_GOOD_LINE, SCORE_MAX, STEPS_FULL, SLEEP_HOURS_FULL, type PulseScoreResult, type PulseScoreParts } from './pulseScore';
import { emailToHash, checkIngestStatus, saveLiveHRSession, type HealthIdentity } from '../lib/healthLiveSession';
import { HeartRateMonitor, isWebBluetoothSupported, type HRReading } from '../lib/webBluetoothHR';

// ── カラー (深い夜色×ピンクグロー。プレミアム・ヘルステック) ──
// 文字系はすべて夜色背景 #0D0A0F で 4.5:1 以上になる明るさを選定:
//   ink #F6EEF3 ≈ 17:1 / sub #BFAABA ≈ 8.6:1 / accent #FF8FB2 ≈ 8:1 /
//   goldText #D9B9AC ≈ 10:1 / good #7DDBA8 ≈ 10:1 / warn #FFBE85 ≈ 10:1
const C = {
  bg: '#0D0A0F',                          // 深い夜色 (ベース)
  bgDeep: '#1A1218',                      // 夜色の面 (入力・くぼみ)
  card: 'rgba(255,255,255,0.045)',        // ガラス質カード
  line: 'rgba(255,124,163,0.18)',         // 1px ピンク罫
  ink: '#F6EEF3',                         // 明るい生成り (本文)
  sub: '#BFAABA',                         // うすいモーブグレー (サブ)
  accent: '#FF8FB2',                      // 明るいピンク (文字アクセント)
  pink: '#FF5C8A',                        // ブランドピンク (図形・グロー)
  accentSoft: 'rgba(255,92,138,0.14)',    // ピンクの淡い面
  mauve: '#E8859E',                       // ローズ (図形・アイコン)
  rose: '#E8859E',                        // ローズ (グラフ・装飾)
  roseSoft: 'rgba(232,133,158,0.12)',
  gold: '#C9A192',                        // ローズベージュ (線・装飾)
  goldText: '#D9B9AC',                    // ローズベージュの文字用 (ラベル)
  good: '#7DDBA8',
  goodSoft: 'rgba(125,219,168,0.12)',
  warn: '#FFBE85',
  warnSoft: 'rgba(255,190,133,0.12)',
};
/** ピンクのソフトグロー (数字の発光) */
const NUM_GLOW = '0 0 22px rgba(255,92,138,0.45)';

// ── 共通アニメーションCSS (LP・アプリ両方に注入) ──
const PULSE_CSS = `
  .pulse-spin { animation: pulse-rotate 1s linear infinite; }
  @keyframes pulse-rotate { to { transform: rotate(360deg); } }
  .pulse-press { transition: transform .18s cubic-bezier(.34, 1.56, .64, 1); }
  .pulse-press:active { transform: scale(.95); }
  .pulse-card { transition: transform .25s ease, border-color .25s ease; }
  @media (hover: hover) {
    .pulse-card:hover { transform: translateY(-2px); border-color: rgba(255,124,163,0.36); }
  }
  .pulse-breathe { animation: pulse-breathe 3.6s ease-in-out infinite; }
  @keyframes pulse-breathe {
    0%, 100% { opacity: .55; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.03); }
  }
  .pulse-ecg-flow { stroke-dasharray: 260 740; animation: pulse-ecg-flow 5.5s linear infinite; }
  @keyframes pulse-ecg-flow { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: -1000; } }
  @media (prefers-reduced-motion: reduce) {
    .pulse-breathe, .pulse-ecg-flow { animation: none; }
  }
`;

// ── タイポグラフィ ──
const SERIF = "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif";
const NUM_STYLE: React.CSSProperties = {
  fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
  fontWeight: 300,
  letterSpacing: '0.03em',
  fontVariantNumeric: 'tabular-nums',
};
/** 小さくtracking広めのラベル (うす茶 or ゴールド文字) */
function labelStyle(color: string = C.sub): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    color,
    letterSpacing: '0.16em',
  };
}

const ENTERED_KEY = 'pulse_entered_v1';
const PROFILE_KEY = 'pulse_profile_v1';
const MEMO_KEY = 'pulse_memos_v1';
const STREAK_KEY = 'pulse_record_days_v1'; // アプリを開いて記録した日 (YYYY-MM-DD の配列)
const CHIP_KEY = 'pulse_chips_v1';         // ワンタップ記録 { 'YYYY-MM-DD': chipId[] }
const MONITOR_MAILTO =
  'mailto:core.guild.inc@gmail.com?subject=' + encodeURIComponent('CORE Pulse 先行モニター希望');

interface PulseProfile {
  name: string;
  email: string;
  goalSteps: number;
  goalSleep: number; // 時間
}
interface PulseMemo {
  id: string;
  ts: number;
  mood: 1 | 2 | 3 | 4; // 1=つらい 2=いまいち 3=ふつう 4=げんき
  text: string;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
}
function saveJson<T>(key: string, v: T) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}
function loadMemos(): PulseMemo[] {
  try {
    const raw = localStorage.getItem(MEMO_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

// ── 継続日数 (ストリーク) — 開いて記録した日を localStorage で数える ──
function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
/** きょうを記録日に加え、きょうまで連続している日数を返す */
function recordTodayAndGetStreak(): number {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    const set = new Set<string>(Array.isArray(arr) ? (arr as string[]) : []);
    set.add(localDateStr());
    localStorage.setItem(STREAK_KEY, JSON.stringify([...set].sort().slice(-400)));
    let streak = 0;
    const d = new Date();
    while (set.has(localDateStr(d))) { streak += 1; d.setDate(d.getDate() - 1); }
    return streak;
  } catch { return 1; }
}

// ── きぶん・からだのワンタップ記録 (Flo型・10秒で完了) ──
const BODY_CHIPS: Array<{ id: string; label: string }> = [
  { id: 'slept-well', label: 'よく眠れた' },
  { id: 'tired', label: 'だるい' },
  { id: 'headache', label: '頭が重い' },
  { id: 'cold', label: '冷え' },
  { id: 'skin-good', label: '肌の調子がいい' },
  { id: 'low-mood', label: '気分が晴れない' },
  { id: 'shoulder', label: '肩こり' },
  { id: 'no-appetite', label: '食欲がない' },
  { id: 'period', label: '生理中' },
  { id: 'swelling', label: 'むくみ' },
];
/** チップ → けさのことばに足すひとこと (決まった文・推測なし) */
const CHIP_WORDS: Record<string, string> = {
  'slept-well': '「よく眠れた」の記録、なによりです。よいねむりは今日いちにちの土台になります。',
  'tired': '「だるい」の記録がありました。今日は予定をひとつ減らして、休む時間を先に確保しましょう。',
  'headache': '「頭が重い」の記録がありました。こまめな水分と、画面から目を離す休憩を。つらいときはがまんせず病院へ。',
  'cold': '「冷え」の記録がありました。足首・おなか・首もとをあたためて、白湯（さゆ）を1杯どうぞ。',
  'skin-good': '「肌の調子がいい」の記録、うれしいですね。睡眠と水分のリズムが合っているサインです。',
  'low-mood': '「気分が晴れない」の記録がありました。10分だけ外の空気を吸うと、少し軽くなることがあります。むりは禁物です。',
  'shoulder': '「肩こり」の記録がありました。1時間に1回、肩をゆっくり回して深呼吸を。',
  'no-appetite': '「食欲がない」の記録がありました。消化にやさしいあたたかいものを少しずつ。続くときは早めにご相談を。',
  'period': '「生理中」の記録がありました。からだを冷やさず、休みをいつもより多めに。つらさが強い月が続くなら、婦人科への相談も大切な予防です。',
  'swelling': '「むくみ」の記録がありました。水分は控えるよりこまめにとって、足首をやさしく動かすのがおすすめです。',
};
function loadChips(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(CHIP_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch { return {}; }
}

// ── ロゴ — 共通ブランドロゴ (src/components/Logo.tsx の PulseLogo) を使用 ──

// ── やさしい言葉の変換ヘルパー ──
function fmtSleep(h?: number): string {
  if (typeof h !== 'number' || !isFinite(h) || h <= 0) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}時間${mm}分` : `${hh}時間`;
}
function fmtNum(v?: number, suffix = ''): string {
  if (typeof v !== 'number' || !isFinite(v) || v <= 0) return '—';
  return `${Math.round(v).toLocaleString()}${suffix}`;
}
function todayLabel(): string {
  const d = new Date();
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 (${w})`;
}

/** 変化検知の内容を、専門用語ゼロのやさしい日本語へ言いかえる */
function anomalyToPlain(a: HealthAnomaly): { title: string; detail: string } {
  const m = String(a.metric);
  if (m === 'hrv') {
    return {
      title: '心拍のゆらぎ（自律神経の元気さ）が下がりぎみです',
      detail: 'ふだんより疲れがたまっているサインかもしれません。今日はむりをせず、ゆっくりめに過ごしてみてください。',
    };
  }
  if (m === 'restingHR') {
    return {
      title: '安静時の心拍（休んでいるときの脈）がふだんより高めです',
      detail: '睡眠不足・疲れ・体調の変わり目などで上がることがあります。続くようなら休息を多めに。',
    };
  }
  if (m === 'sleepHours' || m === 'sleepScore') {
    return {
      title: 'ねむりが少なめの日が続いています',
      detail: '今夜はいつもより30分早くおふとんへ。寝る前のスマホを少し控えるのもおすすめです。',
    };
  }
  if (m === 'steps' || m === 'activeMinutes') {
    return {
      title: 'からだを動かす量がふだんより少なめです',
      detail: '10分のお散歩でも十分です。気分転換もかねて、すこし外を歩いてみませんか。',
    };
  }
  if (m === 'stressLevel') {
    return {
      title: 'ストレスのサインが高めに出ています',
      detail: '深呼吸をゆっくり3回。あたたかい飲みものを片手に、ひと休みする時間をつくってみてください。',
    };
  }
  if (m === 'alcoholDrinks') {
    return {
      title: 'この1週間、お酒が多めのようです',
      detail: 'お酒はねむりの質をそっと下げてしまいます。今夜は休肝日にして、あたたかいお茶でひと息つきませんか。',
    };
  }
  if (m === 'caffeineMg') {
    return {
      title: 'カフェインが多めの日が続いています',
      detail: '午後のコーヒーをノンカフェインに替えるだけで、ねむりがぐっと深くなることがあります。',
    };
  }
  if (m === 'recoveryScore') {
    return {
      title: 'このところ、とても調子がいいようです',
      detail: 'からだの回復がしっかりできている時期です。新しいことを始めるのにぴったりのタイミングかもしれません。',
    };
  }
  return { title: 'いつもと少しちがう変化がありました', detail: a.detail };
}

/** けさのことば — 今日の数値と変化から、やさしい文章を組み立てる */
function buildMorningWords(
  name: string,
  today: DailyHealth | undefined,
  week: DailyHealth[],
  anomalies: HealthAnomaly[],
  chipIds: string[] = [],
): string[] {
  const lines: string[] = [];
  const hour = new Date().getHours();
  const callName = name ? `${name}さん` : 'あなた';
  const greet = hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは';
  if (!today) {
    return [`${greet}、${callName}。まだデータが届いていません。「つながる」からApple Watchや iPhoneをつなぐと、毎朝ここにことばが届きます。`];
  }
  lines.push(`${greet}、${callName}。きのうのねむりは${fmtSleep(today.sleepHours)}でした。`);

  if (today.sleepHours >= 7.5) {
    lines.push('しっかり休めています。この調子で、寝る時間のリズムを守っていきましょう。');
  } else if (today.sleepHours < 6) {
    lines.push('すこし少なめです。今夜は30分だけ早くおふとんに入るのを目標にしてみましょう。');
  }

  const avgSteps = week.length ? week.reduce((s, d) => s + d.steps, 0) / week.length : 0;
  if (today.steps > avgSteps * 1.15 && today.steps > 0) {
    lines.push(`歩いた量は${fmtNum(today.steps, '歩')}。この1週間の平均より多く、とてもよいペースです。`);
  } else if (today.steps > 0) {
    lines.push(`歩いた量は${fmtNum(today.steps, '歩')}。午後に10分のお散歩を足せると、ぐっと整います。`);
  }

  // ワンタップ記録 (きぶん・からだ) への応え — 最初のひとつに寄り添う
  const chipLine = chipIds.map((id) => CHIP_WORDS[id]).find(Boolean);
  if (chipLine) lines.push(chipLine);

  const important = anomalies.filter((a) => a.severity !== 'info');
  if (important.length > 0) {
    lines.push(`ひとつだけ気になる変化があります。下の「気づき」を見てみてください。`);
  } else {
    lines.push('大きな変化はありません。今日もあなたのペースで、おだやかにいきましょう。');
  }
  return lines;
}

/** きぶん・症状メモから、予防のヒントをやさしく返す */
function memoToHint(text: string, mood: PulseMemo['mood']): string {
  const t = text;
  if (/頭痛|頭が|ずつう/.test(t)) return 'こまめな水分と、画面から目を離す休憩を。強い痛みが続くときはがまんせず病院へ。';
  if (/生理|月経|PMS|ピーエムエス/.test(t)) return 'からだを冷やさないことがいちばんの味方です。つらさが強い月が続くなら、婦人科で相談するのも大切な予防です。';
  if (/冷え|さむ|寒/.test(t)) return '足首・おなか・首もとをあたためると全身がらくになります。白湯（さゆ）を1杯どうぞ。';
  if (/眠|ねむ|寝/.test(t)) return '寝る1時間前は照明を少し落として、スマホを枕から遠ざけると、ねむりの質が変わります。';
  if (/だる|疲|つかれ/.test(t)) return '疲れは「休んでね」のサイン。今日は予定をひとつ減らして、早めに休みましょう。';
  if (/目|眼精/.test(t)) return '1時間に1回、遠くを20秒ながめるだけで目はかなり休まります。';
  if (/肌|にきび|かさかさ/.test(t)) return '睡眠と水分がお肌の土台です。今夜はしっかり休んで、様子をみましょう。';
  if (/胃|お腹|おなか|腹痛/.test(t)) return '消化にやさしいあたたかい食事を。痛みが強い・続くときは早めに病院へ。';
  if (/めまい|ふらつ/.test(t)) return 'まず座って、水分をとってください。くり返すときは必ずお医者さんに相談を。';
  if (mood <= 2) return '書きとめられたこと自体がすばらしい一歩です。つらい日は、がんばらないことがいちばんの予防です。';
  return '記録が続くと、あなたのからだのリズムが見えてきます。この調子で続けていきましょう。';
}

// ── 共通UI部品 ──
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="pulse-card" style={{
      background: 'linear-gradient(165deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))',
      border: `1px solid ${C.line}`, borderRadius: 24,
      padding: 22,
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 14px 38px rgba(0,0,0,0.38)',
      ...style,
    }}>
      {children}
    </div>
  );
}
function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
      {icon}
      <div style={{ fontSize: 15.5, fontWeight: 600, color: C.ink, fontFamily: SERIF, letterSpacing: '0.04em' }}>{children}</div>
    </div>
  );
}
function PrimaryButton({ onClick, href, children, full }: {
  onClick?: () => void; href?: string; children: React.ReactNode; full?: boolean;
}) {
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 50, padding: '13px 26px', borderRadius: 999,
    background: 'linear-gradient(120deg, #FF5C8A, #E8859E)',
    color: '#2A0D17', fontSize: 14.5, fontWeight: 700,
    letterSpacing: '0.06em',
    border: 'none', cursor: 'pointer', textDecoration: 'none',
    width: full ? '100%' : undefined, boxSizing: 'border-box',
    boxShadow: '0 8px 26px rgba(255,92,138,0.35), 0 0 44px rgba(255,92,138,0.16)',
  };
  if (href) return <a href={href} className="pulse-press" style={style}>{children}</a>;
  return <button type="button" onClick={onClick} className="pulse-press" style={style}>{children}</button>;
}
function GhostButton({ onClick, href, children, full }: {
  onClick?: () => void; href?: string; children: React.ReactNode; full?: boolean;
}) {
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 50, padding: '13px 26px', borderRadius: 999,
    background: 'rgba(255,255,255,0.045)', color: C.accent, fontSize: 14.5, fontWeight: 600,
    letterSpacing: '0.06em',
    border: '1px solid rgba(255,92,138,0.5)', cursor: 'pointer', textDecoration: 'none',
    width: full ? '100%' : undefined, boxSizing: 'border-box',
  };
  if (href) return <a href={href} className="pulse-press" style={style}>{children}</a>;
  return <button type="button" onClick={onClick} className="pulse-press" style={style}>{children}</button>;
}
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...labelStyle(), marginBottom: 6 }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: C.bgDeep, border: `1px solid ${C.line}`, borderRadius: 14, padding: '9px 12px',
      }}>
        <div style={{
          flex: 1, fontSize: 12, fontFamily: 'ui-monospace, monospace', color: C.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}>{value || '—'}</div>
        <button
          type="button"
          onClick={async () => {
            try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* ignore */ }
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
            minHeight: 36, padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: copied ? C.goodSoft : 'rgba(255,255,255,0.05)', color: copied ? C.good : C.accent,
            border: `1px solid ${copied ? C.good : 'rgba(255,92,138,0.5)'}`, cursor: 'pointer',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'できました' : 'コピー'}
        </button>
      </div>
    </div>
  );
}

// ── 7日間ミニグラフ (棒・SVG。ローズベージュの柔らかな棒) ──
function WeekBars({ week, metric, color, goal }: {
  week: DailyHealth[]; metric: 'sleepHours' | 'steps'; color: string; goal?: number;
}) {
  const vals = week.map((d) => d[metric] ?? 0);
  const max = Math.max(...vals, goal ?? 0, 1);
  const W = 260; const H = 64; const gap = 7;
  const bw = (W - gap * (vals.length - 1)) / Math.max(vals.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden>
      {typeof goal === 'number' && goal > 0 && (
        <line x1={0} x2={W} y1={H - (goal / max) * (H - 8)} y2={H - (goal / max) * (H - 8)}
          stroke={C.gold} strokeWidth={1} strokeDasharray="1 5" strokeLinecap="round" />
      )}
      {vals.map((v, i) => {
        const h = Math.max(3, (v / max) * (H - 8));
        return (
          <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={Math.min(6, bw / 2)}
            fill={i === vals.length - 1 ? color : `${color}4D`} />
        );
      })}
    </svg>
  );
}

// ── スコアのカウントアップ (0 → 総合点。数字が息を吹き返す演出) ──
function useCountUp(target: number, duration = 1000): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

// ── 「きょうの調子」リングゲージ (主役・大径。鼓動のように呼吸する光) ──
function ScoreRing({ score }: { score: PulseScoreResult }) {
  const total = Math.max(0, Math.min(100, score.total));
  const shown = useCountUp(total, 1100);
  const R = 82;
  const CIRC = 2 * Math.PI * R;
  const S = 196;
  return (
    <div style={{ position: 'relative', width: S, height: S, margin: '0 auto' }}>
      {/* 呼吸するピンクの光 (ハロー) */}
      <div aria-hidden className="pulse-breathe" style={{
        position: 'absolute', inset: 10, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,92,138,0.28) 0%, rgba(255,92,138,0.07) 55%, rgba(255,92,138,0) 72%)',
      }} />
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden style={{ display: 'block', position: 'relative' }}>
        <defs>
          <linearGradient id="pulseScoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF5C8A" />
            <stop offset="60%" stopColor="#E8859E" />
            <stop offset="100%" stopColor="#C9A192" />
          </linearGradient>
          <filter id="pulseRingGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* トラック (うっすら) */}
        <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" />
        {/* 進捗アーク (発光) */}
        <circle
          cx={S / 2} cy={S / 2} r={R} fill="none"
          stroke="url(#pulseScoreGrad)" strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${CIRC}`} strokeDashoffset={CIRC * (1 - total / 100)}
          transform={`rotate(-90 ${S / 2} ${S / 2})`}
          filter="url(#pulseRingGlow)"
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3,
      }}>
        <div style={{ ...NUM_STYLE, fontSize: 62, color: C.ink, lineHeight: 1, textShadow: NUM_GLOW }}>{shown}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, fontFamily: SERIF, letterSpacing: '0.14em' }}>
          {score.label}
        </div>
      </div>
    </div>
  );
}

// ── 7日間の調子トレンド (折れ線・SVG。ゴールド点線 = 「よい」の目安) ──
function ScoreTrendChart({ scores }: { scores: Array<{ total: number }> }) {
  const W = 260; const H = 76; const P = 8;
  const n = scores.length;
  if (n === 0) return null;
  const x = (i: number) => (n > 1 ? P + (i * (W - 2 * P)) / (n - 1) : W / 2);
  const y = (v: number) => H - 8 - (Math.max(0, Math.min(100, v)) / 100) * (H - 18);
  const pts = scores.map((s, i) => `${x(i)},${y(s.total)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden>
      <line x1={0} x2={W} y1={y(SCORE_GOOD_LINE)} y2={y(SCORE_GOOD_LINE)}
        stroke={C.gold} strokeWidth={1} strokeDasharray="1 5" strokeLinecap="round" />
      {n > 1 && <polyline points={pts} fill="none" stroke={C.rose} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />}
      {scores.map((s, i) => (
        <circle key={i} cx={x(i)} cy={y(s.total)} r={i === n - 1 ? 4 : 2.5}
          fill={i === n - 1 ? C.accent : C.rose} />
      ))}
    </svg>
  );
}

// ── きょうのフォーカス — スコア内訳のいちばん弱い項目から1行提案 (コード確定・LLM不要) ──
const FOCUS_WORDS: Record<keyof PulseScoreParts, string> = {
  sleep: 'きょうは30分早くおふとんへ。ねむりが伸びると、あしたの点がいちばん上がります。',
  hrv: 'きょうはがんばりすぎない日に。深呼吸を3回と、あたたかい飲みものをどうぞ。',
  resting: '脈が高めのサインです。カフェインを控えめに、今夜はゆったり過ごしましょう。',
  steps: '午後に10分のお散歩を。8,000歩に近づくほど、点はぐっと上がります。',
};
/** 内訳のうち満点比がいちばん低い項目を返す (同率なら配点の大きい順に優先) */
export function weakestPart(parts: PulseScoreParts): keyof PulseScoreParts {
  const order: Array<keyof PulseScoreParts> = ['sleep', 'hrv', 'resting', 'steps'];
  let worst: keyof PulseScoreParts = 'sleep';
  let worstRatio = Infinity;
  for (const k of order) {
    const ratio = parts[k] / SCORE_MAX[k];
    if (ratio < worstRatio) { worstRatio = ratio; worst = k; }
  }
  return worst;
}

// ── 今週のまとめ (週間レポート・コード確定計算) ──
interface WeeklySummary {
  avgScore: number | null;      // 今週 (直近7日) の平均スコア
  prevAvgScore: number | null;  // 先週 (その前7日) の平均スコア
  sleepSum: number;             // 今週のねむり合計 (時間)
  prevSleepSum: number | null;
  stepsSum: number;             // 今週の歩数合計
  prevStepsSum: number | null;
  daysCount: number;            // 今週のデータ日数
}
export function summarizeWeek(days: DailyHealth[]): WeeklySummary {
  const last7 = days.slice(-7);
  const prev7 = days.slice(-14, -7);
  const totals = scoreLastDays(days, 14);
  const curTotals = totals.slice(-last7.length);
  const prevTotals = totals.slice(0, Math.max(0, totals.length - last7.length));
  const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  const sum = (arr: DailyHealth[], pick: (d: DailyHealth) => number) =>
    arr.reduce((s, d) => { const v = pick(d); return s + (isFinite(v) && v > 0 ? v : 0); }, 0);
  const avg = mean(curTotals.map((t) => t.total));
  const prevAvg = prev7.length >= 3 ? mean(prevTotals.map((t) => t.total)) : null;
  return {
    avgScore: avg === null ? null : Math.round(avg),
    prevAvgScore: prevAvg === null ? null : Math.round(prevAvg),
    sleepSum: sum(last7, (d) => d.sleepHours),
    prevSleepSum: prev7.length >= 3 ? sum(prev7, (d) => d.sleepHours) : null,
    stepsSum: sum(last7, (d) => d.steps),
    prevStepsSum: prev7.length >= 3 ? sum(prev7, (d) => d.steps) : null,
    daysCount: last7.length,
  };
}
/** 先週比の矢印。cur/prev から ▲(良) ▼(注意) →(横ばい) を決める */
function DeltaArrow({ cur, prev, unit, betterIsUp = true }: {
  cur: number; prev: number | null; unit: string; betterIsUp?: boolean;
}) {
  if (prev === null || prev <= 0) {
    return <span style={{ fontSize: 10.5, color: C.sub, opacity: 0.8 }}>先週分はまだありません</span>;
  }
  const diff = cur - prev;
  const flat = Math.abs(diff) < Math.max(prev * 0.03, 0.0001);
  const isGood = flat ? null : (diff > 0) === betterIsUp;
  const Icon = flat ? Minus : diff > 0 ? TrendingUp : TrendingDown;
  const color = flat ? C.sub : isGood ? C.good : C.warn;
  const fmt = (v: number) => (unit === '時間' ? fmtSleep(Math.abs(v)) : `${Math.round(Math.abs(v)).toLocaleString()}${unit}`);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color }}>
      <Icon size={12} />
      {flat ? '先週なみ' : `先週より${fmt(diff)}${diff > 0 ? '多い' : '少ない'}`}
    </span>
  );
}

// ── ストリーク — ピンクのリング連鎖 (7日ぶんの小さなリングが灯る) ──
function StreakRings({ streak }: { streak: number }) {
  const lit = Math.max(0, Math.min(streak, 7));
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 13px',
      borderRadius: 999, background: 'rgba(255,92,138,0.10)', border: `1px solid ${C.line}`,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }} aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => (
          <svg key={i} width={11} height={11} viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="4.4" fill="none"
              stroke={i < lit ? '#FF5C8A' : 'rgba(255,255,255,0.18)'}
              strokeWidth={i < lit ? 1.9 : 1.1} />
            {i < lit && <circle cx="6" cy="6" r="1.8" fill="rgba(255,92,138,0.75)" />}
          </svg>
        ))}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: C.accent, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
        {streak >= 2 ? `${streak}日連続` : 'きょうから'}
      </span>
    </div>
  );
}

// ── ヒーロー装飾 (夜色にピンクのネオングロー + 流れる脈波ライン) ──
function HeroArcs() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* 右上のピンクのにじみ */}
      <div style={{
        position: 'absolute', top: -180, right: -140, width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 65%, rgba(255,92,138,0.20), rgba(255,92,138,0) 68%)',
      }} />
      {/* 左のローズのにじみ */}
      <div style={{
        position: 'absolute', top: 140, left: -170, width: 380, height: 380, borderRadius: '50%',
        background: 'radial-gradient(circle at 60% 40%, rgba(232,133,158,0.13), rgba(232,133,158,0) 66%)',
      }} />
      {/* 呼吸するピンクの細いリング */}
      <div className="pulse-breathe" style={{
        position: 'absolute', top: 26, right: -70, width: 260, height: 260, borderRadius: '50%',
        border: '1px solid rgba(255,92,138,0.4)',
        boxShadow: '0 0 44px rgba(255,92,138,0.14), inset 0 0 30px rgba(255,92,138,0.08)',
      }} />
      <div style={{
        position: 'absolute', top: 280, left: -90, width: 190, height: 190, borderRadius: '50%',
        border: '1px solid rgba(232,133,158,0.28)',
      }} />
      {/* 流れる脈波ライン (心電図。描かれては消えるループ) */}
      <svg viewBox="0 0 720 120" preserveAspectRatio="none"
        style={{ position: 'absolute', bottom: 8, left: 0, width: '100%', height: 90 }}>
        <defs>
          <linearGradient id="pulseHeroEcg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,92,138,0)" />
            <stop offset="18%" stopColor="#FF5C8A" />
            <stop offset="60%" stopColor="#E8859E" />
            <stop offset="100%" stopColor="rgba(201,161,146,0)" />
          </linearGradient>
        </defs>
        <path
          className="pulse-ecg-flow"
          d="M0 66 H150 l14 -26 20 52 14 -38 10 12 H340 l12 -20 18 40 12 -28 8 8 H540 l13 -24 18 46 13 -32 9 10 H720"
          pathLength={1000}
          fill="none" stroke="url(#pulseHeroEcg)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,92,138,0.55))' }}
        />
        <path
          d="M0 66 H150 l14 -26 20 52 14 -38 10 12 H340 l12 -20 18 40 12 -28 8 8 H540 l13 -24 18 46 13 -32 9 10 H720"
          fill="none" stroke="rgba(255,92,138,0.14)" strokeWidth="1"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ============================================================
// LP (未入場)
// ============================================================
function PulseLanding({ onEnter }: { onEnter: () => void }) {
  const values = [
    {
      Icon: Activity,
      title: '今日の調子が、ひと目でわかる',
      body: '睡眠・心拍のゆらぎ・脈・歩いた量から「きょうの調子」を0〜100の数字で表示します。内訳まで見えるので、なぜその数字なのかも納得できます。開いて1秒で、今日の自分がわかります。',
    },
    {
      Icon: Smartphone,
      title: 'からだの記録が、自動で集まる',
      body: 'Apple Watchや iPhoneをつなぐと、睡眠・心拍・歩数が毎朝自動でこのアプリに届きます。あなたが入力する手間はありません。',
    },
    {
      Icon: Sun,
      title: 'AIが毎朝、ことばで教えてくれる',
      body: '数字の一覧ではなく「きのうは少し寝不足。今夜は30分早くおふとんへ」のような、やさしいことばで今日の調子をお届けします。きぶん・からだの記録もタップするだけ。10秒で完了します。',
    },
    {
      Icon: HeartPulse,
      title: '気になる変化に、はやく気づける',
      body: 'ふだんのあなたと比べて「いつもとちがう」変化があると、そっとお知らせ。7日間のうつりかわりもグラフでひと目です。予防医学の考え方でも、いちばんの近道は、はやく気づくことです。',
    },
  ];
  const trust = [
    {
      Icon: Lock,
      title: 'あなたの記録は、あなたのものです',
      body: 'からだの記録は、あなたのアカウント（お使いの端末）にだけ保存されます。ほかの誰かに見られたり、勝手に使われたりすることはありません。',
    },
    {
      Icon: FileText,
      title: '専門家に相談するときの、確かな資料に',
      body: 'からだの記録は、医師や専門家に相談するときの確かな資料になります。「いつから・どのくらい」が伝えられるだけで、相談の質は大きく変わります。',
    },
    {
      Icon: Stethoscope,
      title: '予防医学の考え方にもとづくヒント',
      body: 'お届けするのは、予防医学の考え方にもとづく生活のヒントです。気になる変化が続くときは、早めに信頼できる専門機関へ。その判断を、記録がそっと支えます。',
    },
  ];
  return (
    <div style={{ minHeight: '100svh', background: C.bg, color: C.ink }}>
      {/* ヘッダー */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', maxWidth: 960, margin: '0 auto', boxSizing: 'border-box',
        position: 'relative', zIndex: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PulseLogo size={34} withWordmark={false} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '0.08em', fontFamily: SERIF }}>CORE Pulse</div>
            <div style={{ fontSize: 10, color: C.sub, letterSpacing: '0.14em', marginTop: 1 }}>からだ見守りAI（エーアイ）</div>
          </div>
        </div>
        <button type="button" onClick={onEnter} className="pulse-press" style={{
          minHeight: 40, padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          letterSpacing: '0.04em',
          background: 'rgba(255,255,255,0.05)', color: C.accent, border: '1px solid rgba(255,92,138,0.5)', cursor: 'pointer',
        }}>
          アプリを開く
        </button>
      </header>

      {/* ヒーロー */}
      <section style={{ position: 'relative' }}>
        <HeroArcs />
        <div style={{
          position: 'relative', maxWidth: 720, margin: '0 auto',
          padding: '52px 20px 64px', textAlign: 'center', boxSizing: 'border-box', zIndex: 1,
        }}>
          <div style={{ ...labelStyle(C.goldText), marginBottom: 18 }}>DAILY WELLNESS, GENTLY WATCHED</div>
          <h1 style={{
            fontSize: 'clamp(27px, 6.6vw, 42px)', lineHeight: 1.5, fontWeight: 600, margin: 0,
            fontFamily: SERIF, letterSpacing: '0.02em',
          }}>
            毎日のからだを、<br />AIがやさしく見守る。
          </h1>
          <p style={{
            fontSize: 15.5, lineHeight: 1.9, color: C.accent, margin: '18px 0 0',
            fontFamily: SERIF, fontWeight: 600, letterSpacing: '0.06em',
          }}>
            <span style={{ display: 'inline-block' }}>がんばるためではなく、</span>
            <span style={{ display: 'inline-block' }}>健やかでいるために。</span>
          </p>
          <p style={{ fontSize: 15, lineHeight: 2.1, color: C.sub, margin: '18px auto 0', maxWidth: 560 }}>
            Apple Watchや iPhoneをつなぐだけで、睡眠・心拍・歩数から今日の調子を読みとき、
            毎朝「ことば」でお届けします。症状やきぶんのメモからは、予防のヒントを。
            女性のライフステージの変化にも、そっと寄り添います。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 340, margin: '32px auto 0' }}>
            <PrimaryButton onClick={onEnter} full>
              無料でためしてみる <ArrowRight size={16} />
            </PrimaryButton>
            <GhostButton href={MONITOR_MAILTO} full>
              <Mail size={15} /> 先行モニターに申し込む
            </GhostButton>
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 14, letterSpacing: '0.04em' }}>
            登録なしで、見本のデータをそのままさわれます
          </div>
        </div>
      </section>

      {/* けさのことば サンプル */}
      <section style={{ maxWidth: 500, margin: '4px auto 0', padding: '0 20px', boxSizing: 'border-box' }}>
        <Card style={{ textAlign: 'left', boxShadow: '0 14px 44px rgba(255,92,138,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sun size={15} color={C.goldText} />
            <div style={labelStyle(C.goldText)}>けさのことば（見本）</div>
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 2.05, margin: 0, color: C.ink, fontFamily: SERIF }}>
            おはようございます。きょうの調子は72点「よい」です。
            きのうのねむりは6時間10分と、すこし少なめでした。今夜は30分だけ早くおふとんへ。
            歩いた量は8,200歩で、とてもよいペースです。
            心拍のゆらぎが下がりぎみなので、今日はむりせずゆっくりめに。
          </p>
        </Card>
      </section>

      {/* 3つの価値 */}
      <section style={{ maxWidth: 960, margin: '56px auto 0', padding: '0 20px', boxSizing: 'border-box' }}>
        <div className="pulse-value-grid">
          {values.map((v) => (
            <Card key={v.title}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%', background: C.roseSoft,
                border: `1px solid ${C.line}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <v.Icon size={21} color={C.accent} strokeWidth={1.6} />
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 10, fontFamily: SERIF, letterSpacing: '0.02em', lineHeight: 1.6 }}>{v.title}</div>
              <div style={{ fontSize: 13.5, lineHeight: 2.0, color: C.sub }}>{v.body}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* 信頼 — 安心して続けられる理由 */}
      <section style={{ maxWidth: 640, margin: '56px auto 0', padding: '0 20px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ ...labelStyle(C.goldText), marginBottom: 12 }}>TRUST</div>
          <h2 style={{ fontSize: 21, fontWeight: 600, margin: 0, fontFamily: SERIF, letterSpacing: '0.03em' }}>
            安心して、続けられるように。
          </h2>
        </div>
        <Card style={{ padding: '10px 24px' }}>
          {trust.map((tr, i) => (
            <div key={tr.title} style={{
              display: 'flex', gap: 14, alignItems: 'flex-start', padding: '18px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${C.line}`,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', background: C.accentSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
              }}>
                <tr.Icon size={17} color={C.accent} strokeWidth={1.6} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, fontFamily: SERIF, letterSpacing: '0.02em', lineHeight: 1.6 }}>{tr.title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.95, color: C.sub, marginTop: 5 }}>{tr.body}</div>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {/* 料金 */}
      <section style={{ maxWidth: 500, margin: '56px auto 0', padding: '0 20px', boxSizing: 'border-box' }}>
        <Card style={{ textAlign: 'center', border: `1px solid ${C.gold}` }}>
          <div style={labelStyle(C.goldText)}>料金</div>
          <div style={{ marginTop: 14, ...NUM_STYLE, fontSize: 40, color: C.ink, lineHeight: 1, textShadow: NUM_GLOW }}>
            ¥2,980
            <span style={{ fontSize: 14, fontWeight: 400, color: C.sub, letterSpacing: '0.04em', marginLeft: 8, fontFamily: "'Noto Sans JP', sans-serif" }}>/月（予定）</span>
          </div>
          <div style={{
            display: 'inline-block', marginTop: 14, padding: '7px 16px', borderRadius: 999,
            background: C.goodSoft, color: C.good, fontSize: 13, fontWeight: 600, letterSpacing: '0.03em',
          }}>
            いまは先行モニター募集中・無料
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: C.sub, margin: '16px 0 0' }}>
            正式スタート前のいまは、無料でぜんぶの機能をお使いいただけます。
            使ってみた感想を、メールでひとこと聞かせてください。
          </p>
          <div style={{ marginTop: 18 }}>
            <PrimaryButton href={MONITOR_MAILTO} full>
              <Mail size={15} /> 先行モニターに申し込む
            </PrimaryButton>
          </div>
          <div style={{
            marginTop: 16, padding: '12px 14px', borderRadius: 14, background: C.bgDeep,
            fontSize: 12.5, lineHeight: 1.8, color: C.sub, textAlign: 'left',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>CORE Prismをお使いの方は、そのままのデータでCORE Pulseを使えます（同じ端末なら記録は共通です）。</span>
          </div>
        </Card>
      </section>

      {/* 安心 */}
      <section style={{ maxWidth: 560, margin: '40px auto 0', padding: '0 20px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'center' }}>
          <ShieldCheck size={16} color={C.good} style={{ flexShrink: 0, marginTop: 3 }} />
          <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.sub, margin: 0 }}>
            あなたの記録は、あなたのアカウントにだけ保存されます。
            気になる変化が続くときは、早めに信頼できる専門機関へご相談ください。
          </p>
        </div>
      </section>

      {/* フッター */}
      <footer style={{
        marginTop: 56, padding: '26px 20px calc(32px + env(safe-area-inset-bottom))',
        borderTop: `1px solid ${C.line}`, textAlign: 'center',
      }}>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', fontSize: 12 }}>
          <a href="/privacy" style={{ color: C.sub, textDecoration: 'none' }}>プライバシーポリシー</a>
          <a href="/tokushoho" style={{ color: C.sub, textDecoration: 'none' }}>特定商取引法に基づく表記</a>
        </div>
        <p style={{ fontSize: 11.5, lineHeight: 1.9, color: C.sub, margin: '14px auto 0', maxWidth: 480 }}>
          CORE Pulseは医療機器ではありません。診断・治療は医療機関にご相談ください。
        </p>
        <div style={{ fontSize: 11, color: C.sub, marginTop: 10, letterSpacing: '0.1em', opacity: 0.85 }}>
          CORE Pulse — CORE（設立準備中）
        </div>
      </footer>

      <style>{`
        .pulse-value-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 760px) { .pulse-value-grid { grid-template-columns: repeat(2, 1fr); } }
        ${PULSE_CSS}
      `}</style>
    </div>
  );
}

// ============================================================
// つながる: Apple Watch / iPhone 自動同期 (既存 /api/health/ingest を再利用)
// ============================================================
function ConnectView({ profile, onSaveEmail, health }: {
  profile: PulseProfile;
  onSaveEmail: (email: string) => void;
  health: ReturnType<typeof useHealth>;
}) {
  const [email, setEmail] = useState(profile.email);
  const [hash, setHash] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [checkOk, setCheckOk] = useState<boolean | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!profile.email) { setHash(''); return; }
    emailToHash(profile.email).then((h) => { if (alive) setHash(h); });
    return () => { alive = false; };
  }, [profile.email]);

  const endpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/health/ingest` : '/api/health/ingest';
  const identity: HealthIdentity | null = hash ? { kind: 'hash', id: hash } : null;

  const verify = async () => {
    if (!identity) return;
    setChecking(true); setCheckResult(null); setCheckOk(null);
    try {
      const s = await checkIngestStatus(identity);
      if (s && s.count > 0) {
        setCheckOk(true);
        setCheckResult(`届いています。${s.count}日ぶんのデータを受け取り済みです（最新: ${s.latestDate ?? '—'}）。`);
      } else {
        setCheckOk(false);
        setCheckResult('まだ届いていません。iPhoneのショートカットを一度実行してから、もう一度確認してみてください。');
      }
    } catch {
      setCheckOk(false);
      setCheckResult('確認できませんでした。電波のよいところで、もう一度お試しください。');
    } finally {
      setChecking(false);
    }
  };

  const importDays = async () => {
    if (!hash) return;
    setImporting(true); setImportMsg(null);
    try {
      const r = await fetchWithTimeout(`/api/health/ingest?hash=${hash}`, {
        method: 'GET',
        headers: { 'X-User-Email-Hash': hash },
      }, 15000);
      const j = await r.json();
      const serverDays: Array<{ date: string; metrics: Record<string, number> }> = Array.isArray(j?.days) ? j.days : [];
      if (serverDays.length === 0) {
        setImportMsg('まだ取りこめるデータがありません。先に「届いているか確認」をお試しください。');
        return;
      }
      const byDate = new Map(health.days.map((d) => [d.date, d]));
      const empty: DailyHealth = {
        date: '', sleepHours: 0, deepSleepMin: 0, remSleepMin: 0, sleepScore: 0,
        hrv: 0, restingHR: 0, recoveryScore: 0, steps: 0, activeMinutes: 0,
        exerciseKcal: 0, stressLevel: 0, mindfulMinutes: 0, hydrationL: 0,
        caffeineMg: 0, alcoholDrinks: 0,
      };
      const mapped: DailyHealth[] = serverDays.map((sd) => {
        const base = byDate.get(sd.date) ?? { ...empty, date: sd.date };
        const m = sd.metrics ?? {};
        return {
          ...base,
          date: sd.date,
          steps: m.steps ?? base.steps,
          restingHR: m.restingHR ?? m.heartRate ?? base.restingHR,
          sleepHours: m.sleepHours ?? base.sleepHours,
          hrv: m.hrv ?? base.hrv,
          weightKg: m.weightKg ?? base.weightKg,
          exerciseKcal: m.exerciseKcal ?? base.exerciseKcal,
        };
      });
      health.mergeDays(mapped);
      health.markAppleHealthImported(serverDays.length);
      setImportMsg(`${serverDays.length}日ぶんのデータを取りこみました。「きょう」を開いてみてください。`);
    } catch (e) {
      setImportMsg(isAbort(e)
        ? '時間がかかりすぎたため中断しました。電波のよいところで、もう一度お試しください。'
        : '取りこみに失敗しました。すこし待ってから、もう一度お試しください。');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <SectionTitle icon={<Smartphone size={17} color={C.accent} strokeWidth={1.6} />}>
        Apple Watch / iPhone とつなぐ
      </SectionTitle>
      <p style={{ fontSize: 13, lineHeight: 1.9, color: C.sub, margin: '0 0 4px' }}>
        iPhoneの「ショートカット」というアプリを使うと、毎朝の睡眠・歩数・心拍が自動でここに届きます。
        設定は一度だけ。3つの手順でできます。
      </p>

      {/* 手順1 */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, fontFamily: SERIF }}>手順1. メールアドレスを入れる</div>
        <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.8, marginTop: 5 }}>
          あなた専用の「合いことば（識別番号）」を作るために使います。メールが送られることはありません。
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="例: hana@example.com"
            style={{
              flex: '1 1 180px', minWidth: 0, minHeight: 46, fontSize: 16, color: C.ink,
              padding: '8px 14px', borderRadius: 14, border: `1px solid ${C.line}`,
              background: C.bgDeep, boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => onSaveEmail(email.trim())}
            style={{
              minHeight: 46, padding: '8px 20px', borderRadius: 999, fontSize: 13.5, fontWeight: 600,
              letterSpacing: '0.04em',
              background: 'linear-gradient(120deg, #FF5C8A, #E8859E)', color: '#2A0D17',
              border: 'none', cursor: 'pointer', flexShrink: 0,
            }}
          >
            決定
          </button>
        </div>
      </div>

      {/* 手順2 */}
      {hash && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, fontFamily: SERIF }}>手順2. iPhoneのショートカットに、この2つを貼る</div>
          <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.8, marginTop: 5 }}>
            「ショートカット」アプリで新しいショートカットを作り、「URLの内容を取得」で下の送り先へ、
            ヘルスケアの数値（歩数・睡眠・心拍）を毎朝送るようにします。合いことばは
            「X-User-Email-Hash」という名前のヘッダー（送り主の名札のようなもの）に貼ってください。
          </div>
          <CopyField label="送り先（URL）" value={endpoint} />
          <CopyField label="あなたの合いことば（識別番号）" value={hash} />
        </div>
      )}

      {/* 手順3 */}
      {hash && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, fontFamily: SERIF }}>手順3. 届いているか確認する</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <GhostButton onClick={verify} full>
              {checking ? <Loader2 size={15} className="pulse-spin" /> : <RefreshCw size={15} />}
              届いているか確認
            </GhostButton>
            {checkResult && (
              <div style={{
                fontSize: 13, lineHeight: 1.8, padding: '11px 14px', borderRadius: 14,
                background: checkOk ? C.goodSoft : C.warnSoft,
                color: checkOk ? C.good : C.warn, fontWeight: 500,
              }}>
                {checkResult}
              </div>
            )}
            <PrimaryButton onClick={importDays} full>
              {importing ? <Loader2 size={15} className="pulse-spin" /> : <ArrowRight size={15} />}
              届いたデータをこのアプリに取りこむ
            </PrimaryButton>
            {importMsg && (
              <div style={{
                fontSize: 13, lineHeight: 1.8, padding: '11px 14px', borderRadius: 14,
                background: C.accentSoft, color: C.accent, fontWeight: 500,
              }}>
                {importMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── 心拍計 (Bluetooth) ライブ計測 — webBluetoothHR を再利用した Pulse 向けの見た目 ──
function HeartMonitorView({ identity }: { identity: HealthIdentity | null }) {
  const monitorRef = useRef<HeartRateMonitor | null>(null);
  const [supported] = useState(isWebBluetoothSupported());
  const [status, setStatus] = useState<'idle' | 'pairing' | 'connected' | 'reconnecting' | 'disconnected' | 'error'>('idle');
  const [bpm, setBpm] = useState<number | null>(null);
  const [hrv, setHrv] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => { monitorRef.current?.disconnect(); }, []);

  const connect = async () => {
    setError(null);
    if (!supported) {
      setError('この機能はパソコンやAndroidのChrome（クローム）で使えます。iPhoneのSafariでは使えません。');
      return;
    }
    const m = new HeartRateMonitor();
    monitorRef.current = m;
    m.onStatus((s, detail) => {
      setStatus(s);
      if (s === 'error') setError(detail || 'つながりませんでした。もう一度お試しください。');
    });
    m.onReading((r: HRReading) => {
      setBpm(r.bpm);
      setHrv(Math.round(m.computeHRV()));
    });
    try {
      await m.pair();
    } catch {
      setStatus('error');
      setError('つながりませんでした。心拍計の電源を確かめて、もう一度お試しください。');
    }
  };

  const save = async () => {
    const m = monitorRef.current;
    if (!m || !identity) return;
    const summary = m.sessionSummary();
    if (!summary) { setSaveMsg('もうすこし計測してから保存してください（数十秒ほど）。'); return; }
    setSaving(true); setSaveMsg(null);
    try {
      const r = await saveLiveHRSession(identity, summary);
      setSaveMsg(r.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <SectionTitle icon={<Bluetooth size={17} color={C.accent} strokeWidth={1.6} />}>
        胸につける心拍計でその場で計る
      </SectionTitle>
      <p style={{ fontSize: 13, lineHeight: 1.9, color: C.sub, margin: 0 }}>
        お手持ちの心拍計（胸ベルト式など）があれば、いまの心拍をその場で計れます。お持ちでなければ飛ばしてOKです。
      </p>
      {status === 'connected' || status === 'reconnecting' ? (
        <div style={{
          marginTop: 14, borderRadius: 20, background: C.roseSoft, padding: 20, textAlign: 'center',
          border: `1px solid ${C.line}`,
        }}>
          <div style={{ ...NUM_STYLE, fontSize: 52, color: C.ink, lineHeight: 1, textShadow: NUM_GLOW }}>
            {bpm ?? '—'}
            <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 8, color: C.sub, fontFamily: "'Noto Sans JP', sans-serif" }}>回/分</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8 }}>
            心拍のゆらぎ: {hrv && hrv > 0 ? `${hrv}` : '計測中…'}
            {status === 'reconnecting' && ' ・つなぎ直しています…'}
          </div>
          {identity && (
            <div style={{ marginTop: 14 }}>
              <GhostButton onClick={save} full>
                {saving ? <Loader2 size={15} className="pulse-spin" /> : <Check size={15} />}
                この計測を記録に保存
              </GhostButton>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <GhostButton onClick={connect} full>
            <Bluetooth size={15} />
            {status === 'pairing' ? 'さがしています…' : '心拍計をつなぐ'}
          </GhostButton>
        </div>
      )}
      {error && (
        <div style={{
          marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start',
          fontSize: 12.5, lineHeight: 1.8, color: C.warn, background: C.warnSoft,
          borderRadius: 14, padding: '11px 14px',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          {error}
        </div>
      )}
      {saveMsg && (
        <div style={{
          marginTop: 12, fontSize: 12.5, lineHeight: 1.8, color: C.good,
          background: C.goodSoft, borderRadius: 14, padding: '11px 14px', fontWeight: 500,
        }}>
          {saveMsg}
        </div>
      )}
    </Card>
  );
}

// ============================================================
// アプリ本体 (入場後)
// ============================================================
type Tab = 'today' | 'log' | 'connect' | 'settings';

function PulseHome() {
  const health = useHealth();
  const [tab, setTab] = useState<Tab>('today');
  const [profile, setProfile] = useState<PulseProfile>(() =>
    loadJson<PulseProfile>(PROFILE_KEY, { name: '', email: '', goalSteps: 8000, goalSleep: 7.5 }),
  );
  const [memos, setMemos] = useState<PulseMemo[]>(loadMemos);
  const [memoText, setMemoText] = useState('');
  const [memoMood, setMemoMood] = useState<PulseMemo['mood']>(3);
  const [hash, setHash] = useState('');
  const [streak] = useState<number>(recordTodayAndGetStreak);
  const [chipsByDate, setChipsByDate] = useState<Record<string, string[]>>(loadChips);
  const todayKey = localDateStr();
  const todayChips = useMemo(() => chipsByDate[todayKey] ?? [], [chipsByDate, todayKey]);
  const toggleChip = useCallback((id: string) => {
    setChipsByDate((prev) => {
      const cur = prev[todayKey] ?? [];
      const next = {
        ...prev,
        [todayKey]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
      };
      saveJson(CHIP_KEY, next); // タップした瞬間に保存 (10秒で完了)
      return next;
    });
  }, [todayKey]);

  useEffect(() => { saveJson(PROFILE_KEY, profile); }, [profile]);
  useEffect(() => { saveJson(MEMO_KEY, memos); }, [memos]);
  useEffect(() => {
    let alive = true;
    if (!profile.email) { setHash(''); return; }
    emailToHash(profile.email).then((h) => { if (alive) setHash(h); });
    return () => { alive = false; };
  }, [profile.email]);

  const anomalies = useMemo(() => detectAnomalies(health.days), [health.days]);
  const importantAnomalies = anomalies.filter((a) => a.severity !== 'info').slice(0, 3);
  const morning = useMemo(
    () => buildMorningWords(profile.name, health.today, health.week, anomalies, todayChips),
    [profile.name, health.today, health.week, anomalies, todayChips],
  );
  const identity: HealthIdentity | null = hash ? { kind: 'hash', id: hash } : null;

  // 「きょうの調子」スコア (コード確定の純粋関数・当日より前をふだんとして使う)
  const score = useMemo(
    () => (health.today ? scorePulseDay(health.today, health.days.slice(0, -1)) : null),
    [health.today, health.days],
  );
  const scoreTrend = useMemo(() => scoreLastDays(health.days, 7), [health.days]);
  const weekly = useMemo(() => summarizeWeek(health.days), [health.days]);

  const addMemo = useCallback(() => {
    const text = memoText.trim();
    if (!text) return;
    const memo: PulseMemo = {
      id: `m_${Date.now()}`,
      ts: Date.now(),
      mood: memoMood,
      text,
    };
    setMemos((prev) => [memo, ...prev].slice(0, 100));
    setMemoText('');
  }, [memoText, memoMood]);

  const t = health.today;
  const MOODS: Array<{ v: PulseMemo['mood']; label: string; Icon: typeof Smile }> = [
    { v: 4, label: 'げんき', Icon: SmilePlus },
    { v: 3, label: 'ふつう', Icon: Smile },
    { v: 2, label: 'いまいち', Icon: Meh },
    { v: 1, label: 'つらい', Icon: Frown },
  ];
  const moodLabel = (m: PulseMemo['mood']) => MOODS.find((x) => x.v === m)?.label ?? 'ふつう';

  const NAV: Array<{ key: Tab; label: string; Icon: typeof Sun }> = [
    { key: 'today', label: 'きょう', Icon: Sun },
    { key: 'log', label: '記録', Icon: NotebookPen },
    { key: 'connect', label: 'つながる', Icon: Smartphone },
    { key: 'settings', label: '設定', Icon: Settings },
  ];

  return (
    <div style={{ minHeight: '100svh', background: C.bg, color: C.ink }}>
      {/* ヘッダー */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', maxWidth: 640, margin: '0 auto', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <PulseLogo size={30} withWordmark={false} />
          <div style={{ fontSize: 15, fontWeight: 600, fontFamily: SERIF, letterSpacing: '0.06em' }}>CORE Pulse</div>
        </div>
        <div style={{ fontSize: 12, color: C.sub, fontWeight: 500, letterSpacing: '0.06em' }}>{todayLabel()}</div>
      </header>

      <main style={{
        maxWidth: 640, margin: '0 auto',
        padding: '6px 18px calc(100px + env(safe-area-inset-bottom))', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* ── きょう ── */}
        {tab === 'today' && (
          <>
            {/* きょうの調子 — 0-100 スコア + リング (Oura型・主役) */}
            {score && score.hasData && (
              <Card style={{ position: 'relative', overflow: 'hidden', paddingBottom: 24 }}>
                <div aria-hidden style={{
                  position: 'absolute', top: -90, left: -90, width: 240, height: 240, borderRadius: '50%',
                  background: 'radial-gradient(circle at 60% 60%, rgba(255,92,138,0.14), rgba(255,92,138,0) 70%)',
                }} />
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, flexWrap: 'wrap', marginBottom: 14, position: 'relative',
                }}>
                  <div style={labelStyle(C.goldText)}>きょうの調子</div>
                  <StreakRings streak={streak} />
                </div>
                <ScoreRing score={score} />
                {/* 内訳の透明表示 (Whoop型・内訳の合計 = 総合点) */}
                <div style={{
                  marginTop: 16, textAlign: 'center', fontSize: 12.5, color: C.sub,
                  fontWeight: 500, letterSpacing: '0.02em', lineHeight: 1.9,
                }}>
                  ねむり +{score.parts.sleep} ・ ゆらぎ +{score.parts.hrv} ・ 脈 +{score.parts.resting} ・ 歩いた量 +{score.parts.steps}
                </div>
                {/* きょうのフォーカス — いちばん弱い項目からの1行提案 (決まったルール) */}
                <div style={{
                  marginTop: 14, display: 'flex', gap: 9, alignItems: 'flex-start',
                  borderRadius: 16, padding: '12px 15px',
                  background: C.accentSoft, border: `1px solid ${C.line}`, position: 'relative',
                }}>
                  <Compass size={15} color={C.accent} style={{ flexShrink: 0, marginTop: 3 }} strokeWidth={1.8} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.12em', marginBottom: 3 }}>きょうのフォーカス</div>
                    <div style={{ fontSize: 13, lineHeight: 1.9, color: C.ink }}>{FOCUS_WORDS[weakestPart(score.parts)]}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: C.sub, lineHeight: 1.8, opacity: 0.9 }}>
                  ねむりは{SLEEP_HOURS_FULL}時間・歩いた量は{STEPS_FULL.toLocaleString()}歩で満点。
                  ゆらぎと脈は、あなたのふだん（過去4週間の記録）と比べた、決まった計算式です
                </div>
              </Card>
            )}

            <Card style={{ background: 'linear-gradient(150deg, rgba(255,255,255,0.07) 30%, rgba(255,92,138,0.08))', position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden style={{
                position: 'absolute', top: -70, right: -70, width: 190, height: 190, borderRadius: '50%',
                border: '1px solid rgba(255,92,138,0.28)',
              }} />
              <div aria-hidden style={{
                position: 'absolute', bottom: -90, right: -30, width: 170, height: 170, borderRadius: '50%',
                background: 'radial-gradient(circle at 40% 40%, rgba(232,133,158,0.14), rgba(232,133,158,0) 70%)',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, position: 'relative' }}>
                <Sun size={15} color={C.goldText} />
                <div style={labelStyle(C.goldText)}>けさのことば</div>
              </div>
              {morning.map((line, i) => (
                <p key={i} style={{
                  fontSize: 14.5, lineHeight: 2.05, margin: i === 0 ? 0 : '10px 0 0',
                  fontFamily: SERIF, position: 'relative',
                }}>{line}</p>
              ))}
            </Card>

            {/* きぶん・からだのワンタップ記録 (Flo型・タップで即保存) */}
            <Card>
              <SectionTitle icon={<NotebookPen size={16} color={C.accent} strokeWidth={1.6} />}>
                きょうのからだ・きぶん
              </SectionTitle>
              <p style={{ fontSize: 13, lineHeight: 1.9, color: C.sub, margin: '0 0 12px' }}>
                あてはまるものをタップするだけ（そのまま保存されます）。「けさのことば」にも反映されます。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {BODY_CHIPS.map((c) => {
                  const on = todayChips.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleChip(c.id)}
                      className="pulse-press"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        minHeight: 40, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, letterSpacing: '0.02em',
                        background: on
                          ? 'linear-gradient(120deg, rgba(255,92,138,0.28), rgba(232,133,158,0.18))'
                          : 'rgba(255,255,255,0.045)',
                        color: on ? '#FFD3E0' : C.sub,
                        border: `1px solid ${on ? 'rgba(255,92,138,0.65)' : C.line}`,
                        boxShadow: on ? '0 0 16px rgba(255,92,138,0.22)' : 'none',
                      }}
                    >
                      {on ? (
                        <Check size={13} />
                      ) : (
                        <svg width={9} height={9} viewBox="0 0 9 9" aria-hidden>
                          <circle cx="4.5" cy="4.5" r="3.4" fill="none" stroke={C.rose} strokeWidth="1.3" />
                        </svg>
                      )}
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {todayChips.length > 0 && (
                <div style={{
                  marginTop: 12, fontSize: 12.5, lineHeight: 1.8, color: C.good,
                  background: C.goodSoft, borderRadius: 14, padding: '10px 14px', fontWeight: 500,
                }}>
                  きょうは{todayChips.length}こ記録できました。続けるほど、あなたのリズムが見えてきます。
                </div>
              )}
            </Card>

            {/* きょうの数値 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { Icon: Moon, label: 'ねむり', value: fmtSleep(t?.sleepHours), sub: '昨夜の睡眠' },
                { Icon: Footprints, label: '歩いた量', value: fmtNum(t?.steps, '歩'), sub: `目標 ${profile.goalSteps.toLocaleString()}歩` },
                { Icon: HeartPulse, label: '休んでいるときの脈', value: fmtNum(t?.restingHR, ' 回/分'), sub: '低いほどゆったり' },
                { Icon: Droplets, label: '水分', value: t?.hydrationL ? `${t.hydrationL}L` : '—', sub: 'きのうの合計' },
              ].map((x) => (
                <Card key={x.label} style={{ padding: '16px 16px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <x.Icon size={14} color={C.mauve} strokeWidth={1.6} />
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: C.sub, letterSpacing: '0.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.label}</div>
                  </div>
                  <div style={{ ...NUM_STYLE, fontSize: 25, color: C.ink, lineHeight: 1.2, textShadow: NUM_GLOW }}>{x.value}</div>
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>{x.sub}</div>
                </Card>
              ))}
            </div>

            {/* 気づき */}
            <Card>
              <SectionTitle icon={<Activity size={16} color={C.accent} strokeWidth={1.6} />}>気づき — いつもとちがう変化</SectionTitle>
              {importantAnomalies.length === 0 ? (
                <div style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.9,
                  color: C.good, background: C.goodSoft, borderRadius: 16, padding: '13px 16px', fontWeight: 500,
                }}>
                  <Check size={15} style={{ flexShrink: 0, marginTop: 4 }} />
                  きょうは大きな変化はありません。いいリズムです。
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {importantAnomalies.map((a) => {
                    const p = anomalyToPlain(a);
                    return (
                      <div key={a.id} style={{
                        borderRadius: 16, padding: '13px 16px',
                        background: a.severity === 'alert' ? C.accentSoft : C.warnSoft,
                      }}>
                        <div style={{
                          fontSize: 13.5, fontWeight: 600, fontFamily: SERIF, lineHeight: 1.7,
                          color: a.severity === 'alert' ? C.accent : C.warn,
                        }}>{p.title}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.9, color: C.ink, marginTop: 5 }}>{p.detail}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* 今週のまとめ (週間レポート・コード確定計算) */}
            {weekly.daysCount > 0 && (
              <Card>
                <SectionTitle icon={<CalendarDays size={16} color={C.accent} strokeWidth={1.6} />}>今週のまとめ</SectionTitle>
                {[
                  {
                    label: '週平均スコア',
                    value: weekly.avgScore === null ? '—' : `${weekly.avgScore}点`,
                    delta: weekly.avgScore === null ? null : (
                      <DeltaArrow cur={weekly.avgScore} prev={weekly.prevAvgScore} unit="点" />
                    ),
                  },
                  {
                    label: 'ねむり合計',
                    value: fmtSleep(weekly.sleepSum),
                    delta: <DeltaArrow cur={weekly.sleepSum} prev={weekly.prevSleepSum} unit="時間" />,
                  },
                  {
                    label: '歩数合計',
                    value: fmtNum(weekly.stepsSum, '歩'),
                    delta: <DeltaArrow cur={weekly.stepsSum} prev={weekly.prevStepsSum} unit="歩" />,
                  },
                ].map((row, i) => (
                  <div key={row.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '13px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.line}`,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.sub, letterSpacing: '0.04em' }}>{row.label}</div>
                      <div style={{ marginTop: 4 }}>{row.delta}</div>
                    </div>
                    <div style={{ ...NUM_STYLE, fontSize: 24, color: C.ink, textShadow: NUM_GLOW, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {row.value}
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.8, opacity: 0.9, marginTop: 2 }}>
                  直近7日間と、その前の7日間をくらべた決まった計算です（記録のある日だけを数えます）
                </div>
              </Card>
            )}

            {/* 7日間のうつりかわり */}
            {scoreTrend.length > 0 && (
              <Card>
                <SectionTitle icon={<Activity size={16} color={C.accent} strokeWidth={1.6} />}>この7日間の調子</SectionTitle>
                <ScoreTrendChart scores={scoreTrend} />
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 8 }}>
                  点線 = 「よい」の目安（{SCORE_GOOD_LINE}点）・いちばん右がきょう
                </div>
              </Card>
            )}
            <Card>
              <SectionTitle icon={<Moon size={16} color={C.accent} strokeWidth={1.6} />}>この7日間のねむり</SectionTitle>
              <WeekBars week={health.week} metric="sleepHours" color={C.rose} goal={profile.goalSleep} />
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 8 }}>点線 = あなたの目標（{profile.goalSleep}時間）・いちばん右がきのう</div>
            </Card>
            <Card>
              <SectionTitle icon={<Footprints size={16} color={C.accent} strokeWidth={1.6} />}>この7日間の歩いた量</SectionTitle>
              <WeekBars week={health.week} metric="steps" color={C.mauve} goal={profile.goalSteps} />
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 8 }}>点線 = あなたの目標（{profile.goalSteps.toLocaleString()}歩）</div>
            </Card>

            {/* 記録の価値 (予防医療の文脈・誠実に) */}
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '2px 6px' }}>
              <FileText size={14} color={C.sub} style={{ flexShrink: 0, marginTop: 3 }} />
              <p style={{ fontSize: 12, lineHeight: 1.9, color: C.sub, margin: 0 }}>
                からだの記録は、医師や専門家に相談するときの確かな資料になります。
                気になる変化が続くときは、早めに信頼できる専門機関へ。
              </p>
            </div>
          </>
        )}

        {/* ── 記録 ── */}
        {tab === 'log' && (
          <>
            <Card>
              <SectionTitle icon={<NotebookPen size={16} color={C.accent} strokeWidth={1.6} />}>きぶん・からだのメモ</SectionTitle>
              <p style={{ fontSize: 13, lineHeight: 1.9, color: C.sub, margin: '0 0 12px' }}>
                「頭が重い」「よく眠れた」など、ひとことでOK。メモから予防のヒントをお返しします。
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {MOODS.map((m) => (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => setMemoMood(m.v)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      minHeight: 60, padding: '9px 4px', borderRadius: 16, cursor: 'pointer',
                      background: memoMood === m.v ? C.accentSoft : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${memoMood === m.v ? C.accent : C.line}`,
                      color: memoMood === m.v ? C.accent : C.sub,
                    }}
                  >
                    <m.Icon size={20} strokeWidth={1.6} />
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>{m.label}</span>
                  </button>
                ))}
              </div>
              <textarea
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder="例: 朝から頭が重い。昨夜は寝るのが遅かった。"
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box', marginTop: 12, fontSize: 16, color: C.ink,
                  padding: '11px 14px', borderRadius: 16, border: `1px solid ${C.line}`,
                  background: C.bgDeep, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7,
                }}
              />
              <div style={{ marginTop: 12 }}>
                <PrimaryButton onClick={addMemo} full>
                  メモを残す <ChevronRight size={16} />
                </PrimaryButton>
              </div>
            </Card>

            {memos.length === 0 ? (
              <Card>
                <div style={{ fontSize: 13.5, lineHeight: 1.95, color: C.sub }}>
                  まだメモはありません。今日のきぶんをひとこと、残してみましょう。
                  続けるほど、あなたのからだのリズムが見えてきます。
                </div>
              </Card>
            ) : (
              memos.map((m) => {
                const d = new Date(m.ts);
                return (
                  <Card key={m.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.sub, letterSpacing: '0.03em' }}>
                        {d.getMonth() + 1}月{d.getDate()}日 {String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}
                        <span style={{
                          marginLeft: 8, padding: '3px 10px', borderRadius: 999,
                          background: C.accentSoft, color: C.accent, fontSize: 11, fontWeight: 600,
                        }}>{moodLabel(m.mood)}</span>
                      </div>
                      <button
                        type="button"
                        aria-label="このメモを削除"
                        onClick={() => setMemos((prev) => prev.filter((x) => x.id !== m.id))}
                        style={{
                          background: 'none', border: 'none', color: C.sub, cursor: 'pointer',
                          minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.9, marginTop: 8 }}>{m.text}</div>
                    <div style={{
                      marginTop: 12, borderRadius: 16, background: C.bgDeep, padding: '11px 14px',
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                    }}>
                      <HeartPulse size={14} color={C.accent} style={{ flexShrink: 0, marginTop: 4 }} strokeWidth={1.6} />
                      <div style={{ fontSize: 12.5, lineHeight: 1.9, color: C.sub }}>
                        <span style={{ fontWeight: 600, color: C.accent }}>予防のヒント: </span>
                        {memoToHint(m.text, m.mood)}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* ── つながる ── */}
        {tab === 'connect' && (
          <>
            <ConnectView
              profile={profile}
              onSaveEmail={(email) => setProfile((p) => ({ ...p, email }))}
              health={health}
            />
            <HeartMonitorView identity={identity} />
            <Card>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <ShieldCheck size={15} color={C.good} style={{ flexShrink: 0, marginTop: 3 }} strokeWidth={1.6} />
                <div style={{ fontSize: 12.5, lineHeight: 1.9, color: C.sub }}>
                  つなぎ方がわからないときは、メールでお気軽にどうぞ。いっしょに設定します。
                  <a href={MONITOR_MAILTO} style={{ color: C.accent, fontWeight: 600 }}> core.guild.inc@gmail.com</a>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* ── 設定 ── */}
        {tab === 'settings' && (
          <>
            <Card>
              <SectionTitle icon={<Settings size={16} color={C.accent} strokeWidth={1.6} />}>あなたのこと</SectionTitle>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.sub }}>
                おなまえ（けさのことばで呼びかけます）
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  placeholder="例: はな"
                  style={{
                    display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 7,
                    minHeight: 46, fontSize: 16, color: C.ink, padding: '8px 14px',
                    borderRadius: 14, border: `1px solid ${C.line}`, background: C.bgDeep,
                  }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: C.sub }}>
                  歩数の目標（歩）
                  <input
                    type="number"
                    value={profile.goalSteps}
                    onChange={(e) => setProfile((p) => ({ ...p, goalSteps: Math.max(0, Number(e.target.value) || 0) }))}
                    style={{
                      display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 7,
                      minHeight: 46, fontSize: 16, color: C.ink, padding: '8px 14px',
                      borderRadius: 14, border: `1px solid ${C.line}`, background: C.bgDeep,
                    }}
                  />
                </label>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: C.sub }}>
                  ねむりの目標（時間）
                  <input
                    type="number"
                    step="0.5"
                    value={profile.goalSleep}
                    onChange={(e) => setProfile((p) => ({ ...p, goalSleep: Math.max(0, Number(e.target.value) || 0) }))}
                    style={{
                      display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 7,
                      minHeight: 46, fontSize: 16, color: C.ink, padding: '8px 14px',
                      borderRadius: 14, border: `1px solid ${C.line}`, background: C.bgDeep,
                    }}
                  />
                </label>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={<RefreshCw size={15} color={C.accent} strokeWidth={1.6} />}>データ</SectionTitle>
              <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.sub, margin: '0 0 12px' }}>
                いま表示されている記録が見本データのときは、下のボタンで新しい見本に入れかえられます。
                実際のデータをつなぐと（「つながる」タブ）、見本は上書きされていきます。
              </p>
              <GhostButton onClick={() => health.reseed()} full>
                <RefreshCw size={15} /> 見本データを入れなおす
              </GhostButton>
            </Card>

            <Card style={{ border: `1px solid ${C.gold}` }}>
              <SectionTitle icon={<Mail size={15} color={C.accent} strokeWidth={1.6} />}>先行モニター募集中</SectionTitle>
              <p style={{ fontSize: 13, lineHeight: 1.9, color: C.sub, margin: '0 0 12px' }}>
                正式版は月額 ¥2,980（予定）。いまは無料でぜんぶの機能をお使いいただけます。
                感想をひとこと送っていただける方を募集しています。
              </p>
              <PrimaryButton href={MONITOR_MAILTO} full>
                <Mail size={15} /> 先行モニターに申し込む
              </PrimaryButton>
            </Card>

            <Card>
              <div style={{ fontSize: 12.5, lineHeight: 2.0, color: C.sub }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Lock size={14} style={{ flexShrink: 0, marginTop: 4 }} strokeWidth={1.6} />
                  <span>
                    あなたの記録は、あなたのアカウントにだけ保存されます。
                    CORE Prismをお使いの方は、そのままのデータでCORE Pulseを使えます（同じ端末なら記録は共通です）。
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 4 }} strokeWidth={1.6} />
                  <span>
                    CORE Pulseは医療機器ではありません。診断・治療は医療機関にご相談ください。
                    気になる変化が続くときは、早めに信頼できる専門機関へ。からだの記録は、そのときの確かな資料になります。
                  </span>
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 18 }}>
                  <a href="/privacy" style={{ color: C.sub }}>プライバシーポリシー</a>
                  <a href="/tokushoho" style={{ color: C.sub }}>特商法表記</a>
                </div>
              </div>
            </Card>
          </>
        )}
      </main>

      {/* 下部タブ (44px以上・safe-area対応) */}
      <nav style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20,
        background: 'rgba(13,10,15,0.88)', backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: `1px solid ${C.line}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{
          maxWidth: 640, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        }}>
          {NAV.map((n) => {
            const active = tab === n.key;
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => setTab(n.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  minHeight: 58, padding: '9px 4px 7px', background: 'none', border: 'none', cursor: 'pointer',
                  color: active ? C.accent : C.sub,
                }}
              >
                <n.Icon size={20} strokeWidth={active ? 2 : 1.5} />
                <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, letterSpacing: '0.06em' }}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style>{PULSE_CSS}</style>
    </div>
  );
}

// ============================================================
// ルート
// ============================================================
export default function PulseApp() {
  const [entered, setEntered] = useState<boolean>(() => {
    try { return localStorage.getItem(ENTERED_KEY) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    document.title = 'CORE Pulse — 毎日のからだを、AIがやさしく見守る';
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', C.bg);
    return () => { if (prev) meta?.setAttribute('content', prev); };
  }, []);

  const enter = () => {
    try { localStorage.setItem(ENTERED_KEY, 'true'); } catch { /* ignore */ }
    setEntered(true);
    window.scrollTo(0, 0);
  };

  if (!entered) return <PulseLanding onEnter={enter} />;
  return <PulseHome />;
}
