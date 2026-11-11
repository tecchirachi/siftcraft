/**
 * ShiftCraft の画面
 *
 * このファイルの役割: 画面の見た目と操作を担当する。
 * 給料計算は src/lib/pay.ts などに切り離してあるので、ここは
 * 「データを集めて lib に渡し、結果を表示する」だけ。
 *
 * UI設計（スマホアプリとして使う前提）(Issue #12 で1画面化):
 * - メイン（カレンダーページ）はスマホ1画面に収める: ヘッダー、月の
 *   サマリー1行、月移動、カレンダーだけ。画面の高さいっぱいに広げる
 * - 集計・バイト先・設定は別ページにし、ハンバーガーメニュー
 *   （ドロワー）から移動する。ルーターは入れず state で切り替える
 * - 日付タップで Bottom sheet が開き、その日の確認と入力ができる
 */

import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { calculatePay, formatMinutes, formatYen, type ShiftInput } from './lib/pay'
import { goalProgress } from './lib/goal'
import { shiftsToCsv } from './lib/csv'
import { validateShift } from './lib/validate'
// 予定表（カレンダー）のロジック（Issue #6）
import { buildMonthGrid, groupByDate, shiftMonth } from './lib/calendar'
// バイト先（複数登録）のロジック（Issue #7）
import { migrateWorkplaces, resolveWorkplace, summarizeByWorkplace, workplaceColor, workplaceToSettings, type Workplace } from './lib/workplace'
// 時間の重なり判定（Issue #9）
import { findOverlaps } from './lib/overlap'
// 入力候補（オートコンプリート）（Issue #11）
import { frequentPatterns, uniqueSuggestions } from './lib/suggest'

/** フォームとシフト共通の形: 入力項目 + 選んだバイト先のID */
interface ShiftForm extends ShiftInput {
  workplaceId?: string
}
interface ShiftRecord extends ShiftForm {
  id: string
}

const SHIFTS_KEY = 'shiftcraft:shifts'
const SETTINGS_KEY = 'shiftcraft:settings'
const GOAL_KEY = 'shiftcraft:goal'
const WORKPLACES_KEY = 'shiftcraft:workplaces'

/** localStorage から JSON を読み込む（壊れていたら初期値を使う） */
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "2026-11-07" を「11月7日（木）」のように表示する */
function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return `${d.getMonth() + 1}月${d.getDate()}日（${d.toLocaleDateString('ja-JP', { weekday: 'short' })}）`
}

/** 表示中のページ。ルーターなしで state 切り替えする（Issue #12） */
type Page = 'calendar' | 'summary' | 'workplaces' | 'settings'
const PAGE_TITLES: Record<Page, string> = {
  calendar: 'カレンダー',
  summary: '集計',
  workplaces: 'バイト先',
  settings: '設定',
}

