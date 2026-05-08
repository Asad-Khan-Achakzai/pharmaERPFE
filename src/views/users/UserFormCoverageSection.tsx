'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Divider from '@mui/material/Divider'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Autocomplete from '@mui/material/Autocomplete'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha, useTheme } from '@mui/material/styles'
import CustomTextField from '@core/components/mui/TextField'
import { territoriesService, type Territory, type TerritoryNode } from '@/services/territories.service'
import type { TerritoryCoveragePreview } from '@/components/territories/TerritoryTreePicker'
import { BrickMultiPicker } from '@/components/territories/BrickMultiPicker'
import { useTerritoryTreeIndex } from '@/hooks/useTerritoryTreeIndex'
import { showApiError } from '@/utils/apiErrors'

export type TerritoryAssignmentStrategy = 'single_brick' | 'multi_brick' | 'entire_area' | 'entire_zone'

const STRATEGY_COPY: Record<
  TerritoryAssignmentStrategy,
  { label: string; description: string; icon: string }
> = {
  single_brick: {
    label: 'Single Brick',
    description: 'Assign one primary brick for a focused route.',
    icon: 'tabler-map-pin'
  },
  multi_brick: {
    label: 'Multiple Bricks',
    description: 'Choose specific bricks and set the reporting anchor.',
    icon: 'tabler-layout-grid'
  },
  entire_area: {
    label: 'Entire Area',
    description: 'Cover every brick under one area automatically.',
    icon: 'tabler-map'
  },
  entire_zone: {
    label: 'Entire Zone',
    description: 'Cover all areas and bricks under one zone.',
    icon: 'tabler-world'
  }
}

function nodeToTerritory(n: TerritoryNode): Territory {
  return {
    _id: String(n._id),
    name: n.name,
    code: n.code ?? undefined,
    kind: n.kind,
    isActive: n.isActive !== false
  }
}

type SummaryProps = {
  strategy: TerritoryAssignmentStrategy
  formTerritory: Territory | null
  multiBricks: Territory[]
  primaryBrickId: string | null
  hierarchyPreview: TerritoryCoveragePreview | null
  breadcrumbText: string | null
  zoneAreaCount: number | null
}

