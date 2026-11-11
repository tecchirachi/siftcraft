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

/** UI テーマ。vars は CSS変数への割り当て（--brand など） */
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
vars: { '--brand': '#ff9e6e', '--brand2': '#7bc8a4', '--bg': '#fff7ec', '--surface': '#ffffff', '--border': '#f3e3cf', '--accent': '#ff9e6e', '--accent-dark': '#e07f45'},
swatch: ['#ff9e6e', '#7bc8a4'],
},
{
id: 'mint',
name: 'ミント',
cost: 50,
vars: { '--brand': '#3fbf8f', '--brand2': '#7bc8a4', '--bg': '#effaf3', '--surface': '#ffffff', '--border': '#cfe9d8', '--accent': '#3fbf8f', '--accent-dark': '#2a9d74'},
swatch: ['#3fbf8f', '#a5dd8e'],
},
{
id: 'soda',
name: 'ソーダ',
cost: 120,
vars: { '--brand': '#4fa8e0', '--brand2': '#6fd3e7', '--bg': '#eef7fd', '--surface': '#ffffff', '--border': '#d2e7f5', '--accent': '#4fa8e0', '--accent-dark': '#3585c0'},
swatch: ['#4fa8e0', '#6fd3e7'],
},
{
id: 'sakura',
name: 'サクラ',
cost: 200,
vars: { '--brand': '#f28bb4', '--brand2': '#f7b8cd', '--bg': '#fdf1f5', '--surface': '#ffffff', '--border': '#f6d7e2', '--accent': '#f28bb4', '--accent-dark': '#d96b97'},
swatch: ['#f28bb4', '#f7b8cd'],
},
{
id: 'yoru',
name: 'ヨル（ダーク）',
cost: 300,
vars: { '--brand': '#8f7fe8', '--brand2': '#5fc9b8', '--bg': '#1f1b2e', '--surface': '#2c2742', '--border': '#463f63', '--accent': '#8f7fe8', '--accent-dark': '#b3a6f5'},
swatch: ['#8f7fe8', '#5fc9b8'],
},
{
id: 'gold',
name: 'ゴールド',
cost: 400,
vars: { '--brand': '#e3a008', '--brand2': '#f2c94c', '--bg': '#fdf6e0', '--surface': '#fffdf4', '--border': '#f0dfae', '--accent': '#e3a008', '--accent-dark': '#b97e04'},
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
