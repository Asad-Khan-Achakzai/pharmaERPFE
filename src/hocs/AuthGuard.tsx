'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import { useAuth } from '@/contexts/AuthContext'
import type { User } from '@/contexts/AuthContext'
import { getRequiredPermission } from '@/configs/routePermissions'

/**
 * `platform.*` routes must not use `hasPermission` alone — `admin.access` would let company tenant admins through.
 * Allow: SUPER_ADMIN, `userType === 'PLATFORM'`, or the literal permission on the JWT.
 */
function userCanAccessRequiredPermission(
  user: User,
  requiredPermission: string,
  hasPermission: (p: string) => boolean
): boolean {
  if (user.role === 'SUPER_ADMIN') return true
  if (requiredPermission.startsWith('platform.')) {
    if (user.userType === 'PLATFORM') return true
    return (user.permissions || []).includes(requiredPermission)
  }
  if (requiredPermission === 'attendance.view') {
    return (
      hasPermission('attendance.view') ||
      hasPermission('attendance.viewTeam') ||
      hasPermission('attendance.mark') ||
      hasPermission('attendance.request.create') ||
      hasPermission('attendance.governance.view') ||
      hasPermission('attendance.viewEscalations') ||
      hasPermission('attendance.matrix.manage') ||
      hasPermission('attendance.approve') ||
      hasPermission('attendance.approve.direct') ||
      hasPermission('attendance.approve.escalated')
    )
  }
  if (requiredPermission === 'attendance.sub.admin') {
    return (
      hasPermission('admin.access') ||
      hasPermission('attendance.governance.view') ||
      hasPermission('attendance.matrix.manage')
    )
  }
  if (requiredPermission === 'attendance.sub.team') {
    return (
      hasPermission('admin.access') ||
      hasPermission('attendance.viewCompany') ||
      hasPermission('attendance.viewTeam') ||
      hasPermission('attendance.viewEscalations') ||
      hasPermission('attendance.approve') ||
      hasPermission('attendance.approve.direct') ||
      hasPermission('attendance.approve.escalated')
    )
  }
  return hasPermission(requiredPermission)
}

const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { user, loading, hasPermission, needsCompanySelection } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)

  useEffect(() => {
    if (!loading && !user && !redirected.current) {
      redirected.current = true
      router.replace('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && user && needsCompanySelection && pathname) {
      if (
        pathname.startsWith('/select-company') ||
        pathname.startsWith('/platform') ||
        pathname.startsWith('/super-admin')
      )
        return
      router.replace('/select-company')
    }
  }, [loading, user, needsCompanySelection, pathname, router])

  useEffect(() => {
    if (user) {
      redirected.current = false
    }
  }, [user])

  if (loading) {
    return (
      <div className='flex items-center justify-center min-bs-screen'>
        <div className='text-center'>
          <i className='tabler-loader-2 animate-spin text-4xl text-primary' />
        </div>
      </div>
    )
  }

  if (!user) return null

  if (pathname.startsWith('/super-admin')) {
    const isPlatformUsersOnly =
      pathname === '/super-admin/platform-users' || pathname.startsWith('/super-admin/platform-users/')
    if (user.role === 'SUPER_ADMIN') {
      return <>{children}</>
    }
    if (
      isPlatformUsersOnly &&
      (user.permissions || []).includes('platform.companies.manage')
    ) {
      return <>{children}</>
    }
    return (
      <div className='flex items-center justify-center min-bs-screen'>
        <Card className='max-is-md'>
          <CardContent className='flex flex-col items-center gap-4 p-8 text-center'>
            <i className='tabler-lock text-5xl text-error' />
            <Typography variant='h5'>Access Denied</Typography>
            <Typography color='text.secondary'>Super Admin area is restricted to platform administrators.</Typography>
            <Button variant='contained' onClick={() => router.replace('/home')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const requiredPermission = getRequiredPermission(pathname)

  if (requiredPermission && !userCanAccessRequiredPermission(user, requiredPermission, hasPermission)) {
    return (
      <div className='flex items-center justify-center min-bs-screen'>
        <Card className='max-is-md'>
          <CardContent className='flex flex-col items-center gap-4 p-8 text-center'>
            <i className='tabler-lock text-5xl text-error' />
            <Typography variant='h5'>Access Denied</Typography>
            <Typography color='text.secondary'>
              You don&apos;t have permission to access this page.
            </Typography>
            <Button variant='contained' onClick={() => router.replace('/home')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

export default AuthGuard
