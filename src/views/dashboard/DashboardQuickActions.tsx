import Link from 'next/link'
import type { SxProps, Theme } from '@mui/material/styles'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import SectionHeader from './SectionHeader'

type QuickAction = {
  key: string
  label: string
  href: string
  icon: string
}

const DashboardQuickActions = ({
  actions,
  sx
}: {
  actions: QuickAction[]
  /** e.g. `{ order: { xs: 1, md: 0 } }` to pin quick actions first on mobile */
  sx?: SxProps<Theme>
}) => {
  if (actions.length === 0) return null

  return (
    <Grid size={{ xs: 12 }} sx={sx}>
      <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
        <CardContent
          sx={{
            p: { xs: 2.5, sm: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5
          }}
        >
          <SectionHeader title='Quick actions' subtitle='Shortcuts match your role and permissions.' />
          <Box
            component='ul'
            sx={{
              listStyle: 'none',
              p: 0,
              m: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
              columnGap: { xs: 1.5, sm: 2 },
              rowGap: { xs: 1.25, sm: 1.5 }
            }}
          >
            {actions.map(action => (
              <Box
                key={action.key}
                component='li'
                sx={{
                  minWidth: 0
                }}
              >
                <Box
                  component={Link}
                  href={action.href}
                  className='no-underline'
                  sx={theme => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    minHeight: 50,
                    px: 2,
                    py: 1.25,
                    borderRadius: 2.5,
                    border: '1px solid var(--mui-palette-divider)',
                    bgcolor: 'var(--mui-palette-action-hover)',
                    color: 'var(--mui-palette-text-primary)',
                    transition: theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
                      duration: theme.transitions.duration.shorter
                    }),
                    '&:hover': {
                      bgcolor: 'var(--mui-palette-action-selected)',
                      borderColor: theme.palette.primary.main,
                      boxShadow: 'var(--shadow-xs)'
                    }
                  })}
                >
                  <Box
                    className='flex size-9 shrink-0 items-center justify-center rounded-lg'
                    sx={{
                      bgcolor: 'var(--mui-palette-primary-lightOpacity)',
                      color: 'var(--mui-palette-primary-main)'
                    }}
                  >
                    <i className={`${action.icon} text-lg`} aria-hidden />
                  </Box>
                  <Typography
                    component='span'
                    variant='body2'
                    sx={{ fontWeight: 600, lineHeight: 1.3, minWidth: 0 }}
                    noWrap
                    title={action.label}
                  >
                    {action.label}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Grid>
  )
}

export type { QuickAction }
export default DashboardQuickActions
