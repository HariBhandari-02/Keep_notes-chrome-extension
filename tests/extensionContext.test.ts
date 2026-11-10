// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isExtensionContextValid, watchExtensionContext } from '../src/content/extensionContext'

describe('extension context', () => {
  let runtime: { id?: string }

  beforeEach(() => {
    vi.useFakeTimers()
    runtime = { id: 'test-extension-id' }
    vi.stubGlobal('chrome', { runtime })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('is valid only while the runtime still has an id', () => {
    expect(isExtensionContextValid()).toBe(true)
    delete runtime.id
    expect(isExtensionContextValid()).toBe(false)
    vi.stubGlobal('chrome', undefined)
    expect(isExtensionContextValid()).toBe(false)
  })

  it('treats a throwing runtime accessor as invalidated', () => {
    vi.stubGlobal('chrome', {
      get runtime() {
        throw new Error('Extension context invalidated.')
      },
    })
    expect(isExtensionContextValid()).toBe(false)
  })

  it('reports invalidation once from the polling timer', () => {
    const onInvalidated = vi.fn()
    watchExtensionContext(onInvalidated, 100)

    vi.advanceTimersByTime(300)
    expect(onInvalidated).not.toHaveBeenCalled()

    delete runtime.id
    vi.advanceTimersByTime(100)
    vi.advanceTimersByTime(500)
    window.dispatchEvent(new Event('focus'))
    expect(onInvalidated).toHaveBeenCalledTimes(1)
  })

  it('checks immediately when the tab becomes visible again', () => {
    const onInvalidated = vi.fn()
    watchExtensionContext(onInvalidated, 60_000)

    delete runtime.id
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onInvalidated).toHaveBeenCalledTimes(1)
  })

  it('stops watching when the returned cleanup runs', () => {
    const onInvalidated = vi.fn()
    const stop = watchExtensionContext(onInvalidated, 100)
    stop()
    stop()

    delete runtime.id
    vi.advanceTimersByTime(500)
    window.dispatchEvent(new Event('focus'))
    expect(onInvalidated).not.toHaveBeenCalled()
  })
})
