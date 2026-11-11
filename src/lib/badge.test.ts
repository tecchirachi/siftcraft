import { describe, expect, it } from 'vitest'
import { evaluateBadges, TIER_NAMES, totalTiers, type BadgeEntry } from './badge'
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
  return new Map(evaluateBadges(entries, goal).map((s) => [s.id, s]))
}

describe('evaluateBadges（ティア制）', () => {
  it('空なら全カテゴリ ティア0', () => {
    const statuses = evaluateBadges([], 80000)
    expect(statuses).toHaveLength(9)
    expect(statuses.every((s) => s.tier === 0 && s.tierName === null)).toBe(true)
    expect(totalTiers(statuses)).toBe(0)
  })

  it('シフト1件で件数ティア1（ブロンズ）、次はあと9件', () => {
    const m = byId([entry('2026-11-02')])
    const s = m.get('shifts')
    expect(s?.tier).toBe(1)
    expect(s?.tierName).toBe('ブロンズ')
    expect(s?.nextThreshold).toBe(10)
    expect(s?.progressText).toBe('あと9件で シルバー')
  })

  it('件数500件で最大ティア（レジェンド）・MAX表示', () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      entry(`2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`),
    )
    const s = byId(many).get('shifts')
    expect(s?.tier).toBe(8)
    expect(s?.tierName).toBe(TIER_NAMES[7])
    expect(s?.nextThreshold).toBeNull()
    expect(s?.progressText).toBe('MAX')
  })

  it('深夜・残業は累計時間でティアが上がる', () => {
    // 深夜300分=5時間 → ティア2、残業60分=1時間 → ティア1
    const m = byId([entry('2026-11-02', '17:00', { lateNightMinutes: 300, overtimeMinutes: 60 })])
    expect(m.get('night')?.tier).toBe(2)
    expect(m.get('overtime')?.tier).toBe(1)
  })

  it('早朝は回数、かけもちはバイト先数で数える', () => {
    const m = byId([
      entry('2026-11-02', '06:30', {}, 'a'),
      entry('2026-11-03', '06:00', {}, 'b'),
      entry('2026-11-04', '17:00', {}, 'b'),
    ])
    expect(m.get('early')?.value).toBe(2)
    expect(m.get('multi')?.tier).toBe(1) // 2か所でティア1
  })

  it('連続週は最長記録で判定する', () => {
    const m = byId([
      entry('2026-11-02'), entry('2026-11-09'), entry('2026-11-16'), entry('2026-11-23'),
    ])
    expect(m.get('streak')?.value).toBe(4)
    expect(m.get('streak')?.tier).toBe(2) // 2週=ティア1, 4週=ティア2
  })

  it('目標達成は「達成した月数」、年収は交通費を除いた最高年で判定', () => {
    const m = byId(
      [
        entry('2026-10-05', '17:00', { totalPay: 90000 }),
        entry('2026-11-02', '17:00', { totalPay: 85000 }),
        entry('2026-11-03', '17:00', { totalPay: 1050000, transportPay: 100000 }),
      ],
      80000,
    )
    expect(m.get('goal')?.value).toBe(2) // 10月と11月
    // 2026年の課税対象 = 90000+85000+950000 = 1,125,000 → 100万円超でティア5
    expect(m.get('income')?.tier).toBe(5)
  })

  it('区間進捗は現在区間内の割合になる', () => {
    // 件数15件: ティア2（10件）到達、次25件まで区間 10→25 の 5/15 = 33%
    const many = Array.from({ length: 15 }, (_, i) =>
      entry(`2026-11-${String((i % 28) + 1).padStart(2, '0')}`),
    )
    const s = byId(many).get('shifts')
    expect(s?.tier).toBe(2)
    expect(s?.segmentPercent).toBe(33)
  })
})
