/**
* 重なり判定のテスト
*/
import { describe, it, expect} from 'vitest'
import { shiftsOverlap, findOverlaps} from './overlap'

const s = (date: string, start: string, end: string) => ({ date, start, end, breakMinutes: 0})

describe('shiftsOverlap', () => {
it('同じ日に時間が重なれば true', () => {
expect(shiftsOverlap(s('2026-11-02', '09:00', '17:00'), s('2026-11-02', '13:00', '21:00'))).toBe(true)
})

it('完全に内側に含まれていても true', () => {
expect(shiftsOverlap(s('2026-11-02', '09:00', '21:00'), s('2026-11-02', '12:00', '15:00'))).toBe(true)
})

it('ぴったり隣り合う（終了=開始）なら重なりではない', () => {
expect(shiftsOverlap(s('2026-11-02', '09:00', '13:00'), s('2026-11-02', '13:00', '17:00'))).toBe(false)
})

it('別の日なら重ならない', () => {
expect(shiftsOverlap(s('2026-11-02', '09:00', '17:00'), s('2026-11-03', '09:00', '17:00'))).toBe(false)
})

it('日をまたぐシフトが翌日の早朝シフトに食い込めば true', () => {
// 22:00-翌2:00 と、翌日 01:00-05:00 は 01:00-02:00 が重なる
expect(shiftsOverlap(s('2026-11-02', '22:00', '02:00'), s('2026-11-03', '01:00', '05:00'))).toBe(true)
// 翌日 03:00 開始なら重ならない
expect(shiftsOverlap(s('2026-11-02', '22:00', '02:00'), s('2026-11-03', '03:00', '05:00'))).toBe(false)
})
})

describe('findOverlaps', () => {
it('重なるものだけが返る', () => {
const existing = [s('2026-11-02', '09:00', '12:00'), s('2026-11-02', '18:00', '21:00')]
const hits = findOverlaps(s('2026-11-02', '11:00', '13:00'), existing)
expect(hits).toHaveLength(1)
expect(hits[0].start).toBe('09:00')
})
})
