import { afterEach, describe, expect, it, vi } from 'vitest'

type ActionListener = (tab: chrome.tabs.Tab) => void
type CommandListener = (command: string, tab?: chrome.tabs.Tab) => void

interface Harness {
  click: (tab: Partial<chrome.tabs.Tab>) => void
  command: (command: string, tab?: Partial<chrome.tabs.Tab>) => void
  sendMessage: ReturnType<typeof vi.fn>
  executeScript: ReturnType<typeof vi.fn>
  query: ReturnType<typeof vi.fn>
  action: {
    setBadgeBackgroundColor: ReturnType<typeof vi.fn>
    setBadgeText: ReturnType<typeof vi.fn>
    setTitle: ReturnType<typeof vi.fn>
  }
}

async function loadServiceWorker(): Promise<Harness> {
  let click: ActionListener = () => undefined
  let command: CommandListener = () => undefined

  const sendMessage = vi.fn()
  const executeScript = vi.fn()
  const query = vi.fn()
  const action = {
    onClicked: {
      addListener: vi.fn((listener: ActionListener) => {
        click = listener
      }),
    },
    setBadgeBackgroundColor: vi.fn(async () => undefined),
    setBadgeText: vi.fn(async () => undefined),
    setTitle: vi.fn(async () => undefined),
  }
  const commands = {
    onCommand: {
      addListener: vi.fn((listener: CommandListener) => {
        command = listener
      }),
    },
  }

  vi.stubGlobal('chrome', {
    action,
    commands,
    tabs: { sendMessage, query },
    scripting: { executeScript },
  })

  await import('../src/background/service-worker')

  return {
    click: (tab) => click(tab as chrome.tabs.Tab),
    command: (name, tab) => command(name, tab as chrome.tabs.Tab | undefined),
    sendMessage,
    executeScript,
    query,
    action,
  }
}

