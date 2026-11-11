/**
* 年間収入トラッカーのテスト
*/
import { describe, it, expect} from 'vitest'
import { monthlyTotals, projectYearEnd, wallStatus, yearTotal} from './year'

const entries = [
{ date: '2026-01-15', taxablePay: 50000},
{ date: '2026-01-30', taxablePay: 30000},
{ date: '2026-11-07', taxablePay: 20000},
{ date: '2025-12-31', taxablePay: 99999},
]

describe('yearTotal / monthlyTotals', () => {
it('指定した年だけを合計する', () => {
expect(yearTotal(entries, 2026)).toBe(100000)
expect(yearTotal(entries, 2025)).toBe(99999)
})
it('月別に振り分ける', () => {
const m = monthlyTotals(entries, 2026)
expect(m[0]).toBe(80000)
expect(m[10]).toBe(20000)
expect(m[1]).toBe(0)
})
})

describe('wallStatus', () => {
it('80%未満は safe、80%以上は caution、到達で over', () => {
expect(wallStatus(500000, 1030000).state).toBe('safe')
expect(wallStatus(900000, 1030000).state).toBe('caution')
expect(wallStatus(1030000, 1030000).state).toBe('over')
expect(wallStatus(900000, 1030000).remaining).toBe(130000)
})
})

describe('projectYearEnd', () => {
it('過去の年は実績そのまま', () => {
expect(projectYearEnd(entries, 2025, '2026-06-01')).toBe(99999)
})
it('今年は経過日数で比例計算する（うるう年でない2026年）', () => {
// 2026-07-02 は183日目。合計100000 → 100000/183*365 = 199453.6 → 199454
expect(projectYearEnd(entries, 2026, '2026-07-02')).toBe(199454)
})
})

describe('INCOME_WALLS（2026年分の制度）', () => {
  it('136万・150万・178万の3本で、昇順に並ぶ', async () => {
    const { INCOME_WALLS } = await import('./year')
    expect(INCOME_WALLS.map((w) => w.limit)).toEqual([1360000, 1500000, 1780000])
  })
})
