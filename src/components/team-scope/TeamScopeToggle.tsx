'use client'

import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import { useAuth } from '@/contexts/AuthContext'

export type TeamScope = 'self' | 'team'

type TeamScopeToggleProps = {
  value: TeamScope
  onChange: (next: TeamScope) => void
  size?: 'small' | 'medium'
  /** Override the default `team.viewAllReports` requirement. */
  requiredPermission?: string
  /** Hide the control entirely when the user lacks the perm (default true). */
  hideWhenUnauthorized?: boolean
}

/**
 * Toggle the `?scope=team` filter on list endpoints (Doctors, Weekly Plans, etc).
 *
 * Visible only to users with the team scoping permission (typically ASM/RM). For everyone
 * else the component renders nothing so existing list pages stay byte-identical.
 */
export const TeamScopeToggle = ({
  value,
  onChange,
  size = 'small',
  requiredPermission = 'team.viewAllReports',
  hideWhenUnauthorized = true
}: TeamScopeToggleProps) => {
  const { hasPermission } = useAuth()
  const allowed = hasPermission(requiredPermission) || hasPermission('admin.access')
  if (!allowed && hideWhenUnauthorized) return null

  return (
    <ToggleButtonGroup
      size={size}
      exclusive
      value={value}
      onChange={(_, next) => {
        if (next === null) return
        onChange(next as TeamScope)
      }}
      aria-label='Result scope'
      sx={{
        bgcolor: 'background.paper',
        '& .MuiToggleButton-root': {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 36,
          px: 2
        }
      }}
    >
      <Tooltip title='Only rows you own / created' arrow>
        <ToggleButton value='self'>Mine</ToggleButton>
      </Tooltip>
      <Tooltip title="Everyone reporting to you (and you)" arrow>
        <ToggleButton value='team'>My Team</ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  )
}

export default TeamScopeToggle
