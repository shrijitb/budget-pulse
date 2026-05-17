import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, useCurrentWeekTxs, useCategoryTotals } from '../store/useStore'
import { calcWeeklyScore } from '../utils/scoring'
import { CATEGORY_META } from '../utils/categorizer'
import CategoryBar from './CategoryBar'
import AddTransaction from './AddTransaction'

const SLIDE = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.28 },
}

export default function WeeklyRitual() {
  const { state, dispatch } = useStore()
  const [step, setStep] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [savingsInput, setSavingsInput] = useState('')
  const [fundGoalId, setFundGoalId] = useState(null)
  const [fundAmount, setFundAmount] = useState('')
  const [done, setDone] = useState(false)

  const weekTxs = useCurrentWeekTxs(state)
  const categoryTotals = useCategoryTotals(weekTxs)

  const scoreData = calcWeeklyScore({
    categoryTotals,
    budgets: state.budgets,
    txCount: weekTxs.length,
    weeklyIncome: state.weeklyIncome,
    streak: state.streak,
  })

  const totalSpent = Object.entries(categoryTotals)
    .filter(([k]) => k !== 'savings')
    .reduce((s, [, v]) => s + v, 0)

  function logSavings() {
    const amt = parseFloat(savingsInput)
    if (amt > 0) {
      dispatch({
        type: 'ADD_TRANSACTION',
        tx: {
          id: `tx_${Date.now()}`,
          merchant: 'Savings transfer',
          amount: amt,
          category: 'savings',
          date: new Date().toISOString(),
          source: 'manual',
        },
      })
    }
  }

  function fundGoal() {
    const amt = parseFloat(fundAmount)
    if (fundGoalId && amt > 0) {
      dispatch({ type: 'FUND_GOAL', id: fundGoalId, amount: amt })
    }
  }

  function finish() {
    logSavings()
    fundGoal()
    dispatch({
      type: 'COMPLETE_RITUAL',
      score: scoreData.total,
      totalSpent,
      totalSaved: parseFloat(savingsInput) || 0,
    })
    setDone(true)
  }

  if (done) return <RitualComplete score={scoreData.total} streak={(state.streak || 0) + 1} onReset={() => setDone(false)} />

  const steps = [
    <StepReview key="review" weekTxs={weekTxs} categoryTotals={categoryTotals} budgets={state.budgets}
      onAdd={() => setShowAdd(true)} onNext={() => setStep(1)} />,
    <StepCategories key="cats" categoryTotals={categoryTotals} budgets={state.budgets} onNext={() => setStep(2)} />,
    <StepSavings key="savings" value={savingsInput} onChange={setSavingsInput}
      suggested={state.budgets.savings} onNext={() => setStep(3)} />,
    <StepGoals key="goals" goals={state.goals} fundGoalId={fundGoalId} fundAmount={fundAmount}
      onSelectGoal={setFundGoalId} onSetAmount={setFundAmount} onNext={() => setStep(4)} />,
    <StepFinish key="finish" score={scoreData.total} totalSpent={totalSpent}
      savingsAmount={savingsInput} onFinish={finish} />,
  ]

  const STEP_LABELS = ['Review', 'Categories', 'Savings', 'Goals', 'Finish']

  return (
    <div className="flex flex-col min-h-screen px-5 pt-8 pb-4">
      <div className="mb-6">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Weekly Ritual</p>
        <h1 className="text-2xl font-bold text-[var(--color-text-bright)] mb-4">
          {STEP_LABELS[step]}
        </h1>
        <div className="flex gap-1.5">
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-500"
              style={{ background: i <= step ? 'var(--color-accent)' : 'var(--color-border)' }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...SLIDE}>
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showAdd && <AddTransaction onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function StepReview({ weekTxs, categoryTotals, budgets, onAdd, onNext }) {
  const totalSpent = Object.entries(categoryTotals)
    .filter(([k]) => k !== 'savings')
    .reduce((s, [, v]) => s + v, 0)

  return (
    <div className="space-y-5">
      <div className="glass rounded-xl px-5 py-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Total spent this week</p>
          <p className="text-3xl font-bold text-[var(--color-text-bright)]">${totalSpent.toFixed(0)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-muted)]">Transactions</p>
          <p className="text-2xl font-bold text-[var(--color-accent)]">{weekTxs.length}</p>
        </div>
      </div>

      {weekTxs.length < 5 && (
        <div className="rounded-xl px-4 py-3" style={{ background: 'var(--color-amber-dim)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <p className="text-sm text-[var(--color-amber)]">💡 Add more transactions for a complete picture</p>
        </div>
      )}

      <div className="space-y-3 max-h-60 overflow-y-auto">
        {weekTxs.map(tx => {
          const meta = CATEGORY_META[tx.category] || { icon: '💸' }
          return (
            <div key={tx.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
              <span>{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text)] truncate">{tx.merchant || tx.note}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{new Date(tx.date).toLocaleDateString()}</p>
              </div>
              <span className="text-sm font-semibold text-[var(--color-text-bright)]">${tx.amount.toFixed(2)}</span>
            </div>
          )
        })}
      </div>

      <button onClick={onAdd} className="btn-secondary w-full">+ Add missing transaction</button>
      <button onClick={onNext} className="btn-primary w-full">Looks good →</button>
    </div>
  )
}

function StepCategories({ categoryTotals, budgets, onNext }) {
  return (
    <div className="space-y-5">
      <p className="text-[var(--color-text-muted)] text-sm">How did each category do this week?</p>
      <div className="glass rounded-xl px-5 py-4 space-y-5">
        {Object.keys(budgets).map(cat => (
          <CategoryBar
            key={cat}
            category={cat}
            spent={categoryTotals[cat] || 0}
            budget={budgets[cat]}
          />
        ))}
      </div>
      <button onClick={onNext} className="btn-primary w-full">Next →</button>
    </div>
  )
}

function StepSavings({ value, onChange, suggested, onNext }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[var(--color-text-muted)] text-sm mb-1">Did you transfer to savings this week?</p>
        <p className="text-xs text-[var(--color-text-muted)]">Suggested: ${suggested}/week</p>
      </div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[var(--color-text-muted)]">$</span>
        <input
          type="number"
          step="1"
          min="0"
          placeholder="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input-field w-full pl-9 text-2xl font-bold"
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        {[50, 100, 150, 200].map(amt => (
          <button
            key={amt}
            onClick={() => onChange(String(amt))}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: value === String(amt) ? 'var(--color-accent-glow)' : 'var(--color-surface-3)',
              color: value === String(amt) ? 'var(--color-accent-bright)' : 'var(--color-text-muted)',
              border: value === String(amt) ? '1px solid var(--color-accent)' : '1px solid transparent',
            }}
          >
            ${amt}
          </button>
        ))}
      </div>
      <button onClick={onNext} className="btn-primary w-full">Next →</button>
      <button onClick={onNext} className="w-full py-2 text-sm text-[var(--color-text-muted)]">Skip</button>
    </div>
  )
}

