/**
 * Chrome leaves injected DOM in place when the extension is removed, disabled,
 * or reloaded; the orphaned content script keeps running but its `chrome.runtime`
 * loses its id. Polling that id is a local property read (no IPC, does not wake
 * the service worker), so it is cheap enough to run for the life of the page.
 */
const CHECK_INTERVAL_MS = 1000

export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

export function watchExtensionContext(
  onInvalidated: () => void,
  intervalMs = CHECK_INTERVAL_MS
): () => void {
  let stopped = false

  const stop = () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', check)
    window.removeEventListener('focus', check)
  }

  function check(): void {
    if (stopped || isExtensionContextValid()) return
    stop()
    onInvalidated()
  }

  const timer = setInterval(check, intervalMs)
  // Background tabs throttle timers, so also check as soon as the tab is shown.
  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)

  return stop
}
