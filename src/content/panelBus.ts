export interface PanelState {
  visible: boolean
  focusToken: number
}

let state: PanelState = { visible: true, focusToken: 1 }
const listeners = new Set<() => void>()

function emit(next: PanelState): void {
  state = next
  for (const listener of listeners) listener()
}

export const panelBus = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot(): PanelState {
    return state
  },
  open(): void {
    emit({ visible: true, focusToken: state.focusToken + 1 })
  },
  close(): void {
    emit({ ...state, visible: false })
  },
  toggle(): void {
    if (state.visible) {
      emit({ ...state, visible: false })
    } else {
      emit({ visible: true, focusToken: state.focusToken + 1 })
    }
  },
}

export function __resetPanelBusForTests(): void {
  state = { visible: true, focusToken: 1 }
  emit(state)
}
