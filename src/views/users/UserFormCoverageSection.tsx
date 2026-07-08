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
import { listAllAreas, unionSubtreePreview, unionZonePreview } from '@/utils/territoryTreeUtils'
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
    description: 'Cover every brick under one or more areas (can span zones).',
    icon: 'tabler-map'
  },
  entire_zone: {
    label: 'Entire Zone',
    description: 'Cover all areas and bricks under one or more zones.',
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
  selectedAreas: Territory[]
  selectedZones: Territory[]
  multiBricks: Territory[]
  primaryBrickId: string | null
  hierarchyPreview: TerritoryCoveragePreview | null
  breadcrumbText: string | null
  zoneAreaCount: number | null
}

function CoverageSummaryInner({
  strategy,
  formTerritory,
  selectedAreas,
  selectedZones,
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
    const n = selectedZones.length
    primaryLine =
      n === 0
        ? '—'
        : n === 1
          ? selectedZones[0].name
          : `${n} zones (${selectedZones.map(z => z.name).slice(0, 3).join(', ')}${n > 3 ? '…' : ''})`
    countHint =
      n > 0
        ? `${n} zone${n === 1 ? '' : 's'} · ${ac} area${ac === 1 ? '' : 's'} · ${bc} brick${bc === 1 ? '' : 's'} (union)`
        : 'Select one or more zones'
    sampleNames.push(...(hierarchyPreview?.sampleBrickNames ?? []))
  } else {
    const bc = hierarchyPreview?.brickCount ?? 0
    const extra = multiBricks.length
    const n = selectedAreas.length
    primaryLine =
      n === 0
        ? '—'
        : n === 1
          ? selectedAreas[0].name
          : `${n} areas (${selectedAreas.map(a => a.name).slice(0, 3).join(', ')}${n > 3 ? '…' : ''})`
    countHint =
      n > 0
        ? `${n} area${n === 1 ? '' : 's'} · ${bc} brick${bc === 1 ? '' : 's'} (union)${extra ? ` + ${extra} extra brick${extra === 1 ? '' : 's'}` : ''}`
        : 'Select one or more areas'
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
          {countHint}
        </Typography>
      </Box>
      {uniqSamples.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" className="mbe-1">
            {strategy === 'multi_brick'
              ? 'Selected bricks'
              : strategy === 'entire_area'
                ? selectedAreas.length > 1
                  ? 'Selected areas'
                  : 'Included bricks (sample)'
                : strategy === 'entire_zone' && selectedZones.length > 1
                  ? 'Selected zones'
                  : 'Included bricks (sample)'}
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
              : strategy === 'entire_area' && selectedAreas.length > 1
                ? selectedAreas.map(a => (
                    <Chip key={String(a._id)} size="small" variant="outlined" label={a.name} />
                  ))
                : strategy === 'entire_zone' && selectedZones.length > 1
                  ? selectedZones.map(z => (
                      <Chip key={String(z._id)} size="small" variant="outlined" label={z.name} />
                    ))
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
  selectedAreas: Territory[]
  onSelectedAreasChange: (areas: Territory[]) => void
  selectedZones: Territory[]
  onSelectedZonesChange: (zones: Territory[]) => void
  multiBricks: Territory[]
  primaryBrickId: string | null
  onMultiBricksCommit: (next: { bricks: Territory[]; primaryId: string | null }) => void
  onExtrasBricksChange: (bricks: Territory[]) => void
  hierarchyPreview: TerritoryCoveragePreview | null
  onHierarchyPreviewChange: (p: TerritoryCoveragePreview | null) => void
}

export function UserFormCoverageSection({
  dialogOpen,
  hydrationKey,
  assignmentOptions,
  strategy,
  onStrategyChange,
  formTerritory,
  onFormTerritoryChange,
  selectedAreas,
  onSelectedAreasChange,
  selectedZones,
  onSelectedZonesChange,
  multiBricks,
  primaryBrickId,
  onMultiBricksCommit,
  onExtrasBricksChange,
  hierarchyPreview,
  onHierarchyPreviewChange
}: UserFormCoverageSectionProps) {
  const theme = useTheme()
  const index = useTerritoryTreeIndex(dialogOpen)
  const {
    loading: treeLoading,
    roots,
    breadcrumbLabel,
    zones,
    areasForZone,
    brickSetUnder,
    pathToNode
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

  const hydrateComposite = `${hydrationKey}|${strategy}|${selectedAreas.map(a => a._id).join(',')}|${selectedZones.map(z => z._id).join(',')}|${treeLoading}`

  useEffect(() => {
    if (!dialogOpen || treeLoading) return
    if (strategy === 'entire_area' && selectedAreas.length > 0) {
      if (lastHydrateKey.current === hydrateComposite) return
      const first = selectedAreas[0]
      const path = pathToNode(String(first._id))
      const zone = path?.find(n => n.kind === 'ZONE')
      if (zone) setDraftZoneId(String(zone._id))
      lastHydrateKey.current = hydrateComposite
      return
    }
    if (strategy === 'entire_zone' && selectedZones.length > 0) {
      lastHydrateKey.current = hydrateComposite
      return
    }
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
    }
    lastHydrateKey.current = hydrateComposite
  }, [dialogOpen, treeLoading, formTerritory, strategy, pathToNode, hydrateComposite, selectedAreas, selectedZones])

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
    if (strategy === 'entire_area') {
      if (!selectedAreas.length) {
        onHierarchyPreviewChange(null)
        return
      }
      onHierarchyPreviewChange(
        unionSubtreePreview(
          roots,
          selectedAreas.map(a => String(a._id))
        )
      )
      return
    }
    if (strategy === 'entire_zone') {
      if (!selectedZones.length) {
        onHierarchyPreviewChange(null)
        return
      }
      const zp = unionZonePreview(
        roots,
        selectedZones.map(z => String(z._id))
      )
      onHierarchyPreviewChange({
        brickCount: zp.brickCount,
        sampleBrickNames: zp.sampleBrickNames
      })
      return
    }
    if (strategy !== 'entire_area' && strategy !== 'entire_zone') {
      onHierarchyPreviewChange(null)
    }
  }, [strategy, selectedAreas, selectedZones, roots, onHierarchyPreviewChange])

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

  const areaPickerOptions = useMemo(() => {
    const pool = draftZoneId ? areasForZone(draftZoneId) : listAllAreas(roots)
    const selectedIds = new Set(selectedAreas.map(a => String(a._id)))
    return pool
      .filter(a => !selectedIds.has(String(a._id)))
      .map(nodeToTerritory)
  }, [areasForZone, draftZoneId, roots, selectedAreas])

  const zonePickerOptions = useMemo(() => {
    const selectedIds = new Set(selectedZones.map(z => String(z._id)))
    return zoneList.filter(z => !selectedIds.has(String(z._id))).map(nodeToTerritory)
  }, [zoneList, selectedZones])

  const zoneStats = useMemo(() => {
    if (strategy !== 'entire_zone' || !selectedZones.length) return null
    return unionZonePreview(
      roots,
      selectedZones.map(z => String(z._id))
    )
  }, [strategy, selectedZones, roots])

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
    setDraftZoneId(id || null)
  }

  const onAreasChange = (areas: Territory[]) => {
    onSelectedAreasChange(areas)
    onFormTerritoryChange(areas[0] ?? null)
  }

  const onZonesChange = (zonesNext: Territory[]) => {
    onSelectedZonesChange(zonesNext)
    onFormTerritoryChange(zonesNext[0] ?? null)
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
            Choose areas (one or more)
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Filter by zone to narrow the list, or leave zone cleared to pick areas across the full network.
          </Typography>
          <Stack spacing={2}>
            <CustomTextField
              select
              fullWidth
              label="Filter by zone (optional)"
              value={draftZoneId ?? ''}
              onChange={e => onEntireAreaZone(e.target.value)}
              disabled={treeBusy || !zoneList.length}
              sx={{ maxWidth: { sm: 360 } }}
            >
              <MenuItem value="">
                <em>All zones</em>
              </MenuItem>
              {zoneList.map(z => (
                <MenuItem key={String(z._id)} value={String(z._id)}>
                  {z.name}
                  {z.code ? ` (${z.code})` : ''}
                </MenuItem>
              ))}
            </CustomTextField>
            <Autocomplete
              multiple
              fullWidth
              disableCloseOnSelect
              options={areaPickerOptions}
              value={selectedAreas}
              onChange={(_, v) => onAreasChange(v)}
              getOptionLabel={o => (o.code ? `${o.name} (${o.code})` : o.name)}
              isOptionEqualToValue={(a, b) => String(a._id) === String(b._id)}
              filterSelectedOptions
              disabled={treeBusy}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index })
                  return (
                    <Chip
                      key={key}
                      {...tagProps}
                      size="small"
                      label={index === 0 ? `PRIMARY · ${option.name}` : option.name}
                      color={index === 0 ? 'primary' : 'default'}
                      variant={index === 0 ? 'filled' : 'outlined'}
                    />
                  )
                })
              }
              renderInput={params => (
                <CustomTextField
                  {...params}
                  fullWidth
                  label="Areas"
                  placeholder={selectedAreas.length ? 'Add another area…' : 'Select areas…'}
                  helperText="First area is the primary anchor; all roll up into one footprint."
                />
              )}
              slotProps={{
                popper: {
                  placement: 'bottom-start',
                  sx: { minWidth: 320 }
                }
              }}
            />
          </Stack>
          {hierarchyPreview && selectedAreas.length > 0 ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.04) }}>
              <Typography variant="subtitle2" fontWeight={700} className="mbe-1">
                Combined footprint
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>{selectedAreas.length}</strong> area{selectedAreas.length === 1 ? '' : 's'} ·{' '}
                <strong>{hierarchyPreview.brickCount}</strong> brick{hierarchyPreview.brickCount === 1 ? '' : 's'}{' '}
                (union, overlaps deduplicated)
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
            Choose zones (one or more)
          </Typography>
          <Autocomplete
            multiple
            fullWidth
            disableCloseOnSelect
            options={zonePickerOptions}
            value={selectedZones}
            onChange={(_, v) => onZonesChange(v)}
            getOptionLabel={o => (o.code ? `${o.name} (${o.code})` : o.name)}
            isOptionEqualToValue={(a, b) => String(a._id) === String(b._id)}
            filterSelectedOptions
            disabled={treeBusy || !zoneList.length}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index })
                return (
                  <Chip
                    key={key}
                    {...tagProps}
                    size="small"
                    label={index === 0 ? `PRIMARY · ${option.name}` : option.name}
                    color={index === 0 ? 'primary' : 'default'}
                    variant={index === 0 ? 'filled' : 'outlined'}
                  />
                )
              })
            }
            renderInput={params => (
              <CustomTextField
                {...params}
                fullWidth
                label="Zones"
                placeholder={selectedZones.length ? 'Add another zone…' : 'Select zones…'}
                helperText="First zone is the primary anchor; all areas and bricks union into one footprint."
              />
            )}
            slotProps={{
              popper: {
                placement: 'bottom-start',
                sx: { minWidth: 320 }
              }
            }}
          />
          {zoneStats && selectedZones.length > 0 ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.04) }}>
              <Typography variant="subtitle2" fontWeight={700} className="mbe-1">
                Combined zone footprint
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>{selectedZones.length}</strong> zone{selectedZones.length === 1 ? '' : 's'} ·{' '}
                <strong>{zoneStats.areaCount}</strong> area{zoneStats.areaCount === 1 ? '' : 's'} ·{' '}
                <strong>{zoneStats.brickCount}</strong> brick{zoneStats.brickCount === 1 ? '' : 's'}
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

      {(strategy === 'entire_area' || strategy === 'entire_zone') &&
      ((strategy === 'entire_area' && selectedAreas.length > 0) ||
        (strategy === 'entire_zone' && selectedZones.length > 0)) ? (
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
              selectedAreas={selectedAreas}
              selectedZones={selectedZones}
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
