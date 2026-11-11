/**
* シフト予定表（カレンダー）のロジック(Issue #6)
*
* 役割: 「何年何月のカレンダーをどう並べるか」と
* 「シフトを日付ごとにまとめる」計算を担当する純粋関数群。
* 画面（App.tsx）はここが返した並びを描くだけ、という役割分担。
*
* カレンダーの考え方:
* - 週は日曜始まりで、1週間=7マス。月の表は「7で割り切れる個のマス」で表す
* - 月初より前のマスは null（空白）で表す。末尾も週が揃うよう null で埋める
* - 「その月の日数」は new Date(year, month, 0).getDate() で求まる
* （month は 1〜12 で受け取り、Date の「翌月0日 = 当月末日」の性質を使う）
*/

/** カレンダーの1マス。空白マスは null を使う */
export interface CalendarCell {
/** "2026-11-02" 形式 */
date: string
/** 日（1〜31） */
day: number
}

/** 数値を2桁にゼロ埋めする（"2026-11-2" を "2026-11-02" に） */
function pad(n: number): string {
return String(n).padStart(2, '0')
}

/**
* 指定した月のカレンダーのマス並びを返す。
* 先頭の空白 + その月の日 + 末尾の空白 で、長さは 35 か 42（7の倍数）。
*/
export function buildMonthGrid(year: number, month: number): (CalendarCell | null)[] {
const daysInMonth = new Date(year, month, 0).getDate()
// 月初の曜日（0=日曜）。その数だけ先頭に空白が入る
const firstWeekday = new Date(year, month - 1, 1).getDay()

const cells: (CalendarCell | null)[] = []
for (let i = 0; i < firstWeekday; i++) cells.push(null)
for (let d = 1; d <= daysInMonth; d++) {
cells.push({ date: `${year}-${pad(month)}-${pad(d)}`, day: d})
}
// 末尾を空白で埋めて週を揃える
while (cells.length % 7!== 0) cells.push(null)
return cells
}

/** 日付をキーにしてアイテムをまとめる（予定表の「その日のシフト」用） */
export function groupByDate<T extends { date: string}>(items: T[]): Map<string, T[]> {
const map = new Map<string, T[]>()
for (const item of items) {
const arr = map.get(item.date)
if (arr) arr.push(item)
else map.set(item.date, [item])
}
return map
}

/** 年月を前後にずらす（月移動ボタンの計算をテスト可能にするため） */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number} {
// 一度「通算の月数」に直してから割り戻すと、年の繰り上がり/繰り下がりが一発で合う
const total = year * 12 + (month - 1) + delta
return { year: Math.floor(total / 12), month: (total % 12) + 1}
}
