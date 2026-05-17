import { useStore } from '../store/useStore'
import { getTier } from '../utils/scoring'
import { getSavingsProjection } from '../utils/recommendations'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

export default function History() {
  const { state } = useStore()
  const history = state.weeklyHistory || []
  const projection = getSavingsProjection(state.weeklyIncome, state.budgets, history)

  const chartData = [...history].reverse().map((w, i) => ({
    week: `W${i + 1}`,
    score: w.score,
    saved: w.totalSaved || 0,
  }))

  const avgScore = history.length
    ? Math.round(history.reduce((s, w) => s + w.score, 0) / history.length)
    : 0

  const totalSaved = history.reduce((s, w) => s + (w.totalSaved || 0), 0)

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <div className="px-5 pt-8 pb-4">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Track record</p>
        <h1 className="text-2xl font-bold text-[var(--color-text-bright)]">History</h1>
      </div>

      {/* Summary cards */}
      <div className="px-5 grid grid-cols-2 gap-3 mb-5">
        <div className="glass rounded-xl px-4 py-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Avg weekly score</p>
          <p className="text-2xl font-bold" style={{ color: getTier(avgScore).color }}>{avgScore}</p>
          <p className="text-xs mt-0.5" style={{ color: getTier(avgScore).color }}>{getTier(avgScore).label}</p>
        </div>
        <div className="glass rounded-xl px-4 py-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Total saved</p>
          <p className="text-2xl font-bold text-[var(--color-green)]">${totalSaved.toFixed(0)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{history.length} weeks</p>
        </div>
        <div className="glass rounded-xl px-4 py-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Savings / 3 months</p>
          <p className="text-2xl font-bold text-[var(--color-accent-bright)]">${projection.projected12w}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">projected</p>
        </div>
        <div className="glass rounded-xl px-4 py-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Savings / year</p>
          <p className="text-2xl font-bold text-[var(--color-accent-bright)]">${projection.projected52w}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">projected</p>
        </div>
      </div>

      {/* Score chart */}
      {chartData.length > 0 && (
        <div className="mx-5 glass rounded-xl px-4 py-4 mb-4">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Weekly score</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="week" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text-bright)',
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-accent)', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Savings chart */}
      {chartData.length > 0 && (
        <div className="mx-5 glass rounded-xl px-4 py-4 mb-4">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Weekly savings</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="week" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text-bright)',
                }}
                formatter={v => [`$${v}`, 'Saved']}
              />
              <Line
                type="monotone"
                dataKey="saved"
                stroke="var(--color-green)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-green)', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Week log */}
      {history.length > 0 && (
        <div className="mx-5 glass rounded-xl px-5 py-4">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Week log</p>
          <div className="space-y-3">
            {history.map((w, i) => {
              const tier = getTier(w.score)
              return (
                <div key={i} className="flex items-center gap-3 py-1">
                  <span className="text-lg">{tier.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--color-text)]">
                      Week of {new Date(w.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">Spent ${(w.totalSpent || 0).toFixed(0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: tier.color }}>{w.score}</p>
                    <p className="text-xs" style={{ color: tier.color }}>{tier.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="mx-5 glass rounded-2xl px-6 py-12 text-center space-y-3">
          <div className="text-5xl">📈</div>
          <p className="font-semibold text-[var(--color-text-bright)]">No history yet</p>
          <p className="text-sm text-[var(--color-text-muted)]">Complete your first weekly ritual to start tracking.</p>
        </div>
      )}
    </div>
  )
}