export default function App() {
  // ---- 状態（state） ----
  // バイト先一覧。初回は旧・単一設定（時給/交通費）から移行して作る（Issue #7）
  const [workplaces, setWorkplaces] = useState<Workplace[]>(() =>
    migrateWorkplaces(
      load<Workplace[] | null>(WORKPLACES_KEY, null),
      load(SETTINGS_KEY, { hourlyWage: 1200, transportPerShift: 500 }),
    ),
  )
  const [shifts, setShifts] = useState<ShiftRecord[]>(() => load(SHIFTS_KEY, []))
  const [goalYen, setGoalYen] = useState<number>(() => load(GOAL_KEY, 80000))
  const [page, setPage] = useState<Page>('calendar')
  const [menuOpen, setMenuOpen] = useState(false)
  const [daySheetOpen, setDaySheetOpen] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  // 重なり警告を「確認済み」にするための署名（フォーム内容+相手のID）（Issue #9）
  const [overlapAck, setOverlapAck] = useState('')
  // 予定表で表示中の年月と、タップで選ばれた日（Issue #6）
  const now = new Date()
  const [viewYM, setViewYM] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [pickedDate, setPickedDate] = useState(now.toISOString().slice(0, 10))
  const [form, setForm] = useState<ShiftForm>({
    date: new Date().toISOString().slice(0, 10),
    start: '09:00',
    end: '17:00',
    breakMinutes: 60,
    workplaceId: undefined, // 未選択なら先頭のバイト先として解決される
  })

  // ---- 状態が変わったら localStorage に保存する ----
  useEffect(() => localStorage.setItem(WORKPLACES_KEY, JSON.stringify(workplaces)), [workplaces])
  useEffect(() => localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts)), [shifts])
  useEffect(() => localStorage.setItem(GOAL_KEY, JSON.stringify(goalYen)), [goalYen])

  // ---- 派生データ ----
  // シフトのバイト先を解決し、そのバイト先の時給・交通費で計算するためのヘルパー
  const wpOf = (s: ShiftForm) => resolveWorkplace(workplaces, s.workplaceId)
  const settingsOf = (s: ShiftForm) => workplaceToSettings(wpOf(s))
  // 合計はカレンダー表示中の月に連動する（Issue #10）
  const monthKey = `${viewYM.year}-${pad2(viewYM.month)}`
  const rows = useMemo(
    () =>
      shifts
        .filter((s) => s.date.startsWith(monthKey))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => ({ shift: s, pay: calculatePay(s, settingsOf(s)) })),
    [shifts, workplaces, monthKey],
  )
  // バイト先別の合計（表示中の月）
  const wpTotals = summarizeByWorkplace(
    rows.map((r) => ({ workplaceId: r.shift.workplaceId, totalPay: r.pay.totalPay, workMinutes: r.pay.workMinutes })),
    workplaces,
  )
  const total = rows.reduce((sum, r) => sum + r.pay.totalPay, 0)
  const totalMinutes = rows.reduce((sum, r) => sum + r.pay.workMinutes, 0)
  // 「あと何時間」の換算は先頭のバイト先の時給を代表値として使う
  const goal = goalProgress(total, goalYen, workplaces[0]?.hourlyWage ?? 0)
  const preview = calculatePay(form, settingsOf(form))
  // 入力中の内容と重なる既存シフト（Issue #9）。入力のたびに再計算される
  const formOverlaps = form.date && form.start && form.end ? findOverlaps(form, shifts) : []
  const overlapSig = JSON.stringify([form, formOverlaps.map((s) => s.id)])
  // 予定表用: 表示月のマス並びと、日付ごとにまとめたシフト（金額つき）
  const calGrid = buildMonthGrid(viewYM.year, viewYM.month)
  const calByDate = groupByDate(shifts.map((s) => ({ ...s, pay: calculatePay(s, settingsOf(s)), workplaceName: wpOf(s).name })))
  const pickedRows = calByDate.get(pickedDate) ?? []
  const todayStr = now.toISOString().slice(0, 10)
  // オートコンプリート候補（Issue #11）
  const patterns = frequentPatterns(shifts, wpOf(form).id, (s) => wpOf(s).id)
  const nameSuggestions = uniqueSuggestions(workplaces.map((w) => w.name))
  const placeSuggestions = uniqueSuggestions(workplaces.map((w) => w.place))
  const memoSuggestions = uniqueSuggestions(workplaces.map((w) => w.memo))

  // ---- 操作 ----
  const goPage = (p: Page) => {
    setPage(p)
    setMenuOpen(false)
  }
  const openDay = (date: string) => {
    setPickedDate(date)
    setForm((f) => ({ ...f, date }))
    setErrors([])
    setOverlapAck('')
    setDaySheetOpen(true)
  }
  const addShift = () => {
    const errs = validateShift(form)
    setErrors(errs)
    if (errs.length > 0) return
    // 時間が重なる場合はまず警告だけ出して止め、同じ内容でもう一度押されたら登録する
    if (formOverlaps.length > 0 && overlapAck !== overlapSig) {
      setOverlapAck(overlapSig)
      return
    }
    setOverlapAck('')
    setShifts((prev) => [...prev, { ...form, id: crypto.randomUUID() }])
  }
  const removeShift = (id: string) => setShifts((prev) => prev.filter((s) => s.id !== id))
  // バイト先の追加・更新・削除（削除されたバイト先のシフトは先頭に寄せられる）
  const addWorkplace = () =>
    setWorkplaces((prev) => [...prev, { id: crypto.randomUUID(), name: `バイト先${prev.length + 1}`, hourlyWage: 1200, transportPerShift: 0 }])
  const updateWorkplace = (id: string, patch: Partial<Workplace>) =>
    setWorkplaces((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  const removeWorkplace = (id: string) =>
    setWorkplaces((prev) => (prev.length <= 1 ? prev : prev.filter((w) => w.id !== id)))
  const downloadCsv = () => {
    const csv = shiftsToCsv(rows.map((r) => ({ shift: r.shift, pay: r.pay, workplaceName: wpOf(r.shift).name })))
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shiftcraft-${monthKey}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---- 画面 ----
  return (
    <main className={page === 'calendar' ? 'app app-main' : 'app'}>
      {/* ヘッダー: アプリ名とハンバーガーボタンは全ページ共通 */}
      <header className="app-header">
        <button className="menu-btn" aria-label="メニューを開く" onClick={() => setMenuOpen(true)}>
          <span /><span /><span />
        </button>
        <div className="logo">S</div>
        <div>
          <h1>{page === 'calendar' ? 'ShiftCraft' : PAGE_TITLES[page]}</h1>
          <p>{page === 'calendar' ? 'シフトと給料の見込み' : 'ShiftCraft'}</p>
        </div>
        {page !== 'calendar' && (
          <button className="ghost-btn back-btn" onClick={() => goPage('calendar')}>‹ カレンダーへ</button>
        )}
      </header>

      {/* ===== ハンバーガーメニュー（ドロワー） ===== */}
      {menuOpen && (
        <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}>
          <nav className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <strong>メニュー</strong>
              <button className="sheet-close" aria-label="閉じる" onClick={() => setMenuOpen(false)}>×</button>
            </div>
            {(Object.keys(PAGE_TITLES) as Page[]).map((p) => (
              <button key={p} className={`drawer-item${page === p ? ' current' : ''}`} onClick={() => goPage(p)}>
                {PAGE_TITLES[p]}
              </button>
            ))}
            <p className="drawer-note">データはこの端末の中だけに保存されます</p>
          </nav>
        </div>
      )}

      {/* ===== ページ: カレンダー（メイン・1画面） ===== */}
      {page === 'calendar' && (
        <>
          {/* 今月のサマリーは1行だけ（詳細は集計ページへ） */}
          <div className="summary-line">
            <span>{viewYM.month}月の見込み <strong>{formatYen(total)}</strong></span>
            <span className="summary-goal">目標 {goal.progressPercent}%</span>
          </div>
          <div className="goal-bar mini"><div className="goal-fill" style={{ width: `${goal.progressPercent}%` }} /></div>

          <section className="card cal-card">
            <div className="card-head">
              <button className="nav-btn" aria-label="前の月" onClick={() => setViewYM((v) => shiftMonth(v.year, v.month, -1))}>‹</button>
              <h2>{viewYM.year}年{viewYM.month}月</h2>
              <button className="nav-btn" aria-label="次の月" onClick={() => setViewYM((v) => shiftMonth(v.year, v.month, 1))}>›</button>
            </div>
            <div className="cal-week">
              {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (<span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>))}
            </div>
            <div className="cal-grid fill">
              {calGrid.map((cell, i) =>
                cell === null ? (
                  <span key={i} />
                ) : (
                  <button
                    key={cell.date}
                    className={`cal-cell${cell.date === todayStr ? ' today' : ''}`}
                    onClick={() => openDay(cell.date)}
                  >
                    <span className="cal-day">{cell.day}</span>
                    {(() => {
                      const dayRows = calByDate.get(cell.date)
                      if (!dayRows) return null
                      const sum = dayRows.reduce((a, r) => a + r.pay.totalPay, 0)
                      const colors = [...new Set(dayRows.map((r) => workplaceColor(workplaces, r.workplaceId)))]
                      return (<><span className="cal-dots">{colors.map((c) => (<span key={c} className="cal-dot" style={{ background: c }} />))}</span><span className="cal-yen">{formatYen(sum)}</span></>)
                    })()}
                  </button>
                ),
              )}
            </div>
          </section>
        </>
      )}

      {/* ===== ページ: 集計 ===== */}
      {page === 'summary' && (
        <section className="card page-card">
          <h2>{viewYM.year}年{viewYM.month}月の集計</h2>
          <p className="page-total">{formatYen(total)}</p>
          <p className="page-sub">実働 {formatMinutes(totalMinutes)} ・ {rows.length}件のシフト</p>
          <div className="hero-goal">
            <div className="hero-goal-head">
              <span>目標 {formatYen(goalYen)}</span>
              <span>{goal.progressPercent}%</span>
            </div>
            <div className="goal-bar"><div className="goal-fill" style={{ width: `${goal.progressPercent}%` }} /></div>
            <p className="hero-goal-note">
              {goal.achieved
                ? '目標達成です。お疲れさまでした。'
                : `あと ${formatYen(goal.remainingYen)}${goal.remainingMinutes !== null ? `（約 ${formatMinutes(goal.remainingMinutes)}）` : ''}`}
            </p>
          </div>
          {wpTotals.length > 0 && (
            <div className="wp-totals">
              <span className="wp-totals-title">バイト先別の合計</span>
              {wpTotals.map((t) => (
                <span key={t.workplace.id} className="wp-total-line"><span className="wp-dot" style={{ background: workplaceColor(workplaces, t.workplace.id) }} />{t.workplace.name}: {formatYen(t.totalPay)}（{t.count}件・{formatMinutes(t.workMinutes)}）</span>
              ))}
            </div>
          )}
          <button className="ghost-btn" onClick={downloadCsv} disabled={rows.length === 0}>{viewYM.month}月のCSVで保存</button>
          <p className="page-note">集計はカレンダーで表示中の月に連動します。月を変えるときはカレンダーページで月移動してください。</p>
        </section>
      )}

      {/* ===== ページ: バイト先 ===== */}
      {page === 'workplaces' && (
        <section className="card page-card">
          <h2>バイト先の管理</h2>
          {workplaces.map((w) => (
            <div key={w.id} className="wp-editor" style={{ borderLeft: `6px solid ${workplaceColor(workplaces, w.id)}` }}>
              <label className="field">
                <span>バイト先の名前</span>
                <input type="text" list="dl-names" value={w.name} onChange={(e) => updateWorkplace(w.id, { name: e.target.value })} />
              </label>
              <div className="field-row-2">
                <label className="field">
                  <span>時給（円）</span>
                  <input type="number" inputMode="numeric" value={w.hourlyWage} onChange={(e) => updateWorkplace(w.id, { hourlyWage: Number(e.target.value) })} />
                </label>
                <label className="field">
                  <span>交通費 / 1勤務（円）</span>
                  <input type="number" inputMode="numeric" value={w.transportPerShift} onChange={(e) => updateWorkplace(w.id, { transportPerShift: Number(e.target.value) })} />
                </label>
              </div>
              <label className="field">
                <span>場所（任意）</span>
                <input type="text" list="dl-places" value={w.place ?? ''} placeholder="例: 駅前" onChange={(e) => updateWorkplace(w.id, { place: e.target.value })} />
              </label>
              <label className="field">
                <span>メモ（任意）</span>
                <input type="text" list="dl-memos" value={w.memo ?? ''} placeholder="例: シフト提出は毎月15日まで" onChange={(e) => updateWorkplace(w.id, { memo: e.target.value })} />
              </label>
              {workplaces.length > 1 && (<button className="delete-btn" onClick={() => removeWorkplace(w.id)}>このバイト先を削除</button>)}
            </div>
          ))}
          <button className="ghost-btn" onClick={addWorkplace}>＋ バイト先を追加</button>
        </section>
      )}

      {/* ===== ページ: 設定 ===== */}
      {page === 'settings' && (
        <section className="card page-card">
          <h2>設定</h2>
          <label className="field">
            <span>目標金額（円）</span>
            <input type="number" inputMode="numeric" value={goalYen} onChange={(e) => setGoalYen(Number(e.target.value))} />
          </label>
          <p className="page-note">目標はカレンダー上部の進捗と、集計ページの詳細に使われます。</p>
          <p className="page-note">データはこの端末のブラウザの中だけに保存されます。サーバーには送信されません。</p>
        </section>
      )}

      {/* ===== Bottom sheet: その日の確認と入力（Issue #10） ===== */}
      {daySheetOpen && (
        <div className="sheet-backdrop" onClick={() => setDaySheetOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <h2>{formatDateLabel(pickedDate)}</h2>
              <button className="sheet-close" aria-label="閉じる" onClick={() => setDaySheetOpen(false)}>×</button>
            </div>

            {pickedRows.length > 0 && (
              <ul className="sheet-shifts">
                {pickedRows.map((r) => (
                  <li key={r.id} className="sheet-shift">
                    <span className="wp-dot" style={{ background: workplaceColor(workplaces, r.workplaceId) }} />
                    <span className="sheet-shift-main">{r.workplaceName} {r.start}–{r.end}<small>実働 {formatMinutes(r.pay.workMinutes)} ・ 休憩{r.breakMinutes}分</small></span>
                    <strong>{formatYen(r.pay.totalPay)}</strong>
                    <button className="delete-btn" onClick={() => removeShift(r.id)}>削除</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="sheet-form">
              <label className="field">
                <span>バイト先</span>
                <select value={wpOf(form).id} onChange={(e) => setForm({ ...form, workplaceId: e.target.value })}>
                  {workplaces.map((w) => (<option key={w.id} value={w.id}>{w.name}（時給 {formatYen(w.hourlyWage)}）</option>))}
                </select>
              </label>
              {/* よく使う時間帯（オートコンプリート）: タップで開始・終了・休憩を一括入力 */}
              {patterns.length > 0 && (
                <div className="pattern-row">
                  <span className="pattern-label">いつものパターン</span>
                  {patterns.map((p) => (
                    <button
                      key={`${p.start}-${p.end}-${p.breakMinutes}`}
                      className="pattern-chip"
                      onClick={() => setForm((f) => ({ ...f, start: p.start, end: p.end, breakMinutes: p.breakMinutes }))}
                    >
                      {p.start}–{p.end}{p.breakMinutes > 0 ? ` 休${p.breakMinutes}` : ''}
                    </button>
                  ))}
                </div>
              )}
              <div className="field-row">
                <label className="field">
                  <span>開始</span>
                  <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                </label>
                <span className="field-arrow">→</span>
                <label className="field">
                  <span>終了</span>
                  <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                </label>
              </div>
              <label className="field">
                <span>休憩（分）</span>
                <input type="number" inputMode="numeric" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: Number(e.target.value) })} />
              </label>
              <p className="preview">見込み: 実働 {formatMinutes(preview.workMinutes)} / <strong>{formatYen(preview.totalPay)}</strong>（交通費込み）</p>
              {formOverlaps.length > 0 && (
                <p className="warn-note">⚠ 時間が重なっています: {formOverlaps.map((s) => `${s.date.slice(5)} ${s.start}–${s.end}（${wpOf(s).name}）`).join('、')}</p>
              )}
              {formOverlaps.length > 0 && overlapAck === overlapSig && (
                <p className="warn-box">このまま登録しますか？ もう一度「＋ この日に追加」を押すと登録します。</p>
              )}
              {errors.length > 0 && (
                <ul className="errors">{errors.map((e) => (<li key={e}>{e}</li>))}</ul>
              )}
              <button className="primary-btn" onClick={addShift}>＋ この日に追加</button>
            </div>
          </div>
        </div>
      )}

      {/* オートコンプリート候補（datalist は画面に出ない候補リスト） */}
      <datalist id="dl-names">{nameSuggestions.map((v) => (<option key={v} value={v} />))}</datalist>
      <datalist id="dl-places">{placeSuggestions.map((v) => (<option key={v} value={v} />))}</datalist>
      <datalist id="dl-memos">{memoSuggestions.map((v) => (<option key={v} value={v} />))}</datalist>
    </main>
  )
}
