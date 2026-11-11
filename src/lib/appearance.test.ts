import { describe, expect, it } from 'vitest'
import { DARK_OVERRIDES, isDarkEffective, parseAppearance } from './appearance'

describe('appearance（Issue #30）', () => {
  it('保存値のパース: light/dark 以外は auto', () => {
    expect(parseAppearance('light')).toBe('light')
    expect(parseAppearance('dark')).toBe('dark')
    expect(parseAppearance('auto')).toBe('auto')
    expect(parseAppearance('壊れた値')).toBe('auto')
    expect(parseAppearance(null)).toBe('auto')
    expect(parseAppearance(undefined)).toBe('auto')
  })

  it('実効ダーク判定: dark は常時、auto は端末設定しだい、light は常時オフ', () => {
    expect(isDarkEffective('dark', false)).toBe(true)
    expect(isDarkEffective('dark', true)).toBe(true)
    expect(isDarkEffective('auto', true)).toBe(true)
    expect(isDarkEffective('auto', false)).toBe(false)
    expect(isDarkEffective('light', true)).toBe(false)
  })

  it('ダーク上書きは面と文字の基本色を持ち、コンテナは color-mix で生成する', () => {
    expect(DARK_OVERRIDES['--bg']).toBe('#1d1712')
    expect(DARK_OVERRIDES['--text']).toBe('#f6ead9')
    expect(DARK_OVERRIDES['--primary-container']).toContain('color-mix')
    expect(DARK_OVERRIDES['--secondary-container']).toContain('var(--brand2)')
  })
})
