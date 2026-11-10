// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChrome } from './helpers/fakeChrome'

vi.mock('../src/App', () => ({ default: () => null }))

const ROOT_ID = 'keep-notes-extension-root'
const RUNTIME_ID = 'test-extension-id'

type ContentModule = typeof import('../src/content/content')

interface ContentHarness {
  module: ContentModule
  onMessage: { addListener: ReturnType<typeof vi.fn> }
  attachShadow: ReturnType<typeof vi.spyOn>
}

async function loadContentScript(withChrome = true): Promise<ContentHarness> {
  const attachShadow = vi.spyOn(Element.prototype, 'attachShadow')

  if (withChrome) {
    installFakeChrome()
    const storageChrome = globalThis.chrome as unknown as Record<string, unknown>
    const onMessage = { addListener: vi.fn() }
    vi.stubGlobal('chrome', {
      ...storageChrome,
      runtime: { id: RUNTIME_ID, onMessage },
    })
    return { module: await import('../src/content/content'), onMessage, attachShadow }
  }

  vi.stubGlobal('chrome', undefined)
  return {
    module: await import('../src/content/content'),
    onMessage: { addListener: vi.fn() },
    attachShadow,
  }
}

function selected(range: {
  commonAncestorContainer: Node
  text: string
}): Selection {
  return {
    rangeCount: 1,
    isCollapsed: false,
    getRangeAt: () => ({ commonAncestorContainer: range.commonAncestorContainer }),
    toString: () => range.text,
  } as unknown as Selection
}

function removeRoot(): void {
  document.getElementById(ROOT_ID)?.remove()
}

