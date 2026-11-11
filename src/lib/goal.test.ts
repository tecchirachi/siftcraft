/**
* 目標金額シミュレーションのテスト
*/
import { describe, it, expect} from 'vitest'
import { goalProgress} from './goal'

describe('goalProgress', () => {
it('未達成: あと金額と必要時間、進捗率を返す', () => {
// 現在50,000円、目標80,000円、時給1,200円 → あと30,000円 = 25時間 = 1500分、進捗62%
const r = goalProgress(50000, 80000, 1200)
expect(r.remainingYen).toBe(30000)
expect(r.remainingMinutes).toBe(1500)
expect(r.progressPercent).toBe(62)
expect(r.achieved).toBe(false)
})

it('必要時間は切り上げる（端数があるとそのままでは届かないため）', () => {
// あと1,000円、時給1,200円 → 50分ちょうどではなく 50分で1000円に届くため 50分
// あと1,100円なら 55分
expect(goalProgress(78900, 80000, 1200).remainingMinutes).toBe(55)
})

it('ちょうど達成したら remaining は0で achieved が true', () => {
const r = goalProgress(80000, 80000, 1200)
expect(r.remainingYen).toBe(0)
expect(r.remainingMinutes).toBe(0)
expect(r.progressPercent).toBe(100)
expect(r.achieved).toBe(true)
})

it('超過しても進捗率は100%で止まる', () => {
const r = goalProgress(120000, 80000, 1200)
expect(r.progressPercent).toBe(100)
expect(r.achieved).toBe(true)
})

it('時給が0なら必要時間は計算不能として null を返す', () => {
expect(goalProgress(0, 80000, 0).remainingMinutes).toBeNull()
})
})
