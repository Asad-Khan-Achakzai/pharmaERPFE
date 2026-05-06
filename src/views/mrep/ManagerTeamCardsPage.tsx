'use client'

/**
 * Mobile-first manager view: team roster as tappable cards (Phase 4).
 * Opens Field performance filtered to the selected rep.
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Grid from '@mui/material/Grid'
import { useAuth } from '@/contexts/AuthContext'
import { usersService } from '@/services/users.service'
import { showApiError } from '@/utils/apiErrors'

type TeamUser = {
  _id: string
  name: string
  email: string
  isActive: boolean
  employeeCode?: string | null
  roleId?: { _id: string; name: string; code: string } | null
}

const ManagerTeamCardsPage = () => {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canSee = hasPermission('team.view')

  const [rows, setRows] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!canSee) return
    setLoading(true)
    try {
      const res = await usersService.team({ includeSelf: true })
      const body = res.data?.data || res.data
      setRows((body as { docs?: TeamUser[] })?.docs || [])
    } catch (e) {
      showApiError(e, 'Failed to load team')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [canSee])

  useEffect(() => {
    void load()
  }, [load])

  const openKpis = (id: string) => {
    router.push(`/dashboard/manager?repId=${encodeURIComponent(id)}`)
  }

  if (!canSee) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <Typography color='text.secondary'>You don&apos;t have access to the team roster.</Typography>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={4}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='My team'
            subheader='Tap a rep to open Field performance for that person. Optimised for narrow screens.'
          />
          <CardContent sx={{ pt: 0 }}>
            {loading ? (
              <Stack spacing={2}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant='rounded' height={96} />
                ))}
              </Stack>
            ) : rows.length === 0 ? (
              <Typography color='text.secondary'>No team members found.</Typography>
            ) : (
              <Stack spacing={2}>
                {rows.map(u => (
                  <Card key={u._id} variant='outlined' sx={{ borderRadius: 3 }}>
                    <CardContent sx={{ py: 2.5 }}>
                      <Stack direction='row' spacing={2} alignItems='flex-start'>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            bgcolor: 'action.selected',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            flexShrink: 0
                          }}
                        >
                          {u.name
                            .split(/\s+/)
                            .slice(0, 2)
                            .map(p => p[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700}>{u.name}</Typography>
                          <Typography variant='body2' color='text.secondary' noWrap>
                            {u.email}
                          </Typography>
                          <Stack direction='row' spacing={0.75} flexWrap='wrap' useFlexGap sx={{ mt: 1 }}>
                            {u.roleId?.name ? (
                              <Chip size='small' variant='outlined' label={u.roleId.name} />
                            ) : null}
                            {u.employeeCode ? (
                              <Chip size='small' variant='tonal' label={u.employeeCode} />
                            ) : null}
                            {!u.isActive ? <Chip size='small' color='warning' label='Inactive' /> : null}
                          </Stack>
                        </Box>
                        <Button
                          variant='contained'
                          size='medium'
                          onClick={() => openKpis(u._id)}
                          sx={{ flexShrink: 0, alignSelf: 'center' }}
                        >
                          KPIs
                        </Button>
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
}

export default ManagerTeamCardsPage
