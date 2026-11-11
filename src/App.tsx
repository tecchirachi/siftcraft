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
 * - 日付タップでモーダルが開き、その日の確認と入力ができる（Issue #13）
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import { calculatePay, formatMinutes, formatYen, type ShiftInput } from './lib/pay'
import { goalProgress } from './lib/goal'
import { shiftsToCsv } from './lib/csv'
import { validateShift } from './lib/validate'
// 予定表（カレンダー）のロジック（Issue #6）
import { buildMonthGrid, groupByDate, shiftMonth } from './lib/calendar'
// バイト先（複数登録）のロジック（Issue #7）
import { migrateWorkplaces, resolveWorkplace, summarizeByWorkplace, workplaceColor, type Workplace } from './lib/workplace'
// 時間の重なり判定（Issue #9）
import { findOverlaps } from './lib/overlap'
// 入力候補（オートコンプリート）（Issue #11）
import { frequentPatterns, stepTime, uniqueSuggestions } from './lib/suggest'
// 明細照合・繰り返し登録・支給期間（Issue #15, #16, #17）
import { comparePay } from './lib/check'
import { weeklyDates } from './lib/repeat'
import { periodFor } from './lib/payperiod'
// 交通費の詳細設定（Issue #18）
import { resolveTransport, type TransportMode } from './lib/transport'
// レベル・ポイント・テーマ（Issue #21）
import { levelOf, pointsBalance, pointsEarnedOf, THEMES, themeById } from './lib/game'
import { evaluateBadges, TIER_BONUS_POINTS, TIER_COLORS, totalTiers } from './lib/badge'
// 年間収入トラッカー（Issue #22）
import { INCOME_WALLS, monthlyTotals, projectYearEnd, wallStatus, yearTotal } from './lib/year'

/** フォームとシフト共通の形: 入力項目 + 選んだバイト先のID */
interface ShiftForm extends ShiftInput {
  workplaceId?: string
  /** そのシフトだけの交通費（未設定ならバイト先の方式で解決）（Issue #18） */
  transportOverride?: number
}
interface ShiftRecord extends ShiftForm {
  id: string
}

const SHIFTS_KEY = 'shiftcraft:shifts'
const SETTINGS_KEY = 'shiftcraft:settings'
const GOAL_KEY = 'shiftcraft:goal'
const WORKPLACES_KEY = 'shiftcraft:workplaces'
const ACTUALS_KEY = 'shiftcraft:actuals'
// レベル・テーマ用（Issue #21）
const THEME_KEY = 'shiftcraft:theme'
const UNLOCKED_KEY = 'shiftcraft:unlockedThemes'

/** 実績（明細の支給額）: バイト先ID×対象月 → 金額 */
interface ActualRecord {
  workplaceId: string
  yearMonth: string // "2026-11"
  amount: number
}

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

/** 数字をなめらかに増減させるフック（Issue #19）: 合計金額のカウントアップ用。
 * requestAnimationFrame で「前の値→目標値」をイージングしながら補間する */
