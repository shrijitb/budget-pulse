import { createContext, useContext, useReducer, useEffect } from 'react'

const STORAGE_KEY = 'budgetpulse_v1'

const DEFAULT_BUDGETS = {
  food: 150,
  transport: 75,
  entertainment: 50,
  shopping: 75,
  bigPurchases: 50,
  savings: 150,
}

const DEFAULT_STATE = {
  setup: false,
  weeklyIncome: 725,
  budgets: DEFAULT_BUDGETS,
  transactions: [],
  goals: [],
  weeklyHistory: [],
  currentWeekStart: null,
  streak: 0,
  lastRitualDate: null,
}

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE, currentWeekStart: getWeekStart() }
    const parsed = JSON.parse(raw)
    if (!parsed.currentWeekStart) parsed.currentWeekStart = getWeekStart()
    return parsed
  } catch {
    return { ...DEFAULT_STATE, currentWeekStart: getWeekStart() }
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function reducer(state, action) {
  switch (action.type) {
    case 'COMPLETE_SETUP':
      return { ...state, setup: true, weeklyIncome: action.income, budgets: action.budgets }

    case 'ADD_TRANSACTION':
      return { ...state, transactions: [action.tx, ...state.transactions] }

    case 'REMOVE_TRANSACTION':
      return { ...state, transactions: state.transactions.filter(t => t.id !== action.id) }

    case 'IMPORT_TRANSACTIONS': {
      const ids = new Set(state.transactions.map(t => t.id))
      const fresh = action.txs.filter(t => !ids.has(t.id))
      return { ...state, transactions: [...fresh, ...state.transactions] }
    }

    case 'ADD_GOAL':
      return { ...state, goals: [...state.goals, action.goal] }

    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: state.goals.map(g => g.id === action.id ? { ...g, ...action.updates } : g),
      }

    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter(g => g.id !== action.id) }

    case 'FUND_GOAL': {
      const amount = Number(action.amount)
      return {
        ...state,
        goals: state.goals.map(g =>
          g.id === action.id ? { ...g, saved: Math.min(g.target, (g.saved || 0) + amount) } : g
        ),
      }
    }

    case 'COMPLETE_RITUAL': {
      const now = new Date().toISOString()
      const weekEntry = {
        weekStart: state.currentWeekStart,
        score: action.score,
        completedAt: now,
        totalSpent: action.totalSpent,
        totalSaved: action.totalSaved,
      }
      const prevRitual = state.lastRitualDate
      const streak = prevRitual
        ? (() => {
            const last = new Date(prevRitual)
            const now2 = new Date()
            const diff = Math.floor((now2 - last) / (7 * 24 * 60 * 60 * 1000))
            return diff <= 1 ? (state.streak || 0) + 1 : 1
          })()
        : 1
      return {
        ...state,
        weeklyHistory: [weekEntry, ...state.weeklyHistory].slice(0, 52),
        lastRitualDate: now,
        streak,
        currentWeekStart: getWeekStart(),
      }
    }

    case 'UPDATE_BUDGETS':
      return { ...state, budgets: { ...state.budgets, ...action.budgets } }

    case 'RESET':
      return { ...DEFAULT_STATE, currentWeekStart: getWeekStart() }

    default:
      return state
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    save(state)
  }, [state])

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function useCurrentWeekTxs(state) {
  const weekStart = new Date(state.currentWeekStart)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return state.transactions.filter(t => {
    const d = new Date(t.date)
    return d >= weekStart && d < weekEnd
  })
}

export function useCategoryTotals(txs) {
  return txs.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount
    return acc
  }, {})
}
