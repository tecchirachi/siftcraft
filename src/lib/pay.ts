/**
* ============================================================
* 給料計算ロジック
* ============================================================
* このファイルの役割:
* 画面（App.tsx）から「計算だけ」を切り離したファイル。
* 計算をUIから分離すると、テストで正確さを確かめやすくなる。
* 実務でも「ロジックと画面を分ける」のは基本の設計。
*
* 計算ルール（日本の一般的な割増ルールに沿った簡易モデル）:
* - 実働時間 = (終了 - 開始) - 休憩。終了が開始以前なら翌日扱い（深夜シフト対応）
* - 残業割増: 実働8時間を超えた分は +25%
* - 深夜割増: 22:00〜翌5:00 にかかる分は +25%
* - 残業かつ深夜の分は、割増が重なって +50%
* - 金額は「分あたり単価」で計算し、円未満は切り捨て
*
* 注意:
* 実際の給与規定は勤務先ごとに違うので、これは目安計算。
* また休憩については簡易モデルとして「実働区間 = [開始, 終了 - 休憩]」
* （休憩を終業の直前に取るものとして扱う）と定義している。
* 休憩を取る位置で深夜帯にかかる分数が変わる場合がある、という
* 割り切りを明示しておくことも設計の一部。
*/

// ------------------------------------------------------------
// 型定義（interface）
// TypeScriptでは「データの形」を型で先に宣言する。
// これがあると、存在しない項目を使ったり型を間違えたりすると
// 実行前にエディタ／ビルドがエラーで教えてくれる。
// ------------------------------------------------------------

/** 1回分のシフト入力 */
export interface ShiftInput {
/** 日付。 "2026-11-02" のような YYYY-MM-DD 形式の文字列 */
date: string
/** 開始時刻。"09:00" のような HH:mm 形式 */
start: string
/** 終了時刻。開始より小さい値なら「翌日」とみなす（例: 22:00→02:00） */
end: string
/** 休憩（分） */
breakMinutes: number
}

/** 給料計算の設定 */
export interface PaySettings {
/** 時給（円） */
hourlyWage: number
/** 1勤務あたりの交通費（円） */
transportPerShift: number
}

/** 計算結果の内訳。画面ではこの形のまま表示に使う */
export interface PayBreakdown {
/** 実働（分） */
workMinutes: number
/** 通常分の時間（分）= 実働 - 残業 - 深夜 - (残業かつ深夜) */
regularMinutes: number
/** 残業のみの時間（分） */
overtimeMinutes: number
/** 深夜のみの時間（分） */
lateNightMinutes: number
/** 残業かつ深夜の時間（分）。割増は合計 +50% になる */
overtimeLateNightMinutes: number
/** 基本給 = 全実働分 × 時給（割増なしの金額） */
basePay: number
/** 残業割増の「追加分」だけ（時給の25%分） */
overtimePay: number
/** 深夜割増の「追加分」だけ（時給の25%分） */
lateNightPay: number
/** 交通費 */
transportPay: number
/** 合計 = 基本給 + 残業追加分 + 深夜追加分 + 交通費 */
totalPay: number
}

// ------------------------------------------------------------
// 定数
// マジックナンバー（意味不明な数字）を直接コードに散らさず、
// 名前付き定数にすると「何の数字か」が一目で分かる。
// ------------------------------------------------------------
const MINUTES_PER_DAY = 24 * 60
const LATE_NIGHT_START = 22 * 60 // 22:00 を「0時から何分後か」で表す
const LATE_NIGHT_END = 5 * 60 // 翌 5:00
const OVERTIME_THRESHOLD = 8 * 60 // 残業になる境目 = 実働8時間

/**
* "09:30" のような文字列を「0時から何分後か」の数値に変える小関数。
* 時刻を分単位の数値にしてしまえば、あとは普通の引き算・比較で扱える。
* 例: toMinutes("09:30") === 570
*/
function toMinutes(hhmm: string): number {
// split(':') で ["09","30"] に分け、map(Number) で [9, 30] に変換する
const [h, m] = hhmm.split(':').map(Number)
return h * 60 + m
}

