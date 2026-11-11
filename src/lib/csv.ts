/**
* CSVエクスポート(Issue #4)
*
* 役割: シフトと給料の内訳をCSV文字列に変換する純粋関数。
* ダウンロード自体（Blobの生成など画面側の都合）は App.tsx が担当し、
* ここは「文字列を作る」だけにするとテストしやすい。
*
* CSVの約束事:
* - 1行目が項目名（ヘッダー）、2行目以降がデータ
* - 値にカンマ・改行・ダブルクォートが含まれる場合は
* 値全体を " で囲み、内部の " は "" と2つ重ねて表す（エスケープ）
* - 先頭に BOM(\uFEFF) を付けると、Excelで開いたとき日本語が文字化けしない
*/
import type { PayBreakdown, ShiftInput} from './pay'

/** CSVの1行分に必要なデータ（シフト入力＋計算済みの内訳） */
export interface CsvEntry {
shift: ShiftInput
pay: PayBreakdown
}

const HEADER = ['日付', '開始', '終了', '休憩(分)', '実働(分)', '残業(分)', '深夜(分)', '金額(円)']

/** 1つの値をCSV形式にエスケープする */
function escapeCsv(value: string | number): string {
const s = String(value)
if (/[",\n]/.test(s)) {
return `"${s.replace(/"/g, '""')}"`
}
return s
}

/** エントリ一覧をCSV文字列に変換する。データが空ならヘッダーのみ */
export function shiftsToCsv(entries: CsvEntry[]): string {
const lines = entries.map(({ shift, pay}) =>
[
shift.date,
shift.start,
shift.end,
shift.breakMinutes,
pay.workMinutes,
pay.overtimeMinutes + pay.overtimeLateNightMinutes,
pay.lateNightMinutes + pay.overtimeLateNightMinutes,
pay.totalPay,
]
.map(escapeCsv)
.join(','),
)
// BOM + ヘッダー + データ行を改行(\r\n: Excel互換)でつなぐ
return '\uFEFF' + [HEADER.join(','),...lines].join('\r\n')
}
