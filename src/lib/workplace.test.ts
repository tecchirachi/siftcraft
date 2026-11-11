/**
* バイト先ロジックのテスト
*/
import { describe, it, expect} from 'vitest'
import { migrateWorkplaces, resolveWorkplace, summarizeByWorkplace, workplaceColor, WORKPLACE_COLORS, type Workplace } from './workplace'

const legacy = { hourlyWage: 1200, transportPerShift: 500}
const wps: Workplace[] = [
{ id: 'a', name: '塾講師', hourlyWage: 1500, transportPerShift: 0},
{ id: 'b', name: 'カフェ', hourlyWage: 1100, transportPerShift: 400},
]

describe('migrateWorkplaces', () => {
it('保存が無ければ旧設定からデフォルトのバイト先を作る', () => {
const result = migrateWorkplaces(null, legacy)
expect(result).toHaveLength(1)
expect(result[0].hourlyWage).toBe(1200)
expect(result[0].transportPerShift).toBe(500)
})

it('保存があればそのまま使う（上書きしない）', () => {
expect(migrateWorkplaces(wps, legacy)).toEqual(wps)
})

it('保存が空配列でも旧設定から作り直す', () => {
expect(migrateWorkplaces([], legacy)[0].hourlyWage).toBe(1200)
})
})

describe('resolveWorkplace', () => {
it('IDが一致すればそのバイト先', () => {
expect(resolveWorkplace(wps, 'b').name).toBe('カフェ')
})

it('IDが無い・見つからない場合は先頭にフォールバック', () => {
expect(resolveWorkplace(wps, undefined).id).toBe('a')
expect(resolveWorkplace(wps, 'deleted-id').id).toBe('a')
})
})

describe('summarizeByWorkplace', () => {
it('バイト先ごとに合計・件数が出て、金額順に並ぶ', () => {
const totals = summarizeByWorkplace(
[
{ workplaceId: 'a', totalPay: 6000, workMinutes: 240},
{ workplaceId: 'b', totalPay: 5000, workMinutes: 270},
{ workplaceId: 'a', totalPay: 6000, workMinutes: 240},
],
wps,
)
expect(totals[0].workplace.name).toBe('塾講師')
expect(totals[0].totalPay).toBe(12000)
expect(totals[0].count).toBe(2)
expect(totals[1].totalPay).toBe(5000)
})

it('workplaceIdが無い行はデフォルト（先頭）に集まる', () => {
const totals = summarizeByWorkplace([{ totalPay: 1000, workMinutes: 60}], wps)
expect(totals[0].workplace.id).toBe('a')
})
})

describe('workplaceColor', () => {
  it('並び順で色が決まり、同じバイト先はいつも同じ色', () => {
    expect(workplaceColor(wps, 'a')).toBe(WORKPLACE_COLORS[0])
    expect(workplaceColor(wps, 'b')).toBe(WORKPLACE_COLORS[1])
    expect(workplaceColor(wps, 'a')).toBe(workplaceColor(wps, 'a'))
  })

  it('見つからないIDは先頭の色にフォールバック', () => {
    expect(workplaceColor(wps, 'nope')).toBe(WORKPLACE_COLORS[0])
  })
})
