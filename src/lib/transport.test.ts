/**
* 交通費解決のテスト
*/
import { describe, it, expect} from 'vitest'
import { transportPerShiftOf, resolveTransport} from './transport'

describe('transportPerShiftOf', () => {
it('未設定は従来の固定額として扱う（既存データ互換）', () => {
expect(transportPerShiftOf({ transportPerShift: 400})).toBe(400)
})
it('none と pass は 0', () => {
expect(transportPerShiftOf({ transportMode: 'none', transportPerShift: 400})).toBe(0)
expect(transportPerShiftOf({ transportMode: 'pass', transportPerShift: 400})).toBe(0)
})
it('roundTrip は片道×2', () => {
expect(transportPerShiftOf({ transportMode: 'roundTrip', transportPerShift: 0, transportOneWay: 240})).toBe(480)
})
})

describe('resolveTransport', () => {
it('上書きがあれば優先、なければ方式から解決', () => {
const s = { transportMode: 'roundTrip' as const, transportPerShift: 0, transportOneWay: 240}
expect(resolveTransport(s, 200)).toBe(200)
expect(resolveTransport(s, undefined)).toBe(480)
// 0 への上書き（その日は支給なし）も有効
expect(resolveTransport(s, 0)).toBe(0)
})
})
