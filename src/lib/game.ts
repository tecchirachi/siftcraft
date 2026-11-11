/**
* レベルとポイントの仕組み(Issue #21)
*
* 役割: 「全期間の実績」から XP・レベル・ポイントを計算し、
* ポイントで解放できる UI テーマの定義を持つ。
*
* 設計のポイント:
* - XP と獲得ポイントは「保存せず、実績から毎回計算する」。
* シフトを消せば下がる代わりに、データの不整合が起きない（単一の情報源）。
* - ポイント残高 = 獲得ポイント − 解放済みテーマの価格合計。
* 「使った額」も保存せず、解放済み一覧から導出できる。
* - テーマは色の値（CSS変数）のデータだけを持ち、適用は画面側がやる。
*/

export interface GameStats {
totalWorkMinutes: number
totalShifts: number
}

export interface LevelInfo {
level: number
title: string
xp: number
/** このレベルの開始XP */
levelStartXp: number
/** 次のレベルに必要なXP（最大レベルでは xp と同じ） */
nextLevelXp: number
/** レベル内進捗 0〜100 */
progressPercent: number
}

/** レベル L に到達するのに必要な累計XP。L が大きいほど間隔が広がる（2次式） */
export function xpForLevel(level: number): number {
if (level <= 1) return 0
return 50 * (level - 1) * level // L2=100, L3=300, L4=600, L5=1000, L6=1500...
}

/** 実績から XP を計算する: 実働1時間 = 10XP、1シフト = 15XP */
export function xpOf(stats: GameStats): number {
return Math.floor(stats.totalWorkMinutes / 60) * 10 + stats.totalShifts * 15
}

/** 実績から獲得ポイントを計算する: 実働1時間 = 5P、1シフト = 10P */
export function pointsEarnedOf(stats: GameStats): number {
return Math.floor(stats.totalWorkMinutes / 60) * 5 + stats.totalShifts * 10
}

const TITLES: Array<{ minLevel: number; title: string}> = [
{ minLevel: 10, title: '伝説のバイト'},
{ minLevel: 8, title: 'バイトマスター'},
{ minLevel: 6, title: 'バイトリーダー'},
{ minLevel: 4, title: '頼れるバイト'},
{ minLevel: 2, title: 'バイトかけだし'},
{ minLevel: 1, title: 'バイト見習い'},
]

export function titleForLevel(level: number): string {
return TITLES.find((t) => level >= t.minLevel)?.title?? 'バイト見習い'
}

export function levelOf(stats: GameStats): LevelInfo {
const xp = xpOf(stats)
let level = 1
while (xp >= xpForLevel(level + 1)) level++
const levelStartXp = xpForLevel(level)
const nextLevelXp = xpForLevel(level + 1)
const progressPercent =
nextLevelXp > levelStartXp
? Math.min(100, Math.floor(((xp - levelStartXp) / (nextLevelXp - levelStartXp)) * 100))
: 100
return { level, title: titleForLevel(level), xp, levelStartXp, nextLevelXp, progressPercent}
}

/** UI テーマ。vars は CSS変数への割り当て。
 * Issue #24 からは Material Design 3 の「カラーロール」を採用:
 * 色を部品ごとに決めず、primary / primary-container / surface-container の
 * ような役割で決める。テーマは役割の値セットを差し替えるだけになる */
export interface Theme {
id: string
name: string
cost: number
vars: Record<string, string>
/** テーマカード表示用の代表色（ドット表示） */
swatch: [string, string]
}

