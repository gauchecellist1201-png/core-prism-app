// ============================================================
// IRIS — 企画・台本スタジオ (運用代行モード)
//
// 狙い: SNS 運用代行会社のコスト構造を壊す。
//   従来は「企画者」「台本ライター」「撮影者」「編集者」が分業 → 高コスト。
//   Iris が①クライアント情報を1度登録 → ②ネタを大量に企画 →
//   ③撮影者・編集者がそのまま動ける本格台本を量産、までを担う。
//   → 企画者・台本ライターの人件費が消え、代行会社の粗利が上がる。
//
// データはクライアント単位。AI は /api/ai (キーは interceptor が付与)。
// ============================================================
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';

// ─── クライアント (代行先アカウント) プロフィール ───────────
export interface IrisClient {
  id: string;
  name: string;            // クライアント名 / アカウント名
  niche: string;           // ジャンル (例: 美容クリニック / カフェ / パーソナルジム)
  target: string;          // ターゲット (例: 20-30代女性、都内在住)
  platform: 'instagram' | 'tiktok' | 'youtube';
  goal: string;            // 運用ゴール (例: 来店予約、フォロワー1万、商品認知)
  tone: string;            // アカウントのトーン (例: 親しみやすく専門性も)
  ngWords: string;         // 言ってはいけない言葉 (カンマ区切り)
  updatedAt: string;
}

const CLIENTS_KEY = 'iris_script_clients_v1';

export function loadClients(): IrisClient[] {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    return raw ? (JSON.parse(raw) as IrisClient[]) : [];
  } catch { return []; }
}

export function saveClients(list: IrisClient[]): void {
  try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(list.slice(0, 100))); } catch { /* quota */ }
}

export function clientUid(): string {
  return 'c_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function clientContext(c?: IrisClient | null): string {
  if (!c) return '## クライアント\n(未指定 — 一般的なアカウントとして提案)';
  return `## クライアント
- アカウント名: ${c.name}
- ジャンル: ${c.niche}
- ターゲット: ${c.target}
- プラットフォーム: ${c.platform}
- 運用ゴール: ${c.goal || '(指定なし)'}
- トーン: ${c.tone || '自然体'}
- 言ってはいけない言葉: ${c.ngWords || '(なし)'}`;
}

// ─── ① 企画: ネタを大量に出す ──────────────────────────────
export interface IdeaItem {
  /** 冒頭フック (最初の2秒で離脱を止める一言) */
  hook: string;
  /** 切り口 / コンセプト (1行) */
  angle: string;
  /** 形式 */
  format: 'リール' | 'フィード' | 'ストーリー';
  /** なぜ伸びるか (運用担当への根拠) */
  why: string;
  /** 撮影難易度 */
  effort: '低' | '中' | '高';
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const m = body.match(/[[{][\s\S]*[\]}]/);
  if (!m) throw new Error('JSON が見つかりません');
  return JSON.parse(m[0]);
}

export async function generateIdeaPool(opts: {
  settings: AppSettings;
  client?: IrisClient | null;
  focus?: string;     // 今回のテーマ (例: 新メニュー告知、季節キャンペーン)
  count?: number;     // 何本出すか (既定 10)
}): Promise<IdeaItem[]> {
  const count = Math.max(3, Math.min(20, opts.count ?? 10));
  const sys = `あなたは SNS 運用代行会社のトップ企画者です。クライアントのアカウントを伸ばす投稿ネタを、撮影しやすさまで考えて量産します。

返答は JSON のみ:
{ "ideas": [
  { "hook": "冒頭2秒のフック", "angle": "切り口(1行)", "format": "リール|フィード|ストーリー", "why": "なぜ伸びるか(1行)", "effort": "低|中|高" }
] }

## ルール
- ${toneInstruction(opts.settings.aiTone)}
- 切り口を散らす (悩み解決 / 比較 / ビフォーアフター / 裏側 / 実演 / 共感 / 権威付け / トレンド便乗)
- フックは具体的に。「知らないと損する◯◯」「9割が間違えてる◯◯」など離脱を止める強さ
- effort は撮影の手間。代行現場で回しやすいよう「低」を半分以上に
- クライアントのジャンル・ターゲット・NGワードを必ず踏まえる
- 抽象論を避け、数字・固有名詞・具体シーンで`;

  const userText = `${clientContext(opts.client)}

## 今回のフォーカス
${opts.focus || '(指定なし — アカウントの強みを伸ばす方向で)'}

上記クライアントの投稿ネタを ${count} 本、JSON で出してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-format': 'json' },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 3000,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.userMessage || err.error?.message || `企画AIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  if (!text) throw new Error('AI から空の応答が返りました。もう一度お試しください。');
  let parsed: any;
  try { parsed = extractJson(text); }
  catch (e: any) { throw new Error(`AI 応答を解釈できませんでした: ${e?.message || e}`); }

  const raw = Array.isArray(parsed?.ideas) ? parsed.ideas : Array.isArray(parsed) ? parsed : [];
  const norm = (v: any): IdeaItem => ({
    hook: String(v?.hook || '').slice(0, 60),
    angle: String(v?.angle || '').slice(0, 80),
    format: (['リール', 'フィード', 'ストーリー'].includes(v?.format) ? v.format : 'リール') as IdeaItem['format'],
    why: String(v?.why || '').slice(0, 80),
    effort: (['低', '中', '高'].includes(v?.effort) ? v.effort : '中') as IdeaItem['effort'],
  });
  return raw.map(norm).filter((i: IdeaItem) => i.hook).slice(0, count);
}

