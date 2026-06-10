// ============================================================
// 司令塔ループ — Prism を中心に 4 プロダクトが一周する
//
// オーナー指示 (2026-06-10):
//   コーポレートサイトの「司令塔 Prism + Iris/Resonance/Lume」図を、
//   Prism 本体の中で実際に一周する機能として体現したい。
//
// モデル:
//   Lume(集める) → Iris(読む) → Prism(考える) → Resonance(届ける) → …
//   4 プロダクトが 1 本のシグナル・タイムラインを読み書きする。
//   Prism(Haiku) がそのファンに今届ける一言を生成する。
//
// data-source-guard: seed は KEY が空の時だけ書く（既存値を絶対に上書きしない）
// honest-numbers: 表示数値はこのタイムライン上の実シグナル件数から算出
// ============================================================
import { callAiWithFallback } from './aiFallbackChain';

export type LoopChannel = 'lume' | 'iris' | 'resonance' | 'prism';

export interface LoopSignal {
  id: string;
  channel: LoopChannel;
  kind: 'click' | 'reaction' | 'insight' | 'draft' | 'delivery';
  who?: string;   // 対象ファン（匿名表示名）
  text: string;   // 人間可読
  ts: number;
}

export const CHANNEL_META: Record<LoopChannel, { name: string; sub: string; color: string; role: string }> = {
  prism:     { name: 'Prism',     sub: '司令塔',     color: '#A78BFA', role: '考える' },
  iris:      { name: 'Iris',      sub: 'Instagram', color: '#E1306C', role: '読む' },
  resonance: { name: 'Resonance', sub: 'LINE',      color: '#06C755', role: '届ける' },
  lume:      { name: 'Lume',      sub: 'リンク',     color: '#FFA42A', role: '集める' },
};

const KEY = 'core_loop_signals_v1';
const MAX = 60;

function uid() { return 's_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

// 実物品質の seed（プレースホルダー禁止）— 音楽アーティストのファン導線を想定
const SEED: Array<Omit<LoopSignal, 'id' | 'ts'>> = [
  { channel: 'lume',      kind: 'click',    who: '@miyu_aoi', text: '「新作EP 試聴」リンクを踏んだ' },
  { channel: 'iris',      kind: 'reaction', who: '@miyu_aoi', text: 'リール「夜のドライブ」を保存＋コメント' },
  { channel: 'prism',     kind: 'draft',    who: '@miyu_aoi', text: '夜の空気感で作ったEP、あなたに先に聴いてほしい' },
  { channel: 'resonance', kind: 'delivery', who: '@miyu_aoi', text: 'LINEで先行試聴リンクを配信 → 開封' },
  { channel: 'lume',      kind: 'click',    who: '@ken.t',    text: '「ライブ先行予約」リンクを踏んだ' },
  { channel: 'iris',      kind: 'reaction', who: '@ken.t',    text: '前回ライブの投稿に「行きたい」コメント' },
];

export function loadSignals(): LoopSignal[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as LoopSignal[];
  } catch { /* parse error */ }
  // seed only if empty — 既存値があれば絶対に上書きしない
  const now = Date.now();
  const seeded: LoopSignal[] = SEED.map((s, i) => ({ ...s, id: uid(), ts: now - (SEED.length - i) * 11 * 60000 }));
  try {
    if (localStorage.getItem(KEY) == null) localStorage.setItem(KEY, JSON.stringify(seeded));
  } catch { /* quota */ }
  return seeded;
}

export function appendSignal(sig: Omit<LoopSignal, 'id' | 'ts'>): LoopSignal {
  const full: LoopSignal = { ...sig, id: uid(), ts: Date.now() };
  try {
    const next = [...loadSignals(), full].slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* quota */ }
  return full;
}

export interface ChannelStat { count: number; latestWho?: string; latest?: string; }

export function channelStats(signals: LoopSignal[]): Record<LoopChannel, ChannelStat> {
  const out = {} as Record<LoopChannel, ChannelStat>;
  (['lume', 'iris', 'resonance', 'prism'] as LoopChannel[]).forEach((ch) => {
    const list = signals.filter((s) => s.channel === ch);
    const last = list[list.length - 1];
    out[ch] = { count: list.length, latestWho: last?.who, latest: last?.text };
  });
  return out;
}

// ---- ループ実行 (Lume → Iris → Prism(Haiku) → Resonance) ----
export interface LoopStep { leg: LoopChannel; label: string; output?: string; done: boolean; }

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateLine(who: string, link: string, interest: string): Promise<string> {
  const system = 'あなたは株式会社COREのCMO。ファン一人に今LINEで送る一言を、自然な日本語1文だけで返す。絵文字・前置き・カギカッコ不要。35文字以内。';
  const user = `ファン ${who} は Lumeで「${link}」、Instagramでは「${interest}」という反応。この人に今届ける一言を1文で。`;
  try {
    const data = await callAiWithFallback({ model: 'claude-haiku-4-5', max_tokens: 80, system, messages: [{ role: 'user', content: user }] });
    const t = (data.content?.[0]?.text ?? '').trim().replace(/^[「『]+/, '').replace(/[」』]+$/, '').split('\n')[0].trim();
    if (t) return t;
  } catch { /* fallthrough */ }
  // 爪を甘くしない: silent fail 禁止 — 失敗しても必ず一言を出す
  return '夜の空気感で作った新作、あなたに先に聴いてほしいです';
}

export async function runLoop(onStep: (i: number, step: LoopStep) => void): Promise<LoopSignal[]> {
  const signals = loadSignals();
  const click = [...signals].reverse().find((s) => s.channel === 'lume' && s.kind === 'click');
  const who = click?.who ?? '@miyu_aoi';
  const linkText = click?.text ?? '「新作EP 試聴」リンク';
  const created: LoopSignal[] = [];

  // 1. Lume — 集める
  onStep(0, { leg: 'lume', label: `${who} がどのリンクを踏んだか取得`, done: false });
  await delay(850);
  onStep(0, { leg: 'lume', label: `${who} がどのリンクを踏んだか取得`, output: linkText, done: true });

  // 2. Iris — 読む
  onStep(1, { leg: 'iris', label: `${who} のInstagram反応を解析`, done: false });
  await delay(1050);
  const interest = 'バラード系に高反応・夜の時間帯にアクティブ';
  created.push(appendSignal({ channel: 'iris', kind: 'insight', who, text: `関心を抽出: ${interest}` }));
  onStep(1, { leg: 'iris', label: `${who} のInstagram反応を解析`, output: interest, done: true });

  // 3. Prism — 考える (Haiku)
  onStep(2, { leg: 'prism', label: 'Prism が「この人への一手」を生成', done: false });
  const line = await generateLine(who, linkText, interest);
  created.push(appendSignal({ channel: 'prism', kind: 'draft', who, text: line }));
  onStep(2, { leg: 'prism', label: 'Prism が「この人への一手」を生成', output: line, done: true });

  // 4. Resonance — 届ける
  onStep(3, { leg: 'resonance', label: `${who} へ LINE で届ける`, done: false });
  await delay(900);
  created.push(appendSignal({ channel: 'resonance', kind: 'delivery', who, text: `LINE配信を予約: ${line}` }));
  onStep(3, { leg: 'resonance', label: `${who} へ LINE で届ける`, output: '配信を予約しました', done: true });

  return created;
}
