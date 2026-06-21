'use client'

import { useRef, useState } from 'react'

import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

import { mediaService, type MediaKind } from '@/services/media.service'

interface MediaUploadProps {
  /** Media kind controls retention + storage key prefix on the backend. */
  kind: MediaKind
  /** Currently saved image URL (short-lived signed URL from the entity read). */
  value?: string | null
  /** Called with the finalized assetId once upload + finalize succeed. */
  onUploaded: (assetId: string) => void
  label?: string
  /** Accept attribute for the file input. Defaults to images. */
  accept?: string
  /** Max file size in bytes. Defaults to 5 MB (matches backend MEDIA_MAX_FILE_SIZE). */
  maxSize?: number
  /** Render as a circular avatar (profile images) instead of a square preview. */
  rounded?: boolean
  size?: number
  disabled?: boolean
}

const DEFAULT_MAX = 5 * 1024 * 1024

/** Human-readable type list from an accept string, e.g. "JPG, PNG, WEBP". */
function describeAccept(accept: string): string {
  const exts = accept
    .split(',')
    .map(a => a.trim())
    .map(a => (a.includes('/') ? a.split('/')[1] : a.replace(/^\./, '')))
    .filter(Boolean)
    .map(e => (e === 'jpeg' ? 'jpg' : e).toUpperCase())
  return Array.from(new Set(exts)).join(', ')
}

export default function MediaUpload({
  kind,
  value,
  onUploaded,
  label = 'Upload image',
  accept = 'image/png,image/jpeg,image/webp',
  maxSize = DEFAULT_MAX,
  rounded = false,
  size = 96,
  disabled = false
}: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const shown = preview || value || null
  const maxMb = (maxSize / 1024 / 1024).toFixed(maxSize % (1024 * 1024) === 0 ? 0 : 1)
  const typesLabel = describeAccept(accept)
  const acceptedTypes = accept
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(Boolean)

  async function handleFile(file: File) {
    setError(null)
    if (acceptedTypes.length && file.type && !acceptedTypes.includes(file.type.toLowerCase())) {
      setError(`Unsupported file type. Allowed: ${typesLabel}.`)
      return
    }
    if (file.size > maxSize) {
      setError(`File too large (max ${maxMb} MB).`)
      return
    }
    setBusy(true)
    try {
      const localPreview = URL.createObjectURL(file)
      setPreview(localPreview)
      const { assetId } = await mediaService.upload(file, kind)
      onUploaded(assetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {rounded ? (
          <Avatar src={shown || undefined} sx={{ width: size, height: size }} />
        ) : (
          <Box
            sx={{
              width: size,
              height: size,
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              bgcolor: 'action.hover'
            }}
          >
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Typography variant="caption" color="text.secondary">
                No image
              </Typography>
            )}
          </Box>
        )}
        <Box>
          <Button
            variant="outlined"
            size="small"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            startIcon={busy ? <CircularProgress size={16} /> : undefined}
          >
            {busy ? 'Uploading…' : label}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {typesLabel} · up to {maxMb} MB
          </Typography>
          {error ? (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {error}
            </Typography>
          ) : null}
        </Box>
      </Box>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={e => {
          const f = e.target.files?.[0]

          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />
    </Box>
  )
}
