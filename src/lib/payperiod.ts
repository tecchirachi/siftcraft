/**
* 締め日・給料日の期間計算(Issue #17)
*
* 役割: バイト先の「締め日」から、ある日付が属する支給期間
* （開始日〜締め日）と、その期間分の給料日を求める純粋関数。
*
* ルール:
* - 締め日は 1〜31 で表し、31 は「月末」の意味（短い月では月末日に丸める）
* - 給料日は「締め日の翌月の payDay 日」（payDay も 31 は月末の意味）
* - 例: 締め日15日なら期間は 前月16日〜当月15日、給料日は翌月の payDay
*/

export interface PayPeriod {
start: string // "2026-10-16"
end: string // "2026-11-15"（=締め日）
payDate: string // "2026-12-10"
}

function pad2(n: number): string {
return String(n).padStart(2, '0')
}

function fmt(y: number, m: number, d: number): string {
return `${y}-${pad2(m)}-${pad2(d)}`
}

/** その年月の最終日 */
function lastDayOf(y: number, m: number): number {
return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** 締め日をその月の実際の日に丸める（31→月末） */
function clampDay(y: number, m: number, day: number): number {
return Math.min(day, lastDayOf(y, m))
}

/** 年月を delta ヶ月ずらす */
function shiftMonthYM(y: number, m: number, delta: number): { y: number; m: number} {
const t = y * 12 + (m - 1) + delta
return { y: Math.floor(t / 12), m: (t % 12) + 1}
}

/** date が属する支給期間と給料日を返す */
export function periodFor(date: string, closingDay: number, payDay: number): PayPeriod {
const [y, m, d] = date.split('-').map(Number)
const thisClose = clampDay(y, m, closingDay)
let endY = y
let endM = m
if (d > thisClose) {
// 締め日を過ぎていたら、期間の終わりは来月の締め日
const next = shiftMonthYM(y, m, 1)
endY = next.y
endM = next.m
}
const endDay = clampDay(endY, endM, closingDay)
const end = fmt(endY, endM, endDay)
// 開始日は「前の締め日の翌日」
const prev = shiftMonthYM(endY, endM, -1)
const prevClose = clampDay(prev.y, prev.m, closingDay)
const startDate = new Date(Date.UTC(prev.y, prev.m - 1, prevClose) + 86400000)
const start = fmt(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate())
// 給料日は締め日の翌月の payDay
const payYM = shiftMonthYM(endY, endM, 1)
const payDate = fmt(payYM.y, payYM.m, clampDay(payYM.y, payYM.m, payDay))
return { start, end, payDate}
}
