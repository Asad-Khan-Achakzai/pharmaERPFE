'use client'

import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  describeWorkflowStep,
  formatWorkflowWhen,
  type WorkflowTimelineEntry
} from '@/utils/attendanceWorkflowUi'

type Props = {
  entries: WorkflowTimelineEntry[]
  defaultExpanded?: boolean
  summaryHint?: string
}

/** Read-only vertical timeline for approval history (enterprise language). */
export default function AttendanceWorkflowTimeline({
  entries,
  defaultExpanded = false,
  summaryHint
}: Props) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : []
  if (list.length === 0) {
    return (
      <Typography variant='caption' color='text.secondary'>
        No approval activity recorded yet.
      </Typography>
    )
  }

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        '&:before': { display: 'none' }
      }}
    >
      <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
        <Typography variant='subtitle2' fontWeight={600}>
          Approval activity
        </Typography>
        {summaryHint ? (
          <Typography variant='caption' color='text.secondary' sx={{ ml: 1.5, alignSelf: 'center' }}>
            {summaryHint}
          </Typography>
        ) : null}
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Stack spacing={1.5}>
          {list.map((entry, idx) => (
            <Box
              key={`${idx}-${entry.at}-${entry.action}`}
              sx={{
                pl: 1.5,
                borderLeft: '2px solid',
                borderColor: entry.source === 'POLICY' || entry.source === 'SYSTEM' ? 'info.main' : 'divider'
              }}
            >
              <Typography variant='body2'>{describeWorkflowStep(entry)}</Typography>
              <Typography variant='caption' color='text.secondary' display='block'>
                {formatWorkflowWhen(entry.at)}
                {entry.source === 'POLICY' || entry.source === 'SYSTEM'
                  ? ` · ${entry.source === 'POLICY' ? 'Company rule' : 'Automated'}`
                  : ''}
              </Typography>
              {entry.comment && String(entry.comment).trim() ? (
                <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                  Note: {entry.comment}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}
