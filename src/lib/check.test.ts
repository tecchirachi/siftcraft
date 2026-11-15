import { describe, expect, it } from 'vitest'
import { comparePay } from './check'

describe('明細との照合（comparePay、Issue #15）', () => {
it('実績が未入力なら unset で差額は null', () => {
expect(comparePay(10000, null)).toEqual({ status: 'unset', diff: null })
expect(comparePay(10000, undefined)).toEqual({ status: 'unset', diff: null })
})
it('差が 0 なら match', () => {
expect(comparePay(10000, 10000)).toEqual({ status: 'match', diff: 0 })
})
it('実績が多いと over、少ないと under（差額は 実績 − 見込み）', () => {
expect(comparePay(10000, 10500)).toEqual({ status: 'over', diff: 500 })
expect(comparePay(10000, 9800)).toEqual({ status: 'under', diff: -200 })
})
})
