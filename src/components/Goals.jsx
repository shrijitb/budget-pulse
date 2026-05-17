import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import { getGoalETA, getWeeklyRequired } from '../utils/recommendations'
import PDFImporter from './PDFImporter'

const EMOJIS = ['🎯', '✈️', '🏖️', '🏠', '💻', '🎸', '🚗', '💎', '🌍', '🎓', '👗', '🏋️']

export default function Goals() {
  const { state, dispatch } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [showPDF, setShowPDF] = useState(false)
  const [form, setForm] = useState({ name: '', target: '', emoji: '🎯', targetDate: '' })

  function addGoal(e) {
    e.preventDefault()
    if (!form.name || !form.target) return
    dispatch({
      type: 'ADD_GOAL',
      goal: {
        id: `goal_${Date.now()}`,
        name: form.name,
        target: Number(form.target),
        saved: 0,
        emoji: form.emoji,
        targetDate: form.targetDate || null,
        createdAt: new Date().toISOString(),
      },
    })
    setForm({ name: '', target: '', emoji: '🎯', targetDate: '' })
    setShowForm(false)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <div className="px-5 pt-8 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Achievements</p>
          <h1 className="text-2xl font-bold text-[var(--color-text-bright)]">Goals</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPDF(true)}
            className="px-3 py-2 rounded-xl text-sm glass text-[var(--color-text-muted)]"
          >
            📄 Import
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm">
            + New
          </button>
        </div>
      </div>

      {state.goals.length === 0 && !showForm && (
        <div className="mx-5 glass rounded-2xl px-6 py-12 text-center space-y-3">
          <div className="text-5xl">🎯</div>
          <p className="font-semibold text-[var(--color-text-bright)]">No goals yet</p>
          <p className="text-sm text-[var(--color-text-muted)]">Add a big purchase, vacation, or anything you're saving toward.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary px-6 py-2.5 text-sm mt-2">
            Add first goal
          </button>
        </div>
      )}

      <div className="px-5 space-y-3">
        {state.goals.map(goal => (
          <GoalCard key={goal.id} goal={goal} history={state.weeklyHistory} dispatch={dispatch} />
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <motion.div
              className="relative w-full max-w-[480px] mx-auto rounded-t-2xl px-5 py-6"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-[var(--color-text-bright)]">New Goal</h2>
                <button onClick={() => setShowForm(false)} className="text-[var(--color-text-muted)] text-xl">✕</button>
              </div>
              <form onSubmit={addGoal} className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, emoji: e }))}
                      className="text-2xl w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                      style={{ background: form.emoji === e ? 'var(--color-accent-glow)' : 'var(--color-surface-3)' }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Goal name (e.g. Japan trip)"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field w-full"
                  required
                />
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
                  <input
                    type="number"
                    placeholder="Target amount"
                    value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                    className="input-field w-full pl-8"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Target date (optional)</label>
                  <input
                    type="date"
                    value={form.targetDate}
                    onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
                <button type="submit" className="btn-primary w-full">Add goal</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPDF && <PDFImporter onClose={() => setShowPDF(false)} />}
      </AnimatePresence>
    </div>
  )
}

function GoalCard({ goal, history, dispatch }) {
  const [showFund, setShowFund] = useState(false)
  const [fundAmt, setFundAmt] = useState('')
  const pct = Math.min(100, ((goal.saved || 0) / goal.target) * 100)
  const { weeks, onTrack } = getGoalETA(goal, history)
  const done = (goal.saved || 0) >= goal.target
  const weeklyRequired = getWeeklyRequired(goal)

  function fund(e) {
    e.preventDefault()
    const amt = parseFloat(fundAmt)
    if (!amt || amt <= 0) return
    dispatch({ type: 'FUND_GOAL', id: goal.id, amount: amt })
    setFundAmt('')
    setShowFund(false)
  }

  return (
    <motion.div
      className="glass rounded-2xl px-5 py-4 space-y-3"
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{goal.emoji || '🎯'}</span>
          <div>
            <p className="font-semibold text-[var(--color-text-bright)]">{goal.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              ${(goal.saved || 0).toFixed(0)} of ${goal.target}
            </p>
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'DELETE_GOAL', id: goal.id })}
          className="text-[var(--color-text-muted)] text-sm hover:text-[var(--color-red)]"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">{pct.toFixed(0)}% complete</span>
          {done ? (
            <span className="text-[var(--color-green)] font-semibold">✓ Reached!</span>
          ) : weeks < Infinity ? (
            <span style={{ color: onTrack ? 'var(--color-green)' : 'var(--color-amber)' }}>
              {onTrack ? '✓' : '⚠'} ~{weeks}w to go
            </span>
          ) : null}
        </div>
        <div className="h-2 rounded-full" style={{ background: 'var(--color-surface-3)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: done ? 'var(--color-green)' : 'var(--color-accent)' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
          />
        </div>
      </div>

      {!done && weeklyRequired !== null && weeklyRequired > 0 && (
        <p className="text-xs" style={{ color: onTrack ? 'var(--color-green)' : 'var(--color-amber)' }}>
          Save ${weeklyRequired.toFixed(2)}/wk to reach by {new Date(goal.targetDate).toLocaleDateString()}
        </p>
      )}

      {!done && (
        <>
          <button
            onClick={() => setShowFund(v => !v)}
            className="text-sm text-[var(--color-accent)] font-medium"
          >
            {showFund ? '↑ Cancel' : '+ Add funds'}
          </button>
          <AnimatePresence>
            {showFund && (
              <motion.form
                onSubmit={fund}
                className="flex gap-2"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm">$</span>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={fundAmt}
                    onChange={e => setFundAmt(e.target.value)}
                    className="input-field w-full pl-7 py-2 text-sm"
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn-primary px-4 py-2 text-sm">Add</button>
              </motion.form>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}
