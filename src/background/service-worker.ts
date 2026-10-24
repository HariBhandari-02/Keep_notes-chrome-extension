import type { PanelMessage } from '../content/panelMessages'

const CONTENT_SCRIPT = 'content.js'
const DEFAULT_TITLE = 'Open Keep Notes'
const UNSUPPORTED_TITLE = 'Keep Notes cannot run on this page. Try a regular website.'

type PanelResponse = { ok: boolean; visible?: boolean } | undefined

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:'])
const WEB_STORE_HOSTS = new Set(['chromewebstore.google.com'])

function isValidTabId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isWebStore(url: URL): boolean {
  if (WEB_STORE_HOSTS.has(url.hostname)) return true
  return url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore')
}

export function canInjectInto(url: string | undefined): boolean {
  if (!url) return false

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false
  if (isWebStore(parsed)) return false
  return true
}

async function sendMessage(tabId: number, message: PanelMessage): Promise<PanelResponse> {
  try {
    return await chrome.tabs.sendMessage(tabId, message)
  } catch {
    return undefined
  }
}

async function setUnsupportedFeedback(tabId: number | undefined): Promise<void> {
  if (!isValidTabId(tabId)) return
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#b91c1c' })
    await chrome.action.setBadgeText({ tabId, text: '!' })
    await chrome.action.setTitle({ tabId, title: UNSUPPORTED_TITLE })
  } catch {
    // The badge is best-effort only; some pages do not allow tab-scoped updates.
  }
}

async function clearUnsupportedFeedback(tabId: number): Promise<void> {
  try {
    await chrome.action.setBadgeText({ tabId, text: '' })
    await chrome.action.setTitle({ tabId, title: DEFAULT_TITLE })
  } catch {
    // Ignore: the tab may have closed.
  }
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  const existing = await sendMessage(tabId, { type: 'PING' })
  if (existing?.ok) return true

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT],
    })
  } catch {
    return false
  }

  const injected = await sendMessage(tabId, { type: 'PING' })
  return injected?.ok === true
}

async function openPanel(tab: chrome.tabs.Tab | undefined): Promise<void> {
  const tabId = tab?.id
  if (!isValidTabId(tabId) || !canInjectInto(tab?.url)) {
    await setUnsupportedFeedback(tabId)
    return
  }

  const ready = await ensureContentScript(tabId)
  if (!ready) {
    await setUnsupportedFeedback(tabId)
    return
  }

  await clearUnsupportedFeedback(tabId)
  await sendMessage(tabId, { type: 'OPEN_PANEL' })
}

async function togglePanel(tab: chrome.tabs.Tab | undefined): Promise<void> {
  const tabId = tab?.id
  if (!isValidTabId(tabId) || !canInjectInto(tab?.url)) {
    await setUnsupportedFeedback(tabId)
    return
  }

  const existing = await sendMessage(tabId, { type: 'PING' })
  if (existing?.ok) {
    await clearUnsupportedFeedback(tabId)
    await sendMessage(tabId, { type: 'TOGGLE_PANEL' })
    return
  }

  const ready = await ensureContentScript(tabId)
  if (!ready) {
    await setUnsupportedFeedback(tabId)
    return
  }

  await clearUnsupportedFeedback(tabId)
  await sendMessage(tabId, { type: 'OPEN_PANEL' })
}

chrome.action.onClicked.addListener((tab) => {
  void openPanel(tab)
})

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'toggle-panel') return
  void (async () => {
    const activeTab = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
    await togglePanel(activeTab)
  })()
})
