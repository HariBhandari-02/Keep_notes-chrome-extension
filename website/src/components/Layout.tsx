import type { ReactNode } from 'react'
import { page, REPO_URL, SUPPORT_EMAIL } from '../config'

export function Layout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-5">
        <a href={page('')} className="flex items-center gap-2 font-bold no-underline">
          <img src={`${import.meta.env.BASE_URL}icons/icon48.png`} alt="" width={32} height={32} className="rounded-lg" />
          Keep Notes
        </a>
        <nav className="flex gap-5 text-sm">
          <a href={page('privacy.html')}>Privacy</a>
          <a href={REPO_URL} rel="noopener noreferrer">
            GitHub
          </a>
        </nav>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 pb-16 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>{children}</main>
      <footer className="mx-auto w-full max-w-4xl px-4 py-6 text-sm opacity-70">
        <p>
          Keep Notes keeps your notes on your device. Questions?{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </footer>
    </div>
  )
}
