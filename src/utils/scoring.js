// Weekly score 0-100 with weighted dimensions
// savings 40pts | category discipline 30pts | logging 20pts | streak 10pts

export function calcWeeklyScore({ categoryTotals, budgets, txCount, weeklyIncome, streak }) {
  // Savings rate score (40pts): did we stay under non-savings budget?
  const nonSavingsBudget = Object.entries(budgets)
    .filter(([k]) => k !== 'savings')
    .reduce((s, [, v]) => s + v, 0)
  const totalSpent = Object.entries(categoryTotals)
    .filter(([k]) => k !== 'savings')
    .reduce((s, [, v]) => s + v, 0)
  const spendRatio = totalSpent / nonSavingsBudget
  const savingsScore = Math.round(Math.max(0, Math.min(40, 40 * (1 - Math.max(0, spendRatio - 1)))))

  // Category discipline (30pts): avg of per-category adherence
  const categories = Object.keys(budgets).filter(k => k !== 'savings')
  const disciplineRaw = categories.map(cat => {
    const spent = categoryTotals[cat] || 0
    const budget = budgets[cat] || 1
    return Math.max(0, 1 - Math.max(0, (spent - budget) / budget))
  })
  const avgDiscipline = disciplineRaw.reduce((s, v) => s + v, 0) / categories.length
  const disciplineScore = Math.round(avgDiscipline * 30)

  // Logging score (20pts): 7+ transactions = full score
  const loggingScore = Math.round(Math.min(20, (txCount / 7) * 20))

  // Streak score (10pts): up to 10 week streak = full
  const streakScore = Math.round(Math.min(10, (Math.min(streak, 10) / 10) * 10))

  const total = savingsScore + disciplineScore + loggingScore + streakScore

  return {
    total,
    savingsScore,
    disciplineScore,
    loggingScore,
    streakScore,
    tier: getTier(total),
  }
}

export function getTier(score) {
  if (score >= 90) return { label: 'Elite', color: '#34d399', emoji: '💎' }
  if (score >= 75) return { label: 'Strong', color: '#7c6af7', emoji: '🔥' }
  if (score >= 55) return { label: 'Steady', color: '#38bdf8', emoji: '⚡' }
  if (score >= 35) return { label: 'Building', color: '#f59e0b', emoji: '🌱' }
  return { label: 'Starting', color: '#6b6b80', emoji: '🎯' }
}

export function getScoreInsight({ savingsScore, disciplineScore, loggingScore, categoryTotals, budgets }) {
  if (loggingScore < 10) return "Log more transactions this week for a complete picture."
  if (disciplineScore < 15) {
    const worst = Object.entries(budgets)
      .filter(([k]) => k !== 'savings')
      .sort(([a], [b]) => {
        const overA = (categoryTotals[a] || 0) - budgets[a]
        const overB = (categoryTotals[b] || 0) - budgets[b]
        return overB - overA
      })[0]
    if (worst) return `Your ${LABELS[worst[0]] || worst[0]} spending is pushing over budget.`
  }
  if (savingsScore >= 35) return "Great discipline — your savings rate looks healthy this week."
  return "Stay under budget in the final days to protect your score."
}

const LABELS = {
  food: 'Food',
  transport: 'Transport',
  entertainment: 'Entertainment',
  shopping: 'Shopping',
  bigPurchases: 'Big Purchases',
  savings: 'Savings',
}
