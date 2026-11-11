/**
* バリデーションのテスト
*/
import { describe, it, expect} from 'vitest'
import { validateShift, shiftSpanMinutes} from './validate'

const valid = { date: '2026-11-02', start: '09:00', end: '17:00', breakMinutes: 60}

describe('validateShift', () => {
it('正しい入力ならエラーなし（空配列）', () => {
expect(validateShift(valid)).toEqual([])
})

it('日付が空だとエラー', () => {
expect(validateShift({...valid, date: ''})).toContain('日付を入力してください')
})

it('休憩が負だとエラー', () => {
expect(validateShift({...valid, breakMinutes: -10})).toContain('休憩は0分以上で入力してください')
})

it('休憩が勤務時間以上だとエラー', () => {
// 9:00-10:00（60分勤務）に休憩60分は成立しない
expect(validateShift({...valid, end: '10:00', breakMinutes: 60})).toContain('休憩が勤務時間以上になっています')
})

it('日をまたぐシフトは翌日として判定する', () => {
// 22:00-02:00 は240分勤務。休憩60分はOK、240分はエラー
const night = { date: '2026-11-02', start: '22:00', end: '02:00', breakMinutes: 60}
expect(shiftSpanMinutes(night)).toBe(240)
expect(validateShift(night)).toEqual([])
expect(validateShift({...night, breakMinutes: 240})).toContain('休憩が勤務時間以上になっています')
})

it('複数の問題はまとめて返る', () => {
expect(validateShift({ date: '', start: '', end: '', breakMinutes: -1}).length).toBeGreaterThanOrEqual(3)
})
})
