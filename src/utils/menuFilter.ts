import type { MenuItemWithPermission } from '@/data/navigation/verticalMenuData'
import type { HorizontalMenuItemWithPermission } from '@/data/navigation/horizontalMenuData'

type AnyMenuItem = MenuItemWithPermission | HorizontalMenuItemWithPermission

export function filterMenuByPermission<T extends AnyMenuItem>(
  items: T[],
  hasPermission: (perm: string) => boolean,
  userRole?: string | null,
  /** For items with explicitPermission, only this list is checked (not admin.access bypass). */
  userPermissionKeys?: string[] | null
): T[] {
  return items.reduce<T[]>((acc, item) => {
    const roles = (item as { roles?: string[] }).roles
    const explicit = (item as { explicitPermission?: boolean }).explicitPermission
    if (roles?.length) {
      if (!userRole || !roles.includes(userRole)) {
        return acc
      }
    } else if (item.permission) {
      if (explicit) {
        if (!userPermissionKeys?.includes(item.permission)) {
          return acc
        }
      } else if (!hasPermission(item.permission)) {
        return acc
      }
    }

    const withChildren = item as T & { children?: T[] }

    if (withChildren.children) {
      const filteredChildren = filterMenuByPermission(
        withChildren.children,
        hasPermission,
        userRole,
        userPermissionKeys
      )

      if (filteredChildren.length === 0) return acc

      acc.push({ ...item, children: filteredChildren } as T)
    } else {
      acc.push(item)
    }

    return acc
  }, [])
}
