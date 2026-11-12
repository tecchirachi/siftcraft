import { describe, expect, it } from 'vitest'
import { replaceShift } from './editshift'

// テスト用の最小シフト（id と時刻だけ持つ形で十分）
const base = [
  { id: 'a', date: '2026-11-02', start: '17:00', end: '21:00' },
  { id: 'b', date: '2026-11-03', start: '09:00', end: '12:00' },
  { id: 'c', date: '2026-11-04', start: '13:00', end: '18:00' },
]

describe('replaceShift（シフト編集 Issue #37）', () => {
  it('id が一致するシフトだけを差し替え、並び順と他は変えない', () => {
    const updated = { id: 'b', date: '2026-11-05', start: '10:00', end: '15:00' }
    const result = replaceShift(base, updated)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual(base[0])
    expect(result[1]).toEqual(updated)
    expect(result[2]).toEqual(base[2])
  })

  it('元の配列を変更しない', () => {
    const copy = [...base]
    replaceShift(base, { id: 'a', date: '2026-12-01', start: '08:00', end: '09:00' })
    expect(base).toEqual(copy)
  })

  it('存在しない id の場合は内容が変わらない', () => {
    const result = replaceShift(base, { id: 'zzz', date: '2026-11-09', start: '08:00', end: '09:00' })
    expect(result).toEqual(base)
  })
})
