// ============================================================
// productContext — プロダクト（横断の箱）の文脈を AI に渡す共通ブロック
//
// personaInstructions.ts と同じ役割。全 AI 呼び出しの合流点である
// buildSystemPrompt に1本足すことで、どの画面から話しかけても
// 「いまどのプロダクトの話をしているか」「どの人格が関わっているか」を
// AI が把握した状態になる。
// ============================================================
import type { Product } from '../types/product';
import type { Persona } from '../types/identity';

/**
 * いま選んでいるプロダクトの説明ブロック。
 * 未選択なら空文字（＝従来どおり、その人格だけの文脈で動く）。
 */
export function productContextBlock(
  product: Product | null | undefined,
  personas: Pick<Persona, 'id' | 'name' | 'subtitle'>[],
): string {
  if (!product) return '';
  const members = personas.filter(p => product.personaIds.includes(p.id));
  const lines: string[] = [];
  lines.push(`\n\n## いま扱っているプロダクト: ${product.name}`);
  if (product.description) lines.push(product.description);
  if (members.length > 0) {
    lines.push(
      `このプロダクトは次の${members.length}つの立場にまたがっている: ` +
        members.map(m => `「${m.name}」${m.subtitle ? `(${m.subtitle})` : ''}`).join(' / '),
    );
    lines.push(
      'いまの人格の視点を軸にしつつ、必要なら他の立場の資料や事情も踏まえて答えてよい（このプロダクトに限り、立場をまたいで考えることをオーナーが許可している）。',
    );
  }
  if (product.instructions?.trim()) {
    lines.push(`\n### このプロダクトで必ず守ること\n${product.instructions.trim()}`);
  }
  return lines.join('\n');
}

/**
 * 「このプロダクトに関係する人格すべて」の ID を返す。
 * 資料(ナレッジ)を横断して集めるときの範囲になる。
 * プロダクト未選択なら、いまの人格だけ（＝従来の挙動）。
 */
export function scopeForProduct(
  product: Product | null | undefined,
  activePersonaId: string,
): string[] {
  if (!product || product.personaIds.length === 0) return [activePersonaId];
  // いまの人格が箱に入っていなくても、必ず含める（今いる場所の資料が消えるのは不自然なため）
  return Array.from(new Set([activePersonaId, ...product.personaIds]));
}
