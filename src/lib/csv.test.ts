/**
* CSVエクスポートのテスト
*/
import { describe, it, expect} from 'vitest'
import { shiftsToCsv, type CsvEntry} from './csv'
import { calculatePay} from './pay'

function entry(date: string, start: string, end: string, breakMinutes: number): CsvEntry {
const shift = { date, start, end, breakMinutes}
return { shift, pay: calculatePay(shift, { hourlyWage: 1200, transportPerShift: 500})}
}

describe('shiftsToCsv', () => {
it('ヘッダーとデータ行が出力される', () => {
const csv = shiftsToCsv([entry('2026-11-02', '09:00', '17:00', 60)])
const lines = csv.replace('\uFEFF', '').split('\r\n')
expect(lines[0]).toContain('日付')
// 9-17時 休憩60分: 実働420分、金額 1200*7+500=8900
expect(lines[1]).toBe('2026-11-02,,09:00,17:00,60,420,0,0,8900')
})

it('空データならヘッダーのみ', () => {
const csv = shiftsToCsv([])
expect(csv.replace('\uFEFF', '').split('\r\n')).toHaveLength(1)
})

it('複数行を改行でつなぐ', () => {
const csv = shiftsToCsv([
entry('2026-11-02', '09:00', '17:00', 60),
entry('2026-11-03', '18:00', '23:00', 0),
])
expect(csv.split('\r\n')).toHaveLength(3)
})
})
