/**
 * カレンダーのタップ判定（Issue #29）
 *
 * 役割: 「1タップ=選択、ダブルタップ=入力モーダル」を実現するための判定だけを
 * 切り出したモジュール。画面（React）から切り離すことで単体テストできる。
 *
 * 設計:
 * - 1タップ目では何も待たない（選択は即座に反映）。ダブルタップ判定のために
 *   タイマーで遅らせる方式は「反応が遅い」と感じるので採らない。
 * - 「同じ日を thresholdMs 以内にもう一度タップしたら open」だけを判定する。
 *   違う日を続けてタップした場合は、ただの選択として扱う。
 */

export interface TapState {
  date: string
  /** タップ時刻（ミリ秒。Date.now() の値） */
  at: number
}

export type TapAction = 'select' | 'open'

/** ダブルタップとみなす間隔（ミリ秒） */
export const DOUBLE_TAP_MS = 300

/**
 * 前回タップの状態と今回のタップから、今回のアクションを決める。
 * @param prev 前回のタップ（なければ null）
 * @param date 今回タップされた日
 * @param now 今回のタップ時刻
 */
export function classifyTap(
  prev: TapState | null,
  date: string,
  now: number,
  thresholdMs: number = DOUBLE_TAP_MS,
): TapAction {
  if (prev && prev.date === date && now >= prev.at && now - prev.at <= thresholdMs) {
    return 'open'
  }
  return 'select'
}
