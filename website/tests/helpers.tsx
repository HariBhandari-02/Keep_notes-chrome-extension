import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { vi } from 'vitest'

export const STORE = 'https://chromewebstore.google.com/detail/keep-notes/abc'
export const FORM = 'https://docs.google.com/forms/d/e/XXXX/viewform'

/** Re-imports a page module with `mount` mocked and returns the rendered HTML. */
export async function renderPage(path: string, env: Record<string, string> = {}): Promise<string> {
  vi.resetModules()
  vi.unstubAllEnvs()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const mount = vi.fn<(element: ReactNode) => void>()
  vi.doMock('../src/mount', () => ({ mount }))
  await import(/* @vite-ignore */ path)
  expectMounted(mount)
  return renderToStaticMarkup(mount.mock.calls[0][0])
}

function expectMounted(mount: ReturnType<typeof vi.fn>): void {
  if (mount.mock.calls.length !== 1) throw new Error('page did not call mount() exactly once')
}
