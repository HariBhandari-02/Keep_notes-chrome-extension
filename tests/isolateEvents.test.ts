// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isolatePanelEvents } from '../src/content/isolateEvents'

interface Harness {
  host: HTMLDivElement
  shadow: ShadowRoot
  input: HTMLInputElement
  editor: HTMLDivElement
  button: HTMLButtonElement
  pageInput: HTMLTextAreaElement
}

const cleanups: Array<() => void> = []

function setup(): Harness {
  const pageInput = document.createElement('textarea')
  document.body.appendChild(pageInput)

  const host = document.createElement('div')
  const shadow = host.attachShadow({ mode: 'closed' })
  const input = document.createElement('input')
  const editor = document.createElement('div')
  editor.setAttribute('contenteditable', 'true')
  editor.tabIndex = 0
  editor.textContent = 'hello world'
  const button = document.createElement('button')
  shadow.append(input, editor, button)
  document.documentElement.appendChild(host)

  isolatePanelEvents(host, shadow)
  cleanups.push(() => {
    host.remove()
    pageInput.remove()
  })
  return { host, shadow, input, editor, button, pageInput }
}

function stealFocusOnKeydown(target: HTMLElement): () => void {
  const steal = () => target.focus()
  window.addEventListener('keydown', steal, true)
  return () => window.removeEventListener('keydown', steal, true)
}

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.()
})

describe('isolatePanelEvents', () => {
  it('keeps keyboard, input, and clipboard events from inside the panel away from page listeners', () => {
    const { input } = setup()
    const types = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'compositionstart', 'paste', 'copy', 'cut']
    const seen = vi.fn()
    for (const type of types) document.addEventListener(type, seen)

    for (const type of types) {
      input.dispatchEvent(new Event(type, { bubbles: true, composed: true }))
    }

    expect(seen).not.toHaveBeenCalled()
    for (const type of types) document.removeEventListener(type, seen)
  })

  it('marks the host so ChatGPT does not redirect panel typing into its composer', () => {
    const { input, pageInput } = setup()
    // Mirrors chatgpt.com: a window capture listener that cancels printable keys
    // unless the event path holds an editable element or an input boundary.
    const boundary = '[data-codex-character-input-boundary]'
    const hijack = vi.fn((event: KeyboardEvent) => {
      const exempt = event.composedPath().some(
        (node) =>
          node instanceof HTMLElement &&
          (node.isContentEditable ||
            ['input', 'textarea', 'select'].includes(node.tagName.toLowerCase()) ||
            node.closest(boundary) !== null)
      )
      if (!exempt) event.preventDefault()
    })
    window.addEventListener('keydown', hijack, true)

    const fromPanel = new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true, cancelable: true })
    input.dispatchEvent(fromPanel)
    const fromPage = new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true, cancelable: true })
    pageInput.parentElement?.dispatchEvent(fromPage)

    expect(hijack).toHaveBeenCalledTimes(2)
    expect(fromPanel.defaultPrevented).toBe(false)
    expect(fromPage.defaultPrevented).toBe(true)
    window.removeEventListener('keydown', hijack, true)
  })

  it('leaves events outside the panel alone', () => {
    const { pageInput } = setup()
    const seen = vi.fn()
    document.addEventListener('keydown', seen)

    pageInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }))

    expect(seen).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', seen)
  })

  it('takes focus back when a page capture listener steals it mid-keystroke', () => {
    const { shadow, input, pageInput } = setup()
    const release = stealFocusOnKeydown(pageInput)
    input.focus()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }))

    expect(shadow.activeElement).toBe(input)
    release()
  })

  it('restores the caret in a contenteditable field after focus is stolen', () => {
    const { shadow, editor, pageInput } = setup()
    const text = editor.firstChild as Text
    const caret = document.createRange()
    caret.setStart(text, 5)
    caret.collapse(true)
    Object.defineProperty(shadow, 'getSelection', {
      configurable: true,
      value: () => ({ rangeCount: 1, getRangeAt: () => caret }),
    })

    editor.focus()
    editor.dispatchEvent(new Event('input', { bubbles: true, composed: true }))

    const release = stealFocusOnKeydown(pageInput)
    const addRange = vi.spyOn(Selection.prototype, 'addRange')
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }))

    expect(shadow.activeElement).toBe(editor)
    const restored = addRange.mock.calls.at(-1)?.[0] as Range
    expect(restored.startContainer).toBe(text)
    expect(restored.startOffset).toBe(5)
    release()
  })

  it('does not save a caret that sits outside the focused editor', () => {
    const { shadow, editor, input, pageInput } = setup()
    const outside = document.createRange()
    outside.selectNodeContents(input)
    Object.defineProperty(shadow, 'getSelection', {
      configurable: true,
      value: () => ({ rangeCount: 1, getRangeAt: () => outside }),
    })

    editor.focus()
    document.dispatchEvent(new Event('selectionchange'))
    input.focus()
    shadow.dispatchEvent(new FocusEvent('focusout'))

    const release = stealFocusOnKeydown(pageInput)
    const addRange = vi.spyOn(Selection.prototype, 'addRange')
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }))

    expect(shadow.activeElement).toBe(editor)
    expect(addRange).not.toHaveBeenCalled()
    release()
  })

  it('ignores keystrokes on non-editable panel controls', () => {
    const { shadow, button, pageInput } = setup()
    const release = stealFocusOnKeydown(pageInput)
    button.focus()

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }))

    expect(shadow.activeElement).toBeNull()
    expect(document.activeElement).toBe(pageInput)
    release()
  })
})
