'use client'

import { useMemo } from 'react'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import type { PlatformCompanyRow } from '@/types/platformDashboard'
import { formatPKR } from './PlatformKpiRow'

const trunc = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`)

const PlatformCompareTable = ({ rows, rangeLabel }: { rows: PlatformCompanyRow[]; rangeLabel: string }) => {
  const maxRev = useMemo(() => Math.max(1, ...rows.map(r => r.period.revenue)), [rows])

  if (!rows.length) return null

  return (
    <TableContainer component={Paper} variant='outlined' className='mbe-4'>
      <Table size='small' aria-label={`Company comparison for ${rangeLabel}`}>
        <TableHead>
          <TableRow>
            <TableCell>Company</TableCell>
            <TableCell align='right'>Revenue</TableCell>
            <TableCell>Share</TableCell>
            <TableCell align='right'>Orders</TableCell>
            <TableCell align='right'>Outstanding</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => {
            const o = r.period.receivablesFromPharmacy + r.period.distributorOwedToCompany
            return (
              <TableRow key={r.companyId} hover>
                <TableCell>
                  <Typography fontWeight={600}>{trunc(r.name, 28)}</Typography>
                  <Typography variant='caption' color='text.secondary' display='block'>
                    {r.city || '—'}
                  </Typography>
                  {r.isActive === false ? (
                    <Chip size='small' label='Inactive' variant='outlined' className='mbs-1' />
                  ) : null}
                </TableCell>
                <TableCell align='right'>{formatPKR(r.period.revenue)}</TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <LinearProgress
                    variant='determinate'
                    value={(r.period.revenue / maxRev) * 100}
                    aria-label={`Revenue share for ${r.name}`}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </TableCell>
                <TableCell align='right'>{r.period.orders}</TableCell>
                <TableCell align='right'>{formatPKR(o)}</TableCell>
                <TableCell>
                  <Tooltip
                    title={
                      r.health === 'warning'
                        ? 'Revenue dropped vs prior period or receivables look high vs period sales — review collections and pipeline.'
                        : 'Within expected range for this period.'
                    }
                  >
                    <Chip
                      size='small'
                      color={r.health === 'warning' ? 'warning' : 'success'}
                      variant='tonal'
                      label={r.health === 'warning' ? 'Review' : 'Healthy'}
                    />
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default PlatformCompareTable
