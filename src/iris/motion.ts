// Iris 共通モーション定義 — 画面ごとにバラバラだった速度・カーブを 1 本に統一。
// 「贅沢な体験」を作るための原則:
//   1) 速度は 3 段だけ。迷ったら BASE。タップは SNAP、登場は ENTER。
//   2) カーブは上質な減速 (easeOutQuint 風)。終わり際にスッと止まると高級に見える。
//   3) transition は対象プロパティを明示。'all' はレイアウトまで動かしてカクつく原因なので使わない。

/** 減速カーブ（終わり際がなめらか）。ホバー・登場の標準。 */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** 行き帰りが対称なカーブ。トグルや色変化向け。 */
export const EASE_IN_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)';

/** タップ/トグルなど即応が要る操作（秒）。 */
export const DUR_SNAP = 0.16;
/** ホバー・標準のインタラクション（秒）。 */
export const DUR_BASE = 0.22;
/** 要素の登場・退場（秒）。 */
export const DUR_ENTER = 0.4;

/** ホバーで浮くカードの標準 transition。transform/影/枠だけを動かす。 */
export const HOVER_LIFT = `transform ${DUR_BASE}s ${EASE_OUT}, box-shadow ${DUR_BASE}s ${EASE_OUT}, border-color ${DUR_BASE}s ${EASE_OUT}`;
/** トグル・選択ボタンの標準 transition（背景・色・影）。 */
export const TOGGLE = `background ${DUR_SNAP}s ${EASE_IN_OUT}, color ${DUR_SNAP}s ${EASE_IN_OUT}, box-shadow ${DUR_SNAP}s ${EASE_IN_OUT}`;
/** 複数プロパティが同時に変わる状態カード向け（'all' の速度・カーブだけを統一）。 */
export const BASE_ALL = `all ${DUR_BASE}s ${EASE_OUT}`;

/** framer-motion 用の登場プリセット。 */
export const ENTER_SPRING = { duration: DUR_ENTER, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
