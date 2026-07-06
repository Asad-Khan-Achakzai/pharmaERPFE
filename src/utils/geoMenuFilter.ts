'use client'

import { filterMenuByPermission } from '@/utils/menuFilter'
import type { MenuItemWithPermission } from '@/data/navigation/verticalMenuData'
import type { GeoFeatureKey } from '@/geo/types'

const GEO_MENU_MAP: Record<string, GeoFeatureKey> = {
  '/team/live': 'managerLiveMap',
  '/visits/today': 'dailyPlanMaps',
  '/call-points': 'callPointMaps',
  '/doctors/location-review': 'doctorLocationReviewMaps'
}

export function filterMenuByGeoFeatures<T extends MenuItemWithPermission>(
  items: T[],
  isGeoEnabled: (feature: GeoFeatureKey) => boolean
): T[] {
  return items.reduce<T[]>((acc, item) => {
    const href = (item as { href?: string }).href
    if (href && GEO_MENU_MAP[href] && !isGeoEnabled(GEO_MENU_MAP[href])) {
      return acc
    }

    const withChildren = item as T & { children?: T[] }
    if (withChildren.children) {
      const children = filterMenuByGeoFeatures(withChildren.children, isGeoEnabled)
      if (!children.length && !(href && !GEO_MENU_MAP[href])) return acc
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
  isGeoEnabled: (feature: GeoFeatureKey) => boolean,
  userRole?: string | null,
  userPermissionKeys?: string[] | null,
  userType?: string | null
): T[] {
  const byPerm = filterMenuByPermission(items, hasPermission, userRole, userPermissionKeys, userType)
  return filterMenuByGeoFeatures(byPerm, isGeoEnabled)
}
