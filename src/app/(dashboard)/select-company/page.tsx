'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import { useAuth } from '@/contexts/AuthContext'
import { showApiError } from '@/utils/apiErrors'

const Page = () => {
  const router = useRouter()
  const { user, switchCompanyContext, needsCompanySelection } = useAuth()

  const companies = useMemo(() => user?.allowedCompanies || [], [user?.allowedCompanies])

  useEffect(() => {
    if (user && !needsCompanySelection) {
      router.replace('/home')
    }
  }, [user, needsCompanySelection, router])

  const select = useCallback(
    async (id: string) => {
      try {
        await switchCompanyContext(id)
        router.replace('/home')
      } catch (e) {
        showApiError(e, 'Could not select company')
      }
    },
    [switchCompanyContext, router]
  )

  if (!companies.length) {
    return (
      <Card>
        <CardContent className='p-8 text-center'>
          <Typography variant='h6' className='mbe-2'>
            No company access
          </Typography>
          <Typography color='text.secondary'>Your account has no active company assignments. Contact an administrator.</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className='p-8'>
        <Typography variant='h5' className='mbe-4'>
          Select a company
        </Typography>
        <Typography color='text.secondary' className='mbe-6'>
          Choose which company you want to work in. You can switch later from the header.
        </Typography>
        <Grid container spacing={3}>
          {companies.map(c => (
            <Grid key={c._id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Button fullWidth variant='outlined' size='large' onClick={() => void select(c._id)} className='h-auto py-4 flex-col'>
                <span className='font-semibold'>{c.name}</span>
                {c.city ? <span className='text-xs text-textSecondary font-normal'>{c.city}</span> : null}
              </Button>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  )
}

export default Page