export const THEMES: Theme[] = [
{
id: 'peach',
name: 'ピーチ（標準）',
cost: 0,
vars: { '--brand': '#ff9e6e', '--brand2': '#7bc8a4', '--bg': '#fffbf5', '--surface': '#ffffff', '--border': '#f3e3cf', '--accent': '#ff9e6e', '--accent-dark': '#e07f45', '--primary': '#c75b26', '--on-primary': '#ffffff', '--primary-container': '#ffe3d3', '--on-primary-container': '#5c2e12', '--secondary-container': '#d8efdf', '--on-secondary-container': '#1f4630', '--tertiary': '#8b7bc7', '--surface-container-low': '#fff4e8', '--surface-container': '#fdeed9', '--surface-container-high': '#f7e3c8' },
swatch: ['#ff9e6e', '#7bc8a4'],
},
{
id: 'mint',
name: 'ミント',
cost: 50,
vars: { '--brand': '#3fbf8f', '--brand2': '#7bc8a4', '--bg': '#f7fdf8', '--surface': '#ffffff', '--border': '#cfe9d8', '--accent': '#3fbf8f', '--accent-dark': '#2a9d74', '--primary': '#1f7a54', '--on-primary': '#ffffff', '--primary-container': '#d2f0e0', '--on-primary-container': '#0e3d29', '--secondary-container': '#ffe9d2', '--on-secondary-container': '#5c3a12', '--tertiary': '#e08a3c', '--surface-container-low': '#eafaf0', '--surface-container': '#dcf2e4', '--surface-container-high': '#cdeeda' },
swatch: ['#3fbf8f', '#a5dd8e'],
},
{
id: 'soda',
name: 'ソーダ',
cost: 120,
vars: { '--brand': '#4fa8e0', '--brand2': '#6fd3e7', '--bg': '#f7fbff', '--surface': '#ffffff', '--border': '#d2e7f5', '--accent': '#4fa8e0', '--accent-dark': '#3585c0', '--primary': '#1668a8', '--on-primary': '#ffffff', '--primary-container': '#d3eafd', '--on-primary-container': '#0d3555', '--secondary-container': '#d9f2f4', '--on-secondary-container': '#12444a', '--tertiary': '#4fb3bf', '--surface-container-low': '#ebf5fd', '--surface-container': '#d9ecfa', '--surface-container-high': '#c6e2f6' },
swatch: ['#4fa8e0', '#6fd3e7'],
},
{
id: 'sakura',
name: 'サクラ',
cost: 200,
vars: { '--brand': '#f28bb4', '--brand2': '#f7b8cd', '--bg': '#fff9fb', '--surface': '#ffffff', '--border': '#f6d7e2', '--accent': '#f28bb4', '--accent-dark': '#d96b97', '--primary': '#c24d84', '--on-primary': '#ffffff', '--primary-container': '#ffdfea', '--on-primary-container': '#57162f', '--secondary-container': '#e6f4e3', '--on-secondary-container': '#274a20', '--tertiary': '#7bc8a4', '--surface-container-low': '#fdf0f4', '--surface-container': '#fbe0ea', '--surface-container-high': '#f6cede' },
swatch: ['#f28bb4', '#f7b8cd'],
},
{
id: 'yoru',
name: 'ヨル（ダーク）',
cost: 300,
vars: { '--brand': '#8f7fe8', '--brand2': '#5fc9b8', '--bg': '#1f1b2e', '--surface': '#2c2742', '--border': '#463f63', '--accent': '#8f7fe8', '--accent-dark': '#b3a6f5', '--text': '#f2ecff', '--muted': '#c4bce0', '--primary': '#b3a6f5', '--on-primary': '#2a2140', '--primary-container': '#463a75', '--on-primary-container': '#e9e2ff', '--secondary-container': '#274a44', '--on-secondary-container': '#c2f0e6', '--tertiary': '#5fc9b8', '--surface-container-low': '#2c2742', '--surface-container': '#362f52', '--surface-container-high': '#403863' },
swatch: ['#8f7fe8', '#5fc9b8'],
},
{
id: 'gold',
name: 'ゴールド',
cost: 400,
vars: { '--brand': '#e3a008', '--brand2': '#f2c94c', '--bg': '#fffdf4', '--surface': '#ffffff', '--border': '#f0dfae', '--accent': '#e3a008', '--accent-dark': '#b97e04', '--primary': '#a87408', '--on-primary': '#ffffff', '--primary-container': '#ffedb8', '--on-primary-container': '#4d3402', '--secondary-container': '#fdeeda', '--on-secondary-container': '#5c3412', '--tertiary': '#e07f45', '--surface-container-low': '#fdf6e0', '--surface-container': '#fbeecb', '--surface-container-high': '#f5e0a4' },
swatch: ['#e3a008', '#f2c94c'],
},
]

export function themeById(id: string): Theme {
return THEMES.find((t) => t.id === id)?? THEMES[0]
}

/** ポイント残高 = 獲得 − 解放済みテーマの価格合計 */
export function pointsBalance(stats: GameStats, unlockedIds: string[]): number {
const spent = THEMES.filter((t) => unlockedIds.includes(t.id)).reduce((a, t) => a + t.cost, 0)
return pointsEarnedOf(stats) - spent
}
