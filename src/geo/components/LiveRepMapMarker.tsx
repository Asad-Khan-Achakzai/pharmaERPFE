'use client'

import type { LiveAttendanceStatus } from '@/types/liveTracking'

export function liveRepMarkerColor(
  attendanceStatus: LiveAttendanceStatus | undefined,
  ageSeconds: number | null | undefined,
  confidence?: number | null
): string {
  if (attendanceStatus !== 'CHECKED_IN') return '#9e9e9e'
  if ((confidence ?? 100) < 20) return '#757575'
  return (ageSeconds ?? 0) >= 600 ? '#ed6c02' : '#2e7d32'
}

function PersonGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' aria-hidden>
      <circle cx='12' cy='8' r='3.5' fill='currentColor' />
      <path
        d='M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        fill='none'
      />
    </svg>
  )
}

type Props = {
  name: string
  color: string
  selected?: boolean
}

/** Person-on-map marker (Snapchat / inDrive style) — circle avatar + pointer, not a generic pin. */
export function LiveRepMapMarker({ name, color, selected = false }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const scale = selected ? 1.12 : 1

  return (
    <div
      title={name}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        transform: `scale(${scale})`,
        transformOrigin: 'center bottom',
        transition: 'transform 0.15s ease'
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: color,
          border: '3px solid #fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          color: '#fff',
          fontWeight: 700,
          fontSize: 16,
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1
        }}
      >
        <span style={{ position: 'relative', zIndex: 1 }}>{initial}</span>
        <span
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            opacity: 0.95,
            display: 'flex',
            background: 'rgba(255,255,255,0.22)',
            borderRadius: '50%',
            padding: 1
          }}
        >
          <PersonGlyph size={14} />
        </span>
      </div>
      <div
        style={{
          width: 0,
          height: 0,
          marginTop: -2,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: `9px solid ${color}`,
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))'
        }}
      />
    </div>
  )
}