describe('content script', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    removeRoot()
    delete (window as unknown as Record<string, unknown>).__keepNotesContentLoaded
  })

  afterEach(() => {
    removeRoot()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('mounts the panel inside a closed shadow root with hardened host styles', async () => {
    const { attachShadow } = await loadContentScript()

    const host = document.getElementById(ROOT_ID)
    expect(host).not.toBeNull()
    expect(host?.shadowRoot).toBeNull()
    expect(attachShadow).toHaveBeenCalledWith({ mode: 'closed' })

    const shadow = attachShadow.mock.results[0]?.value as ShadowRoot
    expect(shadow.querySelector('.keep-notes-root')).not.toBeNull()
    expect(host?.style.getPropertyPriority('position')).toBe('important')
    expect(host?.style.getPropertyPriority('z-index')).toBe('important')
    expect(host?.style.getPropertyValue('display')).toBe('block')
  })

  it('does not inject a second panel when the content script runs again', async () => {
    const first = await loadContentScript()
    expect(first.attachShadow).toHaveBeenCalledTimes(1)
    expect((window as unknown as Record<string, unknown>).__keepNotesContentLoaded).toBe(true)

    vi.resetModules()
    const second = await loadContentScript()

    expect(document.querySelectorAll(`#${ROOT_ID}`)).toHaveLength(1)
    expect(second.attachShadow.mock.calls.length).toBe(first.attachShadow.mock.calls.length)
  })

  it('answers authorized runtime messages from the extension background', async () => {
    const { onMessage } = await loadContentScript()
    expect(onMessage.addListener).toHaveBeenCalledTimes(1)

    const listener = onMessage.addListener.mock.calls[0][0] as (
      message: unknown,
      sender: unknown,
      sendResponse: (value: unknown) => void
    ) => boolean
    const sender = {
      id: RUNTIME_ID,
      url: `chrome-extension://${RUNTIME_ID}/background.js`,
    }

    const respond = vi.fn()
    expect(listener({ type: 'PING' }, sender, respond)).toBe(false)
    expect(respond).toHaveBeenCalledWith({ ok: true, visible: true })

    expect(listener({ type: 'TOGGLE_PANEL' }, sender, respond)).toBe(false)
    listener({ type: 'PING' }, sender, respond)
    expect(respond).toHaveBeenLastCalledWith({ ok: true, visible: false })

    expect(listener({ type: 'OPEN_PANEL' }, sender, respond)).toBe(false)
    listener({ type: 'PING' }, sender, respond)
    expect(respond).toHaveBeenLastCalledWith({ ok: true, visible: true })
  })

  it('rejects malformed and unknown message shapes', async () => {
    const { onMessage } = await loadContentScript()
    const listener = onMessage.addListener.mock.calls[0][0] as (
      message: unknown,
      sender: unknown,
      sendResponse: (value: unknown) => void
    ) => boolean
    const sender = { id: RUNTIME_ID, url: `chrome-extension://${RUNTIME_ID}/background.js` }

    const invalidMessages: unknown[] = [
      null,
      'PING',
      [],
      {},
      { type: 42 },
      { type: 'UNKNOWN' },
      { type: 'PING', extra: 'field' },
      { type: `${'A'.repeat(65)}` },
      { __proto__: { type: 'PING' } },
    ]

    for (const message of invalidMessages) {
      const respond = vi.fn()
      expect(listener(message, sender, respond)).toBe(false)
      expect(respond).toHaveBeenCalledWith({ ok: false, error: 'invalid_message' })
    }

    const respond = vi.fn()
    listener({ type: 'PING' }, sender, respond)
    expect(respond).toHaveBeenLastCalledWith({ ok: true, visible: true })
  })

  it('rejects messages from unauthorized senders', async () => {
    const { onMessage } = await loadContentScript()
    const listener = onMessage.addListener.mock.calls[0][0] as (
      message: unknown,
      sender: unknown,
      sendResponse: (value: unknown) => void
    ) => boolean

    const unauthorizedSenders: unknown[] = [
      undefined,
      {},
      { id: 'another-extension' },
      { id: RUNTIME_ID, tab: { id: 1 } },
      { id: RUNTIME_ID, url: 'https://example.com/' },
      { id: RUNTIME_ID, url: `chrome-extension://${RUNTIME_ID}.evil/` },
    ]

    for (const sender of unauthorizedSenders) {
      const respond = vi.fn()
      expect(listener({ type: 'PING' }, sender, respond)).toBe(false)
      expect(respond).toHaveBeenCalledWith({ ok: false, error: 'unauthorized' })
    }
  })

  it('removes the panel once the extension is removed or reloaded', async () => {
    await loadContentScript()
    expect(document.getElementById(ROOT_ID)).not.toBeNull()

    const runtime = (globalThis.chrome as unknown as { runtime: { id?: string } }).runtime
    delete runtime.id
    window.dispatchEvent(new Event('focus'))

    expect(document.getElementById(ROOT_ID)).toBeNull()
    expect((window as unknown as Record<string, unknown>).__keepNotesContentLoaded).toBe(false)
  })

  it('mounts without chrome available', async () => {
    const { onMessage } = await loadContentScript(false)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById(ROOT_ID)).not.toBeNull()
    expect(onMessage.addListener).not.toHaveBeenCalled()
  })

  it('ignores collapsed, shadow, and panel selections', async () => {
    const { module } = await loadContentScript()
    const getSelection = vi.fn()
    vi.stubGlobal('getSelection', getSelection)

    getSelection.mockReturnValueOnce(null)
    expect(module.getPageSelectionText()).toBe('')

    getSelection.mockReturnValueOnce({
      rangeCount: 0,
      isCollapsed: false,
      getRangeAt: () => ({ commonAncestorContainer: document.body }),
      toString: () => 'ignored',
    })
    expect(module.getPageSelectionText()).toBe('')

    getSelection.mockReturnValueOnce({
      rangeCount: 1,
      isCollapsed: true,
      getRangeAt: () => ({ commonAncestorContainer: document.body }),
      toString: () => 'ignored',
    })
    expect(module.getPageSelectionText()).toBe('')

    const shadowText = document.createTextNode('inside shadow')
    const shadow = document.createElement('div').attachShadow({ mode: 'open' })
    shadow.appendChild(shadowText)
    getSelection.mockReturnValueOnce(selected({ commonAncestorContainer: shadowText, text: 'shadow' }))
    expect(module.getPageSelectionText()).toBe('')

    const host = document.getElementById(ROOT_ID)
    getSelection.mockReturnValueOnce(selected({ commonAncestorContainer: host as Node, text: 'panel' }))
    expect(module.getPageSelectionText()).toBe('')
  })

  it('returns text selected on the page and caps oversized selections', async () => {
    const { module } = await loadContentScript()
    const textNode = document.createTextNode('page words')
    document.body.appendChild(textNode)

    vi.stubGlobal(
      'getSelection',
      vi.fn(() => selected({ commonAncestorContainer: textNode, text: 'page words' }))
    )

    expect(module.getPageSelectionText()).toBe('page words')

    vi.stubGlobal(
      'getSelection',
      vi.fn(() => selected({ commonAncestorContainer: textNode, text: 'x'.repeat(60_000) }))
    )
    expect(module.getPageSelectionText()).toHaveLength(50_000)
  })
})
