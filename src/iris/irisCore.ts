// ============================================================
// CORE Iris — あなたの核（発信者の人格・目的・ゴール）
//
// 「人格コア」横断機能の Iris 版。発信者（あなた）自身の人柄・目的・
// 届けたい相手・強み・ゴールを吸い上げ、Iris の全 AI（分析/戦略/リール台本/
// ブランドマッチ）の context 先頭に毎回差し込む＝あなたらしさを憑依させる。
//
// 注入は irisKnowledge.getContext() の先頭に readCreatorCoreContextSync() を
// 連結することで全呼び出しへ自動伝播（呼び出し側の変更ゼロ）。
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { useCloudSync } from '../hooks/useCloudSync';
import { aiFetch } from '../lib/aiFetch';

export const IRIS_CORE_KEY = 'iris_core_v1';

export interface CreatorCore {
  identity: string;   // 人柄・話し方・世界観（一人称・温度感）
  purpose: string;    // 発信の目的・大事にしている価値観
  audience: string;   // 届けたい相手（理想のフォロワー/お客様）
  strengths: string;  // 強み・他と違う点・武器
  goals: string;      // 達成したいゴール（収益/フォロワー/案件…）
  updatedAt: string;
}

export const EMPTY_CREATOR_CORE: CreatorCore = {
  identity: '', purpose: '', audience: '', strengths: '', goals: '', updatedAt: '',
};

export function creatorCoreFilled(c?: CreatorCore | null): boolean {
  if (!c) return false;
  return Boolean((c.identity || c.purpose || c.audience || c.strengths || c.goals || '').trim());
}

function loadCore(): CreatorCore {
  try {
    const raw = localStorage.getItem(IRIS_CORE_KEY);
    if (!raw) return EMPTY_CREATOR_CORE;
    return { ...EMPTY_CREATOR_CORE, ...(JSON.parse(raw) as Partial<CreatorCore>) };
  } catch {
    return EMPTY_CREATOR_CORE;
  }
}

function saveCore(c: CreatorCore) {
  try { localStorage.setItem(IRIS_CORE_KEY, JSON.stringify(c)); } catch { /* noop */ }
}

// ─── AI に渡す context 文字列（核が空なら空文字） ───────────────
export function buildCreatorCoreContext(c: CreatorCore): string {
  if (!creatorCoreFilled(c)) return '';
  const lines: string[] = ['【発信者（あなた）の核 — この人になりきり、この目的・ゴールに沿って提案する】'];
  if (c.identity) lines.push(`・人柄/世界観：${c.identity}`);
  if (c.purpose) lines.push(`・発信の目的：${c.purpose}`);
  if (c.audience) lines.push(`・届けたい相手：${c.audience}`);
  if (c.strengths) lines.push(`・強み：${c.strengths}`);
  if (c.goals) lines.push(`・目指すゴール：${c.goals}`);
  return lines.join('\n');
}

// ─── 同期読み出し（hook 外から context を作る。getContext 注入に使用） ───
export function readCreatorCoreContextSync(): string {
  return buildCreatorCoreContext(loadCore());
}

// ─── 貼り付けテキストから核を抽出（/api/ai 経由・サーバ鍵で動く） ───
export async function extractCreatorCore(source: string, model = 'claude-haiku-4-5'): Promise<CreatorCore | null> {
  const text = (source || '').trim().slice(0, 6000);
  if (text.length < 8) return null;
  const system = `あなたは「発信者プロファイラ」。渡された文章（自己紹介・プロフィール・投稿・メモ）から、その発信者の核を読み取り、Instagram運用AIがこの人になりきれるよう要約します。
事実に書いていないことは創作しない（不明な項目は空文字）。各項目は日本語で簡潔に（60〜120字）。identity は話し方・一人称・温度感・世界観が伝わるように。
返答は JSON のみ（前後に文章やコードフェンスを付けない）:
{"identity":"","purpose":"","audience":"","strengths":"","goals":""}`;
  try {
    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        system,
        messages: [{ role: 'user', content: `# 取り込んだ文章\n${text}\n\nこの発信者の核を JSON で返してください。` }],
      }),
    });
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const data = await res.json();
    const raw: string = data.content?.[0]?.text ?? '';
    const m = raw.match(/\{[\s\S]*\}/);
    const o = JSON.parse(m ? m[0] : raw) as Partial<CreatorCore>;
    const s = (v: unknown) => String(v ?? '').trim().slice(0, 600);
    const core: CreatorCore = {
      identity: s(o.identity), purpose: s(o.purpose), audience: s(o.audience),
      strengths: s(o.strengths), goals: s(o.goals), updatedAt: '',
    };
    if (!creatorCoreFilled(core)) return null;
    return core;
  } catch (e) {
    console.error('[Iris あなたの核] 抽出失敗:', e);
    return null;
  }
}

// ─── hook ───────────────────────────────────────────────
export function useIrisCore() {
  const [core, setCore] = useState<CreatorCore>(loadCore);

  useEffect(() => { saveCore(core); }, [core]);
  useCloudSync({ key: IRIS_CORE_KEY, value: core, setValue: setCore, isEmpty: (v) => !creatorCoreFilled(v) });

  const setField = useCallback((key: keyof Omit<CreatorCore, 'updatedAt'>, value: string) => {
    setCore((c) => ({ ...c, [key]: value }));
  }, []);
  const replace = useCallback((next: Partial<CreatorCore>) => {
    setCore((c) => ({ ...c, ...next, updatedAt: new Date().toISOString() }));
  }, []);
  const stamp = useCallback(() => {
    setCore((c) => ({ ...c, updatedAt: new Date().toISOString() }));
  }, []);

  return { core, setField, replace, stamp, filled: creatorCoreFilled(core) };
}
