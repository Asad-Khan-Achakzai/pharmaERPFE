'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CircularProgress from '@mui/material/CircularProgress'
import CustomTextField from '@core/components/mui/TextField'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { announcementsService, type Announcement } from '@/services/announcements.service'
import { normalizeDocs } from '@/utils/apiList'
import tableStyles from '@core/styles/table.module.css'

const AnnouncementsPage = () => {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('admin.access')
  const [rows, setRows] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [publishNow, setPublishNow] = useState(true)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const fetchSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const res = canManage
        ? await announcementsService.adminList({ limit: 50 })
        : await announcementsService.feed({ limit: 50 })
      if (seq !== fetchSeq.current) return
      setRows(normalizeDocs<Announcement>(res.data))
    } catch (err) {
      showApiError(err)
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setTitle('')
    setBody('')
    setPublishNow(true)
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await announcementsService.create({
        title: title.trim(),
        body: body.trim() || '(No details)',
        publish: publishNow
      })
      showSuccess(publishNow ? 'Announcement published' : 'Announcement saved as draft')
      setOpen(false)
      resetForm()
      await load()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (id: string) => {
    setPublishingId(id)
    try {
      await announcementsService.publish(id)
      showSuccess('Announcement published — team will be notified')
      await load()
    } catch (err) {
      showApiError(err)
    } finally {
      setPublishingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Announcements'
          subheader='Publish company-wide messages to mobile and in-app notification feeds'
          action={
            canManage ? (
              <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setOpen(true)}>
                New announcement
              </Button>
            ) : null
          }
        />
        {loading ? (
          <div className='flex justify-center p-8'>
            <CircularProgress size={32} />
          </div>
        ) : rows.length === 0 ? (
          <Typography className='p-6' color='text.secondary'>
            No announcements yet.
          </Typography>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row._id}>
                    <td>
                      <Typography fontWeight={600}>{row.title}</Typography>
                      {row.body ? (
                        <Typography variant='body2' color='text.secondary' className='line-clamp-2'>
                          {row.body}
                        </Typography>
                      ) : null}
                    </td>
                    <td>
                      <Chip
                        size='small'
                        label={row.publishedAt ? 'Published' : 'Draft'}
                        color={row.publishedAt ? 'success' : 'warning'}
                        variant='tonal'
                      />
                    </td>
                    <td>
                      {row.publishedAt ? new Date(row.publishedAt).toLocaleString() : '—'}
                    </td>
                    <td>
                      {canManage && !row.publishedAt ? (
                        <Button
                          size='small'
                          variant='outlined'
                          disabled={publishingId === row._id}
                          onClick={() => void handlePublish(row._id)}
                        >
                          {publishingId === row._id ? 'Publishing…' : 'Publish'}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth='sm'>
        <DialogTitle>New announcement</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pt-2'>
          <CustomTextField
            label='Title'
            fullWidth
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          <CustomTextField
            label='Body'
            fullWidth
            multiline
            minRows={4}
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <FormControlLabel
            control={<Switch checked={publishNow} onChange={(_, v) => setPublishNow(v)} />}
            label='Publish immediately (sends notifications to all active users)'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={() => void handleCreate()} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : publishNow ? 'Publish' : 'Save draft'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default AnnouncementsPage
