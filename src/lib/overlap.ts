/**
* シフトの時間重なり判定(Issue #9)
*
* 役割: 2つのシフトの時間帯が重なっているかを判定する純粋関数。
* ダブルブッキング（同じ時刻に2つのバイトが入っている）に
* 気づけるようにするためのもの。
*
* 考え方:
* - 各シフトを「絶対分」の区間 [開始, 終了) に変換する
* 絶対分 = （日付の通算日数 × 1440）+ 開始時刻の分
* こうすると日をまたぐシフトも、翌日のシフトとの比較も一発でできる
* - 終了 <= 開始 のシフトは翌日終了として +1440 する（pay.ts と同じ扱い）
* - 区間の重なり判定は a.開始 < b.終了 かつ b.開始 < a.終了。
* ぴったり隣り合う場合（a.終了 = b.開始）は重なりに含めない
*/
import type { ShiftInput} from './pay'

function toMinutes(hhmm: string): number {
const [h, m] = hhmm.split(':').map(Number)
return h * 60 + m
}

/** 日付文字列を「1970-01-01 から何日目か」に変換する（UTC基準で時差の影響を受けない） */
function dayNumber(date: string): number {
const [y, m, d] = date.split('-').map(Number)
return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/** シフトを絶対分の区間に変換する */
export function toInterval(shift: ShiftInput): { start: number; end: number} {
const base = dayNumber(shift.date) * 1440
const start = base + toMinutes(shift.start)
let end = base + toMinutes(shift.end)
if (end <= start) end += 1440 // 日をまたぐシフト
return { start, end}
}

/** 2つのシフトが時間的に重なっていれば true */
export function shiftsOverlap(a: ShiftInput, b: ShiftInput): boolean {
const ia = toInterval(a)
const ib = toInterval(b)
return ia.start < ib.end && ib.start < ia.end
}

/** 既存シフト一覧の中から、対象と重なるものだけを返す */
export function findOverlaps<T extends ShiftInput>(target: ShiftInput, existing: T[]): T[] {
return existing.filter((s) => shiftsOverlap(target, s))
}