function useAnimatedNumber(target: number, duration = 500): number {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)
  useEffect(() => {
    const from = prevRef.current
    prevRef.current = target
    if (from === target) {
      setDisplay(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // 最初速く、最後ゆっくり（easeOutCubic）
      setDisplay(Math.round(from + (target - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return display
}

/** 表示中のページ。ルーターなしで state 切り替えする（Issue #12） */
type Page = 'calendar' | 'summary' | 'workplaces' | 'level' | 'settings'
const PAGE_TITLES: Record<Page, string> = {
  calendar: 'カレンダー',
  summary: '集計',
  workplaces: 'バイト先',
  level: 'レベル・テーマ',
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
const [actuals, setActuals] = useState<ActualRecord[]>(() => load(ACTUALS_KEY, []))
// 繰り返し登録の回数と、直近の登録結果メッセージ（Issue #16）
const [repeatCount, setRepeatCount] = useState(1)
// 使用中テーマと解放済みテーマ（Issue #21）
const [themeId, setThemeId] = useState<string>(() => load(THEME_KEY, 'peach'))
const [unlockedThemes, setUnlockedThemes] = useState<string[]>(() => {
  const saved = load<string[]>(UNLOCKED_KEY, [])
  return saved.includes('peach') ? saved : ['peach', ...saved]
})
const [repeatNote, setRepeatNote] = useState('')
  const [page, setPage] = useState<Page>('calendar')
// 月移動アニメーションの方向（Issue #19）
const [slideDir, setSlideDir] = useState<'next' | 'prev' | ''>('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [dayModalOpen, setDayModalOpen] = useState(false)
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
useEffect(() => localStorage.setItem(ACTUALS_KEY, JSON.stringify(actuals)), [actuals])
useEffect(() => localStorage.setItem(THEME_KEY, JSON.stringify(themeId)), [themeId])
useEffect(() => localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlockedThemes)), [unlockedThemes])

  // ---- 派生データ ----
  // シフトのバイト先を解決し、そのバイト先の時給・交通費で計算するためのヘルパー
  const wpOf = (s: ShiftForm) => resolveWorkplace(workplaces, s.workplaceId)
  const settingsOf = (s: ShiftForm) => {
// 時給はバイト先から、交通費は「方式 or シフト個別の上書き」から解決する（Issue #18）
const wp = wpOf(s)
return { hourlyWage: wp.hourlyWage, transportPerShift: resolveTransport(wp, s.transportOverride)}
}
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
  // レベル・ポイントは全期間の実績から計算する（Issue #21）。保存せず毎回導出する
  const gameStats = {
    totalWorkMinutes: shifts.reduce((a, sh) => a + calculatePay(sh, settingsOf(sh)).workMinutes, 0),
    totalShifts: shifts.length,
  }
  const levelInfo = levelOf(gameStats)
  const pointsEarned = pointsEarnedOf(gameStats)
  // 実績バッジ（Issue #25 / ティア制は #26）: 全シフトの内訳から判定する
  const badgeStatuses = evaluateBadges(
    shifts.map((sh) => ({ shift: sh, pay: calculatePay(sh, settingsOf(sh)) })),
    goalYen,
  )
  // ティア到達はボーナスポイントになる（長期モチベーションとテーマ解放をつなぐ）
  const badgeBonus = totalTiers(badgeStatuses) * TIER_BONUS_POINTS
  const points = pointsBalance(gameStats, unlockedThemes) + badgeBonus
  const activeTheme = themeById(themeId)
  // 年間トラッカー用（Issue #22）: 交通費は非課税なので年収から除く
  const yearEntries = shifts.map((sh) => {
    const p = calculatePay(sh, settingsOf(sh))
    return { date: sh.date, taxablePay: p.totalPay - p.transportPay }
  })
  const year = viewYM.year
  const yTotal = yearTotal(yearEntries, year)
  const yMonthly = monthlyTotals(yearEntries, year)
  const yMaxMonth = Math.max(1, ...yMonthly)
  const yProjection = projectYearEnd(yearEntries, year, new Date().toISOString().slice(0, 10))
  const unlockTheme = (id: string) => {
    if (!unlockedThemes.includes(id)) setUnlockedThemes((u) => [...u, id])
    setThemeId(id)
  }
const animatedTotal = useAnimatedNumber(total)
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
  // そのバイト先の最頻パターン（無ければ undefined）
  const topPatternOf = (workplaceId: string | undefined) =>
    workplaceId
      ? frequentPatterns(shifts, workplaceId, (sh) => resolveWorkplace(workplaces, sh.workplaceId).id)[0]
      : undefined
  const openDay = (date: string) => {
    setPickedDate(date)
    // プリフィル（Issue #20）: 開いた時点で前回のバイト先＋その最頻パターンを入れておき、
    // 多くの場合は「追加」を押すだけで登録できるようにする
    setForm((f) => {
      const top = topPatternOf(f.workplaceId ?? workplaces[0]?.id)
      return top ? { ...f, date, start: top.start, end: top.end, breakMinutes: top.breakMinutes } : { ...f, date }
    })
    setErrors([])
    setOverlapAck('')
    setDayModalOpen(true)
  }
  // シフトの内容をフォームにコピーする（Issue #20）: 別日へ同じ内容を1タップで登録するため
  const copyShiftToForm = (src: ShiftForm) => {
    setForm((f) => ({
      ...f,
      workplaceId: src.workplaceId,
      start: src.start,
      end: src.end,
      breakMinutes: src.breakMinutes,
      transportOverride: src.transportOverride,
    }))
    setOverlapAck('')
  }
  const addShift = () => {
    const errs = validateShift(form)
    setErrors(errs)
    if (errs.length > 0) return
    setRepeatNote('')
    if (repeatCount <= 1) {
      // 通常登録: 時間が重なる場合はまず警告だけ出して止め、同じ内容でもう一度押されたら登録する
      if (formOverlaps.length > 0 && overlapAck !== overlapSig) {
        setOverlapAck(overlapSig)
        return
      }
      setOverlapAck('')
      setShifts((prev) => [...prev, { ...form, id: crypto.randomUUID() }])
      return
    }
    // 繰り返し登録（Issue #16）: 同じ曜日に週ごと。重なる回はスキップして結果を知らせる
    const dates = weeklyDates(form.date, repeatCount)
    const added: ShiftRecord[] = []
    let skipped = 0
    for (const date of dates) {
      const candidate = { ...form, date }
      if (findOverlaps(candidate, [...shifts, ...added]).length > 0) {
        skipped += 1
      } else {
        added.push({ ...candidate, id: crypto.randomUUID() })
      }
    }
    setShifts((prev) => [...prev, ...added])
    setRepeatNote(`${added.length}件を追加しました${skipped > 0 ? `（重なりのため ${skipped}件スキップ）` : ''}`)
  }
  const removeShift = (id: string) => setShifts((prev) => prev.filter((s) => s.id !== id))
// 実績の入力: 同じバイト先×月は上書き、空欄にしたら記録を消す
const setActual = (workplaceId: string, amount: number | null) =>
setActuals((prev) => {
const rest = prev.filter((a) =>!(a.workplaceId === workplaceId && a.yearMonth === monthKey))
return amount === null? rest: [...rest, { workplaceId, yearMonth: monthKey, amount }]
})
const actualOf = (workplaceId: string) =>
actuals.find((a) => a.workplaceId === workplaceId && a.yearMonth === monthKey)?.amount
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
    <main className={page === 'calendar' ? 'app app-main' : 'app'} style={activeTheme.vars as CSSProperties}>
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
              <button className="modal-close" aria-label="閉じる" onClick={() => setMenuOpen(false)}>×</button>
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
          {/* 今月のサマリー（Issue #24）: M3 の primary-container の面で
              「今月の見込み」を画面の主役にする。詳細は集計ページへ */}
          <div className="summary-hero">
            <div className="summary-line">
              <span>{viewYM.month}月の見込み <strong>{formatYen(animatedTotal)}</strong></span>
              <span className="summary-goal">目標 {goal.progressPercent}%</span>
            </div>
            <div className="goal-bar mini"><div className="goal-fill" style={{ width: `${goal.progressPercent}%` }} /></div>
          </div>
          {/* レベル表示（Issue #21）: タップでレベル・テーマページへ */}
          <button className="level-line" onClick={() => goPage('level')}>
            <span className="level-badge">Lv.{levelInfo.level}</span>
            <span className="level-title">{levelInfo.title}</span>
            <span className="level-bar"><span className="level-fill" style={{ width: `${levelInfo.progressPercent}%` }} /></span>
            <span className="level-points">{points} P</span>
          </button>

          <section className="card cal-card">
            <div className="card-head">
              <button className="nav-btn" aria-label="前の月" onClick={() => { setSlideDir('prev'); setViewYM((v) => shiftMonth(v.year, v.month, -1)) }}>‹</button>
              <h2>{viewYM.year}年{viewYM.month}月</h2>
              <button className="nav-btn" aria-label="次の月" onClick={() => { setSlideDir('next'); setViewYM((v) => shiftMonth(v.year, v.month, 1)) }}>›</button>
            </div>
            {/* 月が変わるたびに key が変わって再マウントされ、スライドアニメーションが再生される */}
<div key={monthKey} className={`cal-anim${slideDir ? ` slide-${slideDir}` : ''}`}>
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
</div>
          </section>
        </>
      )}

      {/* ===== ページ: 集計 ===== */}
      {page === 'summary' && (
        <section className="card page-card page-anim">
          <h2>{viewYM.year}年{viewYM.month}月の集計</h2>
          <p className="page-total">{formatYen(animatedTotal)}</p>
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
          {/* 明細との照合（Issue #15）: 実績を入れると見込みとの差額が出る */}
          {wpTotals.length > 0 && (
            <div className="check-block">
              <span className="wp-totals-title">給料明細との照合（{viewYM.month}月分）</span>
              {wpTotals.map((t) => {
                const actual = actualOf(t.workplace.id)
                const result = comparePay(t.totalPay, actual)
                return (
                  <div key={t.workplace.id} className="check-row">
                    <span className="check-name"><span className="wp-dot" style={{ background: workplaceColor(workplaces, t.workplace.id) }} />{t.workplace.name}</span>
                    <span className="check-expected">見込み {formatYen(t.totalPay)}</span>
                    <span className="check-input">
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="実際の支給額"
                        value={actual ?? ''}
                        onChange={(e) => setActual(t.workplace.id, e.target.value === '' ? null : Number(e.target.value))}
                      />
                      {/* 打たずに調整できるステッパー（Issue #20）: 未入力なら見込み額を起点にする */}
                      <button type="button" className="step-btn small" onClick={() => setActual(t.workplace.id, Math.max(0, (actual ?? t.totalPay) - 500))}>−500</button>
                      <button type="button" className="step-btn small" onClick={() => setActual(t.workplace.id, (actual ?? t.totalPay) + 500)}>＋500</button>
                    </span>
                    <span className={`check-diff ${result.status}`}>
                      {result.status === 'unset' && '未入力'}
                      {result.status === 'match' && '一致しました'}
                      {result.status === 'over' && `実績が ${formatYen(result.diff ?? 0)} 多い`}
                      {result.status === 'under' && `実績が ${formatYen(Math.abs(result.diff ?? 0))} 少ない`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {/* 次の給料日（Issue #17）: 今日が属する支給期間の見込みと給料日 */}
          <div className="check-block">
            <span className="wp-totals-title">次の給料日</span>
            {workplaces.map((w) => {
              const period = periodFor(todayStr, w.closingDay ?? 31, w.payDay ?? 25)
              const periodTotal = shifts
                .filter((s) => wpOf(s).id === w.id && s.date >= period.start && s.date <= period.end)
                .reduce((sum, s) => sum + calculatePay(s, settingsOf(s)).totalPay, 0)
              return (
                <span key={w.id} className="wp-total-line">
                  <span className="wp-dot" style={{ background: workplaceColor(workplaces, w.id) }} />
                  {w.name}: {period.payDate.slice(5).replace('-', '月')}日払い ・ {formatYen(periodTotal)}（{period.start.slice(5)}〜{period.end.slice(5)}分）
                </span>
              )
            })}
          </div>
          {/* 年間収入トラッカー（Issue #22） */}
          <div className="check-block">
            <span className="wp-totals-title">年間収入（{year}年・税金の目安）</span>
            <p className="year-total">{formatYen(yTotal)}</p>
            <p className="page-note">交通費は非課税のため除いて計算しています。実際の課税は他の収入や控除でも変わるので目安として使ってください。</p>
            {INCOME_WALLS.map((w) => {
              const st = wallStatus(yTotal, w.limit)
              return (
                <div key={w.limit} className="wall-row">
                  <div className="wall-head">
                    <span>{w.label}</span>
                    <span className={`wall-state ${st.state}`}>
                      {st.state === 'over' ? `${formatYen(-st.remaining)} 超過` : st.state === 'caution' ? `あと ${formatYen(st.remaining)}` : `あと ${formatYen(st.remaining)}`}
                    </span>
                  </div>
                  <div className="goal-bar"><div className={`wall-fill ${st.state}`} style={{ width: `${Math.min(100, st.percent)}%` }} /></div>
                </div>
              )
            })}
            {year === Number(todayStr.slice(0, 4)) && yTotal > 0 && (
              <p className="page-note">このペースだと年末に約 {formatYen(yProjection)} の見込みです。</p>
            )}
            <div className="month-bars" aria-hidden="true">
              {yMonthly.map((v, i) => (
                <div key={i} className="month-bar-col">
                  <div className="month-bar" style={{ height: `${Math.round((v / yMaxMonth) * 100)}%` }} />
                  <span>{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="ghost-btn" onClick={downloadCsv} disabled={rows.length === 0}>{viewYM.month}月のCSVで保存</button>
          <p className="page-note">集計はカレンダーで表示中の月に連動します。月を変えるときはカレンダーページで月移動してください。</p>
        </section>
      )}

      {/* ===== ページ: バイト先 ===== */}
      {page === 'workplaces' && (
        <section className="card page-card page-anim">
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
                  <span className="step-row">
                    <button type="button" className="step-btn" onClick={() => updateWorkplace(w.id, { hourlyWage: Math.max(0, w.hourlyWage - 100) })}>−100</button>
                    <button type="button" className="step-btn" onClick={() => updateWorkplace(w.id, { hourlyWage: w.hourlyWage + 100 })}>＋100</button>
                  </span>
                </label>
                {/* 交通費の方式（Issue #18）: 方式に応じて下の入力が切り替わる */}
                <label className="field">
                  <span>交通費の方式</span>
                  <select value={w.transportMode ?? 'fixed'} onChange={(e) => updateWorkplace(w.id, { transportMode: e.target.value as TransportMode })}>
                    <option value="fixed">1勤務あたり固定額</option>
                    <option value="roundTrip">片道運賃 ×2（往復）</option>
                    <option value="pass">定期あり（支給なし）</option>
                    <option value="none">支給なし</option>
                  </select>
                </label>
              </div>
              {(w.transportMode ?? 'fixed') === 'fixed' && (
                <label className="field">
                  <span>交通費 / 1勤務（円）</span>
                  <input type="number" inputMode="numeric" value={w.transportPerShift} onChange={(e) => updateWorkplace(w.id, { transportPerShift: Number(e.target.value) })} />
                  <span className="step-row">
                    <button type="button" className="step-btn" onClick={() => updateWorkplace(w.id, { transportPerShift: Math.max(0, w.transportPerShift - 100) })}>−100</button>
                    <button type="button" className="step-btn" onClick={() => updateWorkplace(w.id, { transportPerShift: w.transportPerShift + 100 })}>＋100</button>
                  </span>
                </label>
              )}
              {(w.transportMode ?? 'fixed') === 'roundTrip' && (
                <label className="field">
                  <span>片道運賃（円）</span>
                  <input type="number" inputMode="numeric" value={w.transportOneWay ?? 0} onChange={(e) => updateWorkplace(w.id, { transportOneWay: Number(e.target.value) })} />
                  <span className="step-row">
                    <button type="button" className="step-btn" onClick={() => updateWorkplace(w.id, { transportOneWay: Math.max(0, (w.transportOneWay ?? 0) - 10) })}>−10</button>
                    <button type="button" className="step-btn" onClick={() => updateWorkplace(w.id, { transportOneWay: (w.transportOneWay ?? 0) + 10 })}>＋10</button>
                  </span>
                </label>
              )}
              {((w.transportMode ?? 'fixed') === 'pass' || (w.transportMode ?? 'fixed') === 'none') && (
                <p className="page-note">この方式では交通費は0円として計算します。</p>
              )}
              <label className="field">
                <span>場所（任意）</span>
                <input type="text" list="dl-places" value={w.place ?? ''} placeholder="例: 駅前" onChange={(e) => updateWorkplace(w.id, { place: e.target.value })} />
              </label>
              <label className="field">
                <span>メモ（任意）</span>
                <input type="text" list="dl-memos" value={w.memo ?? ''} placeholder="例: シフト提出は毎月15日まで" onChange={(e) => updateWorkplace(w.id, { memo: e.target.value })} />
              </label>
              {/* 締め日・給料日（Issue #17）: 集計ページの「次の給料日」に使う */}
              <div className="field-row-2">
                <label className="field">
                  <span>締め日</span>
                  <select value={w.closingDay ?? 31} onChange={(e) => updateWorkplace(w.id, { closingDay: Number(e.target.value) })}>
                    {[5, 10, 15, 20, 25, 31].map((d) => (<option key={d} value={d}>{d === 31 ? '月末' : `${d}日`}</option>))}
                  </select>
                </label>
                <label className="field">
                  <span>給料日（翌月）</span>
                  <select value={w.payDay ?? 25} onChange={(e) => updateWorkplace(w.id, { payDay: Number(e.target.value) })}>
                    {[5, 10, 15, 20, 25, 31].map((d) => (<option key={d} value={d}>{d === 31 ? '月末' : `${d}日`}</option>))}
                  </select>
                </label>
              </div>
              {workplaces.length > 1 && (<button className="delete-btn" onClick={() => removeWorkplace(w.id)}>このバイト先を削除</button>)}
            </div>
          ))}
          <button className="ghost-btn" onClick={addWorkplace}>＋ バイト先を追加</button>
        </section>
      )}

      {/* ===== ページ: レベル・テーマ（Issue #21） ===== */}
      {page === 'level' && (
        <section className="card page-card page-anim">
          <h2>レベル・テーマ</h2>
          <div className="level-hero">
            <span className="level-badge big">Lv.{levelInfo.level}</span>
            <div>
              <p className="level-hero-title">{levelInfo.title}</p>
              <p className="page-note">{levelInfo.xp} XP ・ 次のレベルまで あと {Math.max(0, levelInfo.nextLevelXp - levelInfo.xp)} XP</p>
            </div>
          </div>
          <div className="goal-bar"><div className="goal-fill level-fill-bar" style={{ width: `${levelInfo.progressPercent}%` }} /></div>
          <p className="page-note">累計の実働 {formatMinutes(gameStats.totalWorkMinutes)} ・ {gameStats.totalShifts} 件のシフトで経験値を計算しています（実働1時間=10XP、1シフト=15XP）。</p>
          <div className="points-box">
            <span>ポイント残高</span>
            <strong>{points} P</strong>
            <span className="page-note">（累計 {pointsEarned} P 獲得）</span>
          </div>
          {/* 実績バッジ（Issue #25 / ティア制 #26）: ティアの色で丸が変わり、
              次のティアまでの進捗バーと「あと○○」が常に出る */}
          <span className="wp-totals-title">実績（合計 {totalTiers(badgeStatuses)} ティア ・ ボーナス +{badgeBonus} P）</span>
          <div className="badge-grid">
            {badgeStatuses.map((s) => (
              <div key={s.id} className="badge-card">
                <span
                  className="badge-mark"
                  style={s.tier > 0 ? { background: TIER_COLORS[s.tier - 1], color: '#fff' } : undefined}
                >
                  {s.mark}
                </span>
                <span className="badge-name">{s.name}</span>
                <span className="badge-tier">{s.tierName ?? '未到達'} ・ {s.description}</span>
                <span className="badge-bar">
                  <span className="badge-bar-fill" style={{ width: `${s.segmentPercent}%` }} />
                </span>
                <span className="badge-state">{s.progressText}</span>
              </div>
            ))}
          </div>
          <span className="wp-totals-title">UIテーマ（ポイントで解放）</span>
          <div className="theme-grid">
            {THEMES.map((t) => {
              const unlocked = unlockedThemes.includes(t.id)
              const active = activeTheme.id === t.id
              const afford = points >= t.cost
              return (
                <div key={t.id} className={`theme-card${active ? ' active' : ''}`}>
                  <span className="theme-swatches">
                    <span className="theme-swatch" style={{ background: t.swatch[0] }} />
                    <span className="theme-swatch" style={{ background: t.swatch[1] }} />
                  </span>
                  <span className="theme-name">{t.name}</span>
                  {active ? (
                    <button className="step-btn" disabled>使用中</button>
                  ) : unlocked ? (
                    <button className="step-btn" onClick={() => setThemeId(t.id)}>使う</button>
                  ) : afford ? (
                    <button className="step-btn" onClick={() => unlockTheme(t.id)}>{t.cost} P で解放</button>
                  ) : (
                    <button className="step-btn" disabled>あと {t.cost - points} P</button>
                  )}
                </div>
              )
            })}
          </div>
          <p className="page-note">テーマは色の組み合わせだけを変えます。データや計算には影響しません。</p>
        </section>
      )}

      {/* ===== ページ: 設定 ===== */}
      {page === 'settings' && (
        <section className="card page-card page-anim">
          <h2>設定</h2>
          <label className="field">
            <span>目標金額（円）</span>
            <input type="number" inputMode="numeric" value={goalYen} onChange={(e) => setGoalYen(Number(e.target.value))} />
            <span className="step-row">
              <button type="button" className="step-btn" onClick={() => setGoalYen(Math.max(0, goalYen - 1000))}>−1000</button>
              <button type="button" className="step-btn" onClick={() => setGoalYen(goalYen + 1000)}>＋1000</button>
            </span>
          </label>
          <p className="page-note">目標はカレンダー上部の進捗と、集計ページの詳細に使われます。</p>
          <p className="page-note">データはこの端末のブラウザの中だけに保存されます。サーバーには送信されません。</p>
        </section>
      )}

      {/* ===== モーダル: その日の確認と入力（Issue #13。旧 Bottom sheet） ===== */}
      {dayModalOpen && (
        <div className="modal-backdrop" onClick={() => setDayModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-head">
              <h2>{formatDateLabel(pickedDate)}</h2>
              <button className="modal-close" aria-label="閉じる" onClick={() => setDayModalOpen(false)}>×</button>
            </div>

            {pickedRows.length > 0 && (
              <ul className="modal-shifts">
                {pickedRows.map((r, i) => (
                  <li key={r.id} className="modal-shift item-anim" style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="wp-dot" style={{ background: workplaceColor(workplaces, r.workplaceId) }} />
                    <span className="modal-shift-main">{r.workplaceName} {r.start}–{r.end}</span>
                    <strong>{formatYen(r.pay.totalPay)}</strong>
                    <button className="copy-btn" onClick={() => copyShiftToForm(r)}>コピー</button>
                    <button className="delete-btn" onClick={() => removeShift(r.id)}>削除</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="modal-form">
              {shifts.length > 0 && (
                <button className="copy-last-btn" onClick={() => copyShiftToForm(shifts[shifts.length - 1])}>前回のシフトをコピー</button>
              )}
              <label className="field">
                <span>バイト先</span>
                <select value={wpOf(form).id} onChange={(e) => {
                  // バイト先を切り替えたら、そのバイト先の最頻パターンを自動で反映する（Issue #20）
                  const id = e.target.value
                  const top = topPatternOf(id)
                  setForm((f) => (top ? { ...f, workplaceId: id, start: top.start, end: top.end, breakMinutes: top.breakMinutes } : { ...f, workplaceId: id }))
                }}>
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
                  <span className="step-row">
                    <button type="button" className="step-btn" onClick={() => setForm({ ...form, start: stepTime(form.start, -15) })}>−15分</button>
                    <button type="button" className="step-btn" onClick={() => setForm({ ...form, start: stepTime(form.start, 15) })}>＋15分</button>
                  </span>
                </label>
                <span className="field-arrow">→</span>
                <label className="field">
                  <span>終了</span>
                  <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                  <span className="step-row">
                    <button type="button" className="step-btn" onClick={() => setForm({ ...form, end: stepTime(form.end, -15) })}>−15分</button>
                    <button type="button" className="step-btn" onClick={() => setForm({ ...form, end: stepTime(form.end, 15) })}>＋15分</button>
                  </span>
                </label>
              </div>
              {/* 休憩と繰り返しは毎回は触らないので折りたたみの中（Issue #14, #16） */}
              <details className="modal-details">
                <summary>休憩・繰り返し・交通費を変更する</summary>
                <div className="field">
                  <span>休憩（分）</span>
                  <span className="pattern-row">
                    {[0, 30, 45, 60].map((m) => (
                      <button key={m} type="button" className={`pattern-chip${form.breakMinutes === m ? ' active' : ''}`} onClick={() => setForm({ ...form, breakMinutes: m })}>{m}分</button>
                    ))}
                  </span>
                  <input type="number" inputMode="numeric" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: Number(e.target.value) })} />
                </div>
                <label className="field">
                  <span>繰り返し（同じ曜日）</span>
                  <select value={repeatCount} onChange={(e) => setRepeatCount(Number(e.target.value))}>
                    <option value={1}>なし</option>
                    <option value={4}>毎週 × 4回</option>
                    <option value={8}>毎週 × 8回</option>
                    <option value={12}>毎週 × 12回</option>
                  </select>
                </label>
                {/* その日だけ交通費が違う場合の上書き（空欄ならバイト先の方式どおり）（Issue #18） */}
                <div className="field">
                  <span>交通費（円・任意）</span>
                  <span className="pattern-row">
                    <button type="button" className={`pattern-chip${form.transportOverride === undefined ? ' active' : ''}`} onClick={() => setForm({ ...form, transportOverride: undefined })}>設定どおり</button>
                    <button type="button" className={`pattern-chip${form.transportOverride === 0 ? ' active' : ''}`} onClick={() => setForm({ ...form, transportOverride: 0 })}>0円</button>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="空欄ならバイト先の設定"
                    value={form.transportOverride ?? ''}
                    onChange={(e) => setForm({ ...form, transportOverride: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
              </details>
              <p className="preview">見込み <strong>{formatYen(preview.totalPay)}</strong>（実働 {formatMinutes(preview.workMinutes)}）</p>
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
              {repeatNote && (<p className="ok-note">{repeatNote}</p>)}
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
