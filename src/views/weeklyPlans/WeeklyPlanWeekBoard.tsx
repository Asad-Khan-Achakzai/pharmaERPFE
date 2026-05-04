'use client'

import { useMemo, useCallback } from 'react'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { planItemsService } from '@/services/planItems.service'

function SortablePlanRow({
  id,
  children,
  disabled
}: {
  id: string
  children: React.ReactNode
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    touchAction: 'none' as const
  }

  return (
    <Box ref={setNodeRef} style={style} {...attributes} {...listeners} sx={{ cursor: disabled ? 'default' : 'grab' }}>
      {children}
    </Box>
  )
}

function canReorderDay(ymd: string, beforePlanWeek: boolean, businessTodayYmd: string) {
  if (beforePlanWeek) return true
  return ymd >= businessTodayYmd
}

function statusColor(status: string): 'default' | 'success' | 'error' | 'warning' {
  if (status === 'VISITED') return 'success'
  if (status === 'MISSED') return 'error'
  return 'default'
}

type Item = {
  _id: string
  sequenceOrder?: number
  type?: string
  status?: string
  title?: string
  doctorId?: { name?: string } | null
}

export default function WeeklyPlanWeekBoard({
  weeklyPlanId,
  weekYmds,
  itemsByYmd,
  beforePlanWeek,
  businessTodayYmd,
  canEdit,
  onReload
}: {
  weeklyPlanId: string
  weekYmds: string[]
  itemsByYmd: Record<string, Item[]>
  beforePlanWeek: boolean
  businessTodayYmd: string
  canEdit: boolean
  onReload: () => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )

  const grouped = useMemo(() => {
    const out: Record<string, Item[]> = {}
    for (const ymd of weekYmds) {
      const raw = itemsByYmd[ymd] || []
      out[ymd] = [...raw].sort(
        (a, b) => (Number(a.sequenceOrder) || 0) - (Number(b.sequenceOrder) || 0)
      )
    }
    return out
  }, [itemsByYmd, weekYmds])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent, ymd: string) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      if (!canReorderDay(ymd, beforePlanWeek, businessTodayYmd) || !canEdit) return

      const list = grouped[ymd] || []
      const oldIndex = list.findIndex(i => String(i._id) === String(active.id))
      const newIndex = list.findIndex(i => String(i._id) === String(over.id))
      if (oldIndex < 0 || newIndex < 0) return

      const reordered = arrayMove(list, oldIndex, newIndex)
      const orderedPlanItemIds = reordered.map(i => String(i._id))

      try {
        await planItemsService.reorder({ weeklyPlanId, date: ymd, orderedPlanItemIds })
        showSuccess('Visit order updated')
        onReload()
      } catch (e) {
        showApiError(e, 'Could not reorder')
      }
    },
    [beforePlanWeek, businessTodayYmd, canEdit, grouped, onReload, weeklyPlanId]
  )

  return (
    <Box className='overflow-x-auto pb-2' sx={{ WebkitOverflowScrolling: 'touch' }}>
      <Stack direction='row' spacing={1.5} className='min-w-max'>
        {weekYmds.map(ymd => {
          const items = grouped[ymd] || []
          const labelDate = ymd
          const reorderable = canReorderDay(ymd, beforePlanWeek, businessTodayYmd) && canEdit && items.length > 1

          return (
            <Paper key={ymd} variant='outlined' className='min-is-[10.5rem] shrink-0 p-2 sm:p-3'>
              <Typography variant='caption' color='text.secondary' fontWeight={700} className='mbe-2 block uppercase'>
                {labelDate.slice(5)}
              </Typography>
              {items.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  —
                </Typography>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={e => void handleDragEnd(e, ymd)}
                >
                  <SortableContext items={items.map(i => String(i._id))} strategy={verticalListSortingStrategy}>
                    <Stack spacing={1}>
                      {items.map(it => (
                        <SortablePlanRow key={it._id} id={String(it._id)} disabled={!reorderable}>
                          <Paper
                            elevation={0}
                            className='border border-solid p-2'
                            sx={{
                              borderColor: 'divider',
                              bgcolor: 'action.hover',
                              minHeight: 48
                            }}
                          >
                            <Stack direction='row' alignItems='center' spacing={1} className='flex-wrap'>
                              <Chip size='small' label={`#${it.sequenceOrder ?? '—'}`} variant='outlined' />
                              <Chip size='small' label={it.status || ''} color={statusColor(it.status || '')} variant='tonal' />
                              <Typography variant='body2' fontWeight={600}>
                                {it.type === 'DOCTOR_VISIT' ? it.doctorId?.name || 'Doctor' : it.title || 'Task'}
                              </Typography>
                            </Stack>
                          </Paper>
                        </SortablePlanRow>
                      ))}
                    </Stack>
                  </SortableContext>
                </DndContext>
              )}
            </Paper>
          )
        })}
      </Stack>
    </Box>
  )
}
