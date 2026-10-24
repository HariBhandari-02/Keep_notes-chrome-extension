import { createRoot } from 'react-dom/client'
import App from '../App'
import styles from '../styles/globals.css?inline'
import { MAX_PAGE_SELECTION_LENGTH } from '../utils/noteLimits'
import { panelBus } from './panelBus'
import { isTrustedPanelSender, parsePanelMessage } from './panelMessages'

const ROOT_ID = 'keep-notes-extension-root'
const CONTENT_FLAG = '__keepNotesContentLoaded'
const MAX_Z_INDEX = '2147483647'
const HOST_STYLE = [
  'all: initial !important',
  'position: fixed !important',
  'inset: 0 !important',
  'display: block !important',
  `z-index: ${MAX_Z_INDEX} !important`,
  'pointer-events: none !important',
  'visibility: visible !important',
  'opacity: 1 !important',
  'color-scheme: normal !important',
].join('; ')

declare global {
  interface Window {
    __keepNotesContentLoaded?: boolean
  }
}

export function getPageSelectionText(): string {
  const selection = globalThis.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return ''

  const range = selection.getRangeAt(0)
  const root = range.commonAncestorContainer.getRootNode()
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) return ''

  const host = document.getElementById(ROOT_ID)
  if (host?.contains(range.commonAncestorContainer)) return ''

  const text = selection.toString()
  return text.length > MAX_PAGE_SELECTION_LENGTH
    ? text.slice(0, MAX_PAGE_SELECTION_LENGTH)
    : text
}

function registerMessageHandler(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return

  const runtimeId = chrome.runtime.id
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    const parsed = parsePanelMessage(message)
    if (!parsed) {
      sendResponse({ ok: false, error: 'invalid_message' })
      return false
    }
    if (!isTrustedPanelSender(sender, runtimeId)) {
      sendResponse({ ok: false, error: 'unauthorized' })
      return false
    }

    if (parsed.type === 'PING') {
      sendResponse({ ok: true, visible: panelBus.getSnapshot().visible })
      return false
    }
    if (parsed.type === 'OPEN_PANEL') {
      panelBus.open()
      sendResponse({ ok: true })
      return false
    }
    if (parsed.type === 'TOGGLE_PANEL') {
      panelBus.toggle()
      sendResponse({ ok: true })
      return false
    }
    return false
  })
}

function mount(): void {
  if (window[CONTENT_FLAG]) return
  window[CONTENT_FLAG] = true

  document.getElementById(ROOT_ID)?.remove()

  const host = document.createElement('div')
  host.id = ROOT_ID
  host.style.cssText = HOST_STYLE

  const shadow = host.attachShadow({ mode: 'closed' })
  try {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(styles)
    shadow.adoptedStyleSheets = [sheet]
  } catch {
    const style = document.createElement('style')
    style.textContent = styles
    shadow.appendChild(style)
  }

  const mountPoint = document.createElement('div')
  mountPoint.className = 'keep-notes-root'
  shadow.appendChild(mountPoint)

  document.documentElement.appendChild(host)

  createRoot(mountPoint).render(<App getPageSelection={getPageSelectionText} />)
  registerMessageHandler()
}

if (document.documentElement) {
  mount()
} else {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
}
