import { cn } from '@/lib/utils'

/* ─── SVG spiral mark — basado en el logotipo iGEO ERP ─── */
function IgeoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Arc exterior */}
      <path
        d="M28 16C28 22.63 22.63 28 16 28C9.37 28 4 22.63 4 16C4 9.37 9.37 4 16 4C19.65 4 22.94 5.61 25.23 8.18"
        stroke="#1E6BC4" strokeWidth="2.6" strokeLinecap="round" fill="none"
      />
      {/* Arc interior */}
      <path
        d="M22.5 16C22.5 19.59 19.59 22.5 16 22.5C12.41 22.5 9.5 19.59 9.5 16C9.5 12.41 12.41 9.5 16 9.5C17.9 9.5 19.6 10.3 20.82 11.6"
        stroke="#1E6BC4" strokeWidth="2.1" strokeLinecap="round" fill="none"
      />
      {/* Punto central */}
      <circle cx="16" cy="16" r="3.4" fill="#1E6BC4" />
      {/* Punto naranja — la "i" de iGEO */}
      <circle cx="25.8" cy="7.2" r="2.4" fill="#EA580C" />
    </svg>
  )
}

interface LogoProps {
  variant?: 'mark' | 'sidebar' | 'login'
  className?: string
}

export function Logo({ variant = 'sidebar', className }: LogoProps) {
  if (variant === 'mark') {
    return <IgeoMark size={32} />
  }

  if (variant === 'sidebar') {
    return (
      <div className={cn('flex items-center gap-2.5', className)}>
        <IgeoMark size={28} />
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline gap-px">
            <span className="font-bold text-[13.5px] tracking-tight" style={{ color: '#EA580C' }}>i</span>
            <span className="font-bold text-[13.5px] tracking-tight text-white">GEO</span>
            <span className="font-semibold text-[11px] text-[var(--muted)] ml-1">ERP</span>
          </div>
          <span className="text-[9.5px] font-semibold tracking-[0.1em] uppercase mt-0.5" style={{ color: 'var(--accent2)' }}>
            Marketing AI
          </span>
        </div>
      </div>
    )
  }

  /* login variant — grande, centrado */
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative">
        <div className="absolute inset-0 rounded-full blur-2xl opacity-30" style={{ background: 'var(--glow-blue)', transform: 'scale(1.5)' }} />
        <IgeoMark size={52} />
      </div>
      <div className="text-center">
        <div className="flex items-baseline justify-center gap-0.5">
          <span className="font-extrabold text-[28px] tracking-tight" style={{ color: '#EA580C' }}>i</span>
          <span className="font-extrabold text-[28px] tracking-tight text-white">GEO</span>
          <span className="font-bold text-[19px] text-[var(--muted)] ml-1.5">ERP</span>
        </div>
        <div
          className="text-[11.5px] font-semibold tracking-[0.14em] uppercase mt-0.5"
          style={{ color: 'var(--accent2)' }}
        >
          Marketing AI
        </div>
      </div>
    </div>
  )
}
