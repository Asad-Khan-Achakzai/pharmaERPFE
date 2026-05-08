'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import CircularProgress from '@mui/material/CircularProgress'
import { territoriesService, type TerritoryNode, type Territory } from '@/services/territories.service'
import { showApiError } from '@/utils/apiErrors'

export function countBricksInSubtree(node: TerritoryNode): number {
  if (node.kind === 'BRICK') return 1
  if (!node.children?.length) return 0
  return node.children.reduce((sum, ch) => sum + countBricksInSubtree(ch), 0)
}

/** First brick names under `node`, depth-first (for confirmation copy). */
export function collectBrickNameSamples(node: TerritoryNode, limit: number): string[] {
  const acc: string[] = []
  const walk = (n: TerritoryNode) => {
    if (acc.length >= limit) return
    if (n.kind === 'BRICK') {
      acc.push(n.name)
      return
    }
    for (const ch of n.children || []) {
      walk(ch)
      if (acc.length >= limit) return
    }
  }
  walk(node)
  return acc
}

export type TerritoryCoveragePreview = {
  brickCount: number
  sampleBrickNames: string[]
}

type Props = {
  value: Territory | null
  onChange: (v: Territory | null) => void
  /** If set, only these kinds can be selected as the anchor (e.g. MR → BRICK+AREA as two modes). */
  allowedKinds?: Territory['kind'][]
  /**
   * @deprecated use `allowedKinds` with a single entry instead
   */
  expectedKind?: Territory['kind']
  disabled?: boolean
  /** Fired when selection or tree data changes; useful for AREA/ZONE save confirmation. */
  onCoveragePreviewChange?: (preview: TerritoryCoveragePreview | null) => void
}

