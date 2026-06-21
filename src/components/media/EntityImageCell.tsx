'use client'

import { useState } from 'react'

import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'

function initials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)

  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

interface EntityImageCellProps {
  /** Short-lived signed image URL from the entity read (null when none). */
  url?: string | null
  /** Used for initials fallback and the preview dialog title. */
  name?: string
  /** Circular (people) vs rounded square (products). Defaults to circular. */
  rounded?: boolean
  size?: number
}

/**
 * Reusable list thumbnail that opens a click-to-enlarge preview. When there is
 * no image it renders initials and is not clickable. Manages its own dialog so
 * list pages only need to drop it into a column cell.
 */
export default function EntityImageCell({ url, name, rounded = true, size = 36 }: EntityImageCellProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Avatar
        src={url || undefined}
        variant={rounded ? 'circular' : 'rounded'}
        onClick={url ? () => setOpen(true) : undefined}
        sx={{
          width: size,
          height: size,
          fontSize: size / 2.6,
          cursor: url ? 'pointer' : 'default'
        }}
      >
        {initials(name)}
      </Avatar>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {name || 'Image'}
          <IconButton aria-label='close' size='small' onClick={() => setOpen(false)}>
            <i className='tabler-x' />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {url ? (
            <Box
              component='img'
              src={url}
              alt={name || 'image'}
              sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 1 }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
