/**
* 月別フィルタ(Issue #2)
*
* 役割: 日付を持つデータを「指定した月だけ」に絞り込む。
* 画面(App.tsx)から切り離して純粋関数にしておくと、テストで
* 単独検証できる。pay.ts と同じ設計方針。
*
* ポイント: 日付は "2026-11-02" という文字列なので、
* 「月」は先頭7文字 "2026-11" と一致するかどうかで判定できる。
* Dateオブジェクトに変換しなくても、YYYY-MM-DD 形式なら
* 文字列の前方一致で十分正確、という割り切り。
*/

/** "2026-11-02" から年月 "2026-11" を取り出す */
export function shiftMonth(date: string): string {
return date.slice(0, 7)
}

/**
* 月で絞り込む。
* - month が空文字なら「全期間」として全件をそのまま返す
* - ジェネリクス <T extends { date: string}> は
* 「dateという文字列項目を持つデータなら何でも受け付ける」という意味。
* これでシフト以外のデータ（将来の拡張）にも使い回せる。
*/
export function filterByMonth<T extends { date: string}>(items: T[], month: string): T[] {
if (!month) return items
return items.filter((item) => shiftMonth(item.date) === month)
}

/** データに登場する月の一覧を、新しい順で返す（月選択UIの候補に使う） */
export function listMonths<T extends { date: string}>(items: T[]): string[] {
// Set は重複を取り除くためのデータ構造。月だけ抜き出して重複を消し、並べ替える
const months = new Set(items.map((item) => shiftMonth(item.date)))
return [...months].sort().reverse()
}
