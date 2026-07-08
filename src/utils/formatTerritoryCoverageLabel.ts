type TerritoryRef = {
  _id?: string
  name: string
  code?: string | null
  kind: string
}

function labelOne(t: TerritoryRef): string {
  return `${t.name}${t.code ? ` (${t.code})` : ''}`
}

function asTerritoryRef(
  v: TerritoryRef | string | null | undefined
): TerritoryRef | null {
  if (!v || typeof v !== 'object' || !('name' in v)) return null
  return v as TerritoryRef
}

/**
 * Compact label for roster / org chart: primary + extra area/zone nodes of the same kind.
 */
export function formatTerritoryCoverageLabel(
  territoryId: TerritoryRef | string | null | undefined,
  coverageTerritoryIds?: Array<TerritoryRef | string> | null,
  opts?: { kind?: 'AREA' | 'ZONE' }
): string {
  const primary = asTerritoryRef(territoryId)
  const cov = (coverageTerritoryIds || [])
    .map(asTerritoryRef)
    .filter((x): x is TerritoryRef => x != null)

  const targetKind = opts?.kind ?? primary?.kind
  if (!targetKind || (targetKind !== 'AREA' && targetKind !== 'ZONE')) {
    return primary ? labelOne(primary) : '—'
  }

  const nodes: TerritoryRef[] = []
  const seen = new Set<string>()
  const add = (t: TerritoryRef | null) => {
    if (!t || t.kind !== targetKind) return
    const id = t._id ? String(t._id) : t.name
    if (seen.has(id)) return
    seen.add(id)
    nodes.push(t)
  }
  add(primary)
  for (const c of cov) add(c)

  if (!nodes.length) return '—'
  if (nodes.length === 1) return labelOne(nodes[0])
  const noun = targetKind === 'AREA' ? 'area' : 'zone'
  return `${labelOne(nodes[0])} +${nodes.length - 1} ${noun}${nodes.length - 1 === 1 ? '' : 's'}`
}

/** All area/zone nodes assigned to a user (primary + coverage of matching kind). */
export function collectAssignedHierarchyNodes(
  territoryId: TerritoryRef | string | null | undefined,
  coverageTerritoryIds: Array<TerritoryRef | string> | null | undefined,
  kind: 'AREA' | 'ZONE'
): TerritoryRef[] {
  const primary = asTerritoryRef(territoryId)
  const cov = (coverageTerritoryIds || [])
    .map(asTerritoryRef)
    .filter((x): x is TerritoryRef => x != null)
  const nodes: TerritoryRef[] = []
  const seen = new Set<string>()
  const add = (t: TerritoryRef | null) => {
    if (!t || t.kind !== kind) return
    const id = t._id ? String(t._id) : t.name
    if (seen.has(id)) return
    seen.add(id)
    nodes.push(t)
  }
  add(primary)
  for (const c of cov) add(c)
  return nodes
}
