// ============================================================
// CORE Pulse — ヘルスケア特化型AIコンシェルジュ (単体ブランド)
//
// Prism のヘルスケア機能を「機能過多を防ぐため」単体サービスへ切り出したもの。
// ターゲット: 女性のライフステージ・予防医学に関心がある層。
// ITに詳しくなくても直感的にわかる「やさしい日本語」を最優先する。
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
// ルール: 絵文字UI禁止 / 375px見切れゼロ / コントラスト遵守 /
//         fetch はタイムアウト付き / loading は finally で解除
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HeartPulse, Moon, Footprints, Sun, NotebookPen, Settings, Bluetooth,
  Smartphone, Check, Copy, Trash2, Mail, ArrowRight, ShieldCheck, Activity,
  Loader2, AlertTriangle, Droplets, ChevronRight, Smile, Meh, Frown, SmilePlus,
  RefreshCw, Info,
} from 'lucide-react';
import { useHealth } from '../hooks/useHealth';
import { detectAnomalies, type HealthAnomaly } from '../data/healthAnomaly';
import type { DailyHealth } from '../types/health';
import { fetchWithTimeout, isAbort } from '../lib/fetchWithTimeout';
import { emailToHash, checkIngestStatus, saveLiveHRSession, type HealthIdentity } from '../lib/healthLiveSession';
import { HeartRateMonitor, isWebBluetoothSupported, type HRReading } from '../lib/webBluetoothHR';

// ── カラー (コーラル/ローズ系・白基調。Prism紫紺 / Studio金 とは別世界観) ──
const C = {
  bg: '#FBF6F3',
  card: '#FFFFFF',
  line: '#F0DFD8',
  ink: '#46322E',
  sub: '#7C625C',
  accent: '#C2483F',      // 濃コーラル (白文字で 4.5:1 以上)
  accentSoft: '#FBEAE6',
  rose: '#D97066',
  good: '#2E7D5B',
  goodSoft: '#E9F4EE',
  warn: '#9A5A14',
  warnSoft: '#FBF0E0',
};

const ENTERED_KEY = 'pulse_entered_v1';
const PROFILE_KEY = 'pulse_profile_v1';
const MEMO_KEY = 'pulse_memos_v1';
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

// ── ロゴ (鼓動の波形・カスタムSVG) ──
function PulseMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="15" fill={C.accentSoft} stroke={C.accent} strokeWidth="1.4" />
      <path
        d="M5.5 16.5h5l2.2-6 3.6 11 2.8-8 1.6 3h6"
        stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

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
  return { title: 'いつもと少しちがう変化がありました', detail: a.detail };
}

/** けさのことば — 今日の数値と変化から、やさしい文章を組み立てる */
function buildMorningWords(
  name: string,
  today: DailyHealth | undefined,
  week: DailyHealth[],
  anomalies: HealthAnomaly[],
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
    <div style={{
      background: C.card, border: `1px solid ${C.line}`, borderRadius: 18,
      padding: 16, ...style,
    }}>
      {children}
    </div>
  );
}
function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      {icon}
      <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{children}</div>
    </div>
  );
}
function PrimaryButton({ onClick, href, children, full }: {
  onClick?: () => void; href?: string; children: React.ReactNode; full?: boolean;
}) {
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, padding: '12px 22px', borderRadius: 999,
    background: C.accent, color: '#FFFFFF', fontSize: 15, fontWeight: 700,
    border: 'none', cursor: 'pointer', textDecoration: 'none',
    width: full ? '100%' : undefined, boxSizing: 'border-box',
  };
  if (href) return <a href={href} style={style}>{children}</a>;
  return <button type="button" onClick={onClick} style={style}>{children}</button>;
}
function GhostButton({ onClick, href, children, full }: {
  onClick?: () => void; href?: string; children: React.ReactNode; full?: boolean;
}) {
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, padding: '12px 22px', borderRadius: 999,
    background: '#FFFFFF', color: C.accent, fontSize: 15, fontWeight: 700,
    border: `1.5px solid ${C.accent}`, cursor: 'pointer', textDecoration: 'none',
    width: full ? '100%' : undefined, boxSizing: 'border-box',
  };
  if (href) return <a href={href} style={style}>{children}</a>;
  return <button type="button" onClick={onClick} style={style}>{children}</button>;
}
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 4 }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: '8px 10px',
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
            minHeight: 36, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: copied ? C.goodSoft : '#FFFFFF', color: copied ? C.good : C.accent,
            border: `1px solid ${copied ? C.good : C.accent}`, cursor: 'pointer',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'できました' : 'コピー'}
        </button>
      </div>
    </div>
  );
}