/**
* ある時刻が深夜帯（22:00〜翌5:00）かどうかを返す。
* 引数は「開始日の0:00から数えた経過分」なので、日をまたぐと
* 1440（=24時間）を超えることがある。
* %（剰余）で1日の範囲に折り返してから判定するのがポイント。
*/
function isLateNight(absMinute: number): boolean {
const t = ((absMinute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
return t >= LATE_NIGHT_START || t < LATE_NIGHT_END
}

/**
* ============================================================
* メインの計算関数（純粋関数）
* 「同じ入力なら必ず同じ出力」で、画面の状態に依存しない。
* だからテストしやすい。pay.test.ts はこの関数だけを検証している。
* ============================================================
*/
export function calculatePay(shift: ShiftInput, settings: PaySettings): PayBreakdown {
// --- 手順1: 時刻を分に直し、日またぎを処理する ---
const start = toMinutes(shift.start)
let end = toMinutes(shift.end)
if (end <= start) end += MINUTES_PER_DAY // 例: 22:00→02:00 は終了を翌日の時刻として扱う

// --- 手順2: 実働時間を求める ---
const spanMinutes = end - start // 休憩込みの拘束時間
const workMinutes = Math.max(0, spanMinutes - shift.breakMinutes) // マイナスにならないよう下限0

// 簡易モデル: 休憩は終業直前に取るものとし、実働区間は [start, workEnd)
const workEnd = end - shift.breakMinutes

// --- 手順3: 実働を1分ずつ数えて、時間帯ごとに分類する ---
// 区間計算で一気に求める方法もあるが、最大でも1440回（1日分）の
// ループなので十分速い。正確さと読みやすさを優先した選択。
let lateNight = 0
let overtime = 0
let overtimeLateNight = 0
for (let t = start; t < workEnd; t++) {
const elapsed = t - start // この分が「働き始めてから何分目か」
const isOT = elapsed >= OVERTIME_THRESHOLD // 実働8時間を超えた分かどうか
const isLN = isLateNight(t) // 深夜帯かどうか
if (isOT && isLN) overtimeLateNight++
else if (isOT) overtime++
else if (isLN) lateNight++
// どちらでもない分は「通常分」なので、ここでは数えず最後に引き算で求める
}
const regular = workMinutes - overtime - lateNight - overtimeLateNight

// --- 手順4: 金額に換算する ---
// 考え方: 「全実働分にまず時給を付け、割増は追加分だけ上乗せする」
// こうすると、残業時間に時給と割増を二重に付けるミスが起きない。
const perMinute = settings.hourlyWage / 60 // 分あたり単価
const allBase = Math.floor(perMinute * workMinutes) // 基本給（円未満切り捨て）
const overtimeExtra = Math.floor(perMinute * 0.25 * (overtime + overtimeLateNight))
const lateNightExtra = Math.floor(perMinute * 0.25 * (lateNight + overtimeLateNight))
// ↑ 残業かつ深夜の分は、overtimeExtra と lateNightExtra の両方に
// 含まれるので、合計で +50% になる。これが「割増が重なる」の実装。

// --- 手順5: 内訳をオブジェクトにまとめて返す ---
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

// ------------------------------------------------------------
// 表示用フォーマッタ
// 「計算」と「見せ方」も分けておくと、表示形式を変えたくなった
// ときに計算へ影響が出ない。
// ------------------------------------------------------------

/** 8900 → "¥8,900" のように3桁区切りで表示する */
export function formatYen(n: number): string {
return `¥${n.toLocaleString('ja-JP')}`
}

/** 450 → "7時間30分" のように表示する */
export function formatMinutes(min: number): string {
const h = Math.floor(min / 60)
const m = min % 60
return m === 0? `${h}時間`: `${h}時間${m}分`
}
