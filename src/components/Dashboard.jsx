import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, useCurrentWeekTxs, useCategoryTotals } from '../store/useStore'
import { calcWeeklyScore, getScoreInsight } from '../utils/scoring'
import ScoreRing from './ScoreRing'
import CategoryBar from './CategoryBar'
import AddTransaction from './AddTransaction'
import { CATEGORY_META } from '../utils/categorizer'

export default function Dashboard({ onNavigate }) {
  const { state } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  const [showTxs, setShowTxs] = useState(false)

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

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      {/* Header */}
      <div className="px-5 pt-8 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-1">This Week</p>
          <h1 className="text-2xl font-bold text-[var(--color-text-bright)]">BudgetPulse</h1>
        </div>
        <div className="text-right">
          {state.streak > 0 && (
            <div className="flex items-center gap-1 text-sm font-medium text-[var(--color-amber)]">
              🔥 {state.streak} week{state.streak !== 1 ? 's' : ''}
            </div>
          )}
          <p className="text-xs text-[var(--color-text-muted)]">{weekTxs.length} transactions</p>
        </div>
      </div>

      {/* Score ring */}
      <div className="flex justify-center py-4">
        <ScoreRing score={scoreData.total} />
      </div>

      {/* Remaining budget */}
      <div className="mx-5 mb-4 glass rounded-xl px-5 py-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Budget remaining</p>
          <p
            className="text-2xl font-bold"
            style={{ color: remaining >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}
          >
            ${Math.abs(remaining).toFixed(0)}
            <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">
              {remaining >= 0 ? 'left' : 'over'}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary px-5 py-2.5 text-sm"
        >
          + Add
        </button>
      </div>

      {/* Insight */}
      <div className="mx-5 mb-5 rounded-xl px-4 py-3" style={{ background: 'var(--color-accent-glow)', border: '1px solid rgba(124,106,247,0.3)' }}>
        <p className="text-sm text-[var(--color-accent-bright)]">💡 {insight}</p>
      </div>

      {/* Categories */}
      <div className="mx-5 glass rounded-xl px-5 py-4 space-y-4 mb-4">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Categories</p>
        {Object.keys(state.budgets)
          .filter(k => k !== 'savings')
          .map(cat => (
            <CategoryBar
              key={cat}
              category={cat}
              spent={categoryTotals[cat] || 0}
              budget={state.budgets[cat]}
            />
          ))}
      </div>

      {/* Savings bar */}
      <div className="mx-5 glass rounded-xl px-5 py-4 mb-4">
        <CategoryBar
          category="savings"
          spent={categoryTotals.savings || 0}
          budget={state.budgets.savings}
        />
      </div>

      {/* Top goal */}
      {topGoal && (
        <button
          onClick={() => onNavigate('goals')}
          className="mx-5 glass rounded-xl px-5 py-4 w-[calc(100%-40px)] text-left mb-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Top Goal</span>
            <span className="text-xs text-[var(--color-accent)]">See all →</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{topGoal.emoji || '🎯'}</span>
            <div className="flex-1">
              <p className="font-semibold text-[var(--color-text-bright)] text-sm">{topGoal.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--color-surface-3)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--color-green)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ((topGoal.saved || 0) / topGoal.target) * 100)}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  ${(topGoal.saved || 0).toFixed(0)} / ${topGoal.target}
                </span>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Recent transactions */}
      {weekTxs.length > 0 && (
        <div className="mx-5 glass rounded-xl px-5 py-4">
          <button
            className="w-full flex items-center justify-between mb-3"
            onClick={() => setShowTxs(v => !v)}
          >
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Recent transactions</span>
            <span className="text-xs text-[var(--color-accent)]">{showTxs ? '↑ hide' : '↓ show'}</span>
          </button>
          <AnimatePresence>
            {showTxs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-2"
              >
                {weekTxs.slice(0, 10).map(tx => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Folder watcher */}
      {window.electronAPI && <FolderWatcherRow />}

      <AnimatePresence>
        {showAdd && <AddTransaction onClose={() => setShowAdd(false)} />}
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
  }, [])

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
