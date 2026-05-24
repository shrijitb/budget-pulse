import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import { getRecommendations } from '../utils/recommendations'

const SLIDE = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.3 },
}

export default function SetupFlow() {
  const { dispatch } = useStore()
  const [step, setStep] = useState(0)
  const [income, setIncome] = useState(725)
  const [budgets, setBudgets] = useState(() => getRecommendations(725))
  const [monthlyStudentLoan, setMonthlyStudentLoan] = useState(0)
  const [firstGoal, setFirstGoal] = useState({ name: '', target: '' })

  function recalc(newIncome) {
    setIncome(newIncome)
    setBudgets(getRecommendations(newIncome))
  }

  function finish() {
    dispatch({ type: 'COMPLETE_SETUP', income, budgets, monthlyStudentLoan })
    if (monthlyStudentLoan > 0) {
      dispatch({ type: 'SET_MONTHLY_STUDENT_LOAN', amount: monthlyStudentLoan })
    }
    if (firstGoal.name && Number(firstGoal.target) > 0) {
      dispatch({
        type: 'ADD_GOAL',
        goal: {
          id: `goal_${Date.now()}`,
          name: firstGoal.name,
          target: Number(firstGoal.target),
          saved: 0,
          emoji: '🎯',
          createdAt: new Date().toISOString(),
        },
      })
    }
  }

  const steps = [
    <StepWelcome key="welcome" onNext={() => setStep(1)} />,
    <StepIncome key="income" income={income} onChange={recalc} onNext={() => setStep(2)} />,
    <StepBudgets key="budgets" income={income} budgets={budgets} onChange={setBudgets} onNext={() => setStep(3)} />,
    <StepStudentLoan key="loans" monthlyStudentLoan={monthlyStudentLoan} onChange={setMonthlyStudentLoan} onNext={() => setStep(4)} />,
    <StepGoal key="goal" goal={firstGoal} onChange={setFirstGoal} onFinish={finish} />,
  ]

  return (
    <div className="flex flex-col min-h-screen px-6 py-10 justify-between">
      <div className="flex gap-2 mb-8">
        {steps.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-500"
            style={{ background: i <= step ? 'var(--color-accent)' : 'var(--color-border)' }}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...SLIDE}>
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function StepWelcome({ onNext }) {
  return (
    <div className="text-center space-y-6">
      <div className="text-6xl mb-2">💎</div>
      <h1 className="text-3xl font-bold text-gradient">BudgetPulse</h1>
      <p className="text-[var(--color-text-muted)] text-lg leading-relaxed">
        Your weekly 10-minute ritual for financial clarity. Track spending, grow savings, and hit goals that matter.
      </p>
      <button onClick={onNext} className="btn-primary w-full mt-8">
        Let's set up your profile →
      </button>
    </div>
  )
}

function StepIncome({ income, onChange, onNext }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text-bright)] mb-2">Weekly income</h2>
        <p className="text-[var(--color-text-muted)]">We'll auto-calculate smart budgets from this.</p>
      </div>
      <div className="glass rounded-xl p-6">
        <div className="text-center mb-4">
          <span className="text-4xl font-bold text-gradient">${income}</span>
          <span className="text-[var(--color-text-muted)] ml-1">/week</span>
        </div>
        <input
          type="range"
          min={300}
          max={3000}
          step={25}
          value={income}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
        />
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
          <span>$300</span><span>$3,000</span>
        </div>
      </div>
      <button onClick={onNext} className="btn-primary w-full">
        Set budgets →
      </button>
    </div>
  )
}

const BUDGET_LABELS = {
  food: { label: 'Food', icon: '🍔' },
  transport: { label: 'Transport', icon: '🚗' },
  entertainment: { label: 'Entertainment', icon: '🎬' },
  subscriptions: { label: 'Subscriptions', icon: '📱' },
  shopping: { label: 'Shopping', icon: '🛍️' },
  bigPurchases: { label: 'Big Purchases', icon: '✈️' },
  savings: { label: 'Savings', icon: '💰' },
}

