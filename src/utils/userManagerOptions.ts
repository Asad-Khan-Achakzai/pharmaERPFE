/** Which manager role codes may report to a user with the given system role `code`. */
const LADDER = ['DEFAULT_MEDICAL_REP', 'DEFAULT_ASM', 'DEFAULT_RM', 'DEFAULT_ADMIN'] as const

export type MrepLadderRoleCode = (typeof LADDER)[number]

export function isMrepLadderRoleCode(code: string | null | undefined): code is MrepLadderRoleCode {
  return code != null && (LADDER as readonly string[]).includes(code)
}

/**
 * @returns `null` = no restriction (show all assignable users). `[]` = no valid managers (e.g. company admin). Otherwise list of allowed `roleCode` values on candidates.
 */
export function allowedManagerRoleCodesForSubordinate(subordinateRoleCode: string): string[] | null {
  if (!isMrepLadderRoleCode(subordinateRoleCode)) return null
  if (subordinateRoleCode === 'DEFAULT_MEDICAL_REP') return ['DEFAULT_ASM']
  if (subordinateRoleCode === 'DEFAULT_ASM') return ['DEFAULT_RM']
  if (subordinateRoleCode === 'DEFAULT_RM') return ['DEFAULT_ADMIN']
  return []
}

/** RM / custom admin parent: backend also accepts any role with `admin.access`. */
export function managerMatchesRmParent(
  u: { roleCode?: string | null; isAdminCapable?: boolean },
  allowedRoleCodes: string[]
): boolean {
  if (u.isAdminCapable) return true
  return Boolean(u.roleCode && allowedRoleCodes.includes(u.roleCode))
}
