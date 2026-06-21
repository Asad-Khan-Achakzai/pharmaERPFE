'use client'

// React Imports
import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// MUI Imports
import { styled } from '@mui/material/styles'
import Badge from '@mui/material/Badge'
import Avatar from '@mui/material/Avatar'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import MenuList from '@mui/material/MenuList'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { mediaService } from '@/services/media.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'

// Styled component for badge content
const BadgeContentSpan = styled('span')({
  width: 8,
  height: 8,
  borderRadius: '50%',
  cursor: 'pointer',
  backgroundColor: 'var(--mui-palette-success-main)',
  boxShadow: '0 0 0 2px var(--mui-palette-background-paper)'
})

const UserDropdown = () => {
  // States
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Refs
  const anchorRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Hooks
  const router = useRouter()

  const { settings } = useSettings()
  const { user, logout, refreshUser } = useAuth()
  const userName = user?.name || 'User'
  const userEmail = user?.email || 'No email'
  const avatarSrc = user?.imageUrl || '/images/avatars/1.png'

  const handlePhotoSelected = async (file: File) => {
    if (!user?._id) return
    setUploadingPhoto(true)
    try {
      const { assetId } = await mediaService.upload(file, 'USER_AVATAR')
      await mediaService.attach({ resource: 'users', id: user._id, assetId })
      await refreshUser()
      showSuccess('Profile photo updated')
    } catch (err) {
      showApiError(err, 'Could not update profile photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDropdownOpen = () => {
    !open ? setOpen(true) : setOpen(false)
  }

  const handleDropdownClose = (event?: MouseEvent<HTMLLIElement> | (MouseEvent | TouchEvent), url?: string) => {
    if (url) {
      router.push(url)
    }

    if (anchorRef.current && anchorRef.current.contains(event?.target as HTMLElement)) {
      return
    }

    setOpen(false)
  }

  const handleUserLogout = async () => {
    setLoggingOut(true)
    logout()
  }

  return (
    <>
      <input
        ref={photoInputRef}
        type='file'
        accept='image/png,image/jpeg,image/webp'
        hidden
        onChange={e => {
          const f = e.target.files?.[0]

          if (f) void handlePhotoSelected(f)
          e.target.value = ''
        }}
      />
      <Badge
        ref={anchorRef}
        overlap='circular'
        badgeContent={<BadgeContentSpan onClick={handleDropdownOpen} />}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        className='mis-2'
      >
        <Avatar
          ref={anchorRef}
          alt={userName}
          src={avatarSrc}
          onClick={handleDropdownOpen}
          className='cursor-pointer bs-[38px] is-[38px]'
        />
      </Badge>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        anchorEl={anchorRef.current}
        className='min-is-[240px] !mbs-3 z-[1]'
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{
              transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top'
            }}
          >
            <Paper className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}>
              <ClickAwayListener onClickAway={e => handleDropdownClose(e as MouseEvent | TouchEvent)}>
                <MenuList>
                  <div className='flex items-center plb-2 pli-6 gap-2' tabIndex={-1}>
                    <Avatar alt={userName} src={avatarSrc} />
                    <div className='flex items-start flex-col'>
                      <Typography className='font-medium' color='text.primary'>
                        {userName}
                      </Typography>
                      <Typography variant='caption'>{userEmail}</Typography>
                    </div>
                  </div>
                  <Divider className='mlb-1' />
                  <MenuItem
                    className='mli-2 gap-3'
                    disabled={uploadingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {uploadingPhoto ? <CircularProgress size={16} /> : <i className='tabler-camera' />}
                    <Typography color='text.primary'>
                      {uploadingPhoto ? 'Uploading…' : 'Change photo'}
                    </Typography>
                  </MenuItem>
                  {/* <MenuItem className='mli-2 gap-3' onClick={e => handleDropdownClose(e)}>
                    <i className='tabler-user' />
                    <Typography color='text.primary'>My Profile</Typography>
                  </MenuItem>
                  <MenuItem className='mli-2 gap-3' onClick={e => handleDropdownClose(e)}>
                    <i className='tabler-settings' />
                    <Typography color='text.primary'>Settings</Typography>
                  </MenuItem>
                  <MenuItem className='mli-2 gap-3' onClick={e => handleDropdownClose(e)}>
                    <i className='tabler-currency-dollar' />
                    <Typography color='text.primary'>Pricing</Typography>
                  </MenuItem>
                  <MenuItem className='mli-2 gap-3' onClick={e => handleDropdownClose(e)}>
                    <i className='tabler-help-circle' />
                    <Typography color='text.primary'>FAQ</Typography>
                  </MenuItem> */}
                  <div className='flex items-center plb-2 pli-3'>
                    <Button
                      fullWidth
                      variant='contained'
                      color='error'
                      size='small'
                      disabled={loggingOut}
                      endIcon={loggingOut ? <CircularProgress size={14} color='inherit' /> : <i className='tabler-logout' />}
                      onClick={handleUserLogout}
                      sx={{ '& .MuiButton-endIcon': { marginInlineStart: 1.5 } }}
                    >
                      {loggingOut ? 'Logging out...' : 'Logout'}
                    </Button>
                  </div>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default UserDropdown
