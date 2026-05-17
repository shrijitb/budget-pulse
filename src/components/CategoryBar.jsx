import { motion } from 'framer-motion'
import { CATEGORY_META } from '../utils/categorizer'

export default function CategoryBar({ category, spent, budget }) {
  const meta = CATEGORY_META[category] || { label: category, color: '#7c6af7', icon: '💸' }
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const isOver = spent > budget

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.icon}</span>
          <span className="text-sm text-[var(--color-text)]">{meta.label}</span>
        </div>
        <div className="text-right">
          <span
            className="text-sm font-semibold"
            style={{ color: isOver ? 'var(--color-red)' : 'var(--color-text-bright)' }}
          >
            ${spent.toFixed(0)}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]"> / ${budget}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--color-surface-3)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: isOver ? 'var(--color-red)' : meta.color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </div>
    </div>
  )
}
