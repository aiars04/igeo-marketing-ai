'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'

// Pseudo-random determinista (basado en i + position) — evita Math.random()
// que rompe la regla purity de React 19 y produce SSR mismatch.
function pseudoRandom(i: number, position: number): number {
  const x = Math.sin(i * 12.9898 + position * 78.233) * 43758.5453
  return x - Math.floor(x) // [0, 1)
}

function FloatingPaths({ position }: { position: number }) {
  const paths = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
        width: 0.6 + i * 0.04,
        duration: 25 + pseudoRandom(i, position) * 15,
      })),
    [position]
  )

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
            stroke="#f97316"
            strokeWidth={path.width}
            strokeOpacity={0.10 + path.id * 0.020}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.45, 0.80, 0.45],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: path.duration,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </svg>
    </div>
  )
}

export function BackgroundPaths() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </div>
  )
}