function CoverageSummaryInner({
  strategy,
  formTerritory,
  multiBricks,
  primaryBrickId,
  hierarchyPreview,
  breadcrumbText,
  zoneAreaCount
}: SummaryProps) {
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down('md'))
  const title = STRATEGY_COPY[strategy].label

  let primaryLine = '—'
  let countHint = '—'
  const sampleNames: string[] = []

  if (strategy === 'single_brick') {
    primaryLine = formTerritory?.name ?? '—'
    countHint = formTerritory ? '1 brick (primary)' : 'Select a brick'
    if (formTerritory) sampleNames.push(formTerritory.name)
  } else if (strategy === 'multi_brick') {
    const n = multiBricks.length
    primaryLine = n ? `${n} brick${n === 1 ? '' : 's'} in footprint` : '—'
    countHint = n ? `Union of ${n} brick${n === 1 ? '' : 's'}` : 'Select bricks'
    sampleNames.push(...multiBricks.slice(0, 12).map(b => b.name))
  } else if (strategy === 'entire_zone') {
    const bc = hierarchyPreview?.brickCount ?? 0
    const ac = zoneAreaCount ?? 0
    primaryLine = formTerritory?.name ?? '—'
    countHint = formTerritory
      ? `${ac} area${ac === 1 ? '' : 's'} · ${bc} brick${bc === 1 ? '' : 's'} (hierarchy)`
      : 'Select a zone'
    sampleNames.push(...(hierarchyPreview?.sampleBrickNames ?? []))
  } else {
    const bc = hierarchyPreview?.brickCount ?? 0
    const extra = multiBricks.length
    primaryLine = formTerritory?.name ?? '—'
    countHint = formTerritory
      ? `${bc} brick${bc === 1 ? '' : 's'} under area${extra ? ` + ${extra} added (merged on save)` : ''}`
      : 'Select an area'
    sampleNames.push(...(hierarchyPreview?.sampleBrickNames ?? []), ...multiBricks.map(b => b.name))
  }

  const uniqSamples = [...new Set(sampleNames)].slice(0, 12)

  const content = (
    <Stack spacing={1.5}>
      {breadcrumbText ? (
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          {breadcrumbText}
        </Typography>
      ) : null}
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={600}
          textTransform="uppercase"
          letterSpacing={0.6}
        >
          Coverage type
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {title}
        </Typography>
      </Box>
      <Divider flexItem />
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={600}
          textTransform="uppercase"
          letterSpacing={0.6}
        >
          Primary territory
        </Typography>
        <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
          {primaryLine}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {formTerritory ? `${formTerritory.kind} · ${countHint}` : countHint}
        </Typography>
      </Box>
      {uniqSamples.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" className="mbe-1">
            {strategy === 'multi_brick' ? 'Selected bricks' : 'Included bricks (sample)'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {strategy === 'multi_brick'
              ? multiBricks.map(b => {
                  const isPri = primaryBrickId && String(b._id) === String(primaryBrickId)
                  return (
                    <Chip
                      key={String(b._id)}
                      size="small"
                      label={isPri ? `PRIMARY · ${b.name}` : b.name}
                      color={isPri ? 'primary' : 'default'}
                      variant={isPri ? 'filled' : 'outlined'}
                    />
                  )
                })
              : uniqSamples.map(name => <Chip key={name} size="small" variant="outlined" label={name} />)}
          </Box>
        </Box>
      )}
    </Stack>
  )

  if (compact) {
    return (
      <Accordion
        defaultExpanded
        disableGutters
        elevation={0}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 2, '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<i className="tabler-chevron-down" />}>
          <Typography variant="subtitle2" fontWeight={700}>
            Coverage summary
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>{content}</AccordionDetails>
      </Accordion>
    )
  }

  return (
    <Card
      variant="outlined"
      sx={{
        position: 'sticky',
        top: 16,
        borderRadius: 2,
        borderColor: theme => theme.palette.divider,
        boxShadow: 'none',
        bgcolor: theme => alpha(theme.palette.background.paper, 0.9)
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="subtitle2" fontWeight={700} className="mbe-2">
          Coverage summary
        </Typography>
        {content}
      </CardContent>
    </Card>
  )
}

export type UserFormCoverageSectionProps = {
  dialogOpen: boolean
  hydrationKey: string
  assignmentOptions: TerritoryAssignmentStrategy[]
  strategy: TerritoryAssignmentStrategy
  onStrategyChange: (next: TerritoryAssignmentStrategy) => void
  formTerritory: Territory | null
  onFormTerritoryChange: (t: Territory | null) => void
  multiBricks: Territory[]
  primaryBrickId: string | null
  onMultiBricksCommit: (next: { bricks: Territory[]; primaryId: string | null }) => void
  onExtrasBricksChange: (bricks: Territory[]) => void
  hierarchyPreview: TerritoryCoveragePreview | null
  onHierarchyPreviewChange: (p: TerritoryCoveragePreview | null) => void
  legacyNonBrickWarning: boolean
}

export function UserFormCoverageSection({
  dialogOpen,
  hydrationKey,
  assignmentOptions,
  strategy,
  onStrategyChange,
  formTerritory,
  onFormTerritoryChange,
  multiBricks,
  primaryBrickId,
  onMultiBricksCommit,
  onExtrasBricksChange,
  hierarchyPreview,
  onHierarchyPreviewChange,
  legacyNonBrickWarning
}: UserFormCoverageSectionProps) {
  const theme = useTheme()
  const index = useTerritoryTreeIndex(dialogOpen)
  const {
    loading: treeLoading,
    subtreePreview,
    zonePreview,
    breadcrumbLabel,
    zones,
    areasForZone,
    brickSetUnder,
    pathToNode,
    findNode
  } = index

  const zoneList = useMemo(() => zones(), [zones])

  const [draftZoneId, setDraftZoneId] = useState<string | null>(null)
  const [draftAreaId, setDraftAreaId] = useState<string | null>(null)
  const [multiFilterZoneId, setMultiFilterZoneId] = useState<string>('')
  const [multiFilterAreaId, setMultiFilterAreaId] = useState<string>('')
  const [brickSearch, setBrickSearch] = useState('')
  const [brickOptions, setBrickOptions] = useState<Territory[]>([])
  const [brickLoading, setBrickLoading] = useState(false)

  const lastHydrateKey = useRef('')

  useEffect(() => {
    setDraftZoneId(null)
    setDraftAreaId(null)
    setMultiFilterZoneId('')
    setMultiFilterAreaId('')
    setBrickSearch('')
    lastHydrateKey.current = ''
  }, [strategy])

  const hydrateComposite = `${hydrationKey}|${strategy}|${formTerritory?._id ?? ''}|${treeLoading}`

  useEffect(() => {
    if (!dialogOpen || treeLoading) return
    if (!formTerritory?._id) {
      lastHydrateKey.current = hydrateComposite
      return
    }
    if (lastHydrateKey.current === hydrateComposite) return
    const path = pathToNode(String(formTerritory._id))
    if (!path?.length) {
      lastHydrateKey.current = hydrateComposite
      return
    }
    const zone = path.find(n => n.kind === 'ZONE')
    const area = path.find(n => n.kind === 'AREA')
    if (strategy === 'single_brick' && formTerritory.kind === 'BRICK') {
      if (zone) setDraftZoneId(String(zone._id))
      if (area) setDraftAreaId(String(area._id))
      const label = formTerritory.code ? `${formTerritory.name} (${formTerritory.code})` : formTerritory.name
      setBrickSearch(label)
    } else if (strategy === 'entire_area' && formTerritory.kind === 'AREA') {
      if (zone) setDraftZoneId(String(zone._id))
      setDraftAreaId(String(formTerritory._id))
    } else if (strategy === 'entire_zone' && formTerritory.kind === 'ZONE') {
      setDraftZoneId(String(formTerritory._id))
    }
    lastHydrateKey.current = hydrateComposite
  }, [dialogOpen, treeLoading, formTerritory, strategy, pathToNode, hydrateComposite])

  useEffect(() => {
    if (!dialogOpen || strategy !== 'single_brick' || !draftAreaId) {
      setBrickOptions([])
      return
    }
    let cancel = false
    const t = window.setTimeout(async () => {
      setBrickLoading(true)
      try {
        const res = await territoriesService.lookup({
          search: brickSearch,
          kind: 'BRICK',
          parentId: draftAreaId,
          limit: 50
        })
        const rows = (res.data?.data || []) as Territory[]
        if (!cancel) setBrickOptions(Array.isArray(rows) ? rows : [])
      } catch (e) {
        if (!cancel) {
          showApiError(e, 'Territory search failed')
          setBrickOptions([])
        }
      } finally {
        if (!cancel) setBrickLoading(false)
      }
    }, 200)
    return () => {
      cancel = true
      window.clearTimeout(t)
    }
  }, [brickSearch, draftAreaId, dialogOpen, strategy])

  useEffect(() => {
    if (strategy !== 'entire_area' && strategy !== 'entire_zone') {
      onHierarchyPreviewChange(null)
      return
    }
    if (!formTerritory?._id || (formTerritory.kind !== 'AREA' && formTerritory.kind !== 'ZONE')) {
      onHierarchyPreviewChange(null)
      return
    }
    onHierarchyPreviewChange(subtreePreview(String(formTerritory._id)))
  }, [strategy, formTerritory, subtreePreview, onHierarchyPreviewChange])

  const areaRows = useMemo(
    () => (draftZoneId ? areasForZone(draftZoneId) : []),
    [areasForZone, draftZoneId]
  )

  const multiZoneAreas = useMemo(
    () => (multiFilterZoneId ? areasForZone(multiFilterZoneId) : []),
    [areasForZone, multiFilterZoneId]
  )

  const allowedForMulti = useMemo(() => {
    if (multiFilterAreaId) return brickSetUnder(multiFilterAreaId)
    if (multiFilterZoneId) return brickSetUnder(multiFilterZoneId)
    return null
  }, [multiFilterAreaId, multiFilterZoneId, brickSetUnder])

  const zoneStats = useMemo(() => {
    if (strategy !== 'entire_zone' || !formTerritory?._id || formTerritory.kind !== 'ZONE') return null
    return zonePreview(String(formTerritory._id))
  }, [strategy, formTerritory, zonePreview])

  const breadcrumb = useMemo(() => {
    if (!formTerritory?._id) return null
    return breadcrumbLabel(String(formTerritory._id))
  }, [formTerritory, breadcrumbLabel])

  const singleBrickValue = formTerritory?.kind === 'BRICK' ? formTerritory : null

  const onSingleZone = (id: string) => {
    const next = id || null
    setDraftZoneId(next)
    setDraftAreaId(null)
    setBrickSearch('')
    onFormTerritoryChange(null)
  }

  const onSingleArea = (id: string) => {
    const next = id || null
    setDraftAreaId(next)
    setBrickSearch('')
    onFormTerritoryChange(null)
  }

  const onEntireAreaZone = (id: string) => {
    const next = id || null
    setDraftZoneId(next)
    setDraftAreaId(null)
    onFormTerritoryChange(null)
  }

  const onEntireAreaPick = (areaId: string) => {
    const next = areaId || null
    setDraftAreaId(next)
    if (!next) {
      onFormTerritoryChange(null)
      return
    }
    const a = findNode(next)
    if (a?.kind === 'AREA') onFormTerritoryChange(nodeToTerritory(a))
  }

  const onEntireZonePick = (zoneId: string) => {
    const next = zoneId || null
    setDraftZoneId(next)
    if (!next) {
      onFormTerritoryChange(null)
      return
    }
    const z = findNode(next)
    if (z?.kind === 'ZONE') onFormTerritoryChange(nodeToTerritory(z))
  }

  const strategyTiles = (
    <Grid container spacing={1.5}>
      {(['single_brick', 'multi_brick', 'entire_area', 'entire_zone'] as const)
        .filter(s => assignmentOptions.includes(s))
        .map(s => {
          const meta = STRATEGY_COPY[s]
          const active = strategy === s
          return (
            <Grid key={s} size={{ xs: 12, sm: 6 }}>
              <Paper
                elevation={0}
                onClick={() => onStrategyChange(s)}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: active ? 'primary.main' : 'divider',
                  bgcolor: active ? alpha(theme.palette.primary.main, 0.07) : 'background.paper',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                  '&:hover': { borderColor: active ? 'primary.main' : alpha(theme.palette.text.primary, 0.18) }
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.text.primary, 0.04)
                    }}
                  >
                    <i className={meta.icon} style={{ fontSize: '1.35rem', opacity: 0.9 }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {meta.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.45 }}>
                      {meta.description}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          )
        })}
    </Grid>
  )

  const treeBusy = treeLoading && dialogOpen

  const steps = (
    <Stack spacing={2.5}>
      {strategy === 'single_brick' ? (
        <>
          <Typography variant="subtitle2" fontWeight={700}>
            Narrow by hierarchy, then search the brick
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <CustomTextField
              select
              fullWidth
              label="Zone"
              value={draftZoneId ?? ''}
              onChange={e => onSingleZone(e.target.value)}
              disabled={treeBusy || !zoneList.length}
              helperText={treeBusy ? 'Loading…' : 'Pick a zone to list its areas'}
            >
              <MenuItem value="">
                <em>Select zone</em>
              </MenuItem>
              {zoneList.map(z => (
                <MenuItem key={String(z._id)} value={String(z._id)}>
                  {z.name}
                  {z.code ? ` (${z.code})` : ''}
                </MenuItem>
              ))}
            </CustomTextField>
            <CustomTextField
              select
              fullWidth
              label="Area"
              value={draftAreaId ?? ''}
              onChange={e => onSingleArea(e.target.value)}
              disabled={treeBusy || !draftZoneId}
              helperText="Areas under the selected zone"
            >
              <MenuItem value="">
                <em>Select area</em>
              </MenuItem>
              {areaRows.map(a => (
                <MenuItem key={String(a._id)} value={String(a._id)}>
                  {a.name}
                  {a.code ? ` (${a.code})` : ''}
                </MenuItem>
              ))}
            </CustomTextField>
          </Stack>
          <Autocomplete
            options={brickOptions}
            loading={brickLoading}
            value={singleBrickValue}
            inputValue={brickSearch}
            onInputChange={(_, v) => setBrickSearch(v)}
            onChange={(_, v) => {
              if (!v) {
                onFormTerritoryChange(null)
                setBrickSearch('')
                return
              }
              const label = v.code ? `${v.name} (${v.code})` : v.name
              setBrickSearch(label)
              onFormTerritoryChange({
                _id: String(v._id),
                name: v.name,
                code: v.code ?? undefined,
                kind: 'BRICK',
                isActive: true
              })
            }}
            getOptionLabel={o => (o.code ? `${o.name} (${o.code})` : o.name)}
            isOptionEqualToValue={(a, b) => String(a._id) === String(b._id)}
            filterOptions={opts => opts}
            disabled={treeBusy || !draftAreaId}
            renderInput={params => (
              <CustomTextField
                {...params}
                label="Search & select brick"
                placeholder="Type e.g. Rasheed…"
                helperText="Server search within the selected area"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {brickLoading ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  )
                }}
              />
            )}
          />
        </>
      ) : null}

      {strategy === 'entire_area' ? (
        <>
          <Typography variant="subtitle2" fontWeight={700}>
            Choose zone and area
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <CustomTextField
              select
              fullWidth
              label="Zone"
              value={draftZoneId ?? ''}
              onChange={e => onEntireAreaZone(e.target.value)}
              disabled={treeBusy || !zoneList.length}
            >
              <MenuItem value="">
                <em>Select zone</em>
              </MenuItem>
              {zoneList.map(z => (
                <MenuItem key={String(z._id)} value={String(z._id)}>
                  {z.name}
                  {z.code ? ` (${z.code})` : ''}
                </MenuItem>
              ))}
            </CustomTextField>
            <CustomTextField
              select
              fullWidth
              label="Area (coverage anchor)"
              value={draftAreaId ?? ''}
              onChange={e => onEntireAreaPick(e.target.value)}
              disabled={treeBusy || !draftZoneId}
            >
              <MenuItem value="">
                <em>Select area</em>
              </MenuItem>
              {areaRows.map(a => (
                <MenuItem key={String(a._id)} value={String(a._id)}>
                  {a.name}
                  {a.code ? ` (${a.code})` : ''}
                </MenuItem>
              ))}
            </CustomTextField>
          </Stack>
          {hierarchyPreview && formTerritory?.kind === 'AREA' ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.04) }}>
              <Typography variant="subtitle2" fontWeight={700} className="mbe-1">
                Hierarchy footprint
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>{hierarchyPreview.brickCount}</strong> bricks roll up under this area
                {hierarchyPreview.sampleBrickNames?.length
                  ? ` — e.g. ${hierarchyPreview.sampleBrickNames.slice(0, 5).join(', ')}`
                  : ''}
                .
              </Typography>
            </Paper>
          ) : null}
        </>
      ) : null}

      {strategy === 'entire_zone' ? (
        <>
          <Typography variant="subtitle2" fontWeight={700}>
            Choose zone (anchor)
          </Typography>
          <CustomTextField
            select
            fullWidth
            label="Zone"
            value={formTerritory?.kind === 'ZONE' ? String(formTerritory._id) : draftZoneId ?? ''}
            onChange={e => onEntireZonePick(e.target.value)}
            disabled={treeBusy || !zoneList.length}
          >
            <MenuItem value="">
              <em>Select zone</em>
            </MenuItem>
            {zoneList.map(z => (
              <MenuItem key={String(z._id)} value={String(z._id)}>
                {z.name}
                {z.code ? ` (${z.code})` : ''}
              </MenuItem>
            ))}
          </CustomTextField>
          {zoneStats && formTerritory?.kind === 'ZONE' ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.04) }}>
              <Typography variant="subtitle2" fontWeight={700} className="mbe-1">
                Zone footprint
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>{zoneStats.areaCount}</strong> areas · <strong>{zoneStats.brickCount}</strong> bricks
                {zoneStats.sampleBrickNames?.length
                  ? ` — e.g. ${zoneStats.sampleBrickNames.slice(0, 5).join(', ')}`
                  : ''}
                .
              </Typography>
            </Paper>
          ) : null}
        </>
      ) : null}

      {strategy === 'multi_brick' ? (
        <>
          <Typography variant="subtitle2" fontWeight={700}>
            Optional filters → multi-select bricks
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Narrow by zone or area, or leave filters cleared to search the full network.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <CustomTextField
              select
              fullWidth
              label="Filter by zone (optional)"
              value={multiFilterZoneId}
              onChange={e => {
                setMultiFilterZoneId(e.target.value)
                setMultiFilterAreaId('')
              }}
              disabled={treeBusy}
            >
              <MenuItem value="">
                <em>All zones</em>
              </MenuItem>
              {zoneList.map(z => (
                <MenuItem key={String(z._id)} value={String(z._id)}>
                  {z.name}
                </MenuItem>
              ))}
            </CustomTextField>
            <CustomTextField
              select
              fullWidth
              label="Filter by area (optional)"
              value={multiFilterAreaId}
              onChange={e => setMultiFilterAreaId(e.target.value)}
              disabled={treeBusy || !multiFilterZoneId}
            >
              <MenuItem value="">
                <em>All areas in zone</em>
              </MenuItem>
              {multiZoneAreas.map(a => (
                <MenuItem key={String(a._id)} value={String(a._id)}>
                  {a.name}
                </MenuItem>
              ))}
            </CustomTextField>
          </Stack>
          <BrickMultiPicker
            selected={multiBricks}
            primaryId={primaryBrickId}
            onChange={onMultiBricksCommit}
            allowedBrickIds={allowedForMulti}
          />
        </>
      ) : null}

      {(strategy === 'entire_area' || strategy === 'entire_zone') && formTerritory && (formTerritory.kind === 'AREA' || formTerritory.kind === 'ZONE') ? (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} className="mbe-1">
            Additional brick coverage (optional)
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" className="mbe-2">
            Union extra bricks with hierarchical expansion (overlaps deduplicated on the server).
          </Typography>
          <BrickMultiPicker
            selected={multiBricks}
            primaryId={null}
            onChange={({ bricks }) => onExtrasBricksChange(bricks)}
            extrasOnly
          />
        </Box>
      ) : null}
    </Stack>
  )

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderColor: 'divider', boxShadow: 'none' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2} className="mbe-2">
          <Box>
            <Typography variant="h6" fontWeight={700} className="mbe-1">
              Coverage assignment
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Define territory footprint with a clear workflow — the same data is saved as today (primary + optional
              coverage list).
            </Typography>
          </Box>
          {legacyNonBrickWarning ? (
            <Typography variant="caption" color="warning.main" display="block">
              Legacy coverage includes non-brick territory nodes; they are preserved until removed in admin tools.
            </Typography>
          ) : null}
        </Stack>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.6} display="block" className="mbe-2">
              Coverage strategy
            </Typography>
            {strategyTiles}
            <Divider sx={{ my: 3 }} />
            {treeBusy ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              steps
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <CoverageSummaryInner
              strategy={strategy}
              formTerritory={formTerritory}
              multiBricks={multiBricks}
              primaryBrickId={primaryBrickId}
              hierarchyPreview={hierarchyPreview}
              breadcrumbText={breadcrumb}
              zoneAreaCount={zoneStats?.areaCount ?? null}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}
