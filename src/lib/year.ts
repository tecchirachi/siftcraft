/**
* 年間収入トラッカー（扶養の壁）(Issue #22)
*
* 役割: 1〜12月の収入を集計し、「壁」までの残りと年末予測を出す。
*
* 注意している点:
* - 税金・扶養でいう「年収」は、交通費（通勤手当）を含まない。
* 交通費は非課税なので、呼び出し側で transportPay を差し引いた
* taxablePay（課税対象の給与）だけを渡してもらう。
* - 壁は3つ（2026年分の制度。税制改正で金額が動くので定数に集約している）:
* 136万円=親の扶養控除のライン、150万円=社会保険の扶養（19〜22歳）、
* 178万円=所得税がかかり始めるライン。
* - 年末予測は「経過した日数の割合」で割る単純な比例計算。
* 月給の波は吸収できないが、目安としては十分という割り切り。
*/

export interface YearEntry {
date: string // 'YYYY-MM-DD'
taxablePay: number // 交通費を除いた給与
}

export interface IncomeWall {
limit: number
label: string
}

export const INCOME_WALLS: IncomeWall[] = [
{ limit: 1360000, label: '136万円の壁（親の扶養控除）' },
{ limit: 1500000, label: '150万円の壁（社会保険の扶養・19〜22歳）' },
{ limit: 1780000, label: '178万円の壁（所得税）' },
]

export type WallState = 'safe' | 'caution' | 'over'

export interface WallStatus {
total: number
remaining: number
percent: number
state: WallState
}

/** 指定した年の合計（課税対象の給与） */
export function yearTotal(entries: YearEntry[], year: number): number {
return entries
.filter((e) => e.date.startsWith(`${year}-`))
.reduce((a, e) => a + e.taxablePay, 0)
}

/** 月別（1〜12月）の合計を配列で返す */
export function monthlyTotals(entries: YearEntry[], year: number): number[] {
const months = Array.from({ length: 12}, () => 0)
for (const e of entries) {
if (!e.date.startsWith(`${year}-`)) continue
const m = Number(e.date.slice(5, 7))
if (m >= 1 && m <= 12) months[m - 1] += e.taxablePay
}
return months
}

/** 壁に対する状態: 80%以上で注意、到達で超過 */
export function wallStatus(total: number, limit: number): WallStatus {
const percent = limit > 0? Math.floor((total / limit) * 100): 100
const state: WallState = total >= limit? 'over': percent >= 80? 'caution': 'safe'
return { total, remaining: limit - total, percent, state}
}

function daysInYear(year: number): number {
const leap = (year % 4 === 0 && year % 100!== 0) || year % 400 === 0
return leap? 366: 365
}

/** 'YYYY-MM-DD' がその年の何日目か（1始まり） */
function dayOfYear(date: string): number {
const [y, m, d] = date.split('-').map(Number)
return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000)
}

/**
* 年末時点の予測額。
* - 過去の年: 実績そのまま
* - 未来の年: 今年のペースは使えないので実績（=通常0）
* - 今年: 実績 ÷ 経過日数の割合 で比例計算する
*/
export function projectYearEnd(entries: YearEntry[], year: number, today: string): number {
const total = yearTotal(entries, year)
const todayYear = Number(today.slice(0, 4))
if (year!== todayYear) return total
const elapsed = Math.max(1, dayOfYear(today))
return Math.round((total / elapsed) * daysInYear(year))
}
