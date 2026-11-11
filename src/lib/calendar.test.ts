/**
* カレンダーロジックのテスト
* 曜日の答え合わせは実際のカレンダーで確認済みの日付を使う。
*/
import { describe, it, expect} from 'vitest'
import { buildMonthGrid, groupByDate, shiftMonth} from './calendar'

describe('buildMonthGrid', () => {
it('2026年11月: 1日が日曜なので空白なしで始まり、30日ある', () => {
const cells = buildMonthGrid(2026, 11)
expect(cells[0]?.date).toBe('2026-11-01')
expect(cells.filter((c) => c!== null)).toHaveLength(30)
expect(cells).toHaveLength(35) // 7の倍数に揃う
})

it('2024年2月（うるう年）: 1日は木曜で空白4つ、29日まである', () => {
const cells = buildMonthGrid(2024, 2)
expect(cells.slice(0, 4)).toEqual([null, null, null, null])
expect(cells[4]?.date).toBe('2024-02-01')
expect(cells.filter((c) => c!== null)).toHaveLength(29)
expect(cells[cells.length - 1 - 2]?.date).toBe('2024-02-29')
})

it('日付はゼロ埋めされる', () => {
const cells = buildMonthGrid(2026, 1)
expect(cells.find((c) => c?.day === 5)?.date).toBe('2026-01-05')
})
})

describe('groupByDate', () => {
it('同じ日付でまとまる', () => {
const items = [
{ date: '2026-11-02', start: '09:00'},
{ date: '2026-11-02', start: '18:00'},
{ date: '2026-11-03', start: '09:00'},
]
const map = groupByDate(items)
expect(map.get('2026-11-02')).toHaveLength(2)
expect(map.get('2026-11-03')).toHaveLength(1)
expect(map.get('2026-11-04')).toBeUndefined()
})
})

describe('shiftMonth', () => {
it('年をまたいで前後にずれる', () => {
expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1})
expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12})
expect(shiftMonth(2026, 11, 0)).toEqual({ year: 2026, month: 11})
})
})
