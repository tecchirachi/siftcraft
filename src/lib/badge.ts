/**
 * 実績（バッジ）システム（Issue #25 → #26 でティア制に刷新）
 *
 * 役割: シフト記録から「実績カテゴリごとの到達ティア」を判定する。
 * レベル（Issue #21）と同じく、状態は保存せず記録から毎回導出する。
 *
 * ティア制の狙い（長期的に使ってもらうため）:
 * - 「達成して終わり」にせず、各カテゴリに8段階のティアを持たせる。
 *   ブロンズ → シルバー → ゴールド → プラチナ → ダイヤ → マスター →
 *   グランドマスター → レジェンド。色もティアごとに変わる。
 * - 次のティアまでの進捗（あと○○）を常に出すので、常に「次の目標」がある。
 * - ティア到達1つにつき +25P のボーナス（画面側でポイントに加算）。
 *
 * デザイン方針: キャラクターやマスコットは使わない。記号と色だけ。
 */

import type { PayBreakdown, ShiftInput } from './pay'

/** 判定に渡す1件分: シフト本体と、その給与内訳 */
export interface BadgeEntry {
  shift: ShiftInput & { workplaceId?: string }
  pay: PayBreakdown
}

/** ティア名（index 0 = ティア1）。色は画面表示用 */
export const TIER_NAMES = [
  'ブロンズ',
  'シルバー',
  'ゴールド',
  'プラチナ',
  'ダイヤ',
  'マスター',
  'グランドマスター',
  'レジェンド',
] as const

export const TIER_COLORS = [
  '#c47f42',
  '#9aa5ad',
  '#d9a514',
  '#3fa58c',
  '#4f9fd8',
  '#8b7bc7',
  '#d95f4b',
  '#c2185b',
] as const

/** ティア1つあたりのボーナスポイント */
export const TIER_BONUS_POINTS = 25

export interface BadgeStatus {
  id: string
  /** バッジの記号（絵文字ではなく文字記号を使う） */
  mark: string
  name: string
  description: string
  /** 現在の値（カテゴリの単位で） */
  value: number
  /** 到達ティア 0〜8（0は未到達） */
  tier: number
  /** 現在のティア名（未到達なら null） */
  tierName: string | null
  /** 次のティアのしきい値（最大ティアなら null） */
  nextThreshold: number | null
  /** 次のティアまでの進捗テキスト（例: あと7件 / MAX） */
  progressText: string
  /** 次のティアまでの進み具合 0〜100（区間内の割合） */
  segmentPercent: number
}

interface CategoryDef {
  id: string
  mark: string
  name: string
  description: string
  /** ティア1〜8のしきい値（昇順・8個） */
  thresholds: number[]
  /** 値を表示用文字列にする（例: 123 → "123件"） */
  format: (v: number) => string
  /** 記録から値を取り出す */
  valueOf: (ctx: BadgeContext) => number
}

interface BadgeContext {
  count: number
  workHours: number
  lateNightHours: number
  overtimeHours: number
  earlyCount: number
  workplaceCount: number
  weekStreak: number
  goalMonths: number
  bestYearIncome: number
}

/** 日付文字列を「日番号」に変える（週の連続判定用。UTC基準でずれない） */
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/** 連続した異なる週にシフトがある最大の長さ（7日区切り） */
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

