import { describe, expect, it } from 'vitest'
import { isValidExchange, isValidReward, totalExchangeCost, validateReward } from './rewards'

describe('ご褒美交換（Issue #44）', () => {
  it('交換履歴の合計を返す', () => {
    expect(totalExchangeCost([])).toBe(0)
    expect(
      totalExchangeCost([
        { id: '1', name: 'ケーキ', cost: 300, date: '2026-11-13' },
        { id: '2', name: '映画', cost: 500, date: '2026-11-14' },
      ]),
    ).toBe(800)
  })

  it('検証: 名前が空・ポイントが不正だとエラー', () => {
    expect(validateReward('', 300)).toHaveLength(1)
    expect(validateReward('   ', 300)).toHaveLength(1)
    expect(validateReward('ケーキ', 0)).toHaveLength(1)
    expect(validateReward('ケーキ', -100)).toHaveLength(1)
    expect(validateReward('ケーキ', 1.5)).toHaveLength(1)
    expect(validateReward('ケーキ', 300)).toEqual([])
  })

  it('型ガード: 形が違うものを弾く', () => {
    expect(isValidReward({ id: 'r', name: 'ケーキ', cost: 300 })).toBe(true)
    expect(isValidReward({ id: 'r', name: 'ケーキ' })).toBe(false)
    expect(isValidReward(null)).toBe(false)
    expect(isValidExchange({ id: 'e', name: 'ケーキ', cost: 300, date: '2026-11-13' })).toBe(true)
    expect(isValidExchange({ id: 'e', name: 'ケーキ', cost: 300 })).toBe(false)
  })
})
