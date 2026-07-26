// ============================================================
// プロダクト（横断の箱） — 型定義
//
// ★なぜ必要か（オーナー要望 2026-07-26）
//   Prism はこれまで、資料・案件・請求・売上がすべて personaId で
//   完全に分離されていた（人格＝事業体という設計）。
//   そのため「1つの商品を、複数の人格にまたがって扱う」ことができなかった。
//
//   Product は「横断したいものだけを入れる箱」。
//   人格ごとの分離はそのまま保ち、この箱に入れた人格の間でだけ
//   資料と文脈をAIが横断して見られるようにする。
//
//   ＝既存の「ペルソナ間の文脈を混ぜない」原則は維持し、
//     オーナーが明示的に箱へ入れたときだけ、意図的な例外として横断する。
// ============================================================
import type { PersonaId } from './identity';

export type ProductId = string; // UUID

export interface Product {
  id: ProductId;
  /** 商品・事業の名前（例: 「Resonance」「受託事業」） */
  name: string;
  /** 何のプロダクトかの一言。AIにもそのまま渡す。 */
  description: string;
  /** この箱に入っている人格。ここに入れた人格の間でだけ資料が横断される。 */
  personaIds: PersonaId[];
  /** 目印の色（人格と同じパレットから選ぶ） */
  accentColor: string;
  createdAt: string;
  /** このプロダクトで必ず守らせたいこと（任意）。AIのシステムプロンプトへ注入する。 */
  instructions?: string;
}

/** 保存キー（他の一覧系と同じ命名規則に合わせる） */
export const PRODUCTS_STORAGE_KEY = 'core_products_v1';
/** いま選んでいるプロダクト（未選択なら null） */
export const ACTIVE_PRODUCT_KEY = 'core_active_product_id_v1';
