/**
 * レベルアップ・実績解除の「既達記録」と差分検知（Issue #34）
 *
 * レベルも実績ティアも「記録から毎回計算し直す派生値」なので、
 * 「いつ上がったか」はアプリ側では分からない。そこで到達済みの最大値を
 * localStorage に覚えておき（CelebratedState）、現在値がそれを超えた分だけ
 * 「今上がった」とみなして演出キューを作る。
 *
 * ポイント:
 * - 初回（記録なし）は mergeCelebrated で現在値をそのまま記録し、祝わない
 * - 削除で値が下がっても記録は最大値のまま（再到達で二重に祝わない）
 */

import type { BadgeStatus } from './badge'

export interface CelebratedState {
  level: number
  tiers: Record<string, number>
}

export type Celebration =
  | { kind: 'level'; level: number; title: string }
  | {
      kind: 'badge'
      name: string
      mark: string
      tier: number
      tierName: string
      /** true=到達済みの演出、false=未到達のプレビュー（Issue #35） */
      achieved: boolean
      /** 未到達プレビュー用（例: あと9件で シルバー） */
      progressText?: string
    }

export const CELEBRATED_KEY = 'shiftcraft:celebrated'

/** 前回の既達記録と現在値を比べ、今回新しく到達した分の演出リストを返す */
export function diffCelebrations(
  prev: CelebratedState,
  level: number,
  title: string,
  badges: BadgeStatus[],
): Celebration[] {
  const events: Celebration[] = []
  if (level > prev.level) {
    events.push({ kind: 'level', level, title })
  }
  for (const b of badges) {
    const before = prev.tiers[b.id] ?? 0
    if (b.tier > before && b.tierName) {
      events.push({
        kind: 'badge', name: b.name, mark: b.mark, tier: b.tier, tierName: b.tierName, achieved: true,
      })
    }
  }
  return events
}

/** 既達記録を現在値で更新する（各項目の最大値を保持する） */
export function mergeCelebrated(
  prev: CelebratedState | null,
  level: number,
  badges: BadgeStatus[],
): CelebratedState {
  const tiers: Record<string, number> = { ...(prev?.tiers ?? {}) }
  for (const b of badges) {
    tiers[b.id] = Math.max(tiers[b.id] ?? 0, b.tier)
  }
  return { level: Math.max(prev?.level ?? 0, level), tiers }
}
