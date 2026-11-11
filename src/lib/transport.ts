/**
* 交通費の詳細設定(Issue #18)
*
* 役割: バイト先の「交通費の方式」から、1勤務あたりの支給額を解決する。
* 給料計算（pay.ts）は今まで通り「1勤務あたりいくら」しか知らなくてよい。
* 方式の違いはここで吸収するのが、関心の分離という考え方。
*
* 方式:
* - none: 支給なし → 0
* - fixed: 1勤務あたり固定額（従来の方式。既存データは未設定=これとして扱う）
* - roundTrip: 片道運賃 × 2（往復）
* - pass: 定期でまかなう → 支給なし扱いで 0
* シフト側で上書き（override）があれば、方式よりそちらを優先する。
*/

export type TransportMode = 'none' | 'fixed' | 'roundTrip' | 'pass'

export interface TransportSettings {
transportMode?: TransportMode
/** fixed のときの金額（従来の transportPerShift をそのまま使う） */
transportPerShift: number
/** roundTrip のときの片道運賃 */
transportOneWay?: number
}

/** バイト先の設定から1勤務あたりの交通費を求める */
export function transportPerShiftOf(settings: TransportSettings): number {
switch (settings.transportMode?? 'fixed') {
case 'none':
case 'pass':
return 0
case 'roundTrip':
return (settings.transportOneWay?? 0) * 2
case 'fixed':
default:
return settings.transportPerShift
}
}

/** シフト個別の上書きがあればそれを、なければバイト先の設定を使う */
export function resolveTransport(settings: TransportSettings, override: number | undefined): number {
return override!== undefined && override!== null? override: transportPerShiftOf(settings)
}
