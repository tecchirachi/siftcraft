/**
 * カレンダーのタップ判定（Issue #32）
 *
 * 変遷: #29 では「300ms以内の再タップ」をダブルタップとして判定していたが、
 * 時間まかせは押し間違いや端末差で不安定だった。#31 で1タップ即オープンに
 * 振り切った後、最終的にユーザーが選んだのは状態ベースの方式:
 *
 * - 未選択の日をタップ → その日を「選択」する
 * - 選択済みの日をもう一度タップ → 入力モーダルを「開く」
 *
 * 時間に依存しないので、ゆっくり2回押しても確実に開くし、
 * 別の日を押せば選択が移るだけ、という予測しやすい挙動になる。
 */

export type TapAction = 'select' | 'open'

/** 選択中の日と同じ日をタップしたら 'open'、それ以外は 'select' */
export function tapAction(pickedDate: string, tappedDate: string): TapAction {
  return pickedDate === tappedDate ? 'open' : 'select'
}
