/** Shared Map Design System tokens — keep web/mobile in sync. */
export const MAP_ENTITY_COLORS = {
  rep: {
    primary: '#1976D2',
    offline: '#9E9E9E',
    live: '#1976D2',
    lowConfidence: '#78909C'
  },
  doctor: {
    primary: '#2E7D32',
    active: '#2E7D32',
    missed: '#D32F2F',
    completed: '#1B5E20',
    suggested: '#F57C00'
  },
  pharmacy: {
    primary: '#D32F2F'
  },
  callPoint: {
    primary: '#F57C00'
  },
  territory: {
    stroke: '#7B1FA2',
    fill: '#7B1FA2'
  },
  geofence: {
    inside: '#2E7D32',
    outside: '#D32F2F'
  },
  cluster: {
    rep: '#1976D2',
    doctor: '#2E7D32',
    pharmacy: '#D32F2F',
    callPoint: '#F57C00'
  },
  route: {
    checkIn: '#6A1B9A',
    polyline: '#1565C0'
  }
} as const

export const MAP_MARKER_SIZES = {
  repAvatar: 44,
  entity: 36,
  cluster: 36,
  border: 3,
  icon: 18
} as const

export const MAP_MARKER_EFFECTS = {
  selectedScale: 1.12,
  hoverScale: 1.06,
  shadow: '0 2px 8px rgba(0,0,0,0.28)',
  selectedShadow: '0 4px 14px rgba(0,0,0,0.35)',
  glow: (color: string) => `0 0 0 4px ${color}44, 0 0 12px ${color}66`,
  activeGlow: (color: string) => `0 0 0 4px ${color}55, 0 0 16px ${color}88`
} as const

export type MapEntityType =
  | 'rep'
  | 'doctor'
  | 'pharmacy'
  | 'callPoint'
  | 'clusterRep'
  | 'clusterDoctor'
  | 'clusterPharmacy'
  | 'clusterCallPoint'

export type MapMarkerState = 'default' | 'selected' | 'active' | 'live' | 'offline' | 'disabled' | 'hovered'
