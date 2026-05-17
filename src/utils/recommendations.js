export function getRecommendations(weeklyIncome) {
  const w = weeklyIncome
  return {
    food: Math.round(w * 0.21),
    transport: Math.round(w * 0.10),
    entertainment: Math.round(w * 0.07),
    shopping: Math.round(w * 0.10),
    bigPurchases: Math.round(w * 0.07),
    savings: Math.round(w * 0.21),
  }
}

export function getSavingsProjection(weeklyIncome, budgets, weeklyHistory) {
  const weeklySavings = budgets.savings || Math.round(weeklyIncome * 0.21)
  const avgActual = weeklyHistory.length > 0
    ? weeklyHistory.slice(0, 8).reduce((s, w) => s + (w.totalSaved || 0), 0) / Math.min(8, weeklyHistory.length)
    : weeklySavings
  return {
    projected4w: Math.round(avgActual * 4),
    projected12w: Math.round(avgActual * 12),
    projected52w: Math.round(avgActual * 52),
  }
}

export function getGoalETA(goal, weeklyHistory) {
  const remaining = goal.target - (goal.saved || 0)
  if (remaining <= 0) return { weeks: 0, onTrack: true }
  const avgWeeklySavings = weeklyHistory.length > 0
    ? weeklyHistory.slice(0, 8).reduce((s, w) => s + (w.totalSaved || 0), 0) / Math.min(8, weeklyHistory.length)
    : 150
  if (avgWeeklySavings <= 0) return { weeks: Infinity, onTrack: false }
  const weeks = Math.ceil(remaining / avgWeeklySavings)
  const onTrack = goal.targetDate
    ? weeks <= Math.ceil((new Date(goal.targetDate) - new Date()) / (7 * 24 * 60 * 60 * 1000))
    : true
  return { weeks, onTrack }
}

export function getWeeklyRequired(goal) {
  if (!goal.targetDate) return null
  const remaining = goal.target - (goal.saved || 0)
  if (remaining <= 0) return 0
  const weeksLeft = (new Date(goal.targetDate) - new Date()) / (7 * 24 * 60 * 60 * 1000)
  if (weeksLeft <= 0) return null
  return remaining / weeksLeft
}

export function getCategoryInsight(categoryTotals, budgets) {
  const insights = []
  for (const [cat, budget] of Object.entries(budgets)) {
    if (cat === 'savings') continue
    const spent = categoryTotals[cat] || 0
    const ratio = spent / budget
    if (ratio > 1.1) insights.push({ cat, type: 'over', ratio })
    else if (ratio < 0.5 && spent > 0) insights.push({ cat, type: 'under', ratio })
  }
  return insights
}
