import { describe, expect, it } from 'vitest'
import { collapseCelebrations, diffCelebrations, mergeCelebrated, type CelebratedState, type Celebration } from './celebrate'
import type { BadgeStatus } from './badge'

function badge(id: string, tier: number): BadgeStatus {
  return {
    id, mark: '◆', name: `実績${id}`, description: '', value: 0,
    tier, tierName: tier > 0 ? 'ブロンズ' : null, nextThreshold: null,
    progressText: '', segmentPercent: 100,
  }
}

describe('celebrate（Issue #34）', () => {
  const prev: CelebratedState = { level: 2, tiers: { shifts: 1 } }

  it('レベルが上がったら level イベント', () => {
    const ev = diffCelebrations(prev, 3, 'バイト見習い3', [])
    expect(ev).toEqual([{ kind: 'level', level: 3, title: 'バイト見習い3' }])
  })

  it('ティアが上がったカテゴリだけ badge イベント', () => {
    const ev = diffCelebrations(prev, 2, 'x', [badge('shifts', 2), badge('hours', 1)])
    expect(ev).toHaveLength(2)
    expect(ev[0]).toMatchObject({ kind: 'badge', name: '実績shifts', tier: 2 })
    expect(ev[1]).toMatchObject({ kind: 'badge', name: '実績hours', tier: 1 })
  })

  it('変化がなければ空', () => {
    expect(diffCelebrations(prev, 2, 'x', [badge('shifts', 1)])).toEqual([])
    expect(diffCelebrations(prev, 1, 'x', [badge('shifts', 0)])).toEqual([])
  })

  it('merge は最大値を保持する（下がっても戻らない）', () => {
    const merged = mergeCelebrated(prev, 1, [badge('shifts', 0), badge('hours', 3)])
    expect(merged.level).toBe(2)
    expect(merged.tiers).toEqual({ shifts: 1, hours: 3 })
  })

  it('merge は初回（null）でも現在値で作れる', () => {
    const merged = mergeCelebrated(null, 5, [badge('shifts', 2)])
    expect(merged).toEqual({ level: 5, tiers: { shifts: 2 } })
  })
})

describe('collapseCelebrations（Issue #42）', () => {
  const ev = (n: number): Celebration[] =>
    Array.from({ length: n }, (_, i) => ({
      kind: 'badge', name: `実績${i}`, mark: '◆', tier: 1, tierName: 'ブロンズ', achieved: true,
    }))

  it('3件まではそのまま', () => {
    expect(collapseCelebrations(ev(3))).toHaveLength(3)
    expect(collapseCelebrations(ev(1))).toHaveLength(1)
    expect(collapseCelebrations(ev(0))).toEqual([])
  })

  it('4件以上は先頭2件＋まとめ1件に畳む', () => {
    const out = collapseCelebrations(ev(5))
    expect(out).toHaveLength(3)
    expect(out[2]).toEqual({ kind: 'summary', count: 3 })
  })
})
