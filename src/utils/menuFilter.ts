import type { MenuItemWithPermission } from '@/data/navigation/verticalMenuData'
import type { HorizontalMenuItemWithPermission } from '@/data/navigation/horizontalMenuData'

type AnyMenuItem = MenuItemWithPermission | HorizontalMenuItemWithPermission

export function filterMenuByPermission<T extends AnyMenuItem>(
  items: T[],
  hasPermission: (perm: string) => boolean,
  userRole?: string | null,
  /** For items with explicitPermission, only this list is checked (not admin.access bypass). */
  userPermissionKeys?: string[] | null,
  /** Platform-scoped accounts (not company-tenant users). */
  userType?: string | null
): T[] {
  return items.reduce<T[]>((acc, item) => {
    const roles = (item as { roles?: string[] }).roles
    const explicit = (item as { explicitPermission?: boolean }).explicitPermission
    if (roles?.length) {
      if (!userRole || !roles.includes(userRole)) {
        return acc
      }
    } else if (item.permission || (item as { permissionAny?: string[] }).permissionAny?.length) {
      const permissionAny = (item as { permissionAny?: string[] }).permissionAny
      if (explicit) {
        const keys = userPermissionKeys || []
        const required = permissionAny?.length ? permissionAny : item.permission ? [item.permission] : []
        const hasLiteral = required.some(p => keys.includes(p))
        /** SUPER_ADMIN may not have every key listed on the JWT; still show platform / explicit items. */
        const superSeesExplicit = userRole === 'SUPER_ADMIN'
        /** `platform.dashboard.view` is shown to platform user accounts (userType === 'PLATFORM'), not company admins. */
        const platformUserSeesDashboard =
          userType === 'PLATFORM' && required.includes('platform.dashboard.view')
        if (!hasLiteral && !superSeesExplicit && !platformUserSeesDashboard) {
          return acc
        }
      } else if (permissionAny?.length) {
        if (!permissionAny.some(p => hasPermission(p))) return acc
      } else if (item.permission && !hasPermission(item.permission)) {
        return acc
      }
    }

    const withChildren = item as T & { children?: T[] }

    if (withChildren.children) {
      const filteredChildren = filterMenuByPermission(
        withChildren.children,
        hasPermission,
        userRole,
        userPermissionKeys,
        userType
      )

      if (filteredChildren.length === 0) return acc

      acc.push({ ...item, children: filteredChildren } as T)
    } else {
      acc.push(item)
    }

    return acc
  }, [])
}