// ── 7日間ミニグラフ (棒・SVG) ──
function WeekBars({ week, metric, color, goal }: {
  week: DailyHealth[]; metric: 'sleepHours' | 'steps'; color: string; goal?: number;
}) {
  const vals = week.map((d) => d[metric] ?? 0);
  const max = Math.max(...vals, goal ?? 0, 1);
  const W = 260; const H = 64; const gap = 6;
  const bw = (W - gap * (vals.length - 1)) / Math.max(vals.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden>
      {typeof goal === 'number' && goal > 0 && (
        <line x1={0} x2={W} y1={H - (goal / max) * (H - 8)} y2={H - (goal / max) * (H - 8)}
          stroke={C.sub} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
      )}
      {vals.map((v, i) => {
        const h = Math.max(3, (v / max) * (H - 8));
        return (
          <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={3}
            fill={i === vals.length - 1 ? color : `${color}55`} />
        );
      })}
    </svg>
  );
}

// ============================================================
// LP (未入場)
// ============================================================
function PulseLanding({ onEnter }: { onEnter: () => void }) {
  const values = [
    {
      Icon: Smartphone,
      title: 'からだの記録が、自動で集まる',
      body: 'Apple Watchや iPhoneをつなぐと、睡眠・心拍・歩数が毎朝自動でこのアプリに届きます。あなたが入力する手間はありません。',
    },
    {
      Icon: Sun,
      title: 'AIが毎朝、ことばで教えてくれる',
      body: '数字の一覧ではなく「きのうは少し寝不足。今夜は30分早くおふとんへ」のような、やさしいことばで今日の調子をお届けします。',
    },
    {
      Icon: HeartPulse,
      title: '気になる変化に、はやく気づける',
      body: 'ふだんのあなたと比べて「いつもとちがう」変化があると、そっとお知らせ。予防のいちばんの近道は、はやく気づくことです。',
    },
  ];
  return (
    <div style={{ minHeight: '100svh', background: C.bg, color: C.ink }}>
      {/* ヘッダー */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', maxWidth: 960, margin: '0 auto', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <PulseMark size={30} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.02em' }}>CORE Pulse</div>
            <div style={{ fontSize: 10.5, color: C.sub }}>からだ見守りAI（エーアイ）</div>
          </div>
        </div>
        <button type="button" onClick={onEnter} style={{
          minHeight: 40, padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
          background: '#FFFFFF', color: C.accent, border: `1.5px solid ${C.accent}`, cursor: 'pointer',
        }}>
          アプリを開く
        </button>
      </header>

      {/* ヒーロー */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '36px 20px 12px', textAlign: 'center', boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: 'clamp(26px, 6.4vw, 40px)', lineHeight: 1.35, fontWeight: 800, margin: 0 }}>
          毎日のからだを、<br />AIがやさしく見守る。
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.9, color: C.sub, margin: '18px auto 0', maxWidth: 560 }}>
          Apple Watchや iPhoneをつなぐだけで、睡眠・心拍・歩数から今日の調子を読みとき、
          毎朝「ことば」でお届けします。症状やきぶんのメモからは、予防のヒントを。
          女性のライフステージの変化にも、そっと寄り添います。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340, margin: '26px auto 0' }}>
          <PrimaryButton onClick={onEnter} full>
            無料でためしてみる <ArrowRight size={16} />
          </PrimaryButton>
          <GhostButton href={MONITOR_MAILTO} full>
            <Mail size={15} /> 先行モニターに申し込む
          </GhostButton>
        </div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 12 }}>
          登録なしで、見本のデータをそのままさわれます
        </div>
      </section>

      {/* けさのことば サンプル */}
      <section style={{ maxWidth: 480, margin: '28px auto 0', padding: '0 20px', boxSizing: 'border-box' }}>
        <Card style={{ textAlign: 'left', boxShadow: '0 10px 30px rgba(194,72,63,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Sun size={16} color={C.accent} />
            <div style={{ fontSize: 12, fontWeight: 800, color: C.accent, letterSpacing: '0.06em' }}>けさのことば（見本）</div>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.9, margin: 0, color: C.ink }}>
            おはようございます。きのうのねむりは6時間10分と、すこし少なめでした。
            今夜は30分だけ早くおふとんへ。歩いた量は8,200歩で、とてもよいペースです。
            心拍のゆらぎが下がりぎみなので、今日はむりせずゆっくりめに。
          </p>
        </Card>
      </section>

      {/* 3つの価値 */}
      <section style={{ maxWidth: 960, margin: '40px auto 0', padding: '0 20px', boxSizing: 'border-box' }}>
        <div className="pulse-value-grid">
          {values.map((v) => (
            <Card key={v.title}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, background: C.accentSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <v.Icon size={22} color={C.accent} />
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 8 }}>{v.title}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.85, color: C.sub }}>{v.body}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* 料金 */}
      <section style={{ maxWidth: 480, margin: '40px auto 0', padding: '0 20px', boxSizing: 'border-box' }}>
        <Card style={{ textAlign: 'center', border: `1.5px solid ${C.accent}` }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.accent, letterSpacing: '0.08em' }}>料金</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>
            月額 ¥2,980 <span style={{ fontSize: 14, fontWeight: 700, color: C.sub }}>（予定）</span>
          </div>
          <div style={{
            display: 'inline-block', marginTop: 10, padding: '6px 14px', borderRadius: 999,
            background: C.goodSoft, color: C.good, fontSize: 13, fontWeight: 800,
          }}>
            いまは先行モニター募集中・無料
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: C.sub, margin: '14px 0 0' }}>
            正式スタート前のいまは、無料でぜんぶの機能をお使いいただけます。
            使ってみた感想を、メールでひとこと聞かせてください。
          </p>
          <div style={{ marginTop: 16 }}>
            <PrimaryButton href={MONITOR_MAILTO} full>
              <Mail size={15} /> 先行モニターに申し込む
            </PrimaryButton>
          </div>
          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 12, background: C.bg,
            fontSize: 12.5, lineHeight: 1.7, color: C.sub, textAlign: 'left',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>CORE Prismをお使いの方は、そのままのデータでCORE Pulseを使えます（同じ端末なら記録は共通です）。</span>
          </div>
        </Card>
      </section>

      {/* 安心 */}
      <section style={{ maxWidth: 560, margin: '32px auto 0', padding: '0 20px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'center' }}>
          <ShieldCheck size={16} color={C.good} style={{ flexShrink: 0, marginTop: 3 }} />
          <p style={{ fontSize: 12.5, lineHeight: 1.8, color: C.sub, margin: 0 }}>
            からだの記録はあなたの端末に保存されます。CORE Pulseは診断を行うものではありません。
            気になる症状が続くときは、必ずお医者さんにご相談ください。
          </p>
        </div>
      </section>

      {/* フッター */}
      <footer style={{
        marginTop: 44, padding: '22px 20px calc(28px + env(safe-area-inset-bottom))',
        borderTop: `1px solid ${C.line}`, textAlign: 'center',
      }}>
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', fontSize: 12 }}>
          <a href="/privacy" style={{ color: C.sub, textDecoration: 'none' }}>プライバシーポリシー</a>
          <a href="/tokushoho" style={{ color: C.sub, textDecoration: 'none' }}>特定商取引法に基づく表記</a>
        </div>
        <div style={{ fontSize: 11.5, color: C.sub, marginTop: 10, opacity: 0.8 }}>
          CORE Pulse — CORE（設立準備中）
        </div>
      </footer>

      <style>{`
        .pulse-value-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 760px) { .pulse-value-grid { grid-template-columns: repeat(3, 1fr); } }
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
      <SectionTitle icon={<Smartphone size={18} color={C.accent} />}>
        Apple Watch / iPhone とつなぐ
      </SectionTitle>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: C.sub, margin: '0 0 4px' }}>
        iPhoneの「ショートカット」というアプリを使うと、毎朝の睡眠・歩数・心拍が自動でここに届きます。
        設定は一度だけ。3つの手順でできます。
      </p>

      {/* 手順1 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>手順1. メールアドレスを入れる</div>
        <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.7, marginTop: 4 }}>
          あなた専用の「合いことば（識別番号）」を作るために使います。メールが送られることはありません。
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="例: hana@example.com"
            style={{
              flex: '1 1 180px', minWidth: 0, minHeight: 44, fontSize: 16, color: C.ink,
              padding: '8px 12px', borderRadius: 12, border: `1px solid ${C.line}`,
              background: C.bg, boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => onSaveEmail(email.trim())}
            style={{
              minHeight: 44, padding: '8px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 700,
              background: C.accent, color: '#FFF', border: 'none', cursor: 'pointer', flexShrink: 0,
            }}
          >
            決定
          </button>
        </div>
      </div>

      {/* 手順2 */}
      {hash && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>手順2. iPhoneのショートカットに、この2つを貼る</div>
          <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.7, marginTop: 4 }}>
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
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>手順3. 届いているか確認する</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <GhostButton onClick={verify} full>
              {checking ? <Loader2 size={15} className="pulse-spin" /> : <RefreshCw size={15} />}
              届いているか確認
            </GhostButton>
            {checkResult && (
              <div style={{
                fontSize: 13, lineHeight: 1.7, padding: '10px 12px', borderRadius: 12,
                background: checkOk ? C.goodSoft : C.warnSoft,
                color: checkOk ? C.good : C.warn, fontWeight: 600,
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
                fontSize: 13, lineHeight: 1.7, padding: '10px 12px', borderRadius: 12,
                background: C.accentSoft, color: C.accent, fontWeight: 600,
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
      <SectionTitle icon={<Bluetooth size={18} color={C.accent} />}>
        胸につける心拍計でその場で計る
      </SectionTitle>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: C.sub, margin: 0 }}>
        お手持ちの心拍計（胸ベルト式など）があれば、いまの心拍をその場で計れます。お持ちでなければ飛ばしてOKです。
      </p>
      {status === 'connected' || status === 'reconnecting' ? (
        <div style={{
          marginTop: 12, borderRadius: 14, background: C.accentSoft, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: C.accent, lineHeight: 1 }}>
            {bpm ?? '—'}
            <span style={{ fontSize: 14, fontWeight: 700, marginLeft: 6 }}>回/分</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>
            心拍のゆらぎ: {hrv && hrv > 0 ? `${hrv}` : '計測中…'}
            {status === 'reconnecting' && ' ・つなぎ直しています…'}
          </div>
          {identity && (
            <div style={{ marginTop: 12 }}>
              <GhostButton onClick={save} full>
                {saving ? <Loader2 size={15} className="pulse-spin" /> : <Check size={15} />}
                この計測を記録に保存
              </GhostButton>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <GhostButton onClick={connect} full>
            <Bluetooth size={15} />
            {status === 'pairing' ? 'さがしています…' : '心拍計をつなぐ'}
          </GhostButton>
        </div>
      )}
      {error && (
        <div style={{
          marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start',
          fontSize: 12.5, lineHeight: 1.7, color: C.warn, background: C.warnSoft,
          borderRadius: 12, padding: '10px 12px',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          {error}
        </div>
      )}
      {saveMsg && (
        <div style={{
          marginTop: 10, fontSize: 12.5, lineHeight: 1.7, color: C.good,
          background: C.goodSoft, borderRadius: 12, padding: '10px 12px', fontWeight: 600,
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
    () => buildMorningWords(profile.name, health.today, health.week, anomalies),
    [profile.name, health.today, health.week, anomalies],
  );
  const identity: HealthIdentity | null = hash ? { kind: 'hash', id: hash } : null;

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
        padding: '12px 16px', maxWidth: 640, margin: '0 auto', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PulseMark size={26} />
          <div style={{ fontSize: 15, fontWeight: 800 }}>CORE Pulse</div>
        </div>
        <div style={{ fontSize: 12.5, color: C.sub, fontWeight: 600 }}>{todayLabel()}</div>
      </header>

      <main style={{
        maxWidth: 640, margin: '0 auto',
        padding: '4px 16px calc(96px + env(safe-area-inset-bottom))', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* ── きょう ── */}
        {tab === 'today' && (
          <>
            <Card style={{ background: 'linear-gradient(140deg, #FFFFFF, #FDF0EC)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Sun size={16} color={C.accent} />
                <div style={{ fontSize: 12, fontWeight: 800, color: C.accent, letterSpacing: '0.06em' }}>けさのことば</div>
              </div>
              {morning.map((line, i) => (
                <p key={i} style={{ fontSize: 14.5, lineHeight: 1.95, margin: i === 0 ? 0 : '8px 0 0' }}>{line}</p>
              ))}
            </Card>

            {/* きょうの数値 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { Icon: Moon, label: 'ねむり', value: fmtSleep(t?.sleepHours), sub: '昨夜の睡眠' },
                { Icon: Footprints, label: '歩いた量', value: fmtNum(t?.steps, '歩'), sub: `目標 ${profile.goalSteps.toLocaleString()}歩` },
                { Icon: HeartPulse, label: '休んでいるときの脈', value: fmtNum(t?.restingHR, ' 回/分'), sub: '低いほどゆったり' },
                { Icon: Droplets, label: '水分', value: t?.hydrationL ? `${t.hydrationL}L` : '—', sub: 'きのうの合計' },
              ].map((x) => (
                <Card key={x.label} style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <x.Icon size={15} color={C.accent} />
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>{x.label}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>{x.value}</div>
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>{x.sub}</div>
                </Card>
              ))}
            </div>

            {/* 気づき */}
            <Card>
              <SectionTitle icon={<Activity size={17} color={C.accent} />}>気づき — いつもとちがう変化</SectionTitle>
              {importantAnomalies.length === 0 ? (
                <div style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.8,
                  color: C.good, background: C.goodSoft, borderRadius: 12, padding: '12px 14px', fontWeight: 600,
                }}>
                  <Check size={15} style={{ flexShrink: 0, marginTop: 3 }} />
                  きょうは大きな変化はありません。いいリズムです。
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {importantAnomalies.map((a) => {
                    const p = anomalyToPlain(a);
                    return (
                      <div key={a.id} style={{
                        borderRadius: 12, padding: '12px 14px',
                        background: a.severity === 'alert' ? C.accentSoft : C.warnSoft,
                      }}>
                        <div style={{
                          fontSize: 13.5, fontWeight: 800,
                          color: a.severity === 'alert' ? C.accent : C.warn,
                        }}>{p.title}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.8, color: C.ink, marginTop: 4 }}>{p.detail}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* 7日間のうつりかわり */}
            <Card>
              <SectionTitle icon={<Moon size={17} color={C.accent} />}>この7日間のねむり</SectionTitle>
              <WeekBars week={health.week} metric="sleepHours" color={C.rose} goal={profile.goalSleep} />
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>点線 = あなたの目標（{profile.goalSleep}時間）・いちばん右がきのう</div>
            </Card>
            <Card>
              <SectionTitle icon={<Footprints size={17} color={C.accent} />}>この7日間の歩いた量</SectionTitle>
              <WeekBars week={health.week} metric="steps" color={C.accent} goal={profile.goalSteps} />
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>点線 = あなたの目標（{profile.goalSteps.toLocaleString()}歩）</div>
            </Card>
          </>
        )}

        {/* ── 記録 ── */}
        {tab === 'log' && (
          <>
            <Card>
              <SectionTitle icon={<NotebookPen size={17} color={C.accent} />}>きぶん・からだのメモ</SectionTitle>
              <p style={{ fontSize: 13, lineHeight: 1.8, color: C.sub, margin: '0 0 10px' }}>
                「頭が重い」「よく眠れた」など、ひとことでOK。メモから予防のヒントをお返しします。
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {MOODS.map((m) => (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => setMemoMood(m.v)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      minHeight: 58, padding: '8px 4px', borderRadius: 12, cursor: 'pointer',
                      background: memoMood === m.v ? C.accentSoft : C.bg,
                      border: `1.5px solid ${memoMood === m.v ? C.accent : C.line}`,
                      color: memoMood === m.v ? C.accent : C.sub,
                    }}
                  >
                    <m.Icon size={20} />
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{m.label}</span>
                  </button>
                ))}
              </div>
              <textarea
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder="例: 朝から頭が重い。昨夜は寝るのが遅かった。"
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box', marginTop: 10, fontSize: 16, color: C.ink,
                  padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.line}`,
                  background: C.bg, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7,
                }}
              />
              <div style={{ marginTop: 10 }}>
                <PrimaryButton onClick={addMemo} full>
                  メモを残す <ChevronRight size={16} />
                </PrimaryButton>
              </div>
            </Card>

            {memos.length === 0 ? (
              <Card>
                <div style={{ fontSize: 13.5, lineHeight: 1.8, color: C.sub }}>
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
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>
                        {d.getMonth() + 1}月{d.getDate()}日 {String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}
                        <span style={{
                          marginLeft: 8, padding: '2px 8px', borderRadius: 999,
                          background: C.accentSoft, color: C.accent, fontSize: 11,
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
                    <div style={{ fontSize: 14, lineHeight: 1.8, marginTop: 6 }}>{m.text}</div>
                    <div style={{
                      marginTop: 10, borderRadius: 12, background: C.bg, padding: '10px 12px',
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                    }}>
                      <HeartPulse size={14} color={C.accent} style={{ flexShrink: 0, marginTop: 3 }} />
                      <div style={{ fontSize: 12.5, lineHeight: 1.8, color: C.sub }}>
                        <span style={{ fontWeight: 800, color: C.accent }}>予防のヒント: </span>
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
                <ShieldCheck size={15} color={C.good} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12.5, lineHeight: 1.8, color: C.sub }}>
                  つなぎ方がわからないときは、メールでお気軽にどうぞ。いっしょに設定します。
                  <a href={MONITOR_MAILTO} style={{ color: C.accent, fontWeight: 700 }}> core.guild.inc@gmail.com</a>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* ── 設定 ── */}
        {tab === 'settings' && (
          <>
            <Card>
              <SectionTitle icon={<Settings size={17} color={C.accent} />}>あなたのこと</SectionTitle>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.sub }}>
                おなまえ（けさのことばで呼びかけます）
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  placeholder="例: はな"
                  style={{
                    display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6,
                    minHeight: 44, fontSize: 16, color: C.ink, padding: '8px 12px',
                    borderRadius: 12, border: `1px solid ${C.line}`, background: C.bg,
                  }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: C.sub }}>
                  歩数の目標（歩）
                  <input
                    type="number"
                    value={profile.goalSteps}
                    onChange={(e) => setProfile((p) => ({ ...p, goalSteps: Math.max(0, Number(e.target.value) || 0) }))}
                    style={{
                      display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6,
                      minHeight: 44, fontSize: 16, color: C.ink, padding: '8px 12px',
                      borderRadius: 12, border: `1px solid ${C.line}`, background: C.bg,
                    }}
                  />
                </label>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: C.sub }}>
                  ねむりの目標（時間）
                  <input
                    type="number"
                    step="0.5"
                    value={profile.goalSleep}
                    onChange={(e) => setProfile((p) => ({ ...p, goalSleep: Math.max(0, Number(e.target.value) || 0) }))}
                    style={{
                      display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6,
                      minHeight: 44, fontSize: 16, color: C.ink, padding: '8px 12px',
                      borderRadius: 12, border: `1px solid ${C.line}`, background: C.bg,
                    }}
                  />
                </label>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={<RefreshCw size={16} color={C.accent} />}>データ</SectionTitle>
              <p style={{ fontSize: 12.5, lineHeight: 1.8, color: C.sub, margin: '0 0 10px' }}>
                いま表示されている記録が見本データのときは、下のボタンで新しい見本に入れかえられます。
                実際のデータをつなぐと（「つながる」タブ）、見本は上書きされていきます。
              </p>
              <GhostButton onClick={() => health.reseed()} full>
                <RefreshCw size={15} /> 見本データを入れなおす
              </GhostButton>
            </Card>

            <Card style={{ border: `1.5px solid ${C.accent}` }}>
              <SectionTitle icon={<Mail size={16} color={C.accent} />}>先行モニター募集中</SectionTitle>
              <p style={{ fontSize: 13, lineHeight: 1.8, color: C.sub, margin: '0 0 10px' }}>
                正式版は月額 ¥2,980（予定）。いまは無料でぜんぶの機能をお使いいただけます。
                感想をひとこと送っていただける方を募集しています。
              </p>
              <PrimaryButton href={MONITOR_MAILTO} full>
                <Mail size={15} /> 先行モニターに申し込む
              </PrimaryButton>
            </Card>

            <Card>
              <div style={{ fontSize: 12.5, lineHeight: 1.9, color: C.sub }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>
                    CORE Prismをお使いの方は、そのままのデータでCORE Pulseを使えます（同じ端末なら記録は共通です）。
                    CORE Pulseは診断を行うものではありません。気になる症状が続くときは、必ずお医者さんにご相談ください。
                  </span>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
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
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(10px)',
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
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  minHeight: 58, padding: '9px 4px 7px', background: 'none', border: 'none', cursor: 'pointer',
                  color: active ? C.accent : C.sub,
                }}
              >
                <n.Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
                <span style={{ fontSize: 10.5, fontWeight: active ? 800 : 600 }}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style>{`
        .pulse-spin { animation: pulse-rotate 1s linear infinite; }
        @keyframes pulse-rotate { to { transform: rotate(360deg); } }
      `}</style>
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
