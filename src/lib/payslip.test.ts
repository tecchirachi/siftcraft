import { describe, expect, it } from 'vitest'
import { calculatePay } from './pay'
import { buildPayslip, formatMinutesJP, formatPayslipText, payslipPeriodFor } from './payslip'

/** テスト用のシフト明細を作る（時給1000円・交通費は引数で） */
function entry(date: string, start: string, end: string, breakMinutes = 0, transport = 0) {
return {
date,
breakdown: calculatePay(
{ date, start, end, breakMinutes },
{ hourlyWage: 1000, transportPerShift: transport },
),
}
}

describe('明細の対象期間（payslipPeriodFor）', () => {
it('締め日31日（月末）なら暦月そのもの、給料日は翌月', () => {
const p = payslipPeriodFor('2026-11', 31, 25)
expect(p.start).toBe('2026-11-01')
expect(p.end).toBe('2026-11-30')
expect(p.payDate).toBe('2026-12-25')
})
it('締め日15日なら前月16日〜当月15日', () => {
const p = payslipPeriodFor('2026-11', 15, 10)
expect(p.start).toBe('2026-10-16')
expect(p.end).toBe('2026-11-15')
expect(p.payDate).toBe('2026-12-10')
})
})

describe('明細の集計（buildPayslip）', () => {
const period = payslipPeriodFor('2026-11', 31, 25) // 2026-11-01〜11-30
it('期間内のシフトだけを合計し、内訳が合う', () => {
const slip = buildPayslip(period, [
entry('2026-11-10', '09:00', '18:00', 60, 200), // 実働8h・基本給8000・交通費200
entry('2026-11-11', '17:00', '23:00', 0, 0), // 実働6h・深夜1h→基本給6000・深夜手当250
entry('2026-10-31', '09:00', '18:00', 60, 200), // 期間外は数えない
])
expect(slip.workDays).toBe(2)
expect(slip.shiftCount).toBe(2)
expect(slip.workMinutes).toBe(840)
expect(slip.lateNightMinutes).toBe(60)
expect(slip.basePay).toBe(14000)
expect(slip.lateNightPay).toBe(250)
expect(slip.transportPay).toBe(200)
expect(slip.totalPay).toBe(14450)
// 明細の鉄則: 内訳の合計 = 支給合計
expect(slip.basePay + slip.overtimePay + slip.lateNightPay + slip.transportPay).toBe(slip.totalPay)
})
it('残業×深夜の重なりは +50% が両方の手当に分かれて入る', () => {
const slip = buildPayslip(period, [entry('2026-11-12', '14:00', '24:00', 0, 0)])
// 実働10h: 14〜22時が通常8h、22〜24時が残業×深夜2h
expect(slip.overlapMinutes).toBe(120)
expect(slip.overtimePay).toBe(500) // 2h × 1000 × 25%
expect(slip.lateNightPay).toBe(500)
expect(slip.totalPay).toBe(11000) // 基本給10000 + 500 + 500
})
it('同じ日の2件は勤務日数1日として数える', () => {
const slip = buildPayslip(period, [
entry('2026-11-10', '09:00', '12:00'),
entry('2026-11-10', '17:00', '21:00'),
])
expect(slip.workDays).toBe(1)
expect(slip.shiftCount).toBe(2)
})
})

describe('テキスト整形（formatPayslipText）', () => {
const period = payslipPeriodFor('2026-11', 31, 25)
const slip = buildPayslip(period, [entry('2026-11-10', '09:00', '18:00', 60, 200)])
it('明細の体裁で、期間・給料日・内訳・合計が入る', () => {
const text = formatPayslipText('塾', 1000, slip)
expect(text).toContain('給与明細（見込み）')
expect(text).toContain('【勤務サマリー】')
expect(text).toContain('【支給内訳】')
expect(text).toContain('対象期間：2026年11月1日 〜 2026年11月30日')
expect(text).toContain('給料日：2026年12月25日')
expect(text).toContain('基本給：8,000円')
expect(text).toContain('交通費：200円')
expect(text).toContain('支給見込み合計：8,200円')
expect(text).not.toContain('実際の支給額')
})
it('実績があれば実績と差額も併記する', () => {
const text = formatPayslipText('塾', 1000, slip, 8000)
expect(text).toContain('実際の支給額：8,000円')
expect(text).toContain('差額：−200円')
const matched = formatPayslipText('塾', 1000, slip, 8200)
expect(matched).toContain('差額なし（一致）')
})
it('割増率はバイト先の設定が表示に反映される（Issue #47）', () => {
const text = formatPayslipText('塾', 1000, slip, null, { overtimeRatePct: 30, lateNightRatePct: 20 })
expect(text).toContain('残業手当（+30%）')
expect(text).toContain('深夜手当（+20%）')
expect(text).toContain('重なり時間は +50% です')
})
it('時間の整形', () => {
expect(formatMinutesJP(0)).toBe('0分')
expect(formatMinutesJP(45)).toBe('45分')
expect(formatMinutesJP(120)).toBe('2時間')
expect(formatMinutesJP(150)).toBe('2時間30分')
})
})
