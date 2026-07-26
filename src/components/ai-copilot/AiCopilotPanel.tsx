'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import { usePathname } from 'next/navigation'
import { aiCopilotService, type AiChatMessage } from '@/services/aiCopilot.service'

type Props = {
  onClose?: () => void
  fullPage?: boolean
}

type UiMessage = AiChatMessage & {
  streaming?: boolean
  status?: string
}

const markdownSx = {
  fontSize: '0.875rem',
  lineHeight: 1.6,
  color: 'text.primary',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
  '& p': { my: 0.75, color: 'text.primary', '&:first-of-type': { mt: 0 }, '&:last-of-type': { mb: 0 } },
  '& ul, & ol': { pl: 2.5, my: 0.75, color: 'text.primary' },
  '& li': { mb: 0.35, color: 'text.primary' },
  '& strong': { fontWeight: 600, color: 'text.primary' },
  '& h1, & h2, & h3, & h4': { fontWeight: 600, mt: 1, mb: 0.5, color: 'text.primary' },
  '& code': {
    fontFamily: 'monospace',
    fontSize: '0.8125rem',
    bgcolor: 'action.hover',
    px: 0.5,
    borderRadius: 0.5
  },
  '& pre': {
    overflow: 'auto',
    bgcolor: 'action.hover',
    p: 1,
    borderRadius: 1,
    my: 0.75
  }
} as const

function AssistantMarkdown({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <Box className='ai-markdown' sx={markdownSx}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '…'}</ReactMarkdown>
      {streaming ? (
        <Box
          component='span'
          sx={{
            display: 'inline-block',
            opacity: 0.6,
            '@keyframes blink': { '50%': { opacity: 0 } },
            animation: 'blink 1s step-end infinite'
          }}
        >
          ▍
        </Box>
      ) : null}
    </Box>
  )
}