function StepBudgets({ income, budgets, onChange, onNext }) {
  function update(cat, val) {
    onChange(prev => ({ ...prev, [cat]: Math.max(0, val) }))
  }

  const total = Object.values(budgets).reduce((s, v) => s + v, 0)
  const remaining = income - total

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text-bright)] mb-1">Weekly budgets</h2>
        <p className="text-[var(--color-text-muted)] text-sm">Adjust to fit your life. Remainder is buffer.</p>
      </div>

      <div className="glass rounded-xl p-3 flex justify-between items-center">
        <span className="text-sm text-[var(--color-text-muted)]">Remaining buffer</span>
        <span className={`font-bold text-lg ${remaining < 0 ? 'text-[var(--color-red)]' : 'text-[var(--color-green)]'}`}>
          ${remaining}
        </span>
      </div>

      <div className="space-y-3">
        {Object.entries(BUDGET_LABELS).map(([cat, { label, icon }]) => (
          <div key={cat} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-lg">{icon}</span>
            <span className="text-sm text-[var(--color-text)] flex-1">{label}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => update(cat, (budgets[cat] || 0) - 5)}
                className="w-7 h-7 rounded-lg bg-[var(--color-surface-3)] text-[var(--color-text-muted)] flex items-center justify-center text-sm hover:text-[var(--color-text-bright)]"
              >−</button>
              <span className="w-14 text-center font-semibold text-[var(--color-text-bright)]">
                ${budgets[cat] || 0}
              </span>
              <button
                onClick={() => update(cat, (budgets[cat] || 0) + 5)}
                className="w-7 h-7 rounded-lg bg-[var(--color-surface-3)] text-[var(--color-text-muted)] flex items-center justify-center text-sm hover:text-[var(--color-text-bright)]"
              >+</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onNext} className="btn-primary w-full">
        Set first goal →
      </button>
    </div>
  )
}

function StepStudentLoan({ monthlyStudentLoan, onChange, onNext }) {
  const [inputVal, setInputVal] = useState(monthlyStudentLoan > 0 ? String(monthlyStudentLoan) : '')

  function handleNext() {
    const amt = parseFloat(inputVal)
    onChange(isNaN(amt) ? 0 : Math.max(0, amt))
    onNext()
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text-bright)] mb-2">Student loans</h2>
        <p className="text-[var(--color-text-muted)]">
          Do you make monthly student loan payments? We'll track them separately so they don't inflate your weekly spending.
        </p>
      </div>
      <div className="glass rounded-xl p-6 space-y-3">
        <p className="text-sm font-medium text-[var(--color-text-bright)]">Monthly payment amount</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 350"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            className="input-field w-full pl-9 text-2xl font-bold"
            autoFocus
          />
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Leave blank if you don't have student loans — you can set this later from the dashboard.
        </p>
      </div>
      <div className="space-y-3">
        <button onClick={handleNext} className="btn-primary w-full">
          Set first goal →
        </button>
        <button
          onClick={onNext}
          className="w-full py-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Skip — no student loans
        </button>
      </div>
    </div>
  )
}

function StepGoal({ goal, onChange, onFinish }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text-bright)] mb-2">First goal</h2>
        <p className="text-[var(--color-text-muted)]">What are you saving toward? You can add more later.</p>
      </div>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="e.g. Japan trip, MacBook Pro"
          value={goal.name}
          onChange={e => onChange(prev => ({ ...prev, name: e.target.value }))}
          className="input-field w-full"
        />
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
          <input
            type="number"
            placeholder="Target amount"
            value={goal.target}
            onChange={e => onChange(prev => ({ ...prev, target: e.target.value }))}
            className="input-field w-full pl-8"
          />
        </div>
      </div>
      <div className="space-y-3">
        <button onClick={onFinish} className="btn-primary w-full">
          Start tracking →
        </button>
        <button
          onClick={onFinish}
          className="w-full py-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
