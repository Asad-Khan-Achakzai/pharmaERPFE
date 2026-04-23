import type { ReactNode } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

type MobileCardListItem = {
  id: string
  title: string
  subtitle?: string
  value?: string
  tone?: 'default' | 'primary' | 'success' | 'info' | 'warning' | 'error'
  /** Optional row action (e.g. admin “Set status” on attendance cards). */
  action?: ReactNode
}

type MobileCardListProps = {
  items: MobileCardListItem[]
  emptyText: string
}

const MobileCardList = ({ items, emptyText }: MobileCardListProps) => {
  if (items.length === 0) {
    return (
      <Typography variant='body2' color='text.secondary'>
        {emptyText}
      </Typography>
    )
  }

  return (
    <Stack spacing={1.5} sx={{ maxWidth: '100%' }}>
      {items.map(item => (
        <Card
          key={item.id}
          variant='outlined'
          sx={{
            borderColor: 'divider',
            boxShadow: 'none',
            borderRadius: 2
          }}
        >
          <CardContent
            sx={{
              p: 2.5,
              minHeight: 64,
              '&:last-of-type': { pb: 2.5 }
            }}
          >
            <Stack spacing={1.5}>
              <Stack direction='row' alignItems='center' justifyContent='space-between' spacing={2}>
                <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant='subtitle1' sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                    {item.title}
                  </Typography>
                  {item.subtitle ? (
                    <Typography variant='body2' color='text.secondary' sx={{ lineHeight: 1.4 }}>
                      {item.subtitle}
                    </Typography>
                  ) : null}
                </Stack>
                {item.value ? (
                  <Chip
                    label={item.value}
                    size='medium'
                    color={item.tone || 'default'}
                    variant='tonal'
                    sx={{ maxWidth: '45%', height: 'auto', py: 0.5, '& .MuiChip-label': { whiteSpace: 'normal' } }}
                  />
                ) : null}
              </Stack>
              {item.action ? (
                <Box sx={{ width: '100%' }} onClick={e => e.stopPropagation()}>
                  {item.action}
                </Box>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}

export default MobileCardList
