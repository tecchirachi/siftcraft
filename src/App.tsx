/**
* ShiftCraft の画面
*
* このファイルの役割: 画面の見た目と操作を担当する。
* 給料計算は src/lib/pay.ts などに切り離してあるので、ここは
* 「データを集めて lib に渡し、結果を表示する」だけ。
*
* UI設計（スマホアプリとして使う前提）:
* - 幅は最大480pxの1カラムにし、片手操作を想定する
* - 一番見たい「今月の見込み給料」を先頭のヒーローカードに大きく出す
* - 入力欄は高さ48px以上・文字16px（iPhoneで自動ズームしない大きさ）
* - 設定のような低頻度の操作は details で折りたたんで画面を空ける
*/

import { useEffect, useMemo, useState} from 'react'
import './App.css'
import { calculatePay, formatMinutes, formatYen, type PaySettings, type ShiftInput} from './lib/pay'
import { filterByMonth, listMonths} from './lib/filter'
import { goalProgress} from './lib/goal'
import { shiftsToCsv} from './lib/csv'
import { validateShift} from './lib/validate'
// 予定表（カレンダー）のロジック（Issue #6）
import { buildMonthGrid, groupByDate, shiftMonth } from './lib/calendar'
/** 保存・一覧表示に使う「ID付きのシフト」 */
interface ShiftRecord extends ShiftInput {
id: string
}

const SHIFTS_KEY = 'shiftcraft:shifts'
const SETTINGS_KEY = 'shiftcraft:settings'
const GOAL_KEY = 'shiftcraft:goal'

/** localStorage から JSON を読み込む（壊れていたら初期値を使う） */
function load<T>(key: string, fallback: T): T {
try {
const raw = localStorage.getItem(key)
return raw? (JSON.parse(raw) as T): fallback
} catch {
return fallback
}
}

/** "2026-11-02" から { day: "2", weekday: "月"} を取り出す（一覧のバッジ用） */
function dateBadge(date: string): { day: string; weekday: string} {
const d = new Date(`${date}T00:00:00`)
return {
day: String(d.getDate()),
weekday: d.toLocaleDateString('ja-JP', { weekday: 'short'}),
}
}

export default function App() {
// ---- 状態（state） ----
const [settings, setSettings] = useState<PaySettings>(() =>
load(SETTINGS_KEY, { hourlyWage: 1200, transportPerShift: 500}),
)
const [shifts, setShifts] = useState<ShiftRecord[]>(() => load(SHIFTS_KEY, []))
const [selectedMonth, setSelectedMonth] = useState('')
const [goalYen, setGoalYen] = useState<number>(() => load(GOAL_KEY, 80000))
const [errors, setErrors] = useState<string[]>([])
// 予定表で表示中の年月と、タップで選ばれた日（Issue #6）
const now = new Date()
const [viewYM, setViewYM] = useState({ year: now.getFullYear(), month: now.getMonth()+ 1})
const [pickedDate, setPickedDate] = useState(now.toISOString().slice(0, 10))
const [form, setForm] = useState<ShiftInput>({
date: new Date().toISOString().slice(0, 10),
start: '09:00',
end: '17:00',
breakMinutes: 60,
})

// ---- 状態が変わったら localStorage に保存する ----
useEffect(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)), [settings])
useEffect(() => localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts)), [shifts])
useEffect(() => localStorage.setItem(GOAL_KEY, JSON.stringify(goalYen)), [goalYen])

// ---- 派生データ: 月で絞り込み → 並べ替え → 給料計算 ----
const rows = useMemo(
() =>
filterByMonth([...shifts], selectedMonth)
.sort((a, b) => a.date.localeCompare(b.date))
.map((s) => ({ shift: s, pay: calculatePay(s, settings)})),
[shifts, settings, selectedMonth],
)
const total = rows.reduce((sum, r) => sum + r.pay.totalPay, 0)
const totalMinutes = rows.reduce((sum, r) => sum + r.pay.workMinutes, 0)
const goal = goalProgress(total, goalYen, settings.hourlyWage)
const preview = calculatePay(form, settings)
const periodLabel = selectedMonth? `${selectedMonth.replace('-', '年')}月`: '全期間'
// 予定表用: 表示月のマス並びと、日付ごとにまとめたシフト（金額つき）
const calGrid = buildMonthGrid(viewYM.year, viewYM.month)
const calByDate = groupByDate(shifts.map((s) => ({...s, pay: calculatePay(s, settings)})))
const pickedRows = calByDate.get(pickedDate)?? []
const todayStr = now.toISOString().slice(0, 10)

