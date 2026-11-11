/**
* マスコット「まるまる」の育成ロジック
*
* 役割: 目標の進捗率（0〜100%）から、マスコットの成長段階と
* 応援メッセージを決める純粋関数。
* 「お金を貯めるのを楽しむ」ための仕掛けで、計算ルールはここに閉じ込め、
* 見た目（SVGの描き分け）は App.tsx 側が level を見て行う。
*
* 成長の考え方:
* - 頭の芽が、進捗に合わせて 種 → 芽 → 双葉 → つぼみ → 花 と育つ
* - 段階は5つ。25%ごとに1段階上がるシンプルな刻みにしている
* （細かすぎると変化に気づけないので、あえて大づかみ）
*/
export interface MascotState {
/** 成長段階 1〜5 */
level: number
/** 段階の名前 */
stageName: string
/** 吹き出しに表示する一言 */
message: string
}

interface Stage {
minPercent: number
stageName: string
message: string
}

// 下から順に「この%以上でこの段階」という表。探すときは後ろから見る
const STAGES: Stage[] = [
{ minPercent: 0, stageName: 'たね', message: 'まあるい一歩、はじめよう。ぼくも一緒にそだつよ。'},
{ minPercent: 25, stageName: 'めばえ', message: '芽が出たよ。その調子、その調子。'},
{ minPercent: 50, stageName: 'ふたば', message: '半分まできたね。葉っぱも うれしそう。'},
{ minPercent: 75, stageName: 'つぼみ', message: 'つぼみがふくらんできた。あと少しだよ。'},
{ minPercent: 100, stageName: 'まんかい', message: 'お花が咲いたよ。がんばったね、ありがとう。'},
]

export function mascotForProgress(progressPercent: number): MascotState {
// 表を後ろ（高い段階）から探し、最初に条件を満たした段階を採用する
const stage = [...STAGES].reverse().find((s) => progressPercent >= s.minPercent)?? STAGES[0]
const level = STAGES.indexOf(stage) + 1
return { level, stageName: stage.stageName, message: stage.message}
}
