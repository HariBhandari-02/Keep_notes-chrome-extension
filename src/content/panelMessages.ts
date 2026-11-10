export const PANEL_MESSAGE_TYPES = ['PING', 'OPEN_PANEL', 'TOGGLE_PANEL'] as const

export type PanelMessageType = (typeof PANEL_MESSAGE_TYPES)[number]

export interface PanelMessage {
  type: PanelMessageType
}

export interface PanelErrorMessage {
  ok: false
  error: 'invalid_message' | 'unauthorized'
}

const MAX_MESSAGE_TYPE_LENGTH = 64
const ALLOWED_TYPES = new Set<string>(PANEL_MESSAGE_TYPES)

export function parsePanelMessage(value: unknown): PanelMessage | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    const keys = Object.keys(record)
    if (keys.length !== 1 || keys[0] !== 'type') return null
    const type = record.type
    if (typeof type !== 'string' || type.length > MAX_MESSAGE_TYPE_LENGTH) return null
    if (!ALLOWED_TYPES.has(type)) return null
    return { type: type as PanelMessageType }
  } catch {
    return null
  }
}

interface RuntimeSender {
  id?: unknown
  tab?: unknown
  url?: unknown
}

export function isTrustedPanelSender(sender: unknown, runtimeId: string | undefined): boolean {
  if (typeof runtimeId !== 'string' || runtimeId.length === 0) return false
  if (!sender || typeof sender !== 'object') return false

  const candidate = sender as RuntimeSender
  if (candidate.id !== runtimeId) return false
  if (candidate.tab !== undefined) return false
  if (
    typeof candidate.url === 'string' &&
    !candidate.url.startsWith(`chrome-extension://${runtimeId}/`)
  ) {
    return false
  }
  return true
}
