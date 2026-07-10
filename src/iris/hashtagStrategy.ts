// ============================================================
// IRIS ▸ Hashtag Strategy (pure / LLM 不使用 / 失敗ゼロ)
//
// 目的:
//   Instagram 運用の「プロの見せ方」を手入力ゼロで再現する。
//   1) 投稿本文をすっきり保つ — ハッシュタグは本文に埋めず
//      "最初のコメント" に貼るのがプロの定番。届く数は変わらず、
//      本文が読みやすくなる。→ 本文とタグを分けてコピーできるようにする。
//   2) タグの「届く広さ」を色で見える化 — 一般的すぎる語ばかりだと
//      投稿がすぐ埋もれる。広い語 / ちょうどいい語 / 具体的な語を
//      混ぜると初速が付きやすい。
//
// honest-numbers:
//   実際の投稿件数は分からないので数字は一切出さない。
//   ここで出すのは語の"具体さ"から推定した目安カテゴリだけで、
//   必ず「目安」と明示する。作り話の件数は出さない。
// ============================================================

/** タグの届く広さの帯。broad=一般的で競争が激しい / niche=具体的で濃い層に届く */
export type ReachBand = 'broad' | 'mid' | 'niche';

export const BAND_META: Record<ReachBand, { label: string; hint: string; color: string }> = {
  broad: { label: '広く届く', hint: '一般的な語。入口は広いが埋もれやすい', color: '#E1306C' },
  mid:   { label: 'ちょうどいい', hint: 'ほどよい競争。伸ばしやすい中心層', color: '#833AB4' },
  niche: { label: '濃いファンに届く', hint: '具体的な語。刺されば初速が付きやすい', color: '#10B981' },
};

/** 先頭の # を外し、全角/半角の記号を整えたコア語を返す */
function coreWord(tag: string): string {
  return tag.replace(/^[#＃]+/, '').trim();
}

/** 日本語相当の"文字数"（サロゲート考慮） */
function glyphLen(s: string): number {
  return Array.from(s).length;
}

/**
 * タグの"具体さ"から届く広さの帯を推定する（目安・実件数ではない）。
 *
 * 短く一般的な単語ほど competition が高い（broad）、
 * 長く具体的な複合語ほど届く層が絞れる（niche）、という運用上の経験則。
 * LLM は使わず、語の長さ・具体マーカーだけで即判定する。
 */
export function classifyHashtag(tag: string): ReachBand {
  const core = coreWord(tag);
  if (!core) return 'mid';
  const len = glyphLen(core);

  // 具体マーカー: 地名/年/日付/固有名詞っぽい要素・数字を含むと niche 寄り
  const hasSpecific = /[0-9０-９]|さんと繋がりたい|好きな人と繋がりたい|部|会|巡り|レシピ|の日|初心者|さん|くらぶ|クラブ/.test(core);

  // 英数字のみ（ローマ字タグ）は文字数の基準を上げる
  const isLatin = /^[\x00-\x7F]+$/.test(core);
  const shortMax = isLatin ? 6 : 4;
  const longMin = isLatin ? 14 : 9;

  if (hasSpecific || len >= longMin) return 'niche';
  if (len <= shortMax) return 'broad';
  return 'mid';
}

export interface BandedTag { tag: string; band: ReachBand }

export interface HashtagPlan {
  /** # 付きに正規化・重複除去したタグ一覧（帯つき） */
  banded: BandedTag[];
  counts: Record<ReachBand, number>;
  /** バランスの一言アドバイス（目安）。null=十分バランスが取れている */
  advice: string | null;
  /** "最初のコメント" にそのまま貼れる文字列（スペース区切り） */
  firstComment: string;
}

/** タグを # 付きに正規化して重複を除く */
export function normalizeTags(hashtags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of hashtags) {
    const core = coreWord(raw);
    if (!core) continue;
    const key = core.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`#${core}`);
  }
  return out;
}

/** タグ群から帯分け・バランス助言・最初のコメント文を組み立てる */
export function buildHashtagPlan(hashtags: string[]): HashtagPlan {
  const tags = normalizeTags(hashtags);
  const banded: BandedTag[] = tags.map((t) => ({ tag: t, band: classifyHashtag(t) }));
  const counts: Record<ReachBand, number> = { broad: 0, mid: 0, niche: 0 };
  banded.forEach((b) => { counts[b.band] += 1; });

  let advice: string | null = null;
  if (tags.length >= 3) {
    if (counts.niche === 0) {
      advice = '具体的な語（濃いファンに届く語）が少なめ。1〜3個足すと初速が付きやすいです（目安）。';
    } else if (counts.broad === 0) {
      advice = '広く届く一般的な語が少なめ。1〜2個足すと入口が広がります（目安）。';
    }
  }

  return { banded, counts, advice, firstComment: tags.join(' ') };
}

/**
 * 投稿本文の末尾に AI がまとめて付けたハッシュタグ行を取り除き、
 * "すっきりした本文" と "本文から拾ったタグ" を分けて返す。
 * 本文中に自然に混ざった 1〜2 個のタグは残す（末尾のタグ塊だけ剥がす）。
 */
export function splitCaptionAndTags(
  caption: string,
  hashtags: string[],
): { cleanCaption: string; mergedTags: string[] } {
  const lines = caption.split('\n');
  const picked: string[] = [];

  // 末尾から、"ほぼハッシュタグだけ" の行を剥がす
  while (lines.length) {
    const last = (lines[lines.length - 1] || '').trim();
    if (last === '') { lines.pop(); continue; }
    const tokens = last.split(/\s+/).filter(Boolean);
    const tagTokens = tokens.filter((t) => /^[#＃]/.test(t));
    // 行の 6 割以上がタグなら、その行はタグ行とみなして剥がす
    if (tokens.length > 0 && tagTokens.length / tokens.length >= 0.6) {
      picked.push(...tagTokens);
      lines.pop();
      continue;
    }
    break;
  }

  const cleanCaption = lines.join('\n').replace(/\s+$/, '');
  const mergedTags = normalizeTags([...hashtags, ...picked.reverse()]);
  return { cleanCaption, mergedTags };
}
