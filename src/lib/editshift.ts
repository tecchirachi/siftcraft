/**
 * シフトの編集（Issue #37）
 *
 * 役割: 登録済みのシフトを「削除して入れ直す」のではなく、
 * 同じ id のまま内容だけ差し替えるための純粋関数。
 *
 * 考え方:
 * - シフトは id で一意に識別される。編集 = 配列の中で id が一致する
 *   要素だけを新しい内容に置き換え、他はそのまま返す
 * - 元の配列は変更しない（map で新しい配列を作る）。React の state は
 *   「新しい配列を渡す」ことで再描画されるため、この形が都合がいい
 * - 並び順は変えない。カレンダーや集計は日付で並べ替えて表示するので、
 *   編集で日付が変わっても表示側で正しく並ぶ
 */

interface HasId {
  id: string
}

/** id が一致するシフトを updated に差し替えた新しい配列を返す（無ければそのまま） */
export function replaceShift<T extends HasId>(shifts: T[], updated: T): T[] {
  return shifts.map((s) => (s.id === updated.id ? updated : s))
}
