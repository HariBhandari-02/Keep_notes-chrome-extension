import { AlertCircle, Check, Loader2 } from 'lucide-react'
import type { SaveState } from '../types/note'
import { cx } from '../utils/cx'

interface SaveStatusProps {
  state: SaveState
  error: string | null
  onRetry: () => void
}

export function SaveStatus({ state, error, onRetry }: SaveStatusProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      title={state === 'error' ? error ?? undefined : 'Notes are saved locally in Chrome'}
      className={cx(
        'flex min-w-0 items-center gap-1.5 text-[10.5px]',
        state === 'error'
          ? 'text-red-600 dark:text-red-400'
          : 'text-neutral-400 dark:text-neutral-500'
      )}
    >
      {state === 'saving' && (
        <Loader2 size={11} className="shrink-0 animate-spin" aria-hidden="true" />
      )}
      {state === 'saved' && <Check size={11} className="shrink-0" aria-hidden="true" />}
      {state === 'error' && <AlertCircle size={11} className="shrink-0" aria-hidden="true" />}

      <span className="truncate">
        {state === 'saving' && 'Saving…'}
        {state === 'saved' && 'Saved'}
        {state === 'error' && 'Unable to save'}
      </span>

      {state === 'error' && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded px-0.5 font-medium underline decoration-red-400/60 underline-offset-2 outline-none hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500/60 dark:hover:text-red-300"
        >
          Retry
        </button>
      )}
    </div>
  )
}
