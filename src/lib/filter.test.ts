/**
* 月別フィルタのテスト
* 書き方の基本は pay.test.ts と同じ (describe / it / expect)。
*/
import { describe, it, expect} from 'vitest'
import { filterByMonth, listMonths, shiftMonth} from './filter'

const shifts = [
{ date: '2026-10-05'},
{ date: '2026-11-02'},
{ date: '2026-11-20'},
{ date: '2026-12-01'},
]

describe('shiftMonth', () => {
it('日付から年月を取り出す', () => {
expect(shiftMonth('2026-11-02')).toBe('2026-11')
})
})

describe('filterByMonth', () => {
it('指定した月のデータだけを返す', () => {
expect(filterByMonth(shifts, '2026-11')).toHaveLength(2)
})
it('空文字なら全期間として全件を返す', () => {
expect(filterByMonth(shifts, '')).toHaveLength(4)
})
it('該当する月がなければ空配列を返す', () => {
expect(filterByMonth(shifts, '2027-01')).toEqual([])
})
})

describe('listMonths', () => {
it('登場する月を重複なし・新しい順で返す', () => {
expect(listMonths(shifts)).toEqual(['2026-12', '2026-11', '2026-10'])
})
})
