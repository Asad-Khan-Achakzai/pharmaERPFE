'use client'

import type { MarkerVisualState } from '@/geo/marker/MarkerStateResolver'
import { MAP_MARKER_EFFECTS, MAP_MARKER_SIZES } from '@/geo/marker/mapDesignTokens'

function StethoscopeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' aria-hidden>
      <path
        d='M6 8a3 3 0 1 1 6 0v3a3 3 0 0 1-6 0V8Z'
        stroke='currentColor'
        strokeWidth='1.8'
      />
      <path d='M9 11v2.5c0 2.5 2 4.5 4.5 4.5' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      <path d='M15 18h3.5a2.5 2.5 0 0 0 0-5H15' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      <circle cx='18.5' cy='13' r='1.2' fill='currentColor' />
    </svg>
  )
}

function PharmacyCrossIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' aria-hidden>
      <path d='M12 5v14M5 12h14' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' />
    </svg>
  )
}

function TargetIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' aria-hidden>
      <circle cx='12' cy='12' r='7' stroke='currentColor' strokeWidth='1.8' />
      <circle cx='12' cy='12' r='2.5' fill='currentColor' />
    </svg>
  )
}

function EntityIcon({ entity, size }: { entity: MarkerVisualState['entity']; size: number }) {
  if (entity === 'doctor' || entity === 'clusterDoctor') return <StethoscopeIcon size={size} />
  if (entity === 'pharmacy' || entity === 'clusterPharmacy') return <PharmacyCrossIcon size={size} />
  if (entity === 'callPoint' || entity === 'clusterCallPoint') return <TargetIcon size={size} />
  return null
}

export type MapMarkerProps = {
  visual: MarkerVisualState
  title?: string
  initials?: string
  avatarUrl?: string | null
  className?: string
}

export function MapMarker({ visual, title, initials, avatarUrl, className }: MapMarkerProps) {
  const isRep = visual.entity === 'rep' || visual.entity === 'clusterRep'
  const isCluster = visual.entity.startsWith('cluster')
  const size = isRep ? MAP_MARKER_SIZES.repAvatar : MAP_MARKER_SIZES.entity
  const initial = (initials || title || '?').trim().charAt(0).toUpperCase() || '?'

  const boxShadow = visual.glow
    ? visual.active
      ? MAP_MARKER_EFFECTS.activeGlow(visual.color)
      : MAP_MARKER_EFFECTS.glow(visual.color)
    : visual.selected
      ? MAP_MARKER_EFFECTS.selectedShadow
      : MAP_MARKER_EFFECTS.shadow

  if (isCluster) {
    return (
      <div
        title={title}
        className={className}
        style={{
          minWidth: MAP_MARKER_SIZES.cluster,
          height: MAP_MARKER_SIZES.cluster,
          borderRadius: MAP_MARKER_SIZES.cluster / 2,
          background: visual.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 13,
          border: `${MAP_MARKER_SIZES.border}px solid #fff`,
          boxShadow: MAP_MARKER_EFFECTS.shadow,
          opacity: visual.opacity,
          cursor: 'pointer'
        }}
      >
        {initials}
      </div>
    )
  }

  if (isRep) {
    return (
      <div
        title={title}
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `scale(${visual.scale})`,
          transformOrigin: 'center bottom',
          transition: 'transform 0.15s ease',
          opacity: visual.opacity,
          cursor: 'pointer'
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: visual.color,
            border: `${MAP_MARKER_SIZES.border}px solid #fff`,
            boxShadow,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            fontFamily: 'system-ui, sans-serif',
            position: 'relative',
            ...(visual.pulse
              ? { animation: 'mapRepPulse 2s ease-in-out infinite' as const }
              : {})
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initial
          )}
        </div>
        <div
          style={{
            width: 0,
            height: 0,
            marginTop: -2,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: `9px solid ${visual.color}`,
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))'
          }}
        />
      </div>
    )
  }

  return (
    <div
      title={title}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `scale(${visual.scale})`,
        transformOrigin: 'center bottom',
        transition: 'transform 0.15s ease',
        opacity: visual.opacity,
        cursor: 'pointer'
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: visual.color,
          border: `${MAP_MARKER_SIZES.border}px solid #fff`,
          boxShadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff'
        }}
      >
        <EntityIcon entity={visual.entity} size={MAP_MARKER_SIZES.icon} />
      </div>
      <div
        style={{
          width: 0,
          height: 0,
          marginTop: -2,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: `8px solid ${visual.color}`,
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))'
        }}
      />
    </div>
  )
}

export type MapClusterMarkerProps = {
  visual: MarkerVisualState
  count: number
}

export function MapClusterMarker({ visual, count }: MapClusterMarkerProps) {
  return <MapMarker visual={visual} title={`${count} locations`} initials={String(count)} />
}
