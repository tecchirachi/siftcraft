/**
* ============================================================
* ShiftCraft の画面
* ============================================================
* このファイルの役割:
* 画面の見た目と操作（入力・追加・削除・表示）を担当する。
* 給料計算そのものは src/lib/pay.ts に切り離してあるので、
* ここは「データを集めて pay.ts に渡し、結果を表示する」だけ。
*
* Reactの考え方（このファイルで使う分だけ）:
* - 画面は「状態（state）」から自動で作られる。
* 状態が変われば、Reactが画面を描き直してくれる（再レンダリング）。
* - だからプログラマは「状態をどう変えるか」だけを書けばよい。
*/

import { useEffect, useMemo, useState} from 'react'
import './App.css'
// pay.ts から、計算関数・表示フォーマッタ・型を取り込む
import { calculatePay, formatMinutes, formatYen, type PaySettings, type ShiftInput} from './lib/pay'
// 月別フィルタのロジックは lib/filter.ts に切り離してある（Issue #2）
import { filterByMonth, listMonths } from './lib/filter'

/** 保存・一覧表示に使う「ID付きのシフト」。ShiftInput に id を足した型 */
interface ShiftRecord extends ShiftInput {
id: string
}

// localStorage に保存するときのキー名（保存場所の名前）
const SHIFTS_KEY = 'shiftcraft:shifts'
const SETTINGS_KEY = 'shiftcraft:settings'

/**
* localStorage から JSON を読み込むヘルパー関数。
* - ジェネリクス <T>: 「読み込むデータの型」を呼び出し側が決められる書き方
* - try/catch: 保存データが壊れていてもアプリが落ちないよう、失敗したら初期値を使う
*/
function load<T>(key: string, fallback: T): T {
try {
const raw = localStorage.getItem(key)
return raw? (JSON.parse(raw) as T): fallback
} catch {
return fallback
}
}

export default function App() {
// ------------------------------------------------------------
// 状態（state）の定義
// useState(初期値) が返す [現在の値, 値を変える関数] を受け取る。
// 初期値に「関数」を渡すと、最初の1回だけ実行される（遅延初期化）。
// ここでは localStorage からの読み込みをそのタイミングで行っている。
// ------------------------------------------------------------
const [settings, setSettings] = useState<PaySettings>(() =>
load(SETTINGS_KEY, { hourlyWage: 1200, transportPerShift: 500}),
)
const [shifts, setShifts] = useState<ShiftRecord[]>(() => load(SHIFTS_KEY, []))
// 月別フィルタで選ばれている月。"2026-11" の形式、空文字なら全期間（Issue #2）
const [selectedMonth, setSelectedMonth] = useState('')

// 入力フォームの状態。入力のたびにこのオブジェクトを更新する
const [form, setForm] = useState<ShiftInput>({
date: new Date().toISOString().slice(0, 10), // 今日の日付を初期値に
start: '09:00',
end: '17:00',
breakMinutes: 60,
})

// ------------------------------------------------------------
// 副作用（useEffect）: 状態が変わったら localStorage に保存する
// 第2引数の [settings] は「依存配列」で、この値が変わったときだけ実行される。
// Reactで「状態と外部（保存・通信など）を同期する」ための仕組み。
// ------------------------------------------------------------
useEffect(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)), [settings])
useEffect(() => localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts)), [shifts])

// ------------------------------------------------------------
// 派生データ: シフト一覧を日付順に並べ、各シフトの給料を計算する
// useMemo は「依存する値が変わったときだけ再計算する」仕組み。
// 画面の描き直しのたびに全計算し直す無駄を防ぐ。
// ------------------------------------------------------------
const rows = useMemo(
() =>
// まず選ばれている月で絞り込み、次に日付順に並べ、各シフトの給料を計算する
filterByMonth([...shifts], selectedMonth)
.sort((a, b) => a.date.localeCompare(b.date))
.map((s) => ({ shift: s, pay: calculatePay(s, settings)})),
[shifts, settings, selectedMonth],
)
// 合計は「表示中の rows」から求めるので、月を選ぶと合計もその月だけになる
const total = rows.reduce((sum, r) => sum + r.pay.totalPay, 0)
const totalMinutes = rows.reduce((sum, r) => sum + r.pay.workMinutes, 0)

