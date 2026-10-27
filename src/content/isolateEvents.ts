/**
 * Events from inside the closed shadow root are retargeted to the host element,
 * so page scripts see keystrokes in the panel as typing on a plain <div>. Many
 * sites (chat apps in particular) react to that by focusing their own input, and
 * the keystrokes then land on the page instead of in the note.
 */
const ISOLATED_EVENTS = [
  'keydown',
  'keyup',
  'keypress',
  'beforeinput',
  'input',
  'textInput',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'paste',
  'copy',
  'cut',
] as const

/**
 * ChatGPT listens for keydown and paste in the capture phase on window, cancels
 * printable keys, and types them into its own composer unless the event path
 * holds an editable element. The closed shadow root hides our fields from that
 * check, so mark the host with the attribute ChatGPT honors as an input boundary.
 */
const PAGE_INPUT_BOUNDARY_ATTRIBUTES = ['data-codex-character-input-boundary'] as const

type ShadowRootWithSelection = ShadowRoot & { getSelection?: () => Selection | null }

function isRichEditable(element: unknown): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    (element.isContentEditable || element.hasAttribute('contenteditable'))
  )
}

function isEditable(element: Element): element is HTMLElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    isRichEditable(element)
  )
}

function readShadowRange(shadow: ShadowRootWithSelection): Range | null {
  const selection = shadow.getSelection?.() ?? null
  if (!selection || selection.rangeCount === 0) return null
  return selection.getRangeAt(0)
}

export function isolatePanelEvents(host: HTMLElement, shadow: ShadowRoot): () => void {
  for (const name of PAGE_INPUT_BOUNDARY_ATTRIBUTES) host.setAttribute(name, '')

  // Bubble-phase page listeners on document/window never see panel events.
  const stop = (event: Event) => event.stopPropagation()
  for (const type of ISOLATED_EVENTS) host.addEventListener(type, stop)

  // Capture-phase page listeners on window/document still run first and can move
  // focus away mid-keystroke. Track the caret in contenteditable fields so focus
  // and caret can be put back before the browser inserts the character.
  const root = shadow as ShadowRootWithSelection
  let savedRange: Range | null = null

  const saveRange = () => {
    const active = shadow.activeElement
    if (!isRichEditable(active)) return
    const range = readShadowRange(root)
    if (range && active.contains(range.commonAncestorContainer)) savedRange = range.cloneRange()
  }

  const reclaimFocus = (event: Event) => {
    const origin = event.composedPath()[0]
    if (!(origin instanceof Element) || !isEditable(origin)) return
    if (shadow.activeElement === origin) return

    origin.focus({ preventScroll: true })
    if (savedRange && origin.contains(savedRange.commonAncestorContainer)) {
      const selection = host.ownerDocument.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(savedRange)
    }
  }

  // selectionchange is asynchronous and coalesced, so fast typing also saves the
  // caret synchronously after each edit and as focus is about to leave.
  host.ownerDocument.addEventListener('selectionchange', saveRange)
  shadow.addEventListener('input', saveRange, true)
  shadow.addEventListener('focusout', saveRange, true)
  shadow.addEventListener('keydown', reclaimFocus, true)
  shadow.addEventListener('beforeinput', reclaimFocus, true)

  // Only the document listener outlives the host; the rest go away with it.
  return () => host.ownerDocument.removeEventListener('selectionchange', saveRange)
}
