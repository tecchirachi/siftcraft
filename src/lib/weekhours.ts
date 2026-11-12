/**
 * 週の労働時間チェック（Issue #40）
 *
 * 役割: シフトの実働時間を「週」ごとに合計し、法定労働時間の目安である
 * 週40時間を超えた週を見つける純粋関数群。
 *
 * 考え方:
 * - 週の区切りはアプリのカレンダーに合わせて「日曜始まり」にする
 *   （法律上の週の数え方は勤務先の規則で異なる場合があるので、
 *   これはあくまで働きすぎに気づくための目安）
 * - 実働時間は pay.ts の calculatePay が返した workMinutes（休憩を除いた分）を
 *   そのまま使う。ここでは日付の振り分けだけを担当する
 * - 日付の計算は UTC の「日番号」にそろえる（badge.ts などと同じ流儀）。
 *   日番号 0 = 1970-01-01（木曜）なので、(日番号 + 4) % 7 で 0=日曜 になる
 * - 夜勤など日をまたぐシフトも、実働は「開始日」の週に入れる
 *   （給料計算でも開始日をシフトの日付として扱っているため）
 */

/** 週の法定労働時間の目安（40時間 = 2400分） */
export const WEEKLY_LIMIT_MINUTES = 40 * 60

/** 週集計のもとになる1件分（日付と実働分） */
export interface WeekEntry {
  date: string
  workMinutes: number
}

/** 1週間分の集計結果 */
export interface WeekSummary {
  /** 週の始まり（日曜）の日付 */
  weekStart: string
  /** 週の終わり（土曜）の日付 */
  weekEnd: string
  /** その週の実働合計（分） */
  totalMinutes: number
  /** 40時間を「超えた」かどうか（ちょうど40時間は超過ではない） */
  over: boolean
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-DD" → UTCの日番号 */
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/** UTCの日番号 → "YYYY-MM-DD" */
function dateOfDayNumber(n: number): string {
  const d = new Date(n * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** その日付が属する週の日曜の日付を返す */
export function weekStartOf(date: string): string {
  const n = dayNumber(date)
  const dow = (n + 4) % 7 // 0=日曜, 1=月曜, ... 6=土曜
  return dateOfDayNumber(n - dow)
}

/** 全シフトを週ごとに集計する（週の古い順） */
export function summarizeWeeks(entries: WeekEntry[]): WeekSummary[] {
  const totals = new Map<string, number>()
  for (const e of entries) {
    const ws = weekStartOf(e.date)
    totals.set(ws, (totals.get(ws) ?? 0) + e.workMinutes)
  }
  return [...totals.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, totalMinutes]) => ({
      weekStart,
      weekEnd: dateOfDayNumber(dayNumber(weekStart) + 6),
      totalMinutes,
      over: totalMinutes > WEEKLY_LIMIT_MINUTES,
    }))
}

/** 指定した年月と重なる週だけを返す（月をまたぐ週は両方の月に現れる） */
export function weeksInMonth(
  weeks: WeekSummary[],
  year: number,
  month: number,
): WeekSummary[] {
  const monthStart = `${year}-${pad(month)}-01`
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`
  return weeks.filter((w) => w.weekStart < next && w.weekEnd >= monthStart)
}