const yen = (v: number) => `${v.toLocaleString('ja-JP')}円`
const CATEGORIES: CategoryDef[] = [
  {
    id: 'shifts', mark: '◆', name: 'シフト件数', description: '登録したシフトの累計',
    thresholds: [1, 10, 25, 50, 100, 200, 350, 500],
    format: (v) => `${v}件`, valueOf: (c) => c.count,
  },
  {
    id: 'hours', mark: '●', name: '実働時間', description: '累計の実働時間',
    thresholds: [10, 50, 100, 200, 400, 700, 1000, 1500],
    format: (v) => `${v}時間`, valueOf: (c) => c.workHours,
  },
  {
    id: 'night', mark: '☾', name: '深夜勤務', description: '深夜帯（22時〜5時）の累計時間',
    thresholds: [1, 5, 15, 30, 60, 120, 200, 300],
    format: (v) => `${v}時間`, valueOf: (c) => c.lateNightHours,
  },
  {
    id: 'overtime', mark: '▲', name: '残業', description: '8時間超の残業分の累計時間',
    thresholds: [1, 5, 15, 30, 60, 120, 200, 300],
    format: (v) => `${v}時間`, valueOf: (c) => c.overtimeHours,
  },
  {
    id: 'early', mark: '☀', name: '早朝シフト', description: '朝7時より前に始まるシフトの回数',
    thresholds: [1, 5, 10, 20, 40, 70, 100, 150],
    format: (v) => `${v}回`, valueOf: (c) => c.earlyCount,
  },
  {
    id: 'multi', mark: '✚', name: 'かけもち', description: 'シフトを登録したバイト先の数',
    thresholds: [2, 3, 4, 5, 6, 7, 8, 9],
    format: (v) => `${v}か所`, valueOf: (c) => c.workplaceCount,
  },
  {
    id: 'streak', mark: '■', name: '連続週', description: '毎週シフトが続いた最長記録',
    thresholds: [2, 4, 6, 8, 12, 16, 24, 36],
    format: (v) => `${v}週`, valueOf: (c) => c.weekStreak,
  },
  {
    id: 'goal', mark: '♥', name: '目標達成', description: '月の合計が目標金額に達した月数',
    thresholds: [1, 2, 3, 6, 9, 12, 18, 24],
    format: (v) => `${v}か月`, valueOf: (c) => c.goalMonths,
  },
  {
    id: 'income', mark: '¥', name: '年収', description: '年間の収入（交通費を除く）の最高記録',
    thresholds: [100000, 300000, 500000, 800000, 1000000, 1500000, 1780000, 2000000],
    format: yen, valueOf: (c) => c.bestYearIncome,
  },
]

/**
 * 実績カテゴリごとの到達ティアを返す。
 * @param goalAmount 月目標（円）。0以下なら「目標達成」は常に0か月扱い。
 */
export function evaluateBadges(entries: BadgeEntry[], goalAmount: number): BadgeStatus[] {
  const byMonth = new Map<string, number>()
  const byYear = new Map<string, number>()
  let lateNightMinutes = 0
  let overtimeMinutes = 0
  for (const e of entries) {
    lateNightMinutes += e.pay.lateNightMinutes + e.pay.overtimeLateNightMinutes
    overtimeMinutes += e.pay.overtimeMinutes + e.pay.overtimeLateNightMinutes
    const mk = e.shift.date.slice(0, 7)
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + e.pay.totalPay)
    const yk = e.shift.date.slice(0, 4)
    byYear.set(yk, (byYear.get(yk) ?? 0) + (e.pay.totalPay - e.pay.transportPay))
  }
  const ctx: BadgeContext = {
    count: entries.length,
    workHours: Math.floor(entries.reduce((a, e) => a + e.pay.workMinutes, 0) / 60),
    lateNightHours: Math.floor(lateNightMinutes / 60),
    overtimeHours: Math.floor(overtimeMinutes / 60),
    earlyCount: entries.filter((e) => e.shift.start < '07:00').length,
    workplaceCount: new Set(entries.map((e) => e.shift.workplaceId ?? 'default')).size,
    weekStreak: maxWeekStreak(entries),
    goalMonths:
      goalAmount > 0 ? [...byMonth.values()].filter((v) => v >= goalAmount).length : 0,
    bestYearIncome: Math.max(0, ...byYear.values()),
  }

  return CATEGORIES.map((def) => {
    const value = def.valueOf(ctx)
    let tier = 0
    while (tier < def.thresholds.length && value >= def.thresholds[tier]) tier++
    const nextThreshold = tier < def.thresholds.length ? def.thresholds[tier] : null
    const prevThreshold = tier === 0 ? 0 : def.thresholds[tier - 1]
    const segmentPercent =
      nextThreshold === null
        ? 100
        : Math.min(100, Math.floor(((value - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
    return {
      id: def.id,
      mark: def.mark,
      name: def.name,
      description: def.description,
      value,
      tier,
      tierName: tier > 0 ? TIER_NAMES[tier - 1] : null,
      nextThreshold,
      progressText:
        nextThreshold === null
          ? 'MAX'
          : `あと${def.format(nextThreshold - value)}で ${TIER_NAMES[tier]}`,
      segmentPercent,
    }
  })
}

/** 到達ティアの合計（ポイントボーナスの計算用） */
export function totalTiers(statuses: BadgeStatus[]): number {
  return statuses.reduce((a, s) => a + s.tier, 0)
}
