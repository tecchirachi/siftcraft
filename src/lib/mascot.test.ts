/**
* マスコット育成ロジックのテスト
*/
import { describe, it, expect} from 'vitest'
import { mascotForProgress} from './mascot'

describe('mascotForProgress', () => {
it('0% はレベル1（たね）', () => {
const m = mascotForProgress(0)
expect(m.level).toBe(1)
expect(m.stageName).toBe('たね')
})

it('25% でレベル2、50% でレベル3、75% でレベル4', () => {
expect(mascotForProgress(25).level).toBe(2)
expect(mascotForProgress(50).level).toBe(3)
expect(mascotForProgress(75).level).toBe(4)
})

it('境目の手前は前の段階のまま', () => {
expect(mascotForProgress(24).level).toBe(1)
expect(mascotForProgress(99).level).toBe(4)
})

it('100% で満開（レベル5）', () => {
const m = mascotForProgress(100)
expect(m.level).toBe(5)
expect(m.stageName).toBe('まんかい')
})

it('どの段階でも一言が返る', () => {
for (const p of [0, 30, 55, 80, 100]) {
expect(mascotForProgress(p).message.length).toBeGreaterThan(0)
}
})
})
