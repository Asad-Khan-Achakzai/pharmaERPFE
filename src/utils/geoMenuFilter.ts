'use client'

import { filterMenuByPermission } from '@/utils/menuFilter'
import type { MenuItemWithPermission } from '@/data/navigation/verticalMenuData'
import type { GeoFeatureKey, GeoPlatformConfig } from '@/geo/types'

const GEO_MENU_MAP: Record<string, GeoFeatureKey> = {
  '/team/live': 'managerLiveMap',
  '/team/route-history': 'routeReplay',
  '/visits/today': 'dailyPlanMaps',
  '/call-points': 'callPointMaps',
  '/doctors/location-review': 'doctorLocationReviewMaps'
}

/** Manager live map menu is shown when either live map or rep GPS sharing is enabled. */
function isGeoMenuFeatureEnabled(
  feature: GeoFeatureKey,
  geoPlatform: GeoPlatformConfig
): boolean {
  if (geoPlatform.enabled !== true) return false
  if (feature === 'managerLiveMap') {
    return (
      geoPlatform.features.managerLiveMap === true ||
      geoPlatform.features.liveTracking === true
    )
  }
  return geoPlatform.features[feature] === true
}

export function filterMenuByGeoFeatures<T extends MenuItemWithPermission>(
  items: T[],
  geoPlatform: GeoPlatformConfig,
  options?: { loading?: boolean; configReady?: boolean }
): T[] {
  // Show geo-gated nav items until config is loaded, or if fetch failed (page gate still applies).
  if (options?.loading || options?.configReady === false) return items

  return items.reduce<T[]>((acc, item) => {
    const href = (item as { href?: string }).href
    const mappedFeature = href ? GEO_MENU_MAP[href] : undefined
    if (mappedFeature && !isGeoMenuFeatureEnabled(mappedFeature, geoPlatform)) {
      return acc
    }

    const withChildren = item as T & { children?: T[] }
    if (withChildren.children) {
      const children = filterMenuByGeoFeatures(withChildren.children, geoPlatform, options)
      if (!children.length) return acc
      acc.push({ ...item, children } as T)
      return acc
    }

    acc.push(item)
    return acc
  }, [])
}

export function filterMenuByPermissionAndGeo<T extends MenuItemWithPermission>(
  items: T[],
  hasPermission: (perm: string) => boolean,
  geoPlatform: GeoPlatformConfig,
  userRole?: string | null,
  userPermissionKeys?: string[] | null,
  userType?: string | null,
  options?: { loading?: boolean; configReady?: boolean }
): T[] {
  const byPerm = filterMenuByPermission(items, hasPermission, userRole, userPermissionKeys, userType)
  return filterMenuByGeoFeatures(byPerm, geoPlatform, options)
}
