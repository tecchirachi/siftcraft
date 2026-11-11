/**
* 目標金額シミュレーション(Issue #3)
*
* 役割: 「現在の合計が目標まであといくらか」と
* 「時給換算であと何時間働けば届くか」を計算する純粋関数。
*
* 注意する点:
* - 進捗率は100%を超えないように丸める（バーの表示がはみ出さないため）
* - 必要時間は切り上げる。切り捨てると「その時間働いても届かない」ため
* - 時給が0以下のときは割り算ができないので、必要時間を null（計算不能）にする
* 例外で落とすのではなく、型で「ない場合」を表すのがTypeScript流。
*/

export interface GoalProgress {
/** 目標まであといくらか（円）。達成済みなら0 */
remainingYen: number
/** あと必要な労働時間（分、切り上げ）。達成済みなら0、計算不能なら null */
remainingMinutes: number | null
/** 進捗率 0〜100（%） */
progressPercent: number
/** 目標を達成しているか */
achieved: boolean
}

export function goalProgress(currentTotal: number, goalYen: number, hourlyWage: number): GoalProgress {
const remainingYen = Math.max(0, goalYen - currentTotal)
const achieved = remainingYen === 0 && goalYen > 0
// 目標が0以下（未設定）のときは進捗率を0として扱う
const progressPercent = goalYen > 0? Math.min(100, Math.floor((currentTotal / goalYen) * 100)): 0

let remainingMinutes: number | null
if (remainingYen === 0) {
remainingMinutes = 0
} else if (hourlyWage <= 0) {
remainingMinutes = null // 時給が分からないと時間に換算できない
} else {
// あと◯円 ÷ 時給 = 必要な時間。それを分に直して切り上げる
remainingMinutes = Math.ceil((remainingYen / hourlyWage) * 60)
}

return { remainingYen, remainingMinutes, progressPercent, achieved}
}
