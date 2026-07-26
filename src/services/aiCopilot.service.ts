import api from './api'

export type AiClientContext = {
  screen?: string
  selectedDoctorId?: string
  selectedPharmacyId?: string
  latitude?: number
  longitude?: number
}

export type AiChatMessage = {
  role: 'user' | 'assistant'
  content: string
  id?: string
}

export type AiStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'status'; message: string }
  | { type: 'tool_start'; tool: string; input?: unknown; label?: string }
  | { type: 'tool_end'; tool: string; summary?: string; label?: string }
  | { type: 'done'; conversationId: string; messageId?: string; content?: string }
  | { type: 'error'; message: string }

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export const aiCopilotService = {
  status: () => api.get('/ai/status'),
  suggestedPrompts: () => api.get<{ data: { prompts: string[] } }>('/ai/suggested-prompts'),
  createConversation: (title?: string) => api.post('/ai/conversations', { title }),
  listConversations: (params?: { page?: number; limit?: number }) => api.get('/ai/conversations', { params }),
  getConversation: (id: string) => api.get(`/ai/conversations/${id}`),
  deleteConversation: (id: string) => api.delete(`/ai/conversations/${id}`),
  chat: (body: { message: string; conversationId?: string; context?: AiClientContext }) =>
    api.post('/ai/chat', body),
  executeConfirmedTool: (body: {
    toolName: string
    parameters: Record<string, unknown>
    confirmed: true
    context?: AiClientContext
  }) => api.post('/ai/tools/execute-confirmed', body),

  async streamChat(
    body: { message: string; conversationId?: string; context?: AiClientContext },
    onEvent: (ev: AiStreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/ai/chat/stream`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      onEvent({ type: 'error', message: err.message || 'AI Copilot request failed.' })
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      onEvent({ type: 'error', message: 'Streaming not supported in this browser.' })
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const block of parts) {
        const lines = block.split('\n')
        let eventType = 'message'
        let dataLine = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim()
          else if (line.startsWith('data: ')) dataLine = line.slice(6)
        }
        if (!dataLine) continue
        try {
          const data = JSON.parse(dataLine)
          if (eventType === 'token') onEvent({ type: 'token', content: data.content || '' })
          else if (eventType === 'status') onEvent({ type: 'status', message: data.message || '' })
          else if (eventType === 'tool_start')
            onEvent({
              type: 'tool_start',
              tool: data.tool,
              input: data.input,
              label: data.label
            })
          else if (eventType === 'tool_end')
            onEvent({ type: 'tool_end', tool: data.tool, summary: data.summary, label: data.label })
          else if (eventType === 'done')
            onEvent({
              type: 'done',
              conversationId: data.conversationId,
              messageId: data.messageId,
              content: data.content
            })
          else if (eventType === 'error') onEvent({ type: 'error', message: data.message })
        } catch {
          /* ignore malformed SSE chunks */
        }
      }
    }
  }
}
