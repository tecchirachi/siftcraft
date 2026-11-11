/**
* 支給期間計算のテスト
*/
import { describe, it, expect} from 'vitest'
import { periodFor} from './payperiod'
import { weeklyDates} from './repeat'
import { comparePay} from './check'

describe('periodFor', () => {
it('月末締め: 期間は1日〜月末、給料日は翌月の指定日', () => {
const p = periodFor('2026-11-10', 31, 25)
expect(p).toEqual({ start: '2026-11-01', end: '2026-11-30', payDate: '2026-12-25'})
})

it('15日締め: 締め日前は前月16日〜当月15日', () => {
const p = periodFor('2026-11-10', 15, 10)
expect(p).toEqual({ start: '2026-10-16', end: '2026-11-15', payDate: '2026-12-10'})
})

it('15日締め: 締め日を過ぎたら期間は当月16日〜翌月15日', () => {
const p = periodFor('2026-11-20', 15, 10)
expect(p).toEqual({ start: '2026-11-16', end: '2026-12-15', payDate: '2027-01-10'})
})

it('2月の月末締めは28日（2026年）に丸まる', () => {
const p = periodFor('2026-02-10', 31, 31)
expect(p.end).toBe('2026-02-28')
expect(p.payDate).toBe('2026-03-31')
})
})

describe('weeklyDates', () => {
it('7日ごとに進み、月をまたぐ', () => {
expect(weeklyDates('2026-11-28', 3)).toEqual(['2026-11-28', '2026-12-05', '2026-12-12'])
})

it('1回なら開始日だけ', () => {
expect(weeklyDates('2026-11-07', 1)).toEqual(['2026-11-07'])
})
})

describe('comparePay', () => {
it('未入力は unset', () => {
expect(comparePay(10000, undefined)).toEqual({ status: 'unset', diff: null})
})
it('一致・多い・少ないを判定する', () => {
expect(comparePay(10000, 10000).status).toBe('match')
expect(comparePay(10000, 10500)).toEqual({ status: 'over', diff: 500})
expect(comparePay(10000, 9800)).toEqual({ status: 'under', diff: -200})
})
})
