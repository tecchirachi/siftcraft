/**
* 入力候補ロジックのテスト
*/
import { describe, it, expect} from 'vitest'
import { frequentPatterns, uniqueSuggestions} from './suggest'
import type { StoredShift } from './suggest'

const sh = (id: string, workplaceId: string | undefined, start: string, end: string, breakMinutes = 0): StoredShift => ({
id,
workplaceId,
date: '2026-11-01',
start,
end,
breakMinutes,
})
const resolve = (s: StoredShift) => s.workplaceId?? 'default'

describe('frequentPatterns', () => {
const shifts = [
sh('1', 'a', '17:00', '21:00'),
sh('2', 'a', '09:00', '13:00'),
sh('3', 'a', '17:00', '21:00'),
sh('4', 'b', '10:00', '15:00'),
sh('5', undefined, '08:00', '12:00'), // 解決すると default 行き
]

it('対象のバイト先だけを集計し、頻度順に返す', () => {
const out = frequentPatterns(shifts, 'a', resolve)
expect(out).toEqual([
{ start: '17:00', end: '21:00', breakMinutes: 0},
{ start: '09:00', end: '13:00', breakMinutes: 0},
])
})

it('未設定のシフトは解決先のバイト先に数えられる', () => {
const out = frequentPatterns(shifts, 'default', resolve)
expect(out).toEqual([{ start: '08:00', end: '12:00', breakMinutes: 0}])
})

it('limit で件数を絞れる', () => {
expect(frequentPatterns(shifts, 'a', resolve, 1)).toHaveLength(1)
})
})

describe('uniqueSuggestions', () => {
it('重複と空文字を取り除く', () => {
expect(uniqueSuggestions(['駅前', ' 駅前 ', '', undefined, '本店'])).toEqual(['駅前', '本店'])
})
})
