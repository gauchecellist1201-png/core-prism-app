// ============================================================
// CORE Iris — ブランドガイドライン管理
// ブランドの色・トーン・NGワード・フォントを保存し
// AI 投稿生成時のガイドとして活用する
// ============================================================

import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';

// ─── 型定義 ─────────────────────────────────────────────────────

export type BrandTone =
  | 'friendly'    // フレンドリー・親しみやすい
  | 'luxury'      // 高級・上品
  | 'casual'      // カジュアル・気軽
  | 'expert'      // 専門家・信頼感
  | 'playful'     // ポップ・遊び心
  | 'minimal';    // ミニマル・洗練

export interface BrandColor {
  name: string;   // 例: 'Primary', 'Accent'
  hex: string;    // 例: '#E1306C'
}

export interface BrandGuideline {
  id: string;
  name: string;           // ブランド名 / アカウント名
  tagline?: string;       // キャッチフレーズ
  tone: BrandTone;
  colors: BrandColor[];
  fonts: { display?: string; body?: string };
  ngWords: string[];      // 使ってはいけない言葉
  mustWords: string[];    // 必ず使いたいキーワード
  emojiStyle: 'rich' | 'minimal' | 'none';
  hashtagSets: string[][];  // よく使うハッシュタグセット
  bio?: string;           // ブランドの世界観・説明
  updatedAt: string;
}

export const TONE_META: Record<BrandTone, { label: string; emoji: string; description: string }> = {
  friendly:  { label: 'フレンドリー', emoji: '', description: '親しみやすく、話しかけるような口調' },
  luxury:    { label: '高級・上品',   emoji: '', description: 'エレガントで洗練された表現' },
  casual:    { label: 'カジュアル',   emoji: '', description: '気軽でリラックスした雰囲気' },
  expert:    { label: '専門家',       emoji: '', description: '信頼感・知識の深さをアピール' },
  playful:   { label: 'ポップ・楽しい', emoji: '', description: '遊び心があって賑やか' },
  minimal:   { label: 'ミニマル',     emoji: '◻️', description: 'シンプル・洗練・無駄を省く' },
};

const STORAGE_KEY = 'core_iris_brand_guidelines_v1';
const ACTIVE_KEY  = 'core_iris_active_guideline_v1';

function genId(): string {
  return 'bg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function load(): BrandGuideline[] {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) return JSON.parse(r);
  } catch { /* */ }
  // デフォルトガイドライン
  const def: BrandGuideline = {
    id: genId(),
    name: 'My Brand',
    tagline: 'Be yourself, beautifully.',
    tone: 'friendly',
    colors: [
      { name: 'Primary', hex: '#E1306C' },
      { name: 'Accent',  hex: '#FCB045' },
    ],
    fonts: { display: 'Playfair Display', body: 'Inter' },
    ngWords: [],
    mustWords: [],
    emojiStyle: 'rich',
    hashtagSets: [['#コスメ', '#美容', '#スキンケア']],
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([def]));
  localStorage.setItem(ACTIVE_KEY, def.id);
  return [def];
}

function saveAll(list: BrandGuideline[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* */ }
}

// ─── CRUD ─────────────────────────────────────────────────────

export function getGuidelines(): BrandGuideline[] {
  return load();
}

export function getActiveGuideline(): BrandGuideline | undefined {
  const all = load();
  const id = localStorage.getItem(ACTIVE_KEY);
  return all.find(g => g.id === id) || all[0];
}

