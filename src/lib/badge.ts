/**
 * 実績（バッジ）システム（Issue #25）
 *
 * 役割: シフト記録から「実績」を判定する。レベル（Issue #21）と同じく、
 * 達成状態は保存せず、記録から毎回導出する（単一の情報源）。
 *
 * デザイン方針:
 * - キャラクターやマスコットは使わない。記号（★など）と色だけの gentle な見た目。
 * - 未達成の実績には「あと○件」のような進捗を付け、次に狙うものが分かるようにする。
 * - 判定に必要なのは各シフトの給与内訳（PayBreakdown）だけ。
 *   画面側はすでに計算済みの内訳を渡すので、二重計算にならない。
 */

import type { PayBreakdown, ShiftInput } from './pay'

/** 判定に渡す1件分: シフト本体と、その給与内訳 */
export interface BadgeEntry {
  shift: ShiftInput & { workplaceId?: string }
  pay: PayBreakdown
}

export interface Badge {
  id: string
  /** バッジの記号（絵文字ではなく文字記号を使う） */
  mark: string
  name: string
  description: string
}

export interface BadgeStatus {
  badge: Badge
  unlocked: boolean
  /** 未達成時の進捗メモ（例: あと3件）。達成時は空文字 */
  progressText: string
}

/** 日付文字列を「日番号」に変える（週の連続判定用。UTC基準でずれない） */
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/** 連続した異なる週にシフトがある最大の長さ（月曜始まり相当の7日区切り） */
function maxWeekStreak(entries: BadgeEntry[]): number {
  const weeks = new Set(entries.map((e) => Math.floor(dayNumber(e.shift.date) / 7)))
  let best = 0
  for (const w of weeks) {
    if (!weeks.has(w - 1)) {
      let len = 0
      while (weeks.has(w + len)) len++
      best = Math.max(best, len)
    }
  }
  return best
}

/**
 * 実績の一覧と達成状態を返す。
 * @param goalAmount 月目標（円）。0以下なら「月の目標達成」は常に未達成。
 */
export function evaluateBadges(entries: BadgeEntry[], goalAmount: number): BadgeStatus[] {
  const count = entries.length
  const workMinutes = entries.reduce((a, e) => a + e.pay.workMinutes, 0)
  const workHours = Math.floor(workMinutes / 60)
  const hasLateNight = entries.some((e) => e.pay.lateNightMinutes + e.pay.overtimeLateNightMinutes > 0)
  const hasOvertime = entries.some((e) => e.pay.overtimeMinutes + e.pay.overtimeLateNightMinutes > 0)
  const hasEarly = entries.some((e) => e.shift.start < '07:00')
  const workplaceCount = new Set(entries.map((e) => e.shift.workplaceId ?? 'default')).size
  const streak = maxWeekStreak(entries)

  // 月ごとの合計（目標達成の判定）と、年ごとの課税対象合計（交通費を除く）
  const byMonth = new Map<string, number>()
  const byYear = new Map<string, number>()
  for (const e of entries) {
    const mk = e.shift.date.slice(0, 7)
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + e.pay.totalPay)
    const yk = e.shift.date.slice(0, 4)
    byYear.set(yk, (byYear.get(yk) ?? 0) + (e.pay.totalPay - e.pay.transportPay))
  }
  const bestMonth = Math.max(0, ...byMonth.values())
  const goalReached = goalAmount > 0 && bestMonth >= goalAmount
  const bestYear = Math.max(0, ...byYear.values())

  // 件数・時間系の進捗テキストを作る小さなヘルパー
  const remain = (now: number, target: number, unit: string) =>
    now >= target ? '' : `あと${target - now}${unit}`

  const defs: Array<{ badge: Badge; unlocked: boolean; progressText: string }> = [
    {
      badge: { id: 'first', mark: '★', name: 'はじめの一歩', description: '初めてのシフトを登録' },
      unlocked: count >= 1,
      progressText: remain(count, 1, '件'),
    },
    {
      badge: { id: 'shifts10', mark: '◆', name: 'シフト10件', description: 'シフトを累計10件登録' },
      unlocked: count >= 10,
      progressText: remain(count, 10, '件'),
    },
    {
      badge: { id: 'shifts50', mark: '◆', name: 'シフト50件', description: 'シフトを累計50件登録' },
      unlocked: count >= 50,
      progressText: remain(count, 50, '件'),
    },
    {
      badge: { id: 'hours100', mark: '●', name: '実働100時間', description: '累計の実働が100時間に到達' },
      unlocked: workHours >= 100,
      progressText: remain(workHours, 100, '時間'),
    },
    {
      badge: { id: 'hours500', mark: '●', name: '実働500時間', description: '累計の実働が500時間に到達' },
      unlocked: workHours >= 500,
      progressText: remain(workHours, 500, '時間'),
    },
    {
      badge: { id: 'night', mark: '☾', name: '深夜デビュー', description: '深夜帯（22時〜5時）の勤務を経験' },
      unlocked: hasLateNight,
      progressText: hasLateNight ? '' : '深夜帯のシフトで達成',
    },
    {
      badge: { id: 'overtime', mark: '▲', name: '残業デビュー', description: '8時間超の勤務（残業）を経験' },
      unlocked: hasOvertime,
      progressText: hasOvertime ? '' : '8時間超のシフトで達成',
    },
    {
      badge: { id: 'early', mark: '☀', name: '早朝シフト', description: '朝7時より前に始まるシフトを経験' },
      unlocked: hasEarly,
      progressText: hasEarly ? '' : '7時前開始のシフトで達成',
    },
    {
      badge: { id: 'multi', mark: '✚', name: 'かけもち', description: '2つ以上のバイト先でシフトを登録' },
      unlocked: workplaceCount >= 2,
      progressText: workplaceCount >= 2 ? '' : '別のバイト先のシフトで達成',
    },
    {
      badge: { id: 'streak4', mark: '■', name: '4週連続', description: '4週連続で毎週シフトを登録' },
      unlocked: streak >= 4,
      progressText: streak >= 4 ? '' : `現在 ${streak} 週連続`,
    },
    {
      badge: { id: 'goal', mark: '♥', name: '月の目標達成', description: 'いずれかの月の合計が目標金額に到達' },
      unlocked: goalReached,
      progressText: goalReached ? '' : '月の合計が目標を超えると達成',
    },
    {
      badge: { id: 'rich', mark: '¥', name: '年収100万円', description: '年間の収入（交通費を除く）が100万円に到達' },
      unlocked: bestYear >= 1000000,
      progressText: bestYear >= 1000000 ? '' : `あと${(1000000 - bestYear).toLocaleString('ja-JP')}円`,
    },
  ]
  return defs.map((d) => ({ badge: d.badge, unlocked: d.unlocked, progressText: d.progressText }))
}
