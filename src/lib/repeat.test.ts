import { describe, expect, it } from 'vitest'
import { weeklyDates } from './repeat'

describe('毎週の繰り返し（weeklyDates、Issue #16）', () => {
it('開始日を含めて7日ごとの日付を返す', () => {
expect(weeklyDates('2026-11-07', 3)).toEqual(['2026-11-07', '2026-11-14', '2026-11-21'])
})
it('月またぎ・年またぎでも正しく繰り上がる', () => {
expect(weeklyDates('2026-11-30', 2)).toEqual(['2026-11-30', '2026-12-07'])
expect(weeklyDates('2026-12-28', 2)).toEqual(['2026-12-28', '2027-01-04'])
})
it('回数 1 なら開始日だけ、0 なら空', () => {
expect(weeklyDates('2026-11-07', 1)).toEqual(['2026-11-07'])
expect(weeklyDates('2026-11-07', 0)).toEqual([])
})
it('うるう年の2月もずれない（UTC計算）', () => {
expect(weeklyDates('2028-02-26', 2)).toEqual(['2028-02-26', '2028-03-04'])
})
})