export function setActiveGuideline(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function saveGuideline(g: BrandGuideline): BrandGuideline[] {
  const all = load();
  const idx = all.findIndex(x => x.id === g.id);
  const updated = idx >= 0
    ? all.map(x => x.id === g.id ? { ...g, updatedAt: new Date().toISOString() } : x)
    : [...all, { ...g, id: genId(), updatedAt: new Date().toISOString() }];
  saveAll(updated);
  return updated;
}

export function removeGuideline(id: string): BrandGuideline[] {
  const updated = load().filter(g => g.id !== id);
  saveAll(updated);
  return updated;
}

export function createGuideline(input: Omit<BrandGuideline, 'id' | 'updatedAt'>): BrandGuideline {
  const g: BrandGuideline = { ...input, id: genId(), updatedAt: new Date().toISOString() };
  const all = load();
  saveAll([...all, g]);
  return g;
}

// ─── AI スタイルチェック ────────────────────────────────────────

export interface StyleCheckResult {
  score: number;         // 0〜100
  violations: string[];  // NGワード違反など
  suggestions: string[]; // 改善提案
  revised?: string;      // 修正後の文章
}

export async function runStyleCheck(opts: {
  settings: AppSettings;
  guideline: BrandGuideline;
  postText: string;
}): Promise<StyleCheckResult> {
  const { settings, guideline, postText } = opts;
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';

  if (!apiKey) {
    return {
      score: 0,
      violations: ['APIキーが設定されていません'],
      suggestions: ['設定画面でClaude APIキーを入力してください'],
    };
  }

  const violations = guideline.ngWords.filter(w => postText.includes(w));

  const prompt = `あなたはブランドコンサルタントです。以下のブランドガイドラインに基づいて、投稿文章を評価・改善してください。

## ブランドガイドライン
- ブランド名: ${guideline.name}
- トーン: ${TONE_META[guideline.tone].label} (${TONE_META[guideline.tone].description})
- 絵文字スタイル: ${guideline.emojiStyle}
- 必須キーワード: ${guideline.mustWords.join(', ') || 'なし'}
- NGワード: ${guideline.ngWords.join(', ') || 'なし'}
${guideline.bio ? `- 世界観: ${guideline.bio}` : ''}

## 評価する投稿文章
${postText}

## 指示
1. ブランドガイドラインとの一致度を 0〜100 点で評価
2. 問題点があれば3点以内で箇条書き
3. 改善提案を3点以内で箇条書き
4. 改善後の文章を提案

必ずこのJSON形式で返してください:
{
  "score": 85,
  "violations": ["..."],
  "suggestions": ["..."],
  "revised": "改善後の文章..."
}

${toneInstruction()}`;

  try {
    const data = await enqueueClaudeCall(async () => {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings.preferredModel || 'claude-haiku-4-5',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `style check error: ${res.status}`);
      }
      return res.json() as Promise<{ content?: { text: string }[] }>;
    });
    const text = data.content?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { score?: number; violations?: string[]; suggestions?: string[]; revised?: string };
      return {
        score: typeof parsed.score === 'number' ? parsed.score : 75,
        violations: [...violations, ...(parsed.violations || [])],
        suggestions: parsed.suggestions || [],
        revised: parsed.revised,
      };
    }
  } catch { /* */ }

  return {
    score: 60,
    violations,
    suggestions: ['AIによる分析に失敗しました。再試行してください。'],
  };
}

// ─── AI ポスト生成時のガイドライン注入 ────────────────────────

export function buildGuidelinePrompt(g: BrandGuideline): string {
  const parts: string[] = [
    `## ブランドガイドライン (${g.name})`,
    `- トーン: ${TONE_META[g.tone].label} — ${TONE_META[g.tone].description}`,
  ];
  if (g.mustWords.length > 0) parts.push(`- 積極的に使うべきキーワード: ${g.mustWords.join(', ')}`);
  if (g.ngWords.length > 0)   parts.push(`- 絶対に使ってはいけない言葉: ${g.ngWords.join(', ')}`);
  if (g.emojiStyle !== 'none') parts.push(`- 絵文字: ${g.emojiStyle === 'rich' ? '積極的に使う' : 'なるべく少なく'}`);
  if (g.bio) parts.push(`- 世界観: ${g.bio}`);
  if (g.hashtagSets.length > 0) parts.push(`- 定番ハッシュタグ: ${g.hashtagSets[0].join(' ')}`);
  return parts.join('\n');
}

// ─── React Hook ───────────────────────────────────────────────

import { useState, useCallback } from 'react';

export function useBrandGuidelines() {
  const [guidelines, setGuidelines] = useState<BrandGuideline[]>(load);
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY));

  const active = guidelines.find(g => g.id === activeId) || guidelines[0];

  const switchActive = useCallback((id: string) => {
    setActiveGuideline(id);
    setActiveId(id);
  }, []);

  const save = useCallback((g: BrandGuideline) => {
    setGuidelines(saveGuideline(g));
  }, []);

  const create = useCallback((input: Omit<BrandGuideline, 'id' | 'updatedAt'>) => {
    const g = createGuideline(input);
    setGuidelines(load());
    return g;
  }, []);

  const remove = useCallback((id: string) => {
    setGuidelines(removeGuideline(id));
  }, []);

  return { guidelines, active, switchActive, save, create, remove };
}
