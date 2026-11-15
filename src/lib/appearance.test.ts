import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DARK_OVERRIDES, isDarkEffective, parseAppearance } from './appearance'

/** 2色のコントラスト比（WCAG の相対輝度から計算する） */
function contrastRatio(hexA: string, hexB: string): number {
  const luminance = (hex: string): number => {
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = parseInt(hex.slice(1 + i, 3 + i), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

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

describe('App.css の文字色の継承（Issue #49）', () => {
  const css = readFileSync(new URL('../App.css', import.meta.url), 'utf-8')

  it('.app が color: var(--text) を持ち、継承の起点になっている', () => {
    // アプリ名（h1）や年月（h2）のように color を持たない要素は親から
    // 色を継承する。起点が body のままだとライト用の濃茶で固定され、
    // ダーク上書きが効かない（Issue #49 の根本原因）ため、.app 側で
    // 起点を作っていることを固定する
    const appBlock = css.match(/\.app\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(appBlock).toContain('color: var(--text)')
  })

  it('ダークの --text はダーク面に対して十分読める（ライト用の濃茶は読めない）', () => {
    const darkSurfaces = [DARK_OVERRIDES['--bg'], DARK_OVERRIDES['--surface'], DARK_OVERRIDES['--surface-container']]
    for (const surface of darkSurfaces) {
      expect(contrastRatio(DARK_OVERRIDES['--text'], surface)).toBeGreaterThanOrEqual(7)
      // 継承が body 止まりだったときの値（:root の --text = #3e342a）は
      // どのダーク面でも 2:1 未満で、ほぼ読めないことの確認
      expect(contrastRatio('#3e342a', surface)).toBeLessThan(2)
    }
  })
})
