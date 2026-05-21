import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { StoreProvider, useStore } from './store/useStore'
import SetupFlow from './components/SetupFlow'
import Navigation from './components/Navigation'
import Dashboard from './components/Dashboard'
import WeeklyRitual from './components/WeeklyRitual'
import Goals from './components/Goals'
import History from './components/History'

function AppShell() {
  const { state } = useStore()
  const [tab, setTab] = useState('dashboard')

  if (!state.setup) return <SetupFlow />

  const screens = {
    dashboard: <Dashboard onNavigate={setTab} />,
    ritual: <WeeklyRitual />,
    goals: <Goals />,
    history: <History />,
  }

  return (
    <div className="flex h-full min-h-screen bg-[var(--color-surface)]">
      <div className="hidden md:block md:w-64">
        <Navigation active={tab} onChange={setTab} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              className="absolute inset-0 overflow-y-auto"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
            >
              {screens[tab]}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="md:hidden">
          <Navigation active={tab} onChange={setTab} />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  )
}
