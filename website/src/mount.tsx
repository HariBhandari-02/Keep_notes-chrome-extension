import type { ReactNode } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

export function mount(element: ReactNode): void {
  const container = document.getElementById('root')
  if (!container) throw new Error('Missing #root element')
  createRoot(container).render(<StrictMode>{element}</StrictMode>)
}
