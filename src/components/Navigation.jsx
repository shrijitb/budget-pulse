import { motion } from 'framer-motion'

const TABS = [
  { id: 'dashboard', icon: '⚡', label: 'Pulse' },
  { id: 'ritual', icon: '🔁', label: 'Ritual' },
  { id: 'goals', icon: '🎯', label: 'Goals' },
  { id: 'history', icon: '📈', label: 'History' },
]

export default function Navigation({ active, onChange }) {
  return (
    <nav
      className="flex items-center justify-around px-2 py-3 border-t"
      style={{
        background: 'rgba(15,15,19,0.95)',
        borderColor: 'var(--color-border)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {TABS.map(tab => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex flex-col items-center gap-1 px-4 py-1 relative"
          >
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 rounded-xl"
                style={{ background: 'var(--color-accent-glow)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className={`text-xl transition-all ${isActive ? 'scale-110' : 'scale-100 opacity-50'}`}>
              {tab.icon}
            </span>
            <span
              className="text-xs font-medium relative z-10"
              style={{ color: isActive ? 'var(--color-accent-bright)' : 'var(--color-text-muted)' }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
