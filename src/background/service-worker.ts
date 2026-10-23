const CONTENT_SCRIPT = 'content.js'
const DEFAULT_TITLE = 'Open Keep Notes'
const UNSUPPORTED_TITLE = 'Keep Notes cannot run on this page. Try a regular website.'

type PanelMessage =
  | { type: 'PING' }
  | { type: 'OPEN_PANEL' }
  | { type: 'TOGGLE_PANEL' }

type PanelResponse = { ok: true; visible?: boolean } | undefined

const RESTRICTED_SCHEMES = /^(chrome|chrome-extension|chrome-untrusted|edge|brave|opera|vivaldi|about|devtools|view-source|moz-extension):/i
const WEB_STORE_URLS = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)\//i

function canInjectInto(url: string | undefined): boolean {
  if (!url) return false
  if (RESTRICTED_SCHEMES.test(url)) return false
  if (WEB_STORE_URLS.test(url)) return false
  return /^(https?|file):/i.test(url)
}

async function sendMessage(tabId: number, message: PanelMessage): Promise<PanelResponse> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as PanelResponse
  } catch {
    return undefined
  }
}

async function setUnsupportedFeedback(tabId: number | undefined): Promise<void> {
  if (typeof tabId !== 'number') return
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
  if (typeof tabId !== 'number' || !canInjectInto(tab?.url)) {
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
  if (typeof tabId !== 'number' || !canInjectInto(tab?.url)) {
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
