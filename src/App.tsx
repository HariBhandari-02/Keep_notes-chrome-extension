import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { FloatingPanel } from './components/FloatingPanel'
import { panelBus } from './content/panelBus'
import { useNotes } from './hooks/useNotes'
import { useResolvedTheme } from './hooks/useTheme'

interface AppProps {
  getPageSelection: () => string
}

export default function App({ getPageSelection }: Readonly<AppProps>) {
  const store = useNotes()
  const panelState = useSyncExternalStore(
    panelBus.subscribe,
    panelBus.getSnapshot,
    panelBus.getSnapshot
  )
  const { isDark } = useResolvedTheme(store.settings.theme)
  const handleClose = useCallback(() => panelBus.close(), [])
  const wasVisible = useRef(panelState.visible)

  useEffect(() => {
    if (wasVisible.current && !panelState.visible) {
      void store.flushAll()
    }
    wasVisible.current = panelState.visible
  }, [panelState.visible, store.flushAll])

  useEffect(() => {
    const flush = () => {
      void store.flushAll()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    globalThis.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      globalThis.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [store.flushAll])

  if (!store.ready || !panelState.visible) return null

  return (
    <div className={isDark ? 'dark' : ''} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
      <FloatingPanel
        store={store}
        panelState={panelState}
        getPageSelection={getPageSelection}
        onClose={handleClose}
      />
    </div>
  )
}
