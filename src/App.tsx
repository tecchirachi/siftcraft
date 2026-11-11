import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { calculatePay, formatMinutes, formatYen, type PaySettings, type ShiftInput } from './lib/pay'

interface ShiftRecord extends ShiftInput {
  id: string
}

const SHIFTS_KEY = 'shiftcraft:shifts'
const SETTINGS_KEY = 'shiftcraft:settings'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [settings, setSettings] = useState<PaySettings>(() =>
    load(SETTINGS_KEY, { hourlyWage: 1200, transportPerShift: 500 }),
  )
  const [shifts, setShifts] = useState<ShiftRecord[]>(() => load(SHIFTS_KEY, []))
  const [form, setForm] = useState<ShiftInput>({
    date: new Date().toISOString().slice(0, 10),
    start: '09:00',
    end: '17:00',
    breakMinutes: 60,
  })

  useEffect(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)), [settings])
  useEffect(() => localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts)), [shifts])

  const rows = useMemo(
    () =>
      [...shifts]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => ({ shift: s, pay: calculatePay(s, settings) })),
    [shifts, settings],
  )
  const total = rows.reduce((sum, r) => sum + r.pay.totalPay, 0)
  const totalMinutes = rows.reduce((sum, r) => sum + r.pay.workMinutes, 0)

  const addShift = () => {
    setShifts((prev) => [...prev, { ...form, id: crypto.randomUUID() }])
  }
  const removeShift = (id: string) => setShifts((prev) => prev.filter((s) => s.id !== id))

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
            onChange={(e) => setSettings({ ...settings, hourlyWage: Number(e.target.value) })}
          />
        </label>
        <label>
          交通費 / 1勤務（円）
          <input
            type="number"
            value={settings.transportPerShift}
            onChange={(e) => setSettings({ ...settings, transportPerShift: Number(e.target.value) })}
          />
        </label>
      </section>

      <section className="card">
        <h2>シフトを追加</h2>
        <label>日付<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label>開始<input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
        <label>終了<input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
        <label>
          休憩（分）
          <input type="number" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: Number(e.target.value) })} />
        </label>
        <button onClick={addShift}>追加する</button>
        {(() => {
          const preview = calculatePay(form, settings)
          return <p className="preview">このシフトの見込み: 実働 {formatMinutes(preview.workMinutes)} / {formatYen(preview.totalPay)}（交通費込み）</p>
        })()}
      </section>

      <section className="card">
        <h2>シフト一覧</h2>
        {rows.length === 0 ? (
          <p>まだシフトがありません。上のフォームから追加してください。</p>
        ) : (
          <ul className="shifts">
            {rows.map(({ shift, pay }) => (
              <li key={shift.id}>
                <span>{shift.date} {shift.start}–{shift.end}（休憩{shift.breakMinutes}分）</span>
                <span>{formatMinutes(pay.workMinutes)} / {formatYen(pay.totalPay)}</span>
                <button onClick={() => removeShift(shift.id)}>削除</button>
              </li>
            ))}
          </ul>
        )}
        <p className="total">合計: {formatMinutes(totalMinutes)} / {formatYen(total)}</p>
      </section>
    </main>
  )
}
