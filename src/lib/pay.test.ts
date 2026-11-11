import { describe, it, expect } from 'vitest'
import { calculatePay } from './pay'

const settings = { hourlyWage: 1200, transportPerShift: 500 }

describe('calculatePay', () => {
  it('通常シフト: 9:00-17:00 休憩60分 = 実働7時間、割増なし', () => {
    const r = calculatePay({ date: '2026-11-02', start: '09:00', end: '17:00', breakMinutes: 60 }, settings)
    expect(r.workMinutes).toBe(420)
    expect(r.overtimeMinutes).toBe(0)
    expect(r.lateNightMinutes).toBe(0)
    // 1200 * 7 + 交通費500
    expect(r.totalPay).toBe(1200 * 7 + 500)
  })

  it('残業: 9:00-20:00 休憩60分 = 実働10時間、残業2時間は+25%', () => {
    const r = calculatePay({ date: '2026-11-02', start: '09:00', end: '20:00', breakMinutes: 60 }, settings)
    expect(r.workMinutes).toBe(600)
    expect(r.overtimeMinutes).toBe(120)
    // 通常 1200*10 + 残業割増 1200*0.25*2 + 500
    expect(r.totalPay).toBe(12000 + 600 + 500)
  })

  it('深夜: 18:00-23:00 休憩なし = 深夜1時間は+25%', () => {
    const r = calculatePay({ date: '2026-11-02', start: '18:00', end: '23:00', breakMinutes: 0 }, settings)
    expect(r.lateNightMinutes).toBe(60)
    expect(r.totalPay).toBe(1200 * 5 + 1200 * 0.25 * 1 + 500)
  })

  it('日をまたぐ: 22:00-翌2:00 は全て深夜帯', () => {
    const r = calculatePay({ date: '2026-11-02', start: '22:00', end: '02:00', breakMinutes: 0 }, settings)
    expect(r.workMinutes).toBe(240)
    expect(r.lateNightMinutes).toBe(240)
    expect(r.totalPay).toBe(1200 * 4 + 1200 * 0.25 * 4 + 500)
  })

  it('残業かつ深夜は割増が重なる (+50%)', () => {
    // 14:00-24:00 休憩なし = 実働10時間。22:00以降の2時間が深夜、うち実働8時間超は 22:00-24:00 の全て
    const r = calculatePay({ date: '2026-11-02', start: '14:00', end: '00:00', breakMinutes: 0 }, settings)
    expect(r.workMinutes).toBe(600)
    expect(r.overtimeLateNightMinutes).toBe(120)
    // 全体 1200*10 + 残業割増(2h*0.25) + 深夜割増(2h*0.25) + 500 = 12000+600+600+500
    expect(r.totalPay).toBe(13700)
  })

  it('休憩が勤務時間より長い場合は実働0として扱う', () => {
    const r = calculatePay({ date: '2026-11-02', start: '09:00', end: '10:00', breakMinutes: 120 }, settings)
    expect(r.workMinutes).toBe(0)
    expect(r.totalPay).toBe(500) // 交通費のみ
  })
})
