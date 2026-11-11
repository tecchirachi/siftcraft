/**
* 入力候補（オートコンプリート）(Issue #11)
*
* 役割: 過去の入力から「次も使いそうな値」を候補として出すための純粋関数群。
* サーバーも学習モデルも使わず、単純な頻度集計だけで実用的な候補が作れる。
*/
import type { ShiftInput } from './pay'

/** ID とバイト先IDを持つシフト（保存済みデータの形） */
export interface StoredShift extends ShiftInput {
  id: string
  workplaceId?: string
}

export interface TimePattern {
start: string
end: string
breakMinutes: number
}

/**
* そのバイト先でよく使う時間帯パターンを、使用回数の多い順に返す。
*
* - 開始・終了・休憩の3点セットを1パターンとして数える
* - 同点なら最近使ったものを優先する（最後に現れた位置を記録しておく）
* - 「どのバイト先のシフトか」は resolveId 関数で解決してから渡す。
* workplaceId 未設定の旧データの扱い（=先頭のバイト先）を呼び出し側の
* 解決ロジックに寄せることで、この関数は集計だけに集中できる
*/
export function frequentPatterns(
shifts: StoredShift[],
workplaceId: string,
resolveId: (shift: StoredShift) => string,
limit = 4,
): TimePattern[] {
const stats = new Map<string, { pattern: TimePattern; count: number; lastIndex: number}>()
shifts.forEach((s, i) => {
if (resolveId(s)!== workplaceId) return
const pattern: TimePattern = { start: s.start, end: s.end, breakMinutes: s.breakMinutes}
const key = `${pattern.start}-${pattern.end}-${pattern.breakMinutes}`
const cur = stats.get(key)
if (cur) {
cur.count += 1
cur.lastIndex = i
} else {
stats.set(key, { pattern, count: 1, lastIndex: i})
}
})
return [...stats.values()]
.sort((a, b) => b.count - a.count || b.lastIndex - a.lastIndex)
.slice(0, limit)
.map((v) => v.pattern)
}

/** 文字列候補の重複を取り除き、空文字を除いて返す（datalist 用） */
export function uniqueSuggestions(values: (string | undefined)[]): string[] {
const seen = new Set<string>()
for (const v of values) {
const t = (v?? '').trim()
if (t) seen.add(t)
}
return [...seen]
}

/**
 * 時刻を ±分 ずらす（Issue #20）【学習用解説】
 * 「17:00」のような文字列を分に直して加減し、24時間で一周させて戻す。
 * ±15分ボタンから呼ばれ、打たずに時刻を調整できるようにするための部品。
 */
export function stepTime(time: string, deltaMinutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = (((h * 60 + m + deltaMinutes) % 1440) + 1440) % 1440
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}