// ─── ② 台本: 撮影者・編集者がそのまま動ける本格台本 ──────────
export interface ScriptShot {
  no: number;
  time: string;          // "0-3秒"
  shot: string;          // 画角/カット: 寄り(顔アップ)/引き(全身)/手持ち移動/俯瞰/商品アップ
  action: string;        // 撮影者が撮るもの・被写体の動き
  line?: string;         // セリフ / ナレーション
  onScreenText?: string; // テロップ文言
  editNote?: string;     // 編集指示: ジャンプカット/効果音/速度/ズーム/BGM切替
}

export interface ProductionScript {
  title: string;
  format: string;
  durationSec: number;
  hooks: string[];        // 冒頭フック 3 案 (A/B 用)
  shots: ScriptShot[];
  broll: string[];        // 差し込み素材 (B-roll)
  bgmMood: string;        // BGM の雰囲気
  thumbnailText: string;  // 表紙 / サムネ テキスト
  caption: string;        // 投稿本文
  hashtags: string[];
  prep: string[];         // 撮影前の準備 (機材 / 場所 / 小道具)
  shootingTips: string[]; // 撮影者へのコツ
  generatedAt: string;
}

export async function generateProductionScript(opts: {
  settings: AppSettings;
  client?: IrisClient | null;
  topic: string;          // 企画ネタ or 自由入力テーマ
  format?: string;        // リール/フィード/ストーリー
  durationSec?: number;
}): Promise<ProductionScript> {
  if (!opts.topic?.trim()) throw new Error('台本にするテーマ・ネタを入れてください');
  const fmt = opts.format || 'リール';
  const dur = opts.durationSec || (fmt === 'リール' ? 30 : 15);

  const sys = `あなたは SNS 運用代行会社の敏腕ディレクター兼台本ライターです。
「撮影者と編集者が、企画者なしでそのまま動ける」レベルの本格台本を作ります。

返答は JSON のみ:
{
  "title": "コンセプト(10-30字)",
  "format": "リール|フィード|ストーリー",
  "durationSec": 30,
  "hooks": ["冒頭フック案1", "案2", "案3"],
  "shots": [
    {
      "no": 1, "time": "0-3秒",
      "shot": "画角・カット(例: 顔寄り/全身引き/手持ち移動/商品アップ/俯瞰)",
      "action": "撮影者が撮るもの・被写体の動き(具体的に)",
      "line": "セリフ or ナレーション(無ければ空)",
      "onScreenText": "テロップ文言(8-18字)",
      "editNote": "編集指示(カット/効果音/速度/ズーム/BGM切替 など)"
    }
  ],
  "broll": ["差し込み素材1", "..."],
  "bgmMood": "BGMの雰囲気(例: 明るくテンポ良いポップ)",
  "thumbnailText": "表紙/サムネに乗せる文字",
  "caption": "投稿本文(絵文字・改行を活用、300字以内)",
  "hashtags": ["#...", "..."],
  "prep": ["撮影前の準備(機材/場所/小道具)"],
  "shootingTips": ["撮影者へのコツ 2-4個"]
}

## ルール
- ${toneInstruction(opts.settings.aiTone)}
- shots は ${fmt === 'リール' ? '5-8' : '3-5'} カット、合計が想定尺(${dur}秒前後)に収まるように time を割る
- shot(画角)は撮影者が迷わない具体語で。action は「何を・どう撮るか」を1文で
- onScreenText と editNote は編集者がそのまま作業できる粒度で
- hooks は離脱を止める3案 (A/Bテスト用)
- hashtags は 10-14 個、# 付き
- クライアントのジャンル・ターゲット・トーン・NGワードを厳守`;

  const userText = `${clientContext(opts.client)}

## 台本にするネタ
${opts.topic.trim()}

## 形式 / 尺
${fmt} / ${dur}秒前後

撮影者・編集者がそのまま動ける本格台本を JSON で。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-format': 'json' },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 4500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.userMessage || err.error?.message || `台本AIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  if (!text) throw new Error('AI から空の応答が返りました。もう一度お試しください。');
  let p: any;
  try { p = extractJson(text); }
  catch (e: any) { throw new Error(`AI 応答を解釈できませんでした: ${e?.message || e}`); }

  const shots: ScriptShot[] = (Array.isArray(p?.shots) ? p.shots : []).map((s: any, i: number) => ({
    no: typeof s?.no === 'number' ? s.no : i + 1,
    time: String(s?.time || '').slice(0, 16),
    shot: String(s?.shot || '').slice(0, 60),
    action: String(s?.action || '').slice(0, 140),
    line: s?.line ? String(s.line).slice(0, 160) : undefined,
    onScreenText: s?.onScreenText ? String(s.onScreenText).slice(0, 40) : undefined,
    editNote: s?.editNote ? String(s.editNote).slice(0, 120) : undefined,
  }));

  const strArr = (a: any, max = 16): string[] =>
    Array.isArray(a) ? a.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : [];

  return {
    title: String(p?.title || opts.topic).slice(0, 40),
    format: String(p?.format || fmt),
    durationSec: Math.max(5, Math.min(180, Number(p?.durationSec) || dur)),
    hooks: strArr(p?.hooks, 3),
    shots,
    broll: strArr(p?.broll, 8),
    bgmMood: String(p?.bgmMood || '').slice(0, 60),
    thumbnailText: String(p?.thumbnailText || '').slice(0, 40),
    caption: String(p?.caption || '').slice(0, 600),
    hashtags: strArr(p?.hashtags, 14).map((h) => (h.startsWith('#') ? h : '#' + h)),
    prep: strArr(p?.prep, 8),
    shootingTips: strArr(p?.shootingTips, 4),
    generatedAt: new Date().toISOString(),
  };
}

