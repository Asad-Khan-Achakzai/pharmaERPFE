'use client'

import { memo } from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import MobileCardList from './MobileCardList'
import SectionHeader from './SectionHeader'

const formatPKR = (v: number) => `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const DashboardSupplierSection = memo(function DashboardSupplierSection({
  canViewSuppliers,
  supplierPaymentsLoading,
  recentSupplierPayments,
  supplierPayablesLoading,
  topSuppliersPayable,
  nonCriticalReady,
  ordersByStatus,
  embedded = false
}: {
  canViewSuppliers: boolean
  supplierPaymentsLoading: boolean
  recentSupplierPayments: any[]
  supplierPayablesLoading: boolean
  topSuppliersPayable: any[]
  nonCriticalReady: boolean
  ordersByStatus?: Record<string, number>
  embedded?: boolean
}) {
  if (!canViewSuppliers || !nonCriticalReady) return null
  const content = (
    <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Card variant='outlined' sx={{ borderRadius: 3, boxShadow: 'var(--shadow-xs)' }}>
            <CardContent>
              <SectionHeader title='Operational snapshot' subtitle='Order status mix from current dashboard data.' />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(ordersByStatus || {}).map(([status, count]) => (
                  <Chip key={status} variant='tonal' color='default' label={`${status}: ${count}`} />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card variant='outlined' sx={{ borderRadius: 3, boxShadow: 'var(--shadow-xs)' }}>
            <CardHeader title='Recent supplier payments' subheader='Primary operational table' />
            <CardContent>
              {supplierPaymentsLoading ? (
                <Skeleton variant='rounded' width='100%' height={120} animation='wave' />
              ) : recentSupplierPayments.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  No supplier payments yet.
                </Typography>
              ) : (
                <>
                  <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                    <TableContainer component={Paper} variant='outlined'>
                      <Table size='small'>
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Supplier</TableCell>
                            <TableCell align='right'>Amount</TableCell>
                            <TableCell>Method</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {recentSupplierPayments.map((row: any) => {
                            const sid = row.supplierId
                            const sname =
                              typeof sid === 'object' && sid?.name ? sid.name : 'Supplier'
                            const href =
                              typeof sid === 'object' && sid?._id ? `/suppliers/${sid._id}` : '#'
                            return (
                              <TableRow key={String(row._id)}>
                                <TableCell>
                                  {row.date ? new Date(row.date).toLocaleDateString('en-GB') : '—'}
                                </TableCell>
                                <TableCell>
                                  {href !== '#' ? (
                                    <Link href={href} className='text-primary'>
                                      {sname}
                                    </Link>
                                  ) : (
                                    sname
                                  )}
                                </TableCell>
                                <TableCell align='right'>{formatPKR(row.amount)}</TableCell>
                                <TableCell>{row.paymentMethod || '—'}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                  <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    <MobileCardList
                      items={recentSupplierPayments.map((row: any) => {
                        const sid = row.supplierId
                        const sname = typeof sid === 'object' && sid?.name ? sid.name : 'Supplier'
                        return {
                          id: String(row._id),
                          title: sname,
                          subtitle: `${row.date ? new Date(row.date).toLocaleDateString('en-GB') : '—'} · ${row.paymentMethod || '—'}`,
                          value: formatPKR(row.amount),
                          tone: 'primary'
                        }
                      })}
                      emptyText='No supplier payments yet.'
                    />
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card variant='outlined' sx={{ borderRadius: 3, boxShadow: 'var(--shadow-xs)' }}>
            <CardHeader title='Top suppliers by payable' subheader='Compact list' />
            <CardContent>
              {supplierPayablesLoading ? (
                <Skeleton variant='rounded' width='100%' height={120} animation='wave' />
              ) : topSuppliersPayable.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  No supplier balances loaded.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {topSuppliersPayable.map((row: any) => (
                    <Card key={String(row.supplierId)} variant='outlined' sx={{ borderRadius: 2.5 }}>
                      <CardContent sx={{ p: 1.5 }}>
                        <Stack direction='row' alignItems='center' justifyContent='space-between' spacing={1.5}>
                          <Typography variant='body2' sx={{ fontWeight: 600 }}>
                            <Link href={`/suppliers/${row.supplierId}`} className='text-primary'>
                              {row.name}
                            </Link>
                          </Typography>
                          <Chip size='small' label={formatPKR(row.payable)} color='warning' variant='tonal' />
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
  )
  if (embedded) return content
  return <Grid size={{ xs: 12 }}>{content}</Grid>
})

export default DashboardSupplierSection
