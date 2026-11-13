/**
 * データのバックアップ / 復元（Issue #38）
 *
 * 役割: アプリの全データを1つの JSON 文字列にまとめ（書き出し）、
 * その文字列を検証しながら読み戻す（復元）ための純粋関数。
 *
 * なぜ必要か:
 * - データは端末の localStorage のみに保存されるため、機種変更や
 *   ブラウザのデータ削除で全部消えてしまう。これが長期利用の最大の弱点
 * - ファイルに書き出しておけば、新しい端末で読み直して続きから使える
 *
 * 考え方:
 * - 書き出しは { app, version, exportedAt, data } の包みにする。
 *   app 名と version を入れておくことで、復元時に「違うファイル」や
 *   「将来の形式変更」を検知できる
 * - 復元は信用しない: JSON として読めるか、ShiftCraft のファイルか、
 *   各項目の型が合っているかを1つずつ確認し、壊れた項目は落とす。
 *   必須の形が崩れていたら理由つきで { ok: false } を返す
 * - 欠けている任意項目は既定値で補う（古いバックアップも読めるように）
 */
import type { Appearance } from './appearance'
import type { CelebratedState } from './celebrate'
import type { ShiftInput } from './pay'
import { isValidExchange, isValidReward, type Exchange, type RewardDef } from './rewards'
import type { Workplace } from './workplace'

/** バックアップ1件分のシフト（ShiftInput + id + バイト先） */
export interface BackupShift extends ShiftInput {
  id: string
  workplaceId?: string
  transportOverride?: number
}

/** 給料明細との照合の実績（バイト先 × 年月） */
export interface BackupActual {
  workplaceId: string
  yearMonth: string
  amount: number
}

/** バックアップに含める全データ */
export interface BackupData {
  workplaces: Workplace[]
  shifts: BackupShift[]
  goalYen: number
  actuals: BackupActual[]
  themeId: string
  unlockedThemes: string[]
  appearance: Appearance
  celebrated: CelebratedState | null
  /** 背景パターン（Issue #44）。古いバックアップには無いので復元時に補う */
  patternId: string
  unlockedPatterns: string[]
  /** ご褒美と交換履歴（Issue #44） */
  rewards: RewardDef[]
  exchanges: Exchange[]
}

export const BACKUP_VERSION = 1

/** 全データをバックアップ用 JSON 文字列にする */
export function serializeBackup(data: BackupData, exportedAt: string): string {
  return JSON.stringify(
    { app: 'ShiftCraft', version: BACKUP_VERSION, exportedAt, data },
    null,
    2,
  )
}

export type ParseResult =
  | { ok: true; data: BackupData; summary: { workplaces: number; shifts: number } }
  | { ok: false; error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isValidWorkplace(v: unknown): v is Workplace {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.hourlyWage === 'number'
  )
}

function isValidShift(v: unknown): v is BackupShift {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.date === 'string' &&
    typeof v.start === 'string' &&
    typeof v.end === 'string' &&
    typeof v.breakMinutes === 'number'
  )
}

function isValidActual(v: unknown): v is BackupActual {
  return (
    isRecord(v) &&
    typeof v.workplaceId === 'string' &&
    typeof v.yearMonth === 'string' &&
    typeof v.amount === 'number'
  )
}

/** バックアップ文字列を検証して読み戻す。壊れていたら理由を返す */
export function parseBackup(text: string): ParseResult {
  let root: unknown
  try {
    root = JSON.parse(text)
  } catch {
    return { ok: false, error: 'ファイルの内容が読めませんでした（JSON形式ではありません）' }
  }
  if (!isRecord(root) || root.app !== 'ShiftCraft' || !isRecord(root.data)) {
    return { ok: false, error: 'ShiftCraftのバックアップファイルではないようです' }
  }
  if (root.version !== BACKUP_VERSION) {
    return { ok: false, error: '対応していないバージョンのバックアップです' }
  }
  const d = root.data

  if (!Array.isArray(d.workplaces)) {
    return { ok: false, error: 'バイト先のデータが見つかりませんでした' }
  }
  const workplaces = d.workplaces.filter(isValidWorkplace)
  if (workplaces.length === 0) {
    return { ok: false, error: 'バイト先のデータが見つかりませんでした' }
  }

  if (!Array.isArray(d.shifts)) {
    return { ok: false, error: 'シフトのデータが見つかりませんでした' }
  }
  // 壊れたシフトは落として、読める分だけ復元する
  const shifts = d.shifts.filter(isValidShift)

  const actuals = Array.isArray(d.actuals) ? d.actuals.filter(isValidActual) : []
  const unlockedThemes = Array.isArray(d.unlockedThemes)
    ? d.unlockedThemes.filter((t): t is string => typeof t === 'string')
    : []
  if (!unlockedThemes.includes('peach')) unlockedThemes.unshift('peach')
  // パターンとご褒美は Issue #44 で追加。古いバックアップには含まれない
  // ので、欠けていたら既定値（パターンなし・ご褒美なし）で補う
  const unlockedPatterns = Array.isArray(d.unlockedPatterns)
    ? d.unlockedPatterns.filter((t): t is string => typeof t === 'string')
    : []
  if (!unlockedPatterns.includes('none')) unlockedPatterns.unshift('none')
  const rewards = Array.isArray(d.rewards) ? d.rewards.filter(isValidReward) : []
  const exchanges = Array.isArray(d.exchanges) ? d.exchanges.filter(isValidExchange) : []
  const celebrated =
    isRecord(d.celebrated) &&
    typeof d.celebrated.level === 'number' &&
    isRecord(d.celebrated.tiers)
      ? (d.celebrated as unknown as CelebratedState)
      : null

  return {
    ok: true,
    data: {
      workplaces,
      shifts,
      goalYen: typeof d.goalYen === 'number' ? d.goalYen : 80000,
      actuals,
      themeId: typeof d.themeId === 'string' ? d.themeId : 'peach',
      unlockedThemes,
      appearance:
        d.appearance === 'light' || d.appearance === 'dark' || d.appearance === 'auto'
          ? d.appearance
          : 'auto',
      celebrated,
      patternId: typeof d.patternId === 'string' ? d.patternId : 'none',
      unlockedPatterns,
      rewards,
      exchanges,
    },
    summary: { workplaces: workplaces.length, shifts: shifts.length },
  }
}
