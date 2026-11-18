/**
 * カレンダーのフリック（スワイプ）判定（Issue #50）
 *
 * 目的: 月移動を ‹ › ボタンだけでなく、カレンダーを指で弾く操作でも
 * できるようにする。スマホでは「左へ弾く = 次のページへ」が標準的な
 * 感覚なので、左フリックを翌月、右フリックを前月に割り当てる。
 *
 * 誤作動を防ぐための条件は2つ:
 * 1. 横の移動量が SWIPE_MIN_DISTANCE_PX 未満ならフリックとみなさない
 *    （日付セルのタップは移動量がほぼ 0 なので、タップと競合しない）
 * 2. 縦の移動量が横の 2/3 以上ある斜め・縦方向の動きはフリックと
 *    みなさない（スクロールや斜めの指のブレで月が飛ぶのを防ぐ）
 *
 * 判定だけを純粋関数に切り出してあるので、画面なしでテストできる。
 * 実際のタッチ座標の受け取りと月移動は App.tsx 側の役割。
 */

/** フリックと判定する最小の横移動量（px）。タップとの区別の境界 */
export const SWIPE_MIN_DISTANCE_PX = 48

export type SwipeDirection = 'next' | 'prev'

/**
 * 開始点→終了点の移動からフリック方向を判定する。
 * フリックでなければ null を返す。
 * - 左フリック（dx が負）→ 'next'（翌月）
 * - 右フリック（dx が正）→ 'prev'（前月）
 */
export function swipeDirection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): SwipeDirection | null {
  const dx = endX - startX
  const dy = endY - startY
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX) return null
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return null
  return dx < 0 ? 'next' : 'prev'
}
