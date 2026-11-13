import { describe, expect, it } from 'vitest'
import { parseBackup, serializeBackup, type BackupData } from './backup'

const sample: BackupData = {
  workplaces: [
    { id: 'w1', name: '塾講師', hourlyWage: 1500, transportPerShift: 0 },
    { id: 'w2', name: 'カフェ', hourlyWage: 1100, transportPerShift: 400 },
  ],
  shifts: [
    { id: 's1', date: '2026-11-02', start: '17:00', end: '21:00', breakMinutes: 0, workplaceId: 'w1' },
  ],
  goalYen: 80000,
  actuals: [{ workplaceId: 'w1', yearMonth: '2026-11', amount: 50000 }],
  themeId: 'mint',
  unlockedThemes: ['peach', 'mint'],
  appearance: 'dark',
  celebrated: { level: 3, tiers: { count: 1 } },
  patternId: 'dots',
  unlockedPatterns: ['none', 'dots'],
  rewards: [{ id: 'r1', name: 'ケーキ', cost: 300 }],
  exchanges: [{ id: 'e1', name: 'ケーキ', cost: 300, date: '2026-11-13' }],
}

describe('serializeBackup / parseBackup（Issue #38）', () => {
  it('書き出して読み戻すと元のデータに戻る', () => {
    const text = serializeBackup(sample, '2026-11-12T00:00:00.000Z')
    const r = parseBackup(text)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).toEqual(sample)
      expect(r.summary).toEqual({ workplaces: 2, shifts: 1 })
    }
  })

  it('JSONでない文字列はエラーになる', () => {
    const r = parseBackup('これはバックアップではありません')
    expect(r.ok).toBe(false)
  })

  it('app名が違うファイルはエラーになる', () => {
    const r = parseBackup(JSON.stringify({ app: 'OtherApp', version: 1, data: {} }))
    expect(r.ok).toBe(false)
  })

  it('バージョンが違うファイルはエラーになる', () => {
    const r = parseBackup(
      JSON.stringify({ app: 'ShiftCraft', version: 99, data: { workplaces: [], shifts: [] } }),
    )
    expect(r.ok).toBe(false)
  })

  it('壊れたシフトは落として、読める分だけ復元する', () => {
    const text = JSON.stringify({
      app: 'ShiftCraft',
      version: 1,
      data: {
        workplaces: sample.workplaces,
        shifts: [sample.shifts[0], { id: 'broken' }, null],
      },
    })
    const r = parseBackup(text)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.shifts).toHaveLength(1)
      expect(r.summary.shifts).toBe(1)
    }
  })

  it('任意項目が欠けていれば既定値で補う', () => {
    const text = JSON.stringify({
      app: 'ShiftCraft',
      version: 1,
      data: { workplaces: sample.workplaces, shifts: [] },
    })
    const r = parseBackup(text)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.goalYen).toBe(80000)
      expect(r.data.themeId).toBe('peach')
      expect(r.data.unlockedThemes).toContain('peach')
      expect(r.data.appearance).toBe('auto')
      expect(r.data.actuals).toEqual([])
      expect(r.data.celebrated).toBeNull()
      // Issue #44 の項目も既定値で補われる（古いバックアップ互換）
      expect(r.data.patternId).toBe('none')
      expect(r.data.unlockedPatterns).toContain('none')
      expect(r.data.rewards).toEqual([])
      expect(r.data.exchanges).toEqual([])
    }
  })

  it('壊れたご褒美・交換履歴は落とす', () => {
    const text = JSON.stringify({
      app: 'ShiftCraft',
      version: 1,
      data: {
        workplaces: sample.workplaces,
        shifts: [],
        rewards: [sample.rewards[0], { id: 'broken' }, null],
        exchanges: [sample.exchanges[0], { name: 'x' }],
      },
    })
    const r = parseBackup(text)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.rewards).toHaveLength(1)
      expect(r.data.exchanges).toHaveLength(1)
    }
  })
})