export default function AiCopilotPanel({ onClose, fullPage = false }: Props) {
  const pathname = usePathname()
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [streaming, setStreaming] = useState(false)
  const [statusLine, setStatusLine] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastUserMessage, setLastUserMessage] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    aiCopilotService
      .suggestedPrompts()
      .then(res => setPrompts(res.data.data?.prompts || []))
      .catch(() => setPrompts([]))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusLine])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    setStatusLine(null)
    setMessages(prev => {
      const copy = [...prev]
      const last = copy[copy.length - 1]
      if (last?.role === 'assistant' && last.streaming) {
        copy[copy.length - 1] = {
          ...last,
          streaming: false,
          content: last.content || 'Generation stopped.'
        }
      }
      return copy
    })
  }, [])

  const sendMessage = useCallback(
    async (text: string, isRetry = false) => {
      const trimmed = text.trim()
      if (!trimmed || streaming) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setError(null)
      setStatusLine('Thinking…')
      if (!isRetry) {
        setMessages(prev => [...prev, { role: 'user', content: trimmed }])
        setLastUserMessage(trimmed)
      }
      setInput('')
      setStreaming(true)

      let assistantText = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

      try {
        await aiCopilotService.streamChat(
          {
            message: trimmed,
            conversationId,
            context: { screen: pathname || undefined }
          },
          ev => {
            if (ev.type === 'status') {
              setStatusLine(ev.message || null)
              if (ev.message === 'Preparing your answer…') {
                assistantText = ''
                setMessages(prev => {
                  const copy = [...prev]
                  copy[copy.length - 1] = { role: 'assistant', content: '', streaming: true }
                  return copy
                })
              }
            } else if (ev.type === 'tool_start') {
              setStatusLine(ev.label || 'Fetching live ERP data…')
              assistantText = ''
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content: '', streaming: true }
                return copy
              })
            } else if (ev.type === 'token') {
              setStatusLine(null)
              assistantText += ev.content
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: assistantText,
                  streaming: true
                }
                return copy
              })
            } else if (ev.type === 'done') {
              setStatusLine(null)
              if (ev.conversationId) setConversationId(ev.conversationId)
              if (ev.content) assistantText = ev.content
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: assistantText,
                  streaming: false
                }
                return copy
              })
            } else if (ev.type === 'error') {
              setError(ev.message)
              setStatusLine(null)
            }
          },
          controller.signal
        )
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        const msg = e instanceof Error ? e.message : 'AI Copilot is temporarily unavailable.'
        setError(msg)
        setStatusLine(null)
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: msg, streaming: false }
          return copy
        })
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setStreaming(false)
        setStatusLine(null)
        setMessages(prev => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant' && last.streaming) {
            copy[copy.length - 1] = { ...last, streaming: false }
          }
          return copy
        })
      }
    },
    [conversationId, pathname, streaming]
  )

  const handleClear = () => {
    abortRef.current?.abort()
    setMessages([])
    setConversationId(undefined)
    setError(null)
    setStatusLine(null)
  }

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text)
  }

  return (
    <Paper
      elevation={fullPage ? 0 : 8}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: fullPage ? 'calc(100vh - 8rem)' : 'min(640px, 80vh)',
        width: fullPage ? '100%' : { xs: '100vw', sm: 420 },
        maxWidth: '100%',
        borderRadius: fullPage ? 2 : 3,
        overflow: 'hidden'
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '& .MuiTypography-root': { color: 'inherit' }
        }}
      >
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='inherit'>
            AI Copilot
          </Typography>
          <Typography variant='caption' color='inherit' sx={{ opacity: 0.85, display: 'block' }}>
            PharmaERP intelligence assistant
          </Typography>
        </Box>
        <Box>
          <Tooltip title='Clear conversation'>
            <IconButton size='small' color='inherit' onClick={handleClear} disabled={streaming}>
              <i className='tabler-trash' />
            </IconButton>
          </Tooltip>
          {onClose && (
            <IconButton size='small' color='inherit' onClick={onClose}>
              <i className='tabler-x' />
            </IconButton>
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'background.default' }}>
        {messages.length === 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant='body2' color='text.secondary' gutterBottom>
              Ask about visits, sales, attendance, inventory, or team performance. I use live ERP data — I
              never invent records.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
              {prompts.map(p => (
                <Chip
                  key={p}
                  label={p}
                  size='small'
                  clickable
                  onClick={() => sendMessage(p)}
                  disabled={streaming}
                />
              ))}
            </Box>
          </Box>
        )}

        {messages.map((m, idx) => {
          if (m.role === 'assistant' && m.streaming && !m.content) return null

          return (
            <Box
              key={idx}
              sx={{
                mb: 2,
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                width: '100%',
                minWidth: 0
              }}
            >
              <Paper
                sx={{
                  p: 1.5,
                  maxWidth: '90%',
                  width: 'fit-content',
                  minWidth: 0,
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  bgcolor: m.role === 'user' ? 'primary.light' : 'background.paper',
                  color: m.role === 'user' ? 'primary.contrastText' : 'text.primary'
                }}
              >
                {m.role === 'assistant' ? (
                  <AssistantMarkdown content={m.content} streaming={m.streaming} />
                ) : (
                  <Typography
                    variant='body2'
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                  >
                    {m.content}
                  </Typography>
                )}
                {m.role === 'assistant' && m.content && !m.streaming && (
                  <Tooltip title='Copy'>
                    <IconButton size='small' onClick={() => handleCopy(m.content)} sx={{ mt: 0.5 }}>
                      <i className='tabler-copy' style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Paper>
            </Box>
          )
        })}

        {streaming && statusLine && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 1.5,
              px: 1.5,
              py: 1,
              borderRadius: 2,
              bgcolor: 'action.hover',
              width: 'fit-content',
              maxWidth: '90%'
            }}
          >
            <CircularProgress size={16} />
            <Typography variant='caption' color='text.secondary'>
              {statusLine}
            </Typography>
          </Box>
        )}

        <div ref={bottomRef} />
      </Box>

      {error && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant='caption' color='error'>
            {error}
          </Typography>
          {lastUserMessage && (
            <Button size='small' onClick={() => sendMessage(lastUserMessage, true)} disabled={streaming}>
              Retry
            </Button>
          )}
        </Box>
      )}

      <Divider />
      <Box sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size='small'
          placeholder='Ask PharmaERP Copilot…'
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage(input)
            }
          }}
          disabled={streaming}
        />
        {streaming ? (
          <IconButton color='error' onClick={stopStreaming} aria-label='Stop generation'>
            <i className='tabler-player-stop' />
          </IconButton>
        ) : (
          <IconButton color='primary' onClick={() => sendMessage(input)} disabled={!input.trim()}>
            <i className='tabler-send' />
          </IconButton>
        )}
      </Box>
    </Paper>
  )
}