// ------------------------------------------------------------
// イベントハンドラ: ユーザー操作で状態を変える関数
// 状態は直接書き換えず、必ず set 系の関数に「新しい値」を渡す。
// 配列の追加は [...prev, 新要素] のように新しい配列を作るのがReact流。
// ------------------------------------------------------------
const addShift = () => {
// crypto.randomUUID() で重ならないIDを発行し、一覧の key や削除に使う
setShifts((prev) => [...prev, {...form, id: crypto.randomUUID()}])
}
const removeShift = (id: string) => setShifts((prev) => prev.filter((s) => s.id!== id))

// ------------------------------------------------------------
// 画面（JSX）: HTMLに似た記法でUIを書く。
// {} の中には JavaScript の値を埋め込める。
// input の value と onChange を状態に結びつける書き方を
// 「制御されたコンポーネント」と呼ぶ。
// ------------------------------------------------------------
return (
<main className="app">
<header>
<h1>ShiftCraft</h1>
<p>バイトのシフトと給料を、深夜・残業割増まで正確に計算するアプリ。データはこのブラウザの中だけに保存されます。</p>
</header>

<section className="card">
<h2>設定</h2>
<label>
時給（円）
<input
type="number"
value={settings.hourlyWage}
// 入力が変わるたびに、オブジェクトをコピーして該当項目だけ差し替える
onChange={(e) => setSettings({...settings, hourlyWage: Number(e.target.value)})}
/>
</label>
<label>
交通費 / 1勤務（円）
<input
type="number"
value={settings.transportPerShift}
onChange={(e) => setSettings({...settings, transportPerShift: Number(e.target.value)})}
/>
</label>
</section>

<section className="card">
<h2>シフトを追加</h2>
<label>日付<input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} /></label>
<label>開始<input type="time" value={form.start} onChange={(e) => setForm({...form, start: e.target.value})} /></label>
<label>終了<input type="time" value={form.end} onChange={(e) => setForm({...form, end: e.target.value})} /></label>
<label>
休憩（分）
<input type="number" value={form.breakMinutes} onChange={(e) => setForm({...form, breakMinutes: Number(e.target.value)})} />
</label>
<button onClick={addShift}>追加する</button>
{/* 入力中の内容で即座に計算し、追加前に見込み額を見せる */}
{(() => {
const preview = calculatePay(form, settings)
return <p className="preview">このシフトの見込み: 実働 {formatMinutes(preview.workMinutes)} / {formatYen(preview.totalPay)}（交通費込み）</p>
})()}
</section>

<section className="card">
<h2>シフト一覧</h2>
{/* 月別フィルタ（Issue #2）: 候補はデータに登場する月から自動で作る */}
<label>
表示する月
<select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
<option value="">全期間</option>
{listMonths(shifts).map((m) => (
<option key={m} value={m}>{m.replace('-', '年')}月</option>
))}
</select>
</label>
{rows.length === 0? (
// 三項演算子で「空のとき」と「あるとき」の表示を切り替える
<p>{selectedMonth? 'この月のシフトはありません。': 'まだシフトがありません。上のフォームから追加してください。'}</p>
): (
<ul className="shifts">
{rows.map(({ shift, pay}) => (
// 一覧の各要素には安定した key（ここでは id）を付けるのがReactの決まり
<li key={shift.id}>
<span>{shift.date} {shift.start}–{shift.end}（休憩{shift.breakMinutes}分）</span>
<span>{formatMinutes(pay.workMinutes)} / {formatYen(pay.totalPay)}</span>
<button onClick={() => removeShift(shift.id)}>削除</button>
</li>
))}
</ul>
)}
<p className="total">{selectedMonth? `${selectedMonth.replace('-', '年')}月の合計`: '全期間の合計'}: {formatMinutes(totalMinutes)} / {formatYen(total)}（{rows.length}件）</p>
</section>
</main>
)
}
