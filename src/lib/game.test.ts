/**
* レベル・ポイントのテスト
*/
import { describe, it, expect} from 'vitest'
import { BG_PATTERNS, levelOf, pointsBalance, pointsEarnedOf, THEMES, titleForLevel, unlockBlockReason, xpForLevel, xpOf} from './game'

describe('xp とレベル', () => {
it('XPは 実働1時間=10、1シフト=15 で計算する', () => {
expect(xpOf({ totalWorkMinutes: 480, totalShifts: 2})).toBe(80 + 30)
})
it('必要XPはレベルごとに広がる', () => {
expect(xpForLevel(1)).toBe(0)
expect(xpForLevel(2)).toBe(100)
expect(xpForLevel(3)).toBe(300)
expect(xpForLevel(4)).toBe(600)
})
it('XPからレベルと進捗を求める', () => {
// 10時間(100XP) + 0件 = 100XP → ちょうど Lv2、進捗0%
const info = levelOf({ totalWorkMinutes: 600, totalShifts: 0})
expect(info.level).toBe(2)
expect(info.progressPercent).toBe(0)
// 20時間(200XP)+... 250XP相当: 15時間(150) + 100/15は割り切れないので 21時間=210+... 代わりに分で調整
const mid = levelOf({ totalWorkMinutes: 1200, totalShifts: 2}) // 200+30=230XP
expect(mid.level).toBe(2)
expect(mid.progressPercent).toBe(65) // (230-100)/(300-100)=65%
})
it('称号はレベルで変わる', () => {
expect(titleForLevel(1)).toBe('バイト見習い1')
expect(titleForLevel(3)).toBe('バイト見習い3')
expect(titleForLevel(4)).toBe('バイトかけだし1')
expect(titleForLevel(10)).toBe('頼れるバイト1')
expect(titleForLevel(19)).toBe('バイト職人1')
    expect(titleForLevel(22)).toBe('バイト番長1')
    expect(titleForLevel(25)).toBe('伝説のバイト1')
expect(titleForLevel(31)).toBe('伝説のバイト7')
})
})

describe('ポイント', () => {
it('獲得は 実働1時間=5P、1シフト=10P', () => {
expect(pointsEarnedOf({ totalWorkMinutes: 600, totalShifts: 3})).toBe(50 + 30)
})
it('残高は獲得から解放済みテーマの価格を引いたもの', () => {
const stats = { totalWorkMinutes: 6000, totalShifts: 10} // 500+100=600P
expect(pointsBalance(stats, [])).toBe(600)
expect(pointsBalance(stats, ['mint'])).toBe(550)
expect(pointsBalance(stats, ['mint', 'soda'])).toBe(430)
})
it('残高は解放済みパターンの価格も引く（Issue #44）', () => {
const stats = { totalWorkMinutes: 6000, totalShifts: 10} // 600P
expect(pointsBalance(stats, [], ['dots'])).toBe(450)
expect(pointsBalance(stats, ['mint'], ['dots', 'check'])).toBe(50)
expect(pointsBalance(stats, [], ['none'])).toBe(600)
})
})

describe('解放のレベル条件（Issue #45）', () => {
it('レベルが足りなければポイントがあっても買えない', () => {
expect(unlockBlockReason({ minLevel: 4, cost: 120 }, 3, 9999)).toBe('level')
expect(unlockBlockReason({ minLevel: 4, cost: 120 }, 4, 100)).toBe('points')
expect(unlockBlockReason({ minLevel: 4, cost: 120 }, 4, 120)).toBeNull()
expect(unlockBlockReason({ minLevel: 1, cost: 0 }, 1, 0)).toBeNull()
})
it('テーマとパターンの必要レベルは価格順に上がっていく', () => {
const ts = THEMES.map((t) => t.minLevel)
expect(ts).toEqual([...ts].sort((a, b) => a - b))
expect(THEMES[0].minLevel).toBe(1)
const ps = BG_PATTERNS.map((p) => p.minLevel)
expect(ps).toEqual([...ps].sort((a, b) => a - b))
})
})