function StepGoals({ goals, fundGoalId, fundAmount, onSelectGoal, onSetAmount, onNext }) {
  if (goals.length === 0) {
    return (
      <div className="space-y-5">
        <p className="text-[var(--color-text-muted)]">No goals yet — add them in the Goals tab.</p>
        <button onClick={onNext} className="btn-primary w-full">Next →</button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-[var(--color-text-muted)] text-sm">Allocate savings toward a goal?</p>
      <div className="space-y-2">
        {goals.map(g => {
          const pct = Math.min(100, ((g.saved || 0) / g.target) * 100)
          return (
            <button
              key={g.id}
              onClick={() => onSelectGoal(fundGoalId === g.id ? null : g.id)}
              className="w-full glass rounded-xl px-4 py-3 text-left transition-all"
              style={{
                border: fundGoalId === g.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span>{g.emoji || '🎯'}</span>
                <span className="font-medium text-[var(--color-text-bright)] text-sm">{g.name}</span>
                <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                  ${(g.saved || 0).toFixed(0)} / ${g.target}
                </span>
              </div>
              <div className="h-1 rounded-full" style={{ background: 'var(--color-surface-3)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-green)' }} />
              </div>
            </button>
          )
        })}
      </div>
      {fundGoalId && (
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
          <input
            type="number"
            placeholder="Amount to allocate"
            value={fundAmount}
            onChange={e => onSetAmount(e.target.value)}
            className="input-field w-full pl-8"
          />
        </div>
      )}
      <button onClick={onNext} className="btn-primary w-full">Next →</button>
    </div>
  )
}

function StepFinish({ score, totalSpent, savingsAmount, onFinish }) {
  const { label, color, emoji } = (() => {
    if (score >= 90) return { label: 'Elite', color: '#34d399', emoji: '💎' }
    if (score >= 75) return { label: 'Strong', color: '#7c6af7', emoji: '🔥' }
    if (score >= 55) return { label: 'Steady', color: '#38bdf8', emoji: '⚡' }
    return { label: 'Building', color: '#f59e0b', emoji: '🌱' }
  })()

  return (
    <div className="space-y-6 text-center">
      <div className="text-6xl">{emoji}</div>
      <div>
        <p className="text-[var(--color-text-muted)] text-sm mb-1">This week's score</p>
        <p className="text-5xl font-bold" style={{ color }}>{score}</p>
        <p className="font-semibold mt-1" style={{ color }}>{label}</p>
      </div>
      <div className="glass rounded-xl px-5 py-4 space-y-3 text-left">
        <div className="flex justify-between">
          <span className="text-[var(--color-text-muted)] text-sm">Total spent</span>
          <span className="font-semibold text-[var(--color-text-bright)]">${totalSpent.toFixed(0)}</span>
        </div>
        {parseFloat(savingsAmount) > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)] text-sm">Saved</span>
            <span className="font-semibold text-[var(--color-green)]">${parseFloat(savingsAmount).toFixed(0)}</span>
          </div>
        )}
      </div>
      <button onClick={onFinish} className="btn-primary w-full text-base py-4">
        Complete ritual ✓
      </button>
    </div>
  )
}

function RitualComplete({ score, streak, onReset }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-screen px-5 text-center space-y-6"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <div className="text-7xl">🎉</div>
      <h2 className="text-2xl font-bold text-[var(--color-text-bright)]">Ritual complete!</h2>
      <p className="text-[var(--color-text-muted)]">
        Week {streak} in a row. Score: <span className="font-bold text-[var(--color-accent-bright)]">{score}</span>
      </p>
      <p className="text-sm text-[var(--color-text-muted)]">See you next week 💪</p>
    </motion.div>
  )
}
