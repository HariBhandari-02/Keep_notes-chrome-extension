import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetPanelBusForTests, panelBus } from '../src/content/panelBus'

describe('panelBus', () => {
  afterEach(() => {
    __resetPanelBusForTests()
  })

  it('notifies subscribers about visibility changes', () => {
    const listener = vi.fn()
    const unsubscribe = panelBus.subscribe(listener)

    panelBus.close()
    expect(panelBus.getSnapshot().visible).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)

    panelBus.open()
    expect(panelBus.getSnapshot().visible).toBe(true)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    panelBus.close()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('toggles visibility and bumps the focus token when reopening', () => {
    const initial = panelBus.getSnapshot().focusToken

    panelBus.toggle()
    expect(panelBus.getSnapshot().visible).toBe(false)

    panelBus.toggle()
    expect(panelBus.getSnapshot().visible).toBe(true)
    expect(panelBus.getSnapshot().focusToken).toBe(initial + 1)
  })
})
