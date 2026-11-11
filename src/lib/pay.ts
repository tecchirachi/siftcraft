/**
 * 給料計算ロジック（UIから分離し、単体テストで正確さを担保する）
 *
 * 計算ルール（日本の一般的な割増ルールに沿った簡易モデル）:
 * - 実働時間 = (終了 - 開始) - 休憩。終了が開始以前なら翌日扱い（深夜シフト対応）
 * - 通常分: 実働のうち8時間まで、かつ深夜帯(22:00-翌5:00)以外
 * - 残業割増: 実働8時間超の分は +25%
 * - 深夜割増: 深夜帯にかかる分は +25%（残業かつ深夜なら +50% で重なる）
 * - 金額は分単位で按分し、最終金額は円未満を切り捨て
 * 注意: 実際の給与規定は勤務先ごとに異なるため、設定で時給・交通費を変更できる前提の目安計算。
 */

export interface ShiftInput {
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  start: string
  /** HH:mm （開始より小さい場合は翌日とみなす） */
  end: string
  /** 休憩（分） */
  breakMinutes: number
}

export interface PaySettings {
  hourlyWage: number
  /** 1勤務あたりの交通費（円） */
  transportPerShift: number
}

export interface PayBreakdown {
  workMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  lateNightMinutes: number
  /** 残業かつ深夜の重なり（分）— 割増は合計+50% */
  overtimeLateNightMinutes: number
  basePay: number
  overtimePay: number
  lateNightPay: number
  transportPay: number
  totalPay: number
}

const MINUTES_PER_DAY = 24 * 60
const LATE_NIGHT_START = 22 * 60 // 22:00
const LATE_NIGHT_END = 5 * 60 // 翌 5:00
const OVERTIME_THRESHOLD = 8 * 60

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** 指定した分（絶対時刻）が深夜帯か。絶対時刻は開始日0:00からの経過分 */
function isLateNight(absMinute: number): boolean {
  const t = ((absMinute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return t >= LATE_NIGHT_START || t < LATE_NIGHT_END
}

export function calculatePay(shift: ShiftInput, settings: PaySettings): PayBreakdown {
  const start = toMinutes(shift.start)
  let end = toMinutes(shift.end)
  if (end <= start) end += MINUTES_PER_DAY // 日をまたぐシフト

  const spanMinutes = end - start
  const workMinutes = Math.max(0, spanMinutes - shift.breakMinutes)

  // 休憩はシフトの途中にあるものとして、単純化のため「勤務開始直後からではない」
  // 実働分を1分ずつ数えるのではなく、区間で計算する。
  // ここでは休憩を勤務時間の最後から差し引く簡易モデルではなく、
  // 休憩開始を中間（開始+実働の半分）と仮定せず、テスト可能な決定的ルールとして
  // 「休憩は開始時刻から数えて勤務区間の中央に置く」ことはせず、
  // 保守的に: 実働区間 = [start, end - break] として扱う（休憩を終業前に取るモデル）。
  const workEnd = end - shift.breakMinutes

  let lateNight = 0
  let overtime = 0
  let overtimeLateNight = 0
  // 1分単位の走査でも最大1440回で十分高速。正確さと読みやすさを優先する。
  for (let t = start; t < workEnd; t++) {
    const elapsed = t - start
    const isOT = elapsed >= OVERTIME_THRESHOLD
    const isLN = isLateNight(t)
    if (isOT && isLN) overtimeLateNight++
    else if (isOT) overtime++
    else if (isLN) lateNight++
  }
  const regular = workMinutes - overtime - lateNight - overtimeLateNight

  const perMinute = settings.hourlyWage / 60
  // 金額は「通常単価で全実働分 + 割増追加分」で統一する
  // （残業/深夜の区間に通常単価と割増を二重に付けないため）。
  const allBase = Math.floor(perMinute * workMinutes)
  const overtimeExtra = Math.floor(perMinute * 0.25 * (overtime + overtimeLateNight))
  const lateNightExtra = Math.floor(perMinute * 0.25 * (lateNight + overtimeLateNight))

  return {
    workMinutes,
    regularMinutes: regular,
    overtimeMinutes: overtime,
    lateNightMinutes: lateNight,
    overtimeLateNightMinutes: overtimeLateNight,
    basePay: allBase,
    overtimePay: overtimeExtra,
    lateNightPay: lateNightExtra,
    transportPay: settings.transportPerShift,
    totalPay: allBase + overtimeExtra + lateNightExtra + settings.transportPerShift,
  }
}

export function formatYen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}
