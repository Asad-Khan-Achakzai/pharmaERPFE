'use client'

import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { approvalStepRoleLabel, type ApprovalStepSnapshot } from '@/utils/attendanceApprovalPathUi'

type Props = {
  stepsSnapshot: ApprovalStepSnapshot[] | null | undefined
  currentStepIndex: number | null | undefined
  /** When true, uses compact single-row style for narrow cards. */
  compact?: boolean
}

/**
 * Simple horizontal path: MR → manager → … → admin.
 * Highlights completed / current / pending from matrix snapshot + current index.
 */
export default function AttendanceApprovalPath({ stepsSnapshot, currentStepIndex, compact }: Props) {
  const theme = useTheme()
  const steps = Array.isArray(stepsSnapshot) && stepsSnapshot.length ? stepsSnapshot : []

  if (!steps.length) {
    return (
      <Typography variant='caption' color='text.secondary'>
        Approval path will appear after the company routing is saved for this request type.
      </Typography>
    )
  }

  const cur = typeof currentStepIndex === 'number' ? Math.max(0, Math.min(currentStepIndex, steps.length - 1)) : 0

  const dot = (state: 'done' | 'current' | 'pending', label: string, key: string) => {
    const palette =
      state === 'done'
        ? theme.palette.success.main
        : state === 'current'
          ? theme.palette.primary.main
          : theme.palette.action.disabled
    return (
      <Stack key={key} alignItems='center' spacing={0.5} sx={{ minWidth: compact ? 72 : 88, maxWidth: 140 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: palette,
            boxShadow: state === 'current' ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.25)}` : undefined
          }}
        />
        <Typography
          variant='caption'
          color={state === 'pending' ? 'text.disabled' : 'text.secondary'}
          textAlign='center'
          sx={{ lineHeight: 1.25, fontWeight: state === 'current' ? 600 : 400 }}
        >
          {label}
        </Typography>
        {state === 'done' ? (
          <Typography variant='caption' color='success.main' sx={{ fontSize: '0.65rem' }}>
            Done
          </Typography>
        ) : null}
        {state === 'current' ? (
          <Typography variant='caption' color='primary.main' sx={{ fontSize: '0.65rem' }}>
            Now
          </Typography>
        ) : null}
      </Stack>
    )
  }

  return (
    <Box
      sx={{
        overflowX: 'auto',
        pb: 0.5,
        '&::-webkit-scrollbar': { height: 6 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 }
      }}
    >
      <Stack direction='row' alignItems='flex-start' spacing={1} sx={{ minWidth: minWidthForSteps(steps.length) }}>
        {steps.map((s, i) => {
          const state: 'done' | 'current' | 'pending' = i < cur ? 'done' : i === cur ? 'current' : 'pending'
          const label = approvalStepRoleLabel(s)
          return (
            <Stack key={`${i}-${s.order ?? i}`} direction='row' alignItems='center' spacing={1}>
              {dot(state, label, `step-${i}`)}
              {i < steps.length - 1 ? (
                <Typography variant='caption' color='text.disabled' sx={{ mt: -2, px: 0.25 }}>
                  →
                </Typography>
              ) : null}
            </Stack>
          )
        })}
      </Stack>
    </Box>
  )
}

function minWidthForSteps(n: number): number {
  return Math.max(280, n * 100)
}
