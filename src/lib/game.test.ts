/**
* レベル・ポイントのテスト
*/
import { describe, it, expect} from 'vitest'
import { levelOf, pointsBalance, pointsEarnedOf, titleForLevel, xpForLevel, xpOf} from './game'

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
expect(titleForLevel(1)).toBe('バイト見習い')
expect(titleForLevel(4)).toBe('頼れるバイト')
expect(titleForLevel(10)).toBe('伝説のバイト')
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
})
