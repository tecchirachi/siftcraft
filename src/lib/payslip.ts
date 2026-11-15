/**
* 給与明細風の出力(Issue #46)
*
* 役割: バイト先ごと・支給期間ごとに、給料計算の内訳を
* 「給与明細」の形にまとめる純粋関数群。
*
* 既存の部品の再利用:
* - 金額と時間の内訳は pay.ts の calculatePay がシフト単位で出す
* （基本給=全実働分、残業手当・深夜手当は割増の追加分だけ）。
* ここではそれを期間分だけ合計する。
* - 対象期間と給料日は payperiod.ts の periodFor で求める。
* - 実績との差額判定は check.ts の comparePay を使う（表示側）。
*
* 注意（残業×深夜の重なり）:
* 重なった時間は「両率の合計%」（標準では +50%）だが、内訳としては
* 残業率分が残業手当に、深夜率分が深夜手当に分かれて入っている。
* だから明細の行は
* 基本給 + 残業手当 + 深夜手当 + 交通費 = 合計 がそのまま成り立つ。
* 重なり時間そのものは勤務サマリーに別途明示する。
* 割増率はバイト先ごとに違う（Issue #47）ため、表示にもその率を使う。
*/

import type { PayBreakdown} from './pay'
import { periodFor, type PayPeriod} from './payperiod'

/** 明細に集計する1シフト分（日付と、その計算結果） */
export interface PayslipShift {
date: string // "2026-11-10"
breakdown: PayBreakdown
}

export interface Payslip {
/** 対象期間と給料日 */
period: PayPeriod
/** 勤務日数（同じ日に2件あっても1日） */
workDays: number
shiftCount: number
workMinutes: number
regularMinutes: number
overtimeMinutes: number
lateNightMinutes: number
/** 残業かつ深夜の時間（+50%） */
overlapMinutes: number
basePay: number
overtimePay: number
lateNightPay: number
transportPay: number
totalPay: number
}

/**
* 「○年○月分」の明細の対象期間を返す。
* periodFor は「その日が属する期間」を返すので、月初の日を渡せば
* 締め日がその月に来る期間（例: 締め日15日なら前月16日〜当月15日）が得られる。
* 締め日31日（月末）なら暦月そのものになる。
*/
export function payslipPeriodFor(yearMonth: string, closingDay: number, payDay: number): PayPeriod {
return periodFor(`${yearMonth}-01`, closingDay, payDay)
}

/** 期間内のシフトだけを集計して明細を作る */
export function buildPayslip(period: PayPeriod, shifts: PayslipShift[]): Payslip {
const inPeriod = shifts.filter((s) => s.date >= period.start && s.date <= period.end)
const sum = (pick: (b: PayBreakdown) => number) =>
inPeriod.reduce((acc, s) => acc + pick(s.breakdown), 0)
return {
period,
workDays: new Set(inPeriod.map((s) => s.date)).size,
shiftCount: inPeriod.length,
workMinutes: sum((b) => b.workMinutes),
regularMinutes: sum((b) => b.regularMinutes),
overtimeMinutes: sum((b) => b.overtimeMinutes),
lateNightMinutes: sum((b) => b.lateNightMinutes),
overlapMinutes: sum((b) => b.overtimeLateNightMinutes),
basePay: sum((b) => b.basePay),
overtimePay: sum((b) => b.overtimePay),
lateNightPay: sum((b) => b.lateNightPay),
transportPay: sum((b) => b.transportPay),
totalPay: sum((b) => b.totalPay),
}
}

// ---- テキスト整形（書き出し用） ----

/** "2026-11-05" → "2026年11月5日" */
export function formatDateJP(iso: string): string {
const [y, m, d] = iso.split('-').map(Number)
return `${y}年${m}月${d}日`
}

/** 分 → "32時間15分"（0分なら "32時間"） */
export function formatMinutesJP(minutes: number): string {
const h = Math.floor(minutes / 60)
const m = minutes % 60
if (h === 0) return `${m}分`
return m === 0? `${h}時間`: `${h}時間${m}分`
}

function yen(n: number): string {
return `${n.toLocaleString('ja-JP')}円`
}

/**
* 明細をテキストにする。画面表示と同じ数字を使うので、
* 「画面で見た明細をそのまま送る・残す」ができる。
* actual（実際の支給額）があれば実績と差額も併記する。
*/
export function formatPayslipText(
workplaceName: string,
hourlyWage: number,
slip: Payslip,
actual?: number | null,
/** 表示用の割増率（Issue #47）。省略時は標準の各25% */
rates: { overtimeRatePct: number; lateNightRatePct: number } = {
overtimeRatePct: 25,
lateNightRatePct: 25,
},
): string {
const lines: string[] = [
'給与明細（見込み）',
'========================',
`バイト先：${workplaceName}`,
`対象期間：${formatDateJP(slip.period.start)} 〜 ${formatDateJP(slip.period.end)}`,
`給料日：${formatDateJP(slip.period.payDate)}`,
`時給：${yen(hourlyWage)}`,
'------------------------',
'【勤務サマリー】',
`勤務日数：${slip.workDays}日`,
`シフト数：${slip.shiftCount}件`,
`総実働時間：${formatMinutesJP(slip.workMinutes)}`,
`　うち残業：${formatMinutesJP(slip.overtimeMinutes + slip.overlapMinutes)}`,
`　うち深夜：${formatMinutesJP(slip.lateNightMinutes + slip.overlapMinutes)}`,
`　うち残業×深夜（+${rates.overtimeRatePct + rates.lateNightRatePct}%）：${formatMinutesJP(slip.overlapMinutes)}`,
'------------------------',
'【支給内訳】',
`基本給：${yen(slip.basePay)}`,
`残業手当（+${rates.overtimeRatePct}%）：${yen(slip.overtimePay)}`,
`深夜手当（+${rates.lateNightRatePct}%）：${yen(slip.lateNightPay)}`,
`交通費：${yen(slip.transportPay)}`,
'------------------------',
`支給見込み合計：${yen(slip.totalPay)}`,
]
if (actual!== null && actual!== undefined) {
const diff = actual - slip.totalPay
const diffText = diff === 0? '差額なし（一致）': `差額：${diff > 0? '＋': '−'}${yen(Math.abs(diff))}`
lines.push(`実際の支給額：${yen(actual)}`, diffText)
}
lines.push(
`※ 残業×深夜の重なり時間は +${rates.overtimeRatePct + rates.lateNightRatePct}% です（残業手当と深夜手当に分かれて含まれます）`,
'※ これは見込みの計算です。実際の明細と異なる場合があります',
)
return lines.join('\n')
}
