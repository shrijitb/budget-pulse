import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { getTier } from '../utils/scoring'

const SIZE = 180
const RADIUS = 78
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ScoreRing({ score }) {
  const tier = getTier(score)
  const motionScore = useMotionValue(0)
  const displayScore = useRef(0)

  useEffect(() => {
    const controls = animate(motionScore, score, {
      duration: 1.4,
      ease: [0.34, 1.56, 0.64, 1],
      onUpdate: v => { displayScore.current = Math.round(v) },
    })
    return controls.stop
  }, [score, motionScore])

  const dashOffset = useTransform(motionScore, v => {
    const pct = v / 100
    return CIRCUMFERENCE * (1 - pct)
  })

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            className="score-ring-track"
            strokeDasharray={CIRCUMFERENCE}
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            className="score-ring-fill"
            stroke={tier.color}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-bold"
            style={{ color: tier.color }}
          >
            <AnimatedNumber value={score} />
          </motion.span>
          <span className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-wider">Weekly Score</span>
        </div>
      </div>
      <div
        className="mt-3 px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5"
        style={{ background: `${tier.color}20`, color: tier.color }}
      >
        {tier.emoji} {tier.label}
      </div>
    </div>
  )
}

function AnimatedNumber({ value }) {
  const motionVal = useMotionValue(0)
  const display = useTransform(motionVal, v => Math.round(v).toString())

  useEffect(() => {
    const c = animate(motionVal, value, { duration: 1.4, ease: [0.34, 1.56, 0.64, 1] })
    return c.stop
  }, [value, motionVal])

  return <motion.span>{display}</motion.span>
}
