/**
* 毎週の繰り返し登録(Issue #16)
*
* 役割: 開始日から7日ごとの日付列を作る純粋関数。
* 日付計算は UTC 基準で行う。ローカル時刻で計算すると、夏時間や
* タイムゾーンの境目で1日ずれる事故が起きるため（日本は夏時間がないが、
* 旅行先や端末設定に引きずられないための定石）。
*/

function pad2(n: number): string {
return String(n).padStart(2, '0')
}

/** "2026-11-07" のような日付文字列を UTC の Date にする */
function parseDate(date: string): Date {
const [y, m, d] = date.split('-').map(Number)
return new Date(Date.UTC(y, m - 1, d))
}

function formatDate(d: Date): string {
return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/**
* startDate から count 回分、7日ごとの日付を返す（startDate 自身を含む）。
* 例: weeklyDates('2026-11-07', 3) → ['2026-11-07', '2026-11-14', '2026-11-21']
* 月をまたいでも正しく繰り上がるのは Date に任せる。
*/
export function weeklyDates(startDate: string, count: number): string[] {
const base = parseDate(startDate)
const out: string[] = []
for (let i = 0; i < count; i++) {
const d = new Date(base.getTime() + i * 7 * 86400000)
out.push(formatDate(d))
}
return out
}
