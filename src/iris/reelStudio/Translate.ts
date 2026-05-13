// ============================================================
// Translate.ts — 字幕翻訳 (Gemini 経由)
//
// /api/ai (Anthropic 互換 → Gemini) を叩いて
// 日本語字幕を英語/中国語/韓国語へ翻訳する。
// CapCut Pro の「AI 自動翻訳」相当。
// ============================================================

export type TargetLang = 'en' | 'zh' | 'ko';

const LANG_LABEL: Record<TargetLang, string> = {
  en: 'English',
  zh: 'Simplified Chinese (zh-CN)',
  ko: 'Korean (ko-KR)',
};

/**
 * 字幕を一括翻訳。
 * 行ごとの順序を保持するため `||` 区切りで一度に投げて再分割する。
 */
export async function translateCaptions(
  texts: string[],
  target: TargetLang,
): Promise<string[]> {
  if (texts.length === 0) return [];
  const sep = '|||';
  const joined = texts.map(t => t.replace(/\|\|\|/g, '/')).join(sep);
  const prompt = `Translate the following Japanese short-video captions into ${LANG_LABEL[target]}. \
Keep them short and punchy. Preserve any role tag in square brackets like [hook]. \
Output ONLY the translations joined by "${sep}" in the same order — no extra commentary.

${joined}`;

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`translate failed: ${res.status}`);
  const data = await res.json();
  const out: string =
    data?.content?.[0]?.text ??
    data?.content ??
    '';
  const parts = out.split(sep).map(s => s.trim()).filter(Boolean);
  // 行数が違ったら元の長さに揃える
  while (parts.length < texts.length) parts.push(texts[parts.length]);
  return parts.slice(0, texts.length);
}