export function TerritoryTreePicker({
  value,
  onChange,
  allowedKinds: allowedKindsProp,
  expectedKind,
  disabled,
  onCoveragePreviewChange
}: Props) {
  const allowedKinds = useMemo(() => {
    if (allowedKindsProp?.length) return allowedKindsProp
    if (expectedKind) return [expectedKind]
    return null
  }, [allowedKindsProp, expectedKind])

  const [roots, setRoots] = useState<TerritoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await territoriesService.tree()
        const body = res.data?.data ?? res.data
        const r = (body as { roots?: TerritoryNode[] })?.roots ?? []
        if (!cancel) {
          setRoots(Array.isArray(r) ? r : [])
          const initial = new Set<string>()
          for (const z of Array.isArray(r) ? r : []) {
            if (z._id) initial.add(String(z._id))
          }
          setExpanded(initial)
        }
      } catch (e) {
        if (!cancel) {
          showApiError(e, 'Failed to load territory tree')
          setRoots([])
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const selectedId = value?._id ? String(value._id) : null

  const findNode = useCallback((nodes: TerritoryNode[], id: string): TerritoryNode | null => {
    for (const n of nodes) {
      if (String(n._id) === id) return n
      const inCh = n.children?.length ? findNode(n.children, id) : null
      if (inCh) return inCh
    }
    return null
  }, [])

  const subtreeMeta = useMemo(() => {
    if (!value?._id || !roots.length) return null
    const node = findNode(roots, String(value._id))
    if (!node) return null
    const brickCount = countBricksInSubtree(node)
    const sampleBrickNames = collectBrickNameSamples(node, 5)
    return { brickCount, sampleBrickNames }
  }, [value, roots, findNode])

  useEffect(() => {
    if (!onCoveragePreviewChange) return
    if (!value || !subtreeMeta) {
      onCoveragePreviewChange(null)
      return
    }
    onCoveragePreviewChange({
      brickCount: subtreeMeta.brickCount,
      sampleBrickNames: subtreeMeta.sampleBrickNames
    })
  }, [value, subtreeMeta, onCoveragePreviewChange])

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const canSelect = (node: TerritoryNode) => {
    if (!allowedKinds?.length) return true
    return allowedKinds.includes(node.kind)
  }

  const hintText = useMemo(() => {
    if (!allowedKinds?.length) {
      return 'Optional. Expand the tree and pick any active territory node, or leave cleared.'
    }
    if (allowedKinds.length === 1) {
      const k = allowedKinds[0]
      if (k === 'BRICK') {
        return 'Select a single brick node. Coverage uses this brick as the anchor.'
      }
      if (k === 'AREA') {
        return 'Select an area node. All descendant bricks under this area will be included automatically (only this node ID is stored; the backend expands coverage).'
      }
      if (k === 'ZONE') {
        return 'Select a zone node. All bricks under this zone are included via territory path expansion.'
      }
    }
    return `Select one of: ${allowedKinds.join(', ')}.`
  }, [allowedKinds])

  const renderNode = (node: TerritoryNode, depth: number) => {
    const id = String(node._id)
    const hasChildren = Boolean(node.children?.length)
    const isOpen = expanded.has(id)
    const selectable = canSelect(node)
    const isSelected = selectedId === id

    return (
      <Box key={id} sx={{ pl: depth * 1.5 }}>
        <Stack direction='row' spacing={0.5} alignItems='center' sx={{ py: 0.25 }}>
          {hasChildren ? (
            <Button
              size='small'
              variant='text'
              onClick={() => toggle(id)}
              sx={{ minWidth: 32, p: 0, fontSize: '0.75rem' }}
              aria-expanded={isOpen}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
            >
              {isOpen ? '▼' : '▶'}
            </Button>
          ) : (
            <Box sx={{ width: 32 }} />
          )}
          <Button
            size='small'
            variant={isSelected ? 'contained' : 'text'}
            color={isSelected ? 'primary' : 'inherit'}
            disabled={disabled || !selectable}
            onClick={() => {
              if (!selectable) return
              onChange({
                _id: node._id,
                name: node.name,
                code: node.code ?? undefined,
                kind: node.kind,
                isActive: node.isActive !== false
              })
            }}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: isSelected ? 600 : 400 }}
          >
            {node.name}
            {node.code ? ` (${node.code})` : ''}
            <Typography component='span' variant='caption' color='text.secondary' sx={{ ml: 1 }}>
              {node.kind}
            </Typography>
          </Button>
        </Stack>
        {hasChildren ? (
          <Collapse in={isOpen} timeout='auto' unmountOnExit>
            <Box>{node.children!.map(ch => renderNode(ch, depth + 1))}</Box>
          </Collapse>
        ) : null}
      </Box>
    )
  }

  if (loading) {
    return (
      <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  const brickCountPreview = subtreeMeta?.brickCount ?? 0

  return (
    <Box>
      <Stack spacing={1}>
        <Typography variant='body2' color='text.secondary'>
          {hintText}
        </Typography>
        {roots.length === 0 ? (
          <Typography variant='body2' color='text.secondary'>
            No territories defined. Add zones and areas under Territories first.
          </Typography>
        ) : (
          roots.map(r => renderNode(r, 0))
        )}
        {value ? (
          <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant='subtitle2' gutterBottom>
              Selection preview
            </Typography>
            <Typography variant='body2'>
              <strong>{value.name}</strong>
              {value.code ? ` (${value.code})` : ''} · {value.kind}
            </Typography>
            {value.kind !== 'BRICK' ? (
              <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                This will assign <strong>all</strong> descendant bricks under this node (
                <strong>{brickCountPreview}</strong> brick{brickCountPreview === 1 ? '' : 's'}). Coverage is expanded
                on the server from this territory anchor.
              </Typography>
            ) : (
              <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                Single brick — stored as primary territory; subtree expansion uses this node’s path.
              </Typography>
            )}
            <Button size='small' onClick={() => onChange(null)} disabled={disabled} sx={{ mt: 1 }}>
              Clear territory
            </Button>
          </Box>
        ) : null}
      </Stack>
    </Box>
  )
}
