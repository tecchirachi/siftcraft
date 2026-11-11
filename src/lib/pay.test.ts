/**
* ============================================================
* 給料計算の自動テスト
* ============================================================
* テストの役割:
* 「この入力なら、答えはこうなるはず」という期待値を書いておき、
* `npm test` でプログラムが期待通りに動くかを自動で確かめる。
* 給料計算のように「間違えると困るロジック」では特に重要で、
* 後からコードを直したときに計算が壊れていないかも守ってくれる。
*
* 読み方:
* describe(...) … テストのグループ（対象の名前）
* it('...',...) … 1件のテスト。「…であること」という文章で書く
* expect(実際の値).toBe(期待値) … 一致しなければテスト失敗になる
*/

import { describe, it, expect} from 'vitest'
import { calculatePay} from './pay'

// 全テスト共通の設定（時給1200円、交通費500円）
// 先に固定しておくと、各テストの期待値が手計算しやすい
const settings = { hourlyWage: 1200, transportPerShift: 500}

describe('calculatePay', () => {
it('通常シフト: 9:00-17:00 休憩60分 = 実働7時間、割増なし', () => {
const r = calculatePay({ date: '2026-11-02', start: '09:00', end: '17:00', breakMinutes: 60}, settings)
expect(r.workMinutes).toBe(420) // 8時間 - 休憩1時間 = 7時間 = 420分
expect(r.overtimeMinutes).toBe(0)
expect(r.lateNightMinutes).toBe(0)
expect(r.totalPay).toBe(1200 * 7 + 500) // 時給×7時間 + 交通費
})

it('残業: 9:00-20:00 休憩60分 = 実働10時間、残業2時間は+25%', () => {
const r = calculatePay({ date: '2026-11-02', start: '09:00', end: '20:00', breakMinutes: 60}, settings)
expect(r.workMinutes).toBe(600)
expect(r.overtimeMinutes).toBe(120) // 10時間 - 8時間 = 残業2時間
// 全体 1200*10 + 割増の追加分（1200の25% × 2時間 = 600）+ 交通費
expect(r.totalPay).toBe(12000 + 600 + 500)
})

it('深夜: 18:00-23:00 休憩なし = 深夜1時間は+25%', () => {
const r = calculatePay({ date: '2026-11-02', start: '18:00', end: '23:00', breakMinutes: 0}, settings)
expect(r.lateNightMinutes).toBe(60) // 22:00-23:00 の1時間だけが深夜帯
expect(r.totalPay).toBe(1200 * 5 + 1200 * 0.25 * 1 + 500)
})

it('日をまたぐ: 22:00-翌2:00 は全て深夜帯', () => {
// 終了（02:00）が開始（22:00）より小さいので「翌日」として計算されるケース
const r = calculatePay({ date: '2026-11-02', start: '22:00', end: '02:00', breakMinutes: 0}, settings)
expect(r.workMinutes).toBe(240)
expect(r.lateNightMinutes).toBe(240)
expect(r.totalPay).toBe(1200 * 4 + 1200 * 0.25 * 4 + 500)
})

it('残業かつ深夜は割増が重なる (+50%)', () => {
// 14:00-24:00 休憩なし = 実働10時間。
// 実働8時間を超えるのは22:00以降で、その時間帯はちょうど深夜帯と重なる
const r = calculatePay({ date: '2026-11-02', start: '14:00', end: '00:00', breakMinutes: 0}, settings)
expect(r.workMinutes).toBe(600)
expect(r.overtimeLateNightMinutes).toBe(120)
// 全体 1200*10 + 残業追加分600 + 深夜追加分600 + 交通費500
expect(r.totalPay).toBe(13700)
})

it('休憩が勤務時間より長い場合は実働0として扱う', () => {
// 変な入力でもマイナスの時間や金額にならないことを確認する「境界ケース」
const r = calculatePay({ date: '2026-11-02', start: '09:00', end: '10:00', breakMinutes: 120}, settings)
expect(r.workMinutes).toBe(0)
expect(r.totalPay).toBe(500) // 交通費のみ
})
})
