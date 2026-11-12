import { describe, expect, it } from 'vitest'
import { summarizeWeeks, weekStartOf, weeksInMonth } from './weekhours'

describe('weekStartOf（Issue #40）', () => {
  it('水曜はその週の日曜を返す', () => {
    expect(weekStartOf('2026-11-04')).toBe('2026-11-01')
  })

  it('日曜はその日自体、土曜は直前の日曜を返す', () => {
    expect(weekStartOf('2026-11-01')).toBe('2026-11-01')
    expect(weekStartOf('2026-11-07')).toBe('2026-11-01')
  })
})

describe('summarizeWeeks（Issue #40）', () => {
  it('ちょうど40時間（2400分）は超過ではない', () => {
    const weeks = summarizeWeeks([{ date: '2026-11-02', workMinutes: 2400 }])
    expect(weeks).toHaveLength(1)
    expect(weeks[0].totalMinutes).toBe(2400)
    expect(weeks[0].over).toBe(false)
  })

  it('40時間+1分で超過になる', () => {
    const weeks = summarizeWeeks([
      { date: '2026-11-02', workMinutes: 1200 },
      { date: '2026-11-05', workMinutes: 1201 },
    ])
    expect(weeks[0].totalMinutes).toBe(2401)
    expect(weeks[0].over).toBe(true)
  })

  it('月をまたぐ週は1つの週として合計する', () => {
    // 2026-11-29（日）〜12-05（土）が同じ週
    const weeks = summarizeWeeks([
      { date: '2026-11-30', workMinutes: 1000 },
      { date: '2026-12-02', workMinutes: 1500 },
    ])
    expect(weeks).toHaveLength(1)
    expect(weeks[0].weekStart).toBe('2026-11-29')
    expect(weeks[0].weekEnd).toBe('2026-12-05')
    expect(weeks[0].over).toBe(true)
  })

  it('日をまたぐシフトは開始日の週に入る前提で集計する', () => {
    // 土曜22時始まりの夜勤（実働は呼び出し側が開始日で渡す）
    const weeks = summarizeWeeks([
      { date: '2026-11-07', workMinutes: 480 },
      { date: '2026-11-08', workMinutes: 480 },
    ])
    expect(weeks).toHaveLength(2)
    expect(weeks[0].weekStart).toBe('2026-11-01')
    expect(weeks[1].weekStart).toBe('2026-11-08')
  })
})

describe('weeksInMonth（Issue #40）', () => {
  it('月をまたぐ週は両方の月に含まれる', () => {
    const weeks = summarizeWeeks([{ date: '2026-12-02', workMinutes: 600 }])
    expect(weeksInMonth(weeks, 2026, 11)).toHaveLength(1)
    expect(weeksInMonth(weeks, 2026, 12)).toHaveLength(1)
    expect(weeksInMonth(weeks, 2026, 10)).toHaveLength(0)
  })
})
