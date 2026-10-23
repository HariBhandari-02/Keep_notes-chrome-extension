import { createRoot } from 'react-dom/client'
import App from '../App'
import styles from '../styles/globals.css?inline'
import { panelBus } from './panelBus'

const ROOT_ID = 'keep-notes-extension-root'
const CONTENT_FLAG = '__keepNotesContentLoaded'
const MAX_Z_INDEX = '2147483647'

declare global {
  interface Window {
    __keepNotesContentLoaded?: boolean
  }
}

export function getPageSelectionText(): string {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return ''

  const range = selection.getRangeAt(0)
  const root = range.commonAncestorContainer.getRootNode()
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) return ''

  const host = document.getElementById(ROOT_ID)
  if (host && host.contains(range.commonAncestorContainer)) return ''

  return selection.toString()
}

function mount(): void {
  if (window[CONTENT_FLAG]) return
  window[CONTENT_FLAG] = true

  document.getElementById(ROOT_ID)?.remove()

  const host = document.createElement('div')
  host.id = ROOT_ID
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'inset: 0',
    'display: block',
    `z-index: ${MAX_Z_INDEX}`,
    'pointer-events: none',
    'color-scheme: normal',
  ].join('; ')

  const shadow = host.attachShadow({ mode: 'open' })
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

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!message || typeof message !== 'object') return false
      const type = (message as { type?: unknown }).type

      if (type === 'PING') {
        sendResponse({ ok: true, visible: panelBus.getSnapshot().visible })
        return false
      }
      if (type === 'OPEN_PANEL') {
        panelBus.open()
        sendResponse({ ok: true })
        return false
      }
      if (type === 'TOGGLE_PANEL') {
        panelBus.toggle()
        sendResponse({ ok: true })
        return false
      }
      return false
    })
  }
}

if (document.documentElement) {
  mount()
} else {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
}
