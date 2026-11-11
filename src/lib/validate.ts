/**
* 入力バリデーション(Issue #5)
*
* 役割: シフト入力が「計算できる形」かどうかを事前にチェックし、
* 問題があれば日本語のエラーメッセージ一覧を返す純粋関数。
* エラーがなければ空配列 [] が返る、という約束にすると
* 呼び出し側は `errors.length > 0` だけで判定できてシンプル。
*
* なぜ必要か:
* - 画面の入力は信用しない（空・負の数・あり得ない休憩など来うる）
* - pay.ts の計算は「正しい入力が来る前提」でシンプルに保ち、
* 入口で弾く責任はここが持つ、という役割分担
*/
import type { ShiftInput} from './pay'

/** "HH:mm" を分に直す（pay.ts の toMinutes と同じ考え方） */
function toMinutes(hhmm: string): number {
const [h, m] = hhmm.split(':').map(Number)
return h * 60 + m
}

/** 勤務の長さ（分）。日をまたぐ場合は翌日として計算する */
export function shiftSpanMinutes(shift: ShiftInput): number {
const start = toMinutes(shift.start)
let end = toMinutes(shift.end)
if (end <= start) end += 24 * 60
return end - start
}

export function validateShift(shift: ShiftInput): string[] {
const errors: string[] = []

// 日付: HTMLの date 入力は YYYY-MM-DD を返す前提で、形式を軽く確認する
if (!shift.date ||!/^\d{4}-\d{2}-\d{2}$/.test(shift.date)) {
errors.push('日付を入力してください')
}
if (!shift.start) errors.push('開始時刻を入力してください')
if (!shift.end) errors.push('終了時刻を入力してください')

// 休憩: 負の数はあり得ない
if (Number.isNaN(shift.breakMinutes) || shift.breakMinutes < 0) {
errors.push('休憩は0分以上で入力してください')
}

// 時刻が揃っている場合だけ、勤務時間と休憩の関係をチェックする
if (shift.start && shift.end) {
const span = shiftSpanMinutes(shift)
if (span <= 0) {
errors.push('勤務時間が0分以下になっています')
} else if (shift.breakMinutes >= span) {
errors.push('休憩が勤務時間以上になっています')
}
}

return errors
}
