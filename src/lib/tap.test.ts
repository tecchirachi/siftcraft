import { describe, expect, it } from 'vitest'
import { classifyTap } from './tap'

describe('classifyTap（Issue #29）', () => {
  it('初回タップは選択', () => {
    expect(classifyTap(null, '2026-11-07', 1000)).toBe('select')
  })

  it('同じ日を300ms以内に再タップしたら open', () => {
    expect(classifyTap({ date: '2026-11-07', at: 1000 }, '2026-11-07', 1250)).toBe('open')
    expect(classifyTap({ date: '2026-11-07', at: 1000 }, '2026-11-07', 1300)).toBe('open')
  })

  it('間隔が空いたら選択に戻る', () => {
    expect(classifyTap({ date: '2026-11-07', at: 1000 }, '2026-11-07', 1301)).toBe('select')
  })

  it('違う日なら速くても選択', () => {
    expect(classifyTap({ date: '2026-11-07', at: 1000 }, '2026-11-08', 1100)).toBe('select')
  })

  it('時刻が巻き戻った場合は選択（異常系）', () => {
    expect(classifyTap({ date: '2026-11-07', at: 1000 }, '2026-11-07', 900)).toBe('select')
  })

  it('しきい値は変更できる', () => {
    expect(classifyTap({ date: '2026-11-07', at: 1000 }, '2026-11-07', 1400, 500)).toBe('open')
  })
})