// ─── 撮影台本シート → Markdown (撮影者・編集者に渡す用) ──────
export function scriptToMarkdown(s: ProductionScript, clientName?: string): string {
  const L: string[] = [];
  L.push(`# 撮影台本: ${s.title}`);
  if (clientName) L.push(`クライアント: ${clientName}`);
  L.push(`形式: ${s.format} / 尺: 約${s.durationSec}秒\n`);
  if (s.hooks.length) {
    L.push(`## 冒頭フック案 (A/B)`);
    s.hooks.forEach((h, i) => L.push(`${i + 1}. ${h}`));
    L.push('');
  }
  if (s.thumbnailText) L.push(`## 表紙テキスト\n${s.thumbnailText}\n`);
  L.push(`## カット割り (撮影者用)`);
  s.shots.forEach((sh) => {
    L.push(`\n### カット${sh.no} [${sh.time}] ${sh.shot}`);
    L.push(`- 撮る: ${sh.action}`);
    if (sh.line) L.push(`- セリフ: 「${sh.line}」`);
    if (sh.onScreenText) L.push(`- テロップ: ${sh.onScreenText}`);
    if (sh.editNote) L.push(`- 編集: ${sh.editNote}`);
  });
  if (s.broll.length) { L.push(`\n## 差し込み素材 (B-roll)`); s.broll.forEach((b) => L.push(`- ${b}`)); }
  if (s.bgmMood) L.push(`\n## BGM\n${s.bgmMood}`);
  if (s.prep.length) { L.push(`\n## 撮影前の準備`); s.prep.forEach((p) => L.push(`- ${p}`)); }
  if (s.shootingTips.length) { L.push(`\n## 撮影のコツ`); s.shootingTips.forEach((t) => L.push(`- ${t}`)); }
  L.push(`\n## 投稿本文\n${s.caption}`);
  if (s.hashtags.length) L.push(`\n## ハッシュタグ\n${s.hashtags.join(' ')}`);
  return L.join('\n');
}
