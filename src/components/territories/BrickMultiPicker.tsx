'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import CustomTextField from '@core/components/mui/TextField'
import { territoriesService, type Territory, type TerritoryNode } from '@/services/territories.service'
import { showApiError } from '@/utils/apiErrors'

export type BrickWithGroup = Territory & { groupLabel: string }

function walkBricks(node: TerritoryNode, ancestorNames: string[], acc: BrickWithGroup[]) {
  const trail = [...ancestorNames, node.name]
  if (node.kind === 'BRICK') {
    const groupLabel =
      ancestorNames.length >= 2
        ? `${ancestorNames[ancestorNames.length - 2]} › ${ancestorNames[ancestorNames.length - 1]}`
        : ancestorNames.length === 1
          ? ancestorNames[0]
          : 'Territory'
    acc.push({
      _id: node._id,
      name: node.name,
      code: node.code,
      kind: 'BRICK',
      isActive: node.isActive !== false,
      groupLabel
    })
    return
  }
  for (const ch of node.children || []) {
    walkBricks(ch, trail, acc)
  }
}

function bricksFromTree(roots: TerritoryNode[]): BrickWithGroup[] {
  const acc: BrickWithGroup[] = []
  for (const r of roots) {
    walkBricks(r, [], acc)
  }
  return acc.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel) || a.name.localeCompare(b.name))
}

export type BrickMultiPickerProps = {
  /** All bricks in the rep’s custom footprint (including primary). */
  selected: Territory[]
  primaryId: string | null
  onChange: (next: { bricks: Territory[]; primaryId: string | null }) => void
  disabled?: boolean
  /** Hierarchical modes: pick extra bricks only (no primary anchor). */
  extrasOnly?: boolean
  /** When set, only bricks in this id set appear in the picker (from hierarchy filters). */
  allowedBrickIds?: Set<string> | null
}

export function BrickMultiPicker({
  selected,
  primaryId,
  onChange,
  disabled,
  extrasOnly,
  allowedBrickIds
}: BrickMultiPickerProps) {
  const [options, setOptions] = useState<BrickWithGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await territoriesService.tree()
        const body = res.data?.data ?? res.data
        const roots = (body as { roots?: TerritoryNode[] })?.roots ?? []
        if (!cancel) setOptions(bricksFromTree(Array.isArray(roots) ? roots : []))
      } catch (e) {
        if (!cancel) {
          showApiError(e, 'Failed to load territory tree')
          setOptions([])
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const filteredOptions = useMemo(() => {
    if (allowedBrickIds == null) return options
    return options.filter(o => allowedBrickIds.has(String(o._id)))
  }, [options, allowedBrickIds])

  const selectedFull = useMemo(() => {
    const byId = new Map(filteredOptions.map(o => [String(o._id), o]))
    return selected.map(s => byId.get(String(s._id)) || s).filter(Boolean) as BrickWithGroup[]
  }, [selected, filteredOptions])

  const syncPrimary = useCallback(
    (bricks: Territory[], prim: string | null) => {
      const ids = new Set(bricks.map(b => String(b._id)))
      let p = prim && ids.has(String(prim)) ? prim : bricks[0]?._id ?? null
      onChange({ bricks, primaryId: p })
    },
    [onChange]
  )

  if (loading) {
    return (
      <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  return (
    <Stack spacing={2}>
      <Autocomplete
        multiple
        disabled={disabled}
        options={filteredOptions}
        groupBy={o => o.groupLabel}
        value={selectedFull}
        onChange={(_, v) =>
          extrasOnly ? onChange({ bricks: v as Territory[], primaryId: null }) : syncPrimary(v as Territory[], primaryId)
        }
        noOptionsText={
          allowedBrickIds?.size === 0 ? 'No bricks match the current zone/area filters.' : 'No bricks found'
        }
        getOptionLabel={o => (o.code ? `${o.name} (${o.code})` : o.name)}
        isOptionEqualToValue={(a, b) => String(a._id) === String(b._id)}
        filterSelectedOptions
        renderInput={params => (
          <CustomTextField
            {...params}
            label='Search bricks'
            placeholder='Type to filter…'
            helperText='Bricks are grouped by area. Select any combination for split-territory coverage.'
          />
        )}
        renderGroup={params => (
          <li key={params.key}>
            <Box
              component='ul'
              sx={{ listStyle: 'none', p: 0, m: 0 }}
              className={params.group.length > 0 ? '' : ''}
            >
              <Typography
                component='div'
                variant='overline'
                sx={{ px: 2, pt: 1.5, pb: 0.5, color: 'text.secondary', fontWeight: 700 }}
              >
                {params.group}
              </Typography>
              {params.children}
            </Box>
          </li>
        )}
        renderTags={(tagVal, getTagProps) =>
          tagVal.map((opt, index) => {
            const isPrimary = !extrasOnly && primaryId && String(opt._id) === String(primaryId)
            const { key, ...tagProps } = getTagProps({ index })
            return (
              <Chip
                key={key}
                size='small'
                label={isPrimary ? `PRIMARY · ${opt.name}` : `Additional · ${opt.name}`}
                color={isPrimary ? 'primary' : 'default'}
                variant={isPrimary ? 'filled' : 'outlined'}
                {...tagProps}
              />
            )
          })
        }
      />

      {!extrasOnly ? (
        <FormControl component='fieldset' disabled={disabled || selectedFull.length === 0}>
          <FormLabel component='legend'>Primary vs additional coverage</FormLabel>
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1 }}>
            The primary brick is the reporting anchor stored on the user. Others extend coverage in the same union.
          </Typography>
          <RadioGroup
            value={primaryId && selectedFull.some(b => String(b._id) === String(primaryId)) ? primaryId : ''}
            onChange={e => {
              const id = e.target.value
              onChange({ bricks: selected, primaryId: id || null })
            }}
          >
            {selectedFull.map(b => (
              <FormControlLabel
                key={String(b._id)}
                value={String(b._id)}
                control={<Radio size='small' />}
                label={b.code ? `${b.name} (${b.code})` : b.name}
              />
            ))}
          </RadioGroup>
        </FormControl>
      ) : null}

      <Typography variant='caption' color='text.secondary'>
        {selectedFull.length === 0
          ? extrasOnly
            ? 'Optional. Add specific bricks outside the defaults above, or leave empty for hierarchy-only coverage.'
            : 'Select at least one brick.'
          : `${selectedFull.length} brick${selectedFull.length === 1 ? '' : 's'} selected${
              extrasOnly ? ' (unioned with hierarchical expansion).' : ' — coverage is the union of these bricks.'
            }`}
      </Typography>
    </Stack>
  )
}
