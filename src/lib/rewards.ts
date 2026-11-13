/**
 * ご褒美交換（Issue #44）: ポイントの使用先その3。
 *
 * 仕組み:
 * - 「ご褒美」は自分で登録する（名前と必要ポイント）。例: ケーキ 300P。
 * - 交換するとポイントが消費され、交換履歴に残る。同じご褒美は
 *   何度でも交換できる（テーマ解放のような「買い切り」とは違う）。
 * - ポイント残高の計算では、テーマ/パターン分は解放済み一覧から、
 *   交換分はこの履歴の合計から差し引く。
 *
 * 現実のお金は一切動かない。「貯めたら自分にご褒美」という
 * モチベーション装置としてだけ働く。
 */

export interface RewardDef {
  id: string
  name: string
  cost: number
}

export interface Exchange {
  id: string
  /** 交換時点の名前と価格を写しておく（定義を消しても履歴が壊れない） */
  name: string
  cost: number
  /** 交換した日（YYYY-MM-DD） */
  date: string
}

export const REWARDS_KEY = 'shiftcraft:rewards'
export const EXCHANGES_KEY = 'shiftcraft:exchanges'

/** 交換履歴の合計ポイント（残高から差し引く分） */
export function totalExchangeCost(exchanges: Exchange[]): number {
  return exchanges.reduce((a, e) => a + e.cost, 0)
}

/** ご褒美の登録内容を検証する。問題があれば理由の配列を返す */
export function validateReward(name: string, cost: number): string[] {
  const errors: string[] = []
  if (!name.trim()) errors.push('ご褒美の名前を入力してください')
  if (!Number.isFinite(cost) || cost <= 0 || Math.floor(cost) !== cost) {
    errors.push('ポイントは1以上の整数にしてください')
  }
  return errors
}

/** バックアップ復元用の型ガード */
export function isValidReward(v: unknown): v is RewardDef {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as RewardDef).id === 'string' &&
    typeof (v as RewardDef).name === 'string' &&
    typeof (v as RewardDef).cost === 'number'
  )
}

export function isValidExchange(v: unknown): v is Exchange {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as Exchange).id === 'string' &&
    typeof (v as Exchange).name === 'string' &&
    typeof (v as Exchange).cost === 'number' &&
    typeof (v as Exchange).date === 'string'
  )
}