describe('service worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('opens the panel when the content script is already injected', async () => {
    const harness = await loadServiceWorker()
    harness.sendMessage.mockResolvedValueOnce({ ok: true })

    harness.click({ id: 3, url: 'https://example.com' })

    await vi.waitFor(() =>
      expect(harness.sendMessage).toHaveBeenCalledWith(3, { type: 'OPEN_PANEL' })
    )
    expect(harness.sendMessage).toHaveBeenCalledWith(3, { type: 'PING' })
    expect(harness.executeScript).not.toHaveBeenCalled()
    expect(harness.action.setBadgeText).toHaveBeenCalledWith({ tabId: 3, text: '' })
  })

  it('shows unsupported feedback for restricted pages', async () => {
    const harness = await loadServiceWorker()

    harness.click({ id: 4, url: 'chrome://settings' })

    await vi.waitFor(() =>
      expect(harness.action.setBadgeText).toHaveBeenCalledWith({ tabId: 4, text: '!' })
    )
    expect(harness.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      tabId: 4,
      color: '#b91c1c',
    })
    expect(harness.action.setTitle).toHaveBeenCalled()
    expect(harness.sendMessage).not.toHaveBeenCalled()
  })

  it('does nothing when the tab has no id', async () => {
    const harness = await loadServiceWorker()

    harness.click({ url: 'https://example.com' })
    await Promise.resolve()

    expect(harness.action.setBadgeText).not.toHaveBeenCalled()
    expect(harness.sendMessage).not.toHaveBeenCalled()
  })

  it('injects the content script and opens the panel', async () => {
    const harness = await loadServiceWorker()
    harness.sendMessage.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ok: true })

    harness.click({ id: 5, url: 'https://example.com' })

    await vi.waitFor(() =>
      expect(harness.sendMessage).toHaveBeenCalledWith(5, { type: 'OPEN_PANEL' })
    )
    expect(harness.executeScript).toHaveBeenCalledWith({
      target: { tabId: 5 },
      files: ['content.js'],
    })
  })

  it('shows unsupported feedback when injection fails', async () => {
    const harness = await loadServiceWorker()
    harness.sendMessage.mockResolvedValueOnce(undefined)
    harness.executeScript.mockRejectedValueOnce(new Error('cannot inject'))

    harness.click({ id: 6, url: 'https://example.com' })

    await vi.waitFor(() =>
      expect(harness.action.setBadgeText).toHaveBeenCalledWith({ tabId: 6, text: '!' })
    )
  })

  it('shows unsupported feedback when the injected script does not answer', async () => {
    const harness = await loadServiceWorker()
    harness.sendMessage.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ok: false })

    harness.click({ id: 7, url: 'https://example.com' })

    await vi.waitFor(() =>
      expect(harness.action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: '!' })
    )
    expect(harness.sendMessage).not.toHaveBeenCalledWith(7, { type: 'OPEN_PANEL' })
  })

  it('still opens the panel when feedback updates fail', async () => {
    const harness = await loadServiceWorker()
    harness.sendMessage.mockResolvedValueOnce({ ok: true })
    harness.action.setBadgeText.mockRejectedValueOnce(new Error('tab closed'))

    harness.click({ id: 8, url: 'https://example.com' })

    await vi.waitFor(() =>
      expect(harness.sendMessage).toHaveBeenCalledWith(8, { type: 'OPEN_PANEL' })
    )
  })

  it('toggles an existing panel and guards unsupported pages', async () => {
    const harness = await loadServiceWorker()
    harness.sendMessage.mockResolvedValueOnce({ ok: true })

    harness.command('toggle-panel', { id: 9, url: 'https://example.com' })

    await vi.waitFor(() =>
      expect(harness.sendMessage).toHaveBeenCalledWith(9, { type: 'TOGGLE_PANEL' })
    )

    vi.resetModules()
    const second = await loadServiceWorker()
    second.command('toggle-panel', { id: 10, url: 'about:blank' })
    await vi.waitFor(() =>
      expect(second.action.setBadgeText).toHaveBeenCalledWith({ tabId: 10, text: '!' })
    )
  })

  it('injects the content script when toggling a page without a panel', async () => {
    const harness = await loadServiceWorker()
    harness.sendMessage
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ ok: true })

    harness.command('toggle-panel', { id: 11, url: 'https://example.com' })

    await vi.waitFor(() =>
      expect(harness.sendMessage).toHaveBeenCalledWith(11, { type: 'OPEN_PANEL' })
    )
    expect(harness.executeScript).toHaveBeenCalledTimes(1)
  })

  it('reports failure when toggling cannot inject', async () => {
    const harness = await loadServiceWorker()
    harness.sendMessage.mockResolvedValueOnce(undefined)
    harness.executeScript.mockRejectedValueOnce(new Error('blocked'))

    harness.command('toggle-panel', { id: 12, url: 'https://example.com' })

    await vi.waitFor(() =>
      expect(harness.action.setBadgeText).toHaveBeenCalledWith({ tabId: 12, text: '!' })
    )
  })

  it('ignores other commands', async () => {
    const harness = await loadServiceWorker()

    harness.command('other-command', { id: 13, url: 'https://example.com' })
    await Promise.resolve()

    expect(harness.sendMessage).not.toHaveBeenCalled()
    expect(harness.action.setBadgeText).not.toHaveBeenCalled()
  })

  it('uses the active tab when the command has no tab', async () => {
    const harness = await loadServiceWorker()
    harness.query.mockResolvedValueOnce([{ id: 14, url: 'https://example.com' }])
    harness.sendMessage.mockResolvedValueOnce({ ok: true })

    harness.command('toggle-panel')

    await vi.waitFor(() =>
      expect(harness.sendMessage).toHaveBeenCalledWith(14, { type: 'TOGGLE_PANEL' })
    )
    expect(harness.query).toHaveBeenCalledWith({ active: true, currentWindow: true })
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'blob:https://example.com/id',
    'chrome://settings',
    'chrome-extension://abc/page.html',
    'about:blank',
    'view-source:https://example.com',
    'https://chromewebstore.google.com/detail/abc',
    'https://chrome.google.com/webstore/detail/abc',
    'not-a-valid-url',
  ])('refuses to inject into unsupported URL %s', async (url) => {
    const harness = await loadServiceWorker()

    harness.click({ id: 20, url })

    await vi.waitFor(() =>
      expect(harness.action.setBadgeText).toHaveBeenCalledWith({ tabId: 20, text: '!' })
    )
    expect(harness.sendMessage).not.toHaveBeenCalled()
    expect(harness.executeScript).not.toHaveBeenCalled()
  })

  it.each([
    'https://chromewebstore.google.com.evil.example/phish',
    'https://example.com/path',
    'http://example.com/path',
    'file:///tmp/notes.html',
  ])('allows injection into supported URL %s', async (url) => {
    const harness = await loadServiceWorker()
    harness.sendMessage.mockResolvedValueOnce({ ok: true })

    harness.click({ id: 21, url })

    await vi.waitFor(() =>
      expect(harness.sendMessage).toHaveBeenCalledWith(21, { type: 'OPEN_PANEL' })
    )
  })

  it('ignores malformed tab ids', async () => {
    const harness = await loadServiceWorker()

    harness.click({ id: -1, url: 'https://example.com' })
    harness.click({ id: 1.5, url: 'https://example.com' })
    await Promise.resolve()

    expect(harness.sendMessage).not.toHaveBeenCalled()
    expect(harness.action.setBadgeText).not.toHaveBeenCalled()
  })
})
