'use client'

import { motion } from 'framer-motion'

function PathLayer({
  position,
  color,
  opacityBase = 0.02,
  opacityStep = 0.016,
  durationBase = 22,
}: {
  position: number
  color: string
  opacityBase?: number
  opacityStep?: number
  durationBase?: number
}) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width:   0.5 + i * 0.03,
    opacity: opacityBase + i * opacityStep,
    duration: durationBase + (i % 7) * 3,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="w-full h-full"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {paths.map(path => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke={color}
            strokeWidth={path.width}
            strokeOpacity={path.opacity}
            initial={{ pathLength: 0.2, opacity: 0 }}
            animate={{
              pathLength: 1,
              opacity: [0.4, 0.75, 0.4],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: path.duration,
              repeat: Infinity,
              ease: 'linear',
              delay: (path.id % 8) * 1.2,
            }}
          />
        ))}
      </svg>
    </div>
  )
}

export function FloatingPaths() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Orange — lower left, brand primary */}
      <PathLayer
        position={1.2}
        color="rgba(234,88,12,1)"
        opacityBase={0.018}
        opacityStep={0.014}
        durationBase={24}
      />
      {/* Blue — upper right, secondary */}
      <PathLayer
        position={-0.9}
        color="rgba(37,99,235,1)"
        opacityBase={0.015}
        opacityStep={0.013}
        durationBase={28}
      />
    </div>
  )
}
