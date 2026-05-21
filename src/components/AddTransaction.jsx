import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, useCurrentWeekTxs, useCategoryTotals } from '../store/useStore'
import { CATEGORY_META } from '../utils/categorizer'

const CATEGORIES = Object.entries(CATEGORY_META).map(([id, meta]) => ({ id, ...meta }))

export default function AddTransaction({ onClose }) {
  const { state, dispatch } = useStore()
  const weekTxs = useCurrentWeekTxs(state)
  const weekTotals = useCategoryTotals(weekTxs)
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  function submit(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return

    const newTx = {
      id: `tx_${Date.now()}`,
      merchant: merchant.trim() || 'Manual entry',
      amount: amt,
      category,
      date: new Date(date).toISOString(),
      source: 'manual',
    }

    dispatch({ type: 'ADD_TRANSACTION', tx: newTx })

    const weekStart = new Date(state.currentWeekStart)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const txDate = new Date(newTx.date)
    const inCurrentWeek = txDate >= weekStart && txDate < weekEnd
    const projectedTotal = weekTotals[category] || 0
    const nextTotal = projectedTotal + amt

    if (inCurrentWeek && category !== 'savings' && nextTotal > state.budgets[category]) {
      const meta = CATEGORY_META[category]
      window.electronAPI?.showNotification(
        `Over budget: ${meta?.label || category}`,
        `$${nextTotal.toFixed(0)} spent vs $${state.budgets[category]} budget this week`
      )
    }

    setMerchant('')
    setAmount('')
    setCategory('food')
    setDate(new Date().toISOString().slice(0, 10))
    onClose()
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-[480px] mx-auto rounded-t-2xl px-5 py-6 space-y-5"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-text-bright)]">Add Transaction</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] text-xl leading-none">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[var(--color-text-muted)]">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="input-field w-full pl-9 text-2xl font-bold"
              autoFocus
              required
            />
          </div>

          <input
            type="text"
            placeholder="Merchant / description"
            value={merchant}
            onChange={e => setMerchant(e.target.value)}
            className="input-field w-full"
          />

          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input-field w-full"
          />

          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs transition-all"
                style={{
                  background: category === cat.id ? `${cat.color}25` : 'var(--color-surface-3)',
                  border: `1px solid ${category === cat.id ? cat.color : 'transparent'}`,
                  color: category === cat.id ? cat.color : 'var(--color-text-muted)',
                }}
              >
                <span className="text-lg">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          <button type="submit" className="btn-primary w-full">
            Save transaction
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
