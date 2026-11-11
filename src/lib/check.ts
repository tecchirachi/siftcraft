/**
* 給料明細との照合(Issue #15)
*
* 役割: 「見込み」と「実際の支給額」の差を判定する純粋関数。
* アプリの最初の動機は「明細の金額が合っているか検算したい」だったので、
* 見込みを出すだけでなく、実績と突き合わせて初めてその目的が完成する。
*/

export type CheckStatus = 'unset' | 'match' | 'over' | 'under'

export interface CheckResult {
status: CheckStatus
/** 実績 − 見込み。未入力なら null */
diff: number | null
}

/**
* 差額を判定する。
* - actual が undefined/null なら「未入力」
* - 差が 0 なら「一致」、プラスなら「実績が多い」、マイナスなら「実績が少ない」
*/
export function comparePay(expected: number, actual: number | null | undefined): CheckResult {
if (actual === null || actual === undefined) return { status: 'unset', diff: null}
const diff = actual - expected
if (diff === 0) return { status: 'match', diff}
return diff > 0? { status: 'over', diff}: { status: 'under', diff}
}
