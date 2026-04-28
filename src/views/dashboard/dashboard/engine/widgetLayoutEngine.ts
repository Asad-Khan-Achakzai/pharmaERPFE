import type { DashboardMode } from '../core/dashboardTypes'
import type {
  DashboardEngineFeatureFlags,
  LayoutBand,
  LayoutBandId,
  WidgetInstance,
  WidgetLayoutRoot
} from './widgetTypes'

const BAND_SEQUENCE: LayoutBandId[] = [
  'HERO_SPLIT',
  'EXECUTION_FULL',
  'QUICK',
  'PROFIT',
  'INVENTORY',
  'ATTENDANCE',
  'SUPPLIERS'
]

function sortByOrder(a: WidgetInstance, b: WidgetInstance) {
  return a.layout.order - b.layout.order
}

/**
 * Produces an ordered set of layout bands (rows) from a resolved widget list. No React — pure data.
 */
export function buildWidgetLayout(
  instances: WidgetInstance[],
  mode: DashboardMode,
  featureFlags: DashboardEngineFeatureFlags
): WidgetLayoutRoot {
  const bands: LayoutBand[] = []

  for (const bandId of BAND_SEQUENCE) {
    const inBand = instances.filter(i => i.layout.band === bandId)
    if (inBand.length === 0) continue
    if (bandId === 'HERO_SPLIT') {
      const sidebar = inBand.filter(i => i.layout.zone === 'sidebar').sort(sortByOrder)
      const main = inBand.filter(i => i.layout.zone === 'main').sort(sortByOrder)
      if (sidebar.length === 0 && main.length === 0) continue
      bands.push({ band: bandId, variant: 'split', sidebar, main, full: [] })
    } else {
      const full = inBand.filter(i => i.layout.zone === 'full').sort(sortByOrder)
      if (full.length === 0) continue
      bands.push({ band: bandId, variant: 'full', sidebar: [], main: [], full })
    }
  }

  let ordered = bands
  if (featureFlags.mobileActionsFirst) {
    const q = ordered.find(b => b.band === 'QUICK')
    if (q) {
      ordered = [q, ...ordered.filter(b => b.band !== 'QUICK')]
    }
  }

  return { mode, featureFlags, bands: ordered }
}

/** xs flex order for band row (aligns with legacy mobile quick-actions-first). */
export function getBandRowOrder(
  band: LayoutBandId,
  featureFlags: DashboardEngineFeatureFlags
): { xs: number; md: number } {
  if (!featureFlags.mobileActionsFirst) {
    return { xs: 0, md: 0 }
  }
  const m: Partial<Record<LayoutBandId, number>> = {
    QUICK: 1,
    HERO_SPLIT: 2,
    EXECUTION_FULL: 3,
    PROFIT: 4,
    INVENTORY: 5,
    ATTENDANCE: 6,
    SUPPLIERS: 7
  }
  const o = m[band] ?? 0
  return { xs: o, md: 0 }
}
