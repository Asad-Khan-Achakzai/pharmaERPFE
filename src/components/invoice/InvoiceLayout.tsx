'use client'

import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha, useTheme } from '@mui/material/styles'

type InvoiceLayoutProps = {
  children: ReactNode
}

type InvoiceHeaderProps = {
  title: string
  documentId: string
  issuedDate?: string
  dueDate?: string
  left: ReactNode
  rightContent?: ReactNode
}

type InvoicePartiesProps = {
  companyTitle?: string
  customerTitle?: string
  companyContent: ReactNode
  customerContent: ReactNode
}

type InvoiceFinancialSummaryProps = {
  grossSalesTp: string
  pharmacyDiscount: string
  netSalesCustomer: string
  distributorCommission: string
  netSalesCompany: string
}

type InvoiceItemsTableProps = {
  columns: string[]
  rows: Array<Array<ReactNode>>
}

type InvoiceTotalsProps = {
  rows: Array<{ label: string; value: ReactNode }>
  highlightLabel?: string
}

type InvoiceFooterProps = {
  children: ReactNode
}

export const InvoiceLayout = ({ children }: InvoiceLayoutProps) => (
  <Card elevation={0} variant='outlined'>
    <CardContent sx={{ p: { xs: 3, sm: 6 } }}>
      <Stack spacing={4}>{children}</Stack>
    </CardContent>
  </Card>
)

export const InvoiceHeader = ({ title, documentId, issuedDate, dueDate, left, rightContent }: InvoiceHeaderProps) => (
  <Paper variant='outlined' sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2.5, borderColor: 'divider' }}>
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 4 }}>
      <Box>{left}</Box>
      {rightContent ?? (
        <Stack spacing={1.5} sx={{ minWidth: { sm: 240 } }}>
          <Typography variant='h6'>{title}</Typography>
          <Typography variant='body2' color='text.secondary'>
            #{documentId}
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant='body2'>Issued: {issuedDate ?? '-'}</Typography>
            <Typography variant='body2'>Due: {dueDate ?? '-'}</Typography>
          </Stack>
        </Stack>
      )}
    </Box>
  </Paper>
)

export const InvoiceParties = ({
  companyTitle = 'From',
  customerTitle = 'Bill To',
  companyContent,
  customerContent
}: InvoicePartiesProps) => (
  <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
    <Stack spacing={1.5}>
      <Typography variant='subtitle2' color='text.secondary'>
        {companyTitle}
      </Typography>
      {companyContent}
    </Stack>
    <Stack spacing={1.5}>
      <Typography variant='subtitle2' color='text.secondary'>
        {customerTitle}
      </Typography>
      {customerContent}
    </Stack>
  </Box>
)

export const InvoiceFinancialSummary = ({
  grossSalesTp,
  pharmacyDiscount,
  netSalesCustomer,
  distributorCommission,
  netSalesCompany
}: InvoiceFinancialSummaryProps) => {
  const rows = [
    { label: 'Gross Sales (TP)', value: grossSalesTp },
    { label: 'Pharmacy Discount', value: pharmacyDiscount },
    { label: 'Net Sales (Customer)', value: netSalesCustomer },
    { label: 'Distributor Commission', value: distributorCommission },
    { label: 'Net Sales (Company)', value: netSalesCompany, highlight: true }
  ]

  return (
    <Paper variant='outlined' sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2.5, borderColor: 'divider' }}>
      <Stack spacing={1.25}>
        <Typography variant='subtitle1'>Financial Summary</Typography>
        {rows.map(row => (
          <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3 }}>
            <Typography
              variant='body2'
              color={row.highlight ? 'text.primary' : 'text.secondary'}
              sx={{ fontWeight: row.highlight ? 700 : 500 }}
            >
              {row.label}
            </Typography>
            <Typography variant='body2' sx={{ textAlign: 'right', fontWeight: row.highlight ? 800 : 600 }}>
              {row.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  )
}

export const InvoiceItemsTable = ({ columns, rows }: InvoiceItemsTableProps) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (isMobile) {
    return (
      <Stack spacing={2}>
        {rows.map((row, idx) => (
          <Paper key={idx} variant='outlined' sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider' }}>
            <Stack spacing={1.2}>
              {columns.map((col, i) => (
                <Box key={col} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {col}
                  </Typography>
                  <Typography variant='body2' sx={{ textAlign: 'right' }}>
                    {row[i]}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        ))}
      </Stack>
    )
  }

  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: theme => `1px solid ${theme.palette.divider}` }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
          px: 3,
          py: 1.5,
          bgcolor: t => alpha(t.palette.text.primary, 0.02)
        }}
      >
        {columns.map(col => (
          <Typography key={col} variant='caption' color='text.secondary'>
            {col}
          </Typography>
        ))}
      </Box>
      <Divider />
      {rows.map((row, idx) => (
        <Box key={idx}>
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, px: 3, py: 1.75 }}>
            {row.map((cell, i) => (
              <Typography key={`${idx}-${i}`} variant='body2' sx={{ textAlign: i >= columns.length - 2 ? 'right' : 'left' }}>
                {cell}
              </Typography>
            ))}
          </Box>
          {idx < rows.length - 1 && <Divider />}
        </Box>
      ))}
    </Box>
  )
}

export const InvoiceTotals = ({ rows, highlightLabel }: InvoiceTotalsProps) => (
  <Box sx={{ ml: 'auto', width: { xs: '100%', sm: 360 } }}>
    <Stack spacing={1.1}>
      {rows.map(row => {
        const highlight = highlightLabel === row.label

        return (
          <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant='body2' sx={{ color: highlight ? 'text.primary' : 'text.secondary', fontWeight: highlight ? 700 : 500 }}>
              {row.label}
            </Typography>
            <Typography variant='body2' sx={{ textAlign: 'right', fontWeight: highlight ? 800 : 600 }}>
              {row.value}
            </Typography>
          </Box>
        )
      })}
    </Stack>
  </Box>
)

export const InvoiceFooter = ({ children }: InvoiceFooterProps) => (
  <Box>
    <Divider sx={{ mb: 2 }} />
    <Box sx={{ color: 'text.secondary' }}>{children}</Box>
  </Box>
)
