/**
* バイト先（複数登録）のロジック(Issue #7)
*
* 役割: バイト先データの「移行」「解決（フォールバック）」「別集計」を
* 担当する純粋関数群。画面はここの結果を使うだけ。
*
* 設計のポイント:
* - シフトは workplaceId（バイト先のID）だけを持ち、時給などは持たない。
* バイト先の時給を直せば、過去分も含めて計算が追従する（正規化の考え方）
* - workplaceId が無い・消えたバイト先を指している等の場合に備え、
* resolveWorkplace が必ずどれか1件を返す（= 画面が壊れない）
*/
import type { PaySettings} from './pay'

/** バイト先1件分のデータ */
export interface Workplace {
id: string
name: string
hourlyWage: number
transportPerShift: number
/** 場所（任意） */
place?: string
/** メモ（任意） */
memo?: string
}

/** 移行で作るデフォルトのバイト先のID */
export const DEFAULT_WORKPLACE_ID = 'default'

/**
* 保存済みのバイト先一覧があればそれを使い、無ければ
* これまでの単一設定（時給・交通費）からデフォルトのバイト先を作る。
* これにより、旧バージョンの利用者のデータがそのまま引き継がれる。
*/
export function migrateWorkplaces(saved: Workplace[] | null, legacy: PaySettings): Workplace[] {
if (saved && saved.length > 0) return saved
return [
{
id: DEFAULT_WORKPLACE_ID,
name: 'バイト先',
hourlyWage: legacy.hourlyWage,
transportPerShift: legacy.transportPerShift,
},
]
}

/** IDからバイト先を探す。見つからなければ先頭のバイト先を返す */
export function resolveWorkplace(workplaces: Workplace[], id: string | undefined): Workplace {
const found = id? workplaces.find((w) => w.id === id): undefined
if (found) return found
// 一覧が空という異常時でも画面を止めないよう、仮の1件を返す
return workplaces[0]?? { id: DEFAULT_WORKPLACE_ID, name: 'バイト先', hourlyWage: 0, transportPerShift: 0}
}

/** バイト先を給料計算用の設定（PaySettings）に変換する */
export function workplaceToSettings(wp: Workplace): PaySettings {
return { hourlyWage: wp.hourlyWage, transportPerShift: wp.transportPerShift}
}

/** バイト先別集計の入力（計算済みの行） */
export interface WorkplaceEntry {
workplaceId?: string
totalPay: number
workMinutes: number
}

export interface WorkplaceTotal {
workplace: Workplace
totalPay: number
workMinutes: number
count: number
}

/** 表示中の行をバイト先ごとに集計する（金額の大きい順） */
export function summarizeByWorkplace(entries: WorkplaceEntry[], workplaces: Workplace[]): WorkplaceTotal[] {
const map = new Map<string, WorkplaceTotal>()
for (const e of entries) {
const wp = resolveWorkplace(workplaces, e.workplaceId)
const cur = map.get(wp.id)?? { workplace: wp, totalPay: 0, workMinutes: 0, count: 0}
cur.totalPay += e.totalPay
cur.workMinutes += e.workMinutes
cur.count += 1
map.set(wp.id, cur)
}
return [...map.values()].sort((a, b) => b.totalPay - a.totalPay)
}
