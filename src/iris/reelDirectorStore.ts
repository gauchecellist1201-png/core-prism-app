// ============================================================
// IRIS — リール監督モードの「消えない」保存層
//
// これまで台本 (AI 生成) とカット編集は React の state にしか無く、
// タブを閉じる・再読み込み・戻るボタンの一発で**全部消えていた**。
// 生成に時間もお金もかかる台本と、1カットずつ直した内容が消えるのは
// 「作り直し」がまるごと発生する＝離脱の最大要因なので、端末内に保存する。
//
// 方針:
//   - 端末内 (localStorage) のみ。サーバへは送らない
//   - 壊れた保存・古い版・容量超過で**画面が落ちない**（必ず null を返す）
//   - 保存できなかった時は黙って失敗しない（false を返して呼び出し側が知らせる）
// ============================================================
import type { ProductionScript } from './scriptStudio';
import type { ReelProject, ReelCut } from './reelDirector';

const KEY = 'iris_reel_director_v1';
const VERSION = 1;
/** localStorage の上限に当たらないための自主制限 (台本＋カットはテキストのみなので通常はこの1/10以下) */
const MAX_BYTES = 400_000;

export interface SavedDirectorState {
  v: number;
  /** どの台本の編集か (script.generatedAt を使う) */
  scriptId: string;
  /** 台本そのもの＝再読み込み後に生成し直さなくてよい */
  script: ProductionScript;
  project: ReelProject;
  telopStyleId: string;
  /** 生成時に入れたテーマ (復元後の画面で何の台本か分かるように) */
  topic: string;
  savedAt: string;
}

function isCut(x: unknown): x is ReelCut {
  const c = x as ReelCut;
  return !!c && typeof c === 'object'
    && typeof c.id === 'string'
    && typeof c.durationSec === 'number' && Number.isFinite(c.durationSec);
}

/** 保存から読み出したカットを、いまの型に合わせて埋め直す (古い保存には broll が無い) */
function normalizeCut(c: ReelCut): ReelCut {
  return {
    id: c.id,
    durationSec: Math.min(60, Math.max(0.1, c.durationSec)),
    shot: typeof c.shot === 'string' ? c.shot : '',
    line: typeof c.line === 'string' ? c.line : '',
    telop: typeof c.telop === 'string' ? c.telop : '',
    transition: c.transition || 'cut',
    editNote: typeof c.editNote === 'string' ? c.editNote : '',
    broll: Array.isArray(c.broll) ? c.broll.filter(b => typeof b === 'string') : [],
  };
}

/**
 * 保存を読み出す。壊れていれば null（呼び出し側は台本から作り直す）。
 * カットが1つも無い保存は「復元しても白紙」なので無効扱いにする。
 */
export function loadDirectorState(): SavedDirectorState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedDirectorState;
    if (!p || p.v !== VERSION) return null;
    if (typeof p.scriptId !== 'string' || !p.scriptId) return null;
    if (!p.script || !Array.isArray(p.script.shots)) return null;
    if (!p.project || !Array.isArray(p.project.cuts)) return null;
    const cuts = p.project.cuts.filter(isCut).map(normalizeCut);
    if (cuts.length === 0) return null;
    return {
      ...p,
      topic: typeof p.topic === 'string' ? p.topic : '',
      telopStyleId: typeof p.telopStyleId === 'string' ? p.telopStyleId : 'subtitle',
      project: {
        title: typeof p.project.title === 'string' ? p.project.title : (p.script.title || ''),
        caption: typeof p.project.caption === 'string' ? p.project.caption : '',
        hashtags: Array.isArray(p.project.hashtags) ? p.project.hashtags.filter(h => typeof h === 'string') : [],
        templateId: typeof p.project.templateId === 'string' ? p.project.templateId : null,
        brollPool: Array.isArray(p.project.brollPool)
          ? p.project.brollPool.filter(b => typeof b === 'string')
          : (p.script.broll || []).filter(b => typeof b === 'string'),
        cuts,
      },
    };
  } catch {
    return null;
  }
}

/** 保存する。書けなかった時は false（呼び出し側が「保存できていない」ことを必ず出す） */
export function saveDirectorState(s: Omit<SavedDirectorState, 'v' | 'savedAt'>, nowISO: string): boolean {
  try {
    const body: SavedDirectorState = { ...s, v: VERSION, savedAt: nowISO };
    const json = JSON.stringify(body);
    if (json.length > MAX_BYTES) return false;
    localStorage.setItem(KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function clearDirectorState(): void {
  try { localStorage.removeItem(KEY); } catch { /* 消せなくても画面は落とさない */ }
}

/** 「8/4 3:42」形式。保存時刻が読めない時は空文字（推測した時刻を出さない） */
export function savedAtLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
