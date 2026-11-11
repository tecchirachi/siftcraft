import { describe, expect, it } from 'vitest'
import { evaluateBadges, type BadgeEntry } from './badge'
import type { PayBreakdown } from './pay'

/** テスト用の内訳を作る（必要な項目だけ差し替える） */
function pay(partial: Partial<PayBreakdown> = {}): PayBreakdown {
  return {
    workMinutes: 240,
    regularMinutes: 240,
    overtimeMinutes: 0,
    lateNightMinutes: 0,
    overtimeLateNightMinutes: 0,
    basePay: 4800,
    overtimePay: 0,
    lateNightPay: 0,
    transportPay: 0,
    totalPay: 4800,
    ...partial,
  }
}

function entry(date: string, start = '17:00', p: Partial<PayBreakdown> = {}, workplaceId?: string): BadgeEntry {
  return {
    shift: { date, start, end: '21:00', breakMinutes: 0, workplaceId },
    pay: pay(p),
  }
}

function byId(entries: BadgeEntry[], goal = 80000) {
  return new Map(evaluateBadges(entries, goal).map((s) => [s.badge.id, s]))
}

describe('evaluateBadges', () => {
  it('空なら何も達成していない', () => {
    const statuses = evaluateBadges([], 80000)
    expect(statuses).toHaveLength(12)
    expect(statuses.every((s) => !s.unlocked)).toBe(true)
  })

  it('1件で「はじめの一歩」、進捗は「あと9件」になる', () => {
    const m = byId([entry('2026-11-02')])
    expect(m.get('first')?.unlocked).toBe(true)
    expect(m.get('shifts10')?.unlocked).toBe(false)
    expect(m.get('shifts10')?.progressText).toBe('あと9件')
  })

  it('深夜・残業は内訳の分数で判定する', () => {
    const m = byId([entry('2026-11-02', '17:00', { lateNightMinutes: 30, overtimeMinutes: 15 })])
    expect(m.get('night')?.unlocked).toBe(true)
    expect(m.get('overtime')?.unlocked).toBe(true)
  })

  it('7時前開始で早朝、2バイト先でかけもち', () => {
    const m = byId([
      entry('2026-11-02', '06:30', {}, 'a'),
      entry('2026-11-03', '17:00', {}, 'b'),
    ])
    expect(m.get('early')?.unlocked).toBe(true)
    expect(m.get('multi')?.unlocked).toBe(true)
  })

  it('4週連続を判定する（同じ週の複数件は1週）', () => {
    const m = byId([
      entry('2026-11-02'),
      entry('2026-11-03'),
      entry('2026-11-09'),
      entry('2026-11-16'),
      entry('2026-11-23'),
    ])
    expect(m.get('streak4')?.unlocked).toBe(true)
  })

  it('月の合計が目標以上なら目標達成', () => {
    const m = byId([entry('2026-11-02', '17:00', { totalPay: 50000 }), entry('2026-11-03', '17:00', { totalPay: 35000 })], 80000)
    expect(m.get('goal')?.unlocked).toBe(true)
  })

  it('年収100万円は交通費を除いて判定する', () => {
    // 支給総額は100万円超でも、交通費を引くと届かないケース
    const m = byId([entry('2026-06-01', '17:00', { totalPay: 1050000, transportPay: 100000 })])
    expect(m.get('rich')?.unlocked).toBe(false)
    const m2 = byId([entry('2026-06-01', '17:00', { totalPay: 1050000, transportPay: 40000 })])
    expect(m2.get('rich')?.unlocked).toBe(true)
  })

  it('実働時間は時間単位（切り捨て）で判定する', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      entry(`2026-11-${String((i % 28) + 1).padStart(2, '0')}`, '17:00', { workMinutes: 240 }),
    )
    const m = byId(many) // 25件 × 4時間 = 100時間
    expect(m.get('hours100')?.unlocked).toBe(true)
    expect(m.get('shifts50')?.progressText).toBe('あと25件')
  })
})
