/**
 * 外観（ライト/ダーク）の設定（Issue #30）
 *
 * 背景: 端末のナイトモード（prefers-color-scheme）が効くと、テーマの明るい
 * CSS変数と :root のダーク上書きが混ざって色が崩れた。そこで外観は
 * ユーザーが手動で選べる設定にし、ダーク配色はここで一元管理する。
 *
 * 設計:
 * - 値は 'auto'（端末に合わせる）/ 'light' / 'dark' の3つ。保存は画面側。
 * - ダーク時の上書き（DARK_OVERRIDES）は、面と文字の基本色だけを差し替え、
 *   primary-container などは color-mix でテーマ色から生成する。
 *   これで6テーマすべてにダーク配色が自動で付く（テーマごとの定義不要）。
 */

export type Appearance = 'auto' | 'light' | 'dark'

export const APPEARANCE_KEY = 'shiftcraft:appearance'

export const APPEARANCE_OPTIONS: Array<{ value: Appearance; label: string }> = [
  { value: 'auto', label: '端末に合わせる' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
]

/** 保存値が壊れていたら 'auto' に倒す */
export function parseAppearance(value: unknown): Appearance {
  return value === 'light' || value === 'dark' ? value : 'auto'
}

/** 実際にダーク配色を適用すべきか（auto のときは端末設定に従う） */
export function isDarkEffective(appearance: Appearance, osDark: boolean): boolean {
  return appearance === 'dark' || (appearance === 'auto' && osDark)
}

/**
 * ダーク時にテーマ変数の上へ重ねる上書きセット。
 * primary や brand2 はテーマの値をそのまま使い、コンテナ色は color-mix で
 * 「テーマ色を暗い土台に混ぜる」ことで生成する（ブラウザ標準機能）。
 */
export const DARK_OVERRIDES: Record<string, string> = {
  '--bg': '#1d1712',
  '--surface': '#2a211a',
  '--text': '#f6ead9',
  '--muted': '#d8c6a8',
  '--border': '#55432f',
  '--shadow': '0 10px 24px rgba(0, 0, 0, 0.35)',
  '--surface-container-low': '#2a211a',
  '--surface-container': '#372a20',
  '--surface-container-high': '#443425',
  '--primary-container': 'color-mix(in srgb, var(--primary) 38%, #1d1712)',
  '--on-primary-container': '#ffffff',
  '--secondary-container': 'color-mix(in srgb, var(--brand2) 30%, #1d1712)',
  '--on-secondary-container': '#ffffff',
}
