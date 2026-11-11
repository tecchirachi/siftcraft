import { describe, expect, it } from 'vitest'
import { tapAction } from './tap'

describe('tapAction（Issue #32）', () => {
  it('未選択の日をタップしたら選択', () => {
    expect(tapAction('2026-11-12', '2026-11-13')).toBe('select')
  })

  it('選択済みの日をタップしたら入力を開く', () => {
    expect(tapAction('2026-11-12', '2026-11-12')).toBe('open')
  })

  it('別の日 → その日、と押すと選択が移るだけで開かない', () => {
    const first = tapAction('2026-11-12', '2026-11-20')
    expect(first).toBe('select')
    // 選択が 20 日に移った状態でもう一度 20 日を押すと開く
    expect(tapAction('2026-11-20', '2026-11-20')).toBe('open')
  })
})