// ---- 操作 ----
const addShift = () => {
const errs = validateShift(form)
setErrors(errs)
if (errs.length > 0) return
setShifts((prev) => [...prev, {...form, id: crypto.randomUUID()}])
}
const removeShift = (id: string) => setShifts((prev) => prev.filter((s) => s.id!== id))
const downloadCsv = () => {
const csv = shiftsToCsv(rows.map((r) => ({ shift: r.shift, pay: r.pay})))
const blob = new Blob([csv], { type: 'text/csv;charset=utf-8'})
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = selectedMonth? `shiftcraft-${selectedMonth}.csv`: 'shiftcraft-all.csv'
a.click()
URL.revokeObjectURL(url)
}

// ---- 画面 ----
return (
<main className="app">
<header className="app-header">
<div className="logo">S</div>
<div>
<h1>ShiftCraft</h1>
<p>シフトと給料の見込み</p>
</div>
<select
className="month-select"
aria-label="表示する月"
value={selectedMonth}
onChange={(e) => setSelectedMonth(e.target.value)}
>
<option value="">全期間</option>
{listMonths(shifts).map((m) => (
<option key={m} value={m}>{m.replace('-', '年')}月</option>
))}
</select>
</header>

{/* ヒーロー: 一番見たい数字を大きく */}
<section className="hero">
<p className="hero-label">{periodLabel}の見込み給料</p>
<p className="hero-amount">{formatYen(total)}</p>
<p className="hero-sub">実働 {formatMinutes(totalMinutes)} ・ {rows.length}件のシフト</p>
<div className="hero-goal">
<div className="hero-goal-head">
<span>目標 {formatYen(goalYen)}</span>
<span>{goal.progressPercent}%</span>
</div>
<div className="goal-bar"><div className="goal-fill" style={{ width: `${goal.progressPercent}%`}} /></div>
<p className="hero-goal-note">
{goal.achieved
? '目標達成です。お疲れさまでした。'
: `あと ${formatYen(goal.remainingYen)}${goal.remainingMinutes!== null? `（約 ${formatMinutes(goal.remainingMinutes)}）`: ''}`}
</p>
</div>
</section>

{/* 予定表（Issue #6）: シフトのある日が一目で分かる月カレンダー */}
<section className="card">
<div className="card-head">
<button className="nav-btn" aria-label="前の月" onClick={() => setViewYM((v) => shiftMonth(v.year, v.month, -1))}>‹</button>
<h2>{viewYM.year}年{viewYM.month}月の予定表</h2>
<button className="nav-btn" aria-label="次の月" onClick={() => setViewYM((v) => shiftMonth(v.year, v.month, 1))}>›</button>
</div>
<div className="cal-week">
{['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (<span key={w} className={i === 0? 'sun': i === 6? 'sat': ''}>{w}</span>))}
</div>
<div className="cal-grid">
{calGrid.map((cell, i) =>
cell === null? (
<span key={i} />
): (
<button
key={cell.date}
className={`cal-cell${cell.date === todayStr? ' today': ''}${cell.date === pickedDate? ' picked': ''}`}
onClick={() => {
// 日をタップしたら、その日を選んで、追加フォームの日付にも入れる
setPickedDate(cell.date)
setForm((f) => ({...f, date: cell.date}))
}}
>
<span className="cal-day">{cell.day}</span>
{(() => {
const dayRows = calByDate.get(cell.date)
if (!dayRows) return null
const sum = dayRows.reduce((a, r) => a + r.pay.totalPay, 0)
return (<><span className="cal-dots">{'●'.repeat(Math.min(3, dayRows.length))}</span><span className="cal-yen">{formatYen(sum)}</span></>)
})()}
</button>
),
)}
</div>
{/* 選んだ日の詳細 */}
<div className="cal-detail">
<strong>{pickedDate.slice(5).replace('-', '月')}日</strong>
{pickedRows.length === 0? (
<span>シフトはありません（上の日付がフォームに入りました）</span>
): (
pickedRows.map((r) => (<span key={r.id}>{r.start}–{r.end} / {formatYen(r.pay.totalPay)}</span>))
)}
</div>
</section>

{/* シフト追加 */}
<section className="card">
<h2>シフトを追加</h2>
<label className="field">
<span>日付</span>
<input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
</label>
<div className="field-row">
<label className="field">
<span>開始</span>
<input type="time" value={form.start} onChange={(e) => setForm({...form, start: e.target.value})} />
</label>
<span className="field-arrow">→</span>
<label className="field">
<span>終了</span>
<input type="time" value={form.end} onChange={(e) => setForm({...form, end: e.target.value})} />
</label>
</div>
<label className="field">
<span>休憩（分）</span>
<input type="number" inputMode="numeric" value={form.breakMinutes} onChange={(e) => setForm({...form, breakMinutes: Number(e.target.value)})} />
</label>
<p className="preview">見込み: 実働 {formatMinutes(preview.workMinutes)} / <strong>{formatYen(preview.totalPay)}</strong>（交通費込み）</p>
{errors.length > 0 && (
<ul className="errors">{errors.map((e) => (<li key={e}>{e}</li>))}</ul>
)}
<button className="primary-btn" onClick={addShift}>＋ シフトを追加</button>
</section>

{/* 一覧 */}
<section className="card">
<div className="card-head">
<h2>シフト一覧</h2>
<button className="ghost-btn" onClick={downloadCsv} disabled={rows.length === 0}>CSVで保存</button>
</div>
{rows.length === 0? (
<p className="empty">{selectedMonth? 'この月のシフトはありません。': 'まだシフトがありません。上のフォームから追加してください。'}</p>
): (
<ul className="shifts">
{rows.map(({ shift, pay}) => {
const badge = dateBadge(shift.date)
const overtime = pay.overtimeMinutes + pay.overtimeLateNightMinutes
const lateNight = pay.lateNightMinutes + pay.overtimeLateNightMinutes
return (
<li key={shift.id} className="shift-item">
<div className="date-badge"><span className="date-day">{badge.day}</span><span className="date-week">{badge.weekday}</span></div>
<div className="shift-main">
<span className="shift-time">{shift.start} – {shift.end}</span>
<span className="shift-meta">
実働 {formatMinutes(pay.workMinutes)}・休憩{shift.breakMinutes}分
{overtime > 0 && <span className="chip">残業 {formatMinutes(overtime)}</span>}
{lateNight > 0 && <span className="chip night">深夜 {formatMinutes(lateNight)}</span>}
</span>
</div>
<div className="shift-side">
<span className="shift-pay">{formatYen(pay.totalPay)}</span>
<button className="delete-btn" aria-label="削除" onClick={() => removeShift(shift.id)}>削除</button>
</div>
</li>
)
})}
</ul>
)}
</section>

{/* 設定は折りたたみ（低頻度の操作で画面を占有しない） */}
<details className="card settings">
<summary>設定（時給・交通費・目標）</summary>
<label className="field">
<span>時給（円）</span>
<input type="number" inputMode="numeric" value={settings.hourlyWage} onChange={(e) => setSettings({...settings, hourlyWage: Number(e.target.value)})} />
</label>
<label className="field">
<span>交通費 / 1勤務（円）</span>
<input type="number" inputMode="numeric" value={settings.transportPerShift} onChange={(e) => setSettings({...settings, transportPerShift: Number(e.target.value)})} />
</label>
<label className="field">
<span>目標金額（円）</span>
<input type="number" inputMode="numeric" value={goalYen} onChange={(e) => setGoalYen(Number(e.target.value))} />
</label>
</details>

<footer className="app-footer">データはこの端末の中だけに保存されます</footer>
</main>
)
}
