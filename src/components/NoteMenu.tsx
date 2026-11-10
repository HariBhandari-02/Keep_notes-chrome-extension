import { MoreVertical, Pin, PinOff, Trash2 } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { cx } from '../utils/cx'

interface NoteMenuProps {
  pinned: boolean
  onTogglePin: () => void
  onDelete: () => void
}

/** Room the menu needs below its trigger before it flips upward. */
const MENU_FLIP_THRESHOLD = 88

function MenuItem({
  onSelect,
  danger = false,
  children,
}: Readonly<{ onSelect: () => void; danger?: boolean; children: ReactNode }>) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onSelect}
      className={cx(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium outline-none transition-colors',
        danger
          ? 'text-red-600 hover:bg-red-50 focus-visible:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus-visible:bg-red-500/10'
          : 'text-neutral-700 hover:bg-neutral-100 focus-visible:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus-visible:bg-neutral-800'
      )}
    >
      {children}
    </button>
  )
}

export function NoteMenu({ pinned, onTogglePin, onDelete }: Readonly<NoteMenuProps>) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const wrapper = wrapperRef.current
    if (!wrapper) return
    // The panel lives in a shadow root, so outside clicks are watched there, not on document.
    const root = wrapper.getRootNode()

    const handlePointerDown = (event: Event) => {
      if (!event.composedPath().includes(wrapper)) setOpen(false)
    }

    // Native listener so it runs before the panel's own Escape handler closes the panel.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus({ preventScroll: true })
    }

    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget
      if (next instanceof Node && wrapper.contains(next)) return
      setOpen(false)
    }

    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
    root.addEventListener('pointerdown', handlePointerDown, true)
    wrapper.addEventListener('keydown', handleKeyDown)
    wrapper.addEventListener('focusout', handleFocusOut)
    return () => {
      root.removeEventListener('pointerdown', handlePointerDown, true)
      wrapper.removeEventListener('keydown', handleKeyDown)
      wrapper.removeEventListener('focusout', handleFocusOut)
    }
  }, [open])

  const handleToggle = () => {
    if (!open) {
      const trigger = triggerRef.current
      const scroller = trigger?.closest('.keep-notes-scroll')
      if (trigger && scroller) {
        const space =
          scroller.getBoundingClientRect().bottom - trigger.getBoundingClientRect().bottom
        setOpenUp(space < MENU_FLIP_THRESHOLD)
      }
    }
    setOpen(!open)
  }

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')
    )
    if (items.length === 0) return
    const index = items.indexOf(event.target as HTMLElement)

    let nextIndex: number | null = null
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % items.length
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = items.length - 1
    else if (event.key === 'Tab') setOpen(false)

    if (nextIndex === null) return
    event.preventDefault()
    items[nextIndex].focus({ preventScroll: true })
  }

  const select = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-label="Note actions"
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={cx(
          'inline-flex h-7 w-7 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500/70',
          open
            ? 'bg-neutral-200/80 text-neutral-800 dark:bg-neutral-700/70 dark:text-neutral-100'
            : 'text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-200'
        )}
      >
        <MoreVertical size={15} strokeWidth={2.2} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Note actions"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          className={cx(
            'absolute right-0 z-20 w-36 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg outline-none animate-keep-notes-in dark:border-neutral-700 dark:bg-neutral-900',
            openUp ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          <MenuItem onSelect={() => select(onTogglePin)}>
            {pinned ? (
              <PinOff size={13.5} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Pin size={13.5} strokeWidth={2} aria-hidden="true" />
            )}
            {pinned ? 'Unpin note' : 'Pin note'}
          </MenuItem>
          <MenuItem danger onSelect={() => select(onDelete)}>
            <Trash2 size={13.5} strokeWidth={2} aria-hidden="true" />
            Delete note
          </MenuItem>
        </div>
      )}
    </div>
  )
}
