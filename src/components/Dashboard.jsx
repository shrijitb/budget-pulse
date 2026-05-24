import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, useCurrentWeekTxs, useCategoryTotals } from '../store/useStore'
import { calcWeeklyScore, getScoreInsight } from '../utils/scoring'
import ScoreRing from './ScoreRing'
import CategoryBar from './CategoryBar'
import AddTransaction from './AddTransaction'
import PDFImporter from './PDFImporter'
import { CATEGORY_META } from '../utils/categorizer'

const spreadsheetColumns = [
  { label: 'Date', key: 'date' },
  { label: 'Merchant', key: 'merchant' },
  { label: 'Category', key: 'category' },
  { label: 'Amount', key: 'amount' },
]

export default function Dashboard({ onNavigate }) {
  const { state, dispatch } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  const [showSpreadsheet, setShowSpreadsheet] = useState(false)
  const [showPDF, setShowPDF] = useState(false)
  const [quickMerchant, setQuickMerchant] = useState('')
  const [quickOtherDesc, setQuickOtherDesc] = useState('')
  const [quickAmount, setQuickAmount] = useState('')
  const [quickCategory, setQuickCategory] = useState('food')
  const [quickDate, setQuickDate] = useState(new Date().toISOString().slice(0, 10))

  const weekTxs = useCurrentWeekTxs(state)
  const categoryTotals = useCategoryTotals(weekTxs)

  const scoreData = calcWeeklyScore({
    categoryTotals,
    budgets: state.budgets,
    txCount: weekTxs.length,
    weeklyIncome: state.weeklyIncome,
    streak: state.streak,
  })

  const insight = getScoreInsight({
    ...scoreData,
    categoryTotals,
    budgets: state.budgets,
  })

  const totalSpent = Object.entries(categoryTotals)
    .filter(([k]) => k !== 'savings')
    .reduce((s, [, v]) => s + v, 0)
  const remaining = state.weeklyIncome - totalSpent
  const topGoal = state.goals[0]

  function handleQuickAdd(e) {
    e.preventDefault()
    const amt = parseFloat(quickAmount)
    if (!amt || amt <= 0) return
    if (quickCategory === 'other' && !quickOtherDesc.trim()) return

    const resolvedMerchant = quickCategory === 'other'
      ? `Other: ${quickOtherDesc.trim()}`
      : quickMerchant.trim() || 'Quick entry'

    const newTx = {
      id: `tx_${Date.now()}`,
      merchant: resolvedMerchant,
      amount: amt,
      category: quickCategory,
      date: new Date(quickDate).toISOString(),
      source: 'manual',
    }

    const weekStart = new Date(state.currentWeekStart)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const txDate = new Date(newTx.date)
    const inCurrentWeek = txDate >= weekStart && txDate < weekEnd
    const nextTotal = (categoryTotals[quickCategory] || 0) + amt

    dispatch({ type: 'ADD_TRANSACTION', tx: newTx })

    if (inCurrentWeek && quickCategory !== 'savings' && quickCategory !== 'studentLoans' && nextTotal > (state.budgets[quickCategory] || 0)) {
      const meta = CATEGORY_META[quickCategory]
      window.electronAPI?.showNotification(
        `Over budget: ${meta?.label || quickCategory}`,
        `$${nextTotal.toFixed(0)} spent vs $${state.budgets[quickCategory]} budget this week`
      )
    }

    setQuickMerchant('')
    setQuickOtherDesc('')
    setQuickAmount('')
    setQuickCategory('food')
    setQuickDate(new Date().toISOString().slice(0, 10))
  }

  function handleDeleteTx(id) {
    dispatch({ type: 'REMOVE_TRANSACTION', id })
  }

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="px-5 pt-8 pb-4 md:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-1">This week</p>
            <h1 className="text-3xl font-bold text-[var(--color-text-bright)]">BudgetPulse</h1>
            <p className="text-sm text-[var(--color-text-muted)] max-w-xl mt-2">
              Desktop-ready finance tracking with quick entry and goals that feel like a game.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass rounded-2xl p-4 text-sm">
              <p className="text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Score tier</p>
              <p className="font-semibold text-[var(--color-text-bright)]">{scoreData.tier.emoji} {scoreData.tier.label}</p>
            </div>
            <div className="glass rounded-2xl p-4 text-sm">
              <p className="text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Streak</p>
              <p className="font-semibold text-[var(--color-amber)]">{state.streak || 0} weeks</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass rounded-3xl p-6 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Rapid add</p>
              <h2 className="text-xl font-bold text-[var(--color-text-bright)]">Enter money fast</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowSpreadsheet(v => !v)}
                className="btn-secondary text-sm"
              >
                {showSpreadsheet ? 'Hide table' : 'Show spreadsheet'}
              </button>
              <button
                onClick={() => setShowPDF(true)}
                className="btn-primary text-sm"
              >
                Import PDF
              </button>
            </div>
          </div>

          <form onSubmit={handleQuickAdd} className="grid gap-3 md:grid-cols-[1.1fr_0.9fr_0.8fr]">
            {quickCategory === 'other' ? (
              <input
                type="text"
                placeholder="Describe this expense (required)"
                value={quickOtherDesc}
                onChange={e => setQuickOtherDesc(e.target.value)}
                className="input-field w-full"
                required
              />
            ) : (
              <input
                type="text"
                placeholder={quickCategory === 'studentLoans' ? 'Loan servicer (e.g. Mohela)' : 'Merchant / bill name'}
                value={quickMerchant}
                onChange={e => setQuickMerchant(e.target.value)}
                className="input-field w-full"
              />
            )}
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              value={quickAmount}
              onChange={e => setQuickAmount(e.target.value)}
              className="input-field w-full"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={quickCategory}
                onChange={e => { setQuickCategory(e.target.value); setQuickOtherDesc('') }}
                className="input-field w-full"
              >
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.icon} {meta.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={quickDate}
                onChange={e => setQuickDate(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <button
              type="submit"
              disabled={quickCategory === 'other' && !quickOtherDesc.trim()}
              className="btn-primary w-full md:col-span-3 disabled:opacity-40"
            >
              Add transaction
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => setQuickCategory(key)}
                className="rounded-full px-3 py-2 text-sm font-semibold transition"
                style={{
                  background: quickCategory === key ? `${meta.color}24` : 'var(--color-surface-3)',
                  color: quickCategory === key ? meta.color : 'var(--color-text-muted)',
                }}
              >
                {meta.icon} {meta.label}
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">Game goals</p>
              <p className="text-lg font-semibold text-[var(--color-text-bright)]">Keep your streak alive</p>
            </div>
            <div className="rounded-2xl bg-[var(--color-surface-3)] px-3 py-2 text-sm font-medium text-[var(--color-green)]">
              {scoreData.total} XP
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl p-4 bg-[var(--color-surface-3)]">
              <p className="text-sm text-[var(--color-text-muted)]">Weekly challenge</p>
              <p className="mt-2 text-sm text-[var(--color-text-bright)]">Add at least 5 transactions and stay under category budgets to earn bonus streak points.</p>
            </div>
            <div className="rounded-2xl p-4 bg-[var(--color-surface-3)]">
              <p className="text-sm text-[var(--color-text-muted)]">Next badge</p>
              <p className="mt-2 text-sm text-[var(--color-text-bright)]">Maintain a 3-week streak to unlock the "Momentum" badge.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-5 mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="glass rounded-3xl px-6 py-5">
          <div className="flex items-center justify-between mb-4 gap-4">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Budget remaining</p>
              <p className="text-3xl font-bold" style={{ color: remaining >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                ${Math.abs(remaining).toFixed(0)}
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              + Add
            </button>
          </div>
          <div className="grid gap-4">
            {Object.keys(state.budgets)
              .filter(k => k !== 'savings' && k !== 'studentLoans')
              .map(cat => (
                <CategoryBar
                  key={cat}
                  category={cat}
                  spent={categoryTotals[cat] || 0}
                  budget={state.budgets[cat]}
                />
              ))}
          </div>
        </div>

        <div className="glass rounded-3xl px-6 py-5 space-y-4">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-3">Savings goal</p>
            <CategoryBar
              category="savings"
              spent={categoryTotals.savings || 0}
              budget={state.budgets.savings}
            />
            {topGoal && (
              <button
                onClick={() => onNavigate('goals')}
                className="mt-5 w-full btn-secondary text-sm"
              >
                View goals
              </button>
            )}
          </div>

          <StudentLoanCard state={state} dispatch={dispatch} />
        </div>
      </div>

      {showSpreadsheet && (
        <div className="mx-5 mt-4 glass rounded-3xl px-6 py-5 overflow-x-auto">
          <div className="flex items-center justify-between mb-4 gap-4">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Spreadsheet</p>
              <p className="text-sm text-[var(--color-text-muted)]">Quick review and bulk deletion for laptop use.</p>
            </div>
            <button
              onClick={() => setShowSpreadsheet(false)}
              className="btn-secondary text-sm"
            >
              Close sheet
            </button>
          </div>
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-[var(--color-text-muted)]">
                {spreadsheetColumns.map(column => (
                  <th key={column.key} className="pb-3 pr-4 font-normal uppercase tracking-[0.24em] text-[0.7rem]">
                    {column.label}
                  </th>
                ))}
                <th className="pb-3 pr-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {weekTxs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--color-text-muted)]">
                    No transactions yet — add one above or import a PDF statement.
                  </td>
                </tr>
              ) : (
                weekTxs.map(tx => (
                  <tr key={tx.id} className="hover:bg-[rgba(124,106,247,0.08)] transition-colors">
                    <td className="py-3 pr-4">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="py-3 pr-4">{tx.merchant || 'Manual entry'}</td>
                    <td className="py-3 pr-4 text-[var(--color-text-muted)]">{CATEGORY_META[tx.category]?.icon || '💸'} {CATEGORY_META[tx.category]?.label || tx.category}</td>
                    <td className="py-3 pr-4 font-semibold text-[var(--color-text-bright)]">${tx.amount.toFixed(2)}</td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => handleDeleteTx(tx.id)}
                        className="text-xs text-[var(--color-red)] hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {window.electronAPI && <FolderWatcherRow />}

      <AnimatePresence>
        {showAdd && <AddTransaction onClose={() => setShowAdd(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showPDF && <PDFImporter onClose={() => setShowPDF(false)} />}
      </AnimatePresence>
    </div>
  )
}

const WATCH_KEY = 'budgetpulse_watchfolder'

function FolderWatcherRow() {
  const [folder, setFolder] = useState(() => localStorage.getItem(WATCH_KEY) || '')
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    if (folder) {
      window.electronAPI.watchFolder(folder).then(ok => setWatching(ok))
    }
  }, [folder])

  async function pickFolder() {
    const path = await window.electronAPI.pickFolder()
    if (!path) return
    localStorage.setItem(WATCH_KEY, path)
    setFolder(path)
    const ok = await window.electronAPI.watchFolder(path)
    setWatching(ok)
  }

  return (
    <div className="mx-5 mb-4 glass rounded-xl px-5 py-3 flex items-center gap-3">
      <span className="text-lg">{watching ? '👁️' : '📁'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">Auto-import folder</p>
        {folder ? (
          <p className="text-xs text-[var(--color-text)] truncate">{folder}</p>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">Drop PDFs here to auto-import</p>
        )}
      </div>
      <button onClick={pickFolder} className="btn-secondary text-xs px-3 py-1.5 shrink-0">
        {folder ? 'Change' : 'Set folder'}
      </button>
    </div>
  )
}

function StudentLoanCard({ state, dispatch }) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(String(state.monthlyStudentLoan || ''))

  const monthly = state.monthlyStudentLoan || 0

  // Sum all studentLoans transactions in the current calendar month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const paidThisMonth = state.transactions
    .filter(t => t.category === 'studentLoans')
    .filter(t => { const d = new Date(t.date); return d >= monthStart && d < monthEnd })
    .reduce((s, t) => s + t.amount, 0)

  const isPaid = monthly > 0 && paidThisMonth >= monthly * 0.9
  const progress = monthly > 0 ? Math.min(1, paidThisMonth / monthly) : 0

  function saveAmount() {
    const amt = parseFloat(inputVal)
    dispatch({ type: 'SET_MONTHLY_STUDENT_LOAN', amount: isNaN(amt) ? 0 : Math.max(0, amt) })
    setEditing(false)
  }

  if (monthly === 0 && !editing) {
    return (
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer"
        style={{ background: 'var(--color-surface-3)', border: '1px dashed var(--color-border)' }}
        onClick={() => { setInputVal(''); setEditing(true) }}
      >
        <span className="text-xl">🎓</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-bright)]">Track Student Loans</p>
          <p className="text-xs text-[var(--color-text-muted)]">Tap to set your monthly payment</p>
        </div>
        <span className="text-[var(--color-text-muted)] text-sm">+</span>
      </div>
    )
  }

  return (
    <div className="rounded-2xl px-4 py-3 space-y-2" style={{ background: 'var(--color-surface-3)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎓</span>
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">Student Loans</p>
            <p className="text-sm font-semibold text-[var(--color-text-bright)]">
              {isPaid ? '✅ Paid this month' : `$${paidThisMonth.toFixed(0)} / $${monthly.toFixed(0)}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setInputVal(String(monthly)); setEditing(v => !v) }}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2 py-1 rounded-lg"
          style={{ background: 'var(--color-surface-2)' }}
        >
          Edit
        </button>
      </div>

      {editing && (
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm">$</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Monthly payment"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              className="input-field w-full pl-7 text-sm"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveAmount()}
            />
          </div>
          <button onClick={saveAmount} className="btn-primary text-xs px-3 py-2">Save</button>
        </div>
      )}

      {!editing && monthly > 0 && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress * 100}%`, background: isPaid ? 'var(--color-green)' : '#60a5fa' }}
          />
        </div>
      )}
    </div>
  )
}

function TxRow({ tx }) {
  const meta = CATEGORY_META[tx.category] || { icon: '💸', color: '#7c6af7' }
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-base">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-text)] truncate">{tx.merchant || tx.note}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{new Date(tx.date).toLocaleDateString()}</p>
      </div>
      <span className="text-sm font-semibold text-[var(--color-text-bright)]">
        ${tx.amount.toFixed(2)}
      </span>
    </div>
  )
}
