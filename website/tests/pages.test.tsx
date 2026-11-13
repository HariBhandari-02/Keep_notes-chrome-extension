import { afterEach, describe, expect, it, vi } from 'vitest'
import { FORM, renderPage, STORE } from './helpers'

afterEach(() => {
  vi.doUnmock('../src/mount')
  vi.unstubAllEnvs()
})

describe('welcome page', () => {
  it('shows every usage step with its illustration', async () => {
    const html = await renderPage('../src/welcome')
    expect(html).toContain('Thanks for installing Keep Notes')
    for (const title of [
      'Open your notepad',
      'Write and format a note',
      'Capture text while you read',
      'Pin, search and organize',
      'Your notes stay on your device',
    ]) {
      expect(html).toContain(title)
    }
    for (const image of ['open', 'write', 'capture', 'organize', 'private']) {
      expect(html).toContain(`images/guide-${image}.webp`)
    }
    expect(html.match(/<img /g)).toHaveLength(6) // five guides plus the header logo
  })

  it('loads only the first illustration eagerly', async () => {
    const html = await renderPage('../src/welcome')
    expect(html.match(/loading="eager"/g)).toHaveLength(1)
    expect(html.match(/loading="lazy"/g)).toHaveLength(4)
  })

  it('gives every illustration descriptive alt text', async () => {
    const html = await renderPage('../src/welcome')
    const guideAlts = [...html.matchAll(/<img[^>]*guide-[^>]*>/g)].map((m) => m[0])
    expect(guideAlts).toHaveLength(5)
    for (const tag of guideAlts) expect(tag).toMatch(/alt="[^"]{20,}"/)
  })

  it('mentions the shortcut and the pages the extension cannot run on', async () => {
    const html = await renderPage('../src/welcome')
    expect(html).toContain('Shift')
    expect(html).toContain('chrome://settings')
  })
})

describe('home page', () => {
  it('describes the extension and hides the install button without a store URL', async () => {
    const html = await renderPage('../src/index', { VITE_STORE_URL: '' })
    expect(html).toContain('A floating notepad for Chrome')
    expect(html).toContain('Local-first')
    expect(html).not.toContain('View on GitHub')
    expect(html).not.toContain('github.com')
    expect(html).not.toContain('Add to Chrome')
  })

  it('offers the Web Store install button once published', async () => {
    const html = await renderPage('../src/index', { VITE_STORE_URL: STORE })
    expect(html).toContain('Add to Chrome')
    expect(html).toContain(`href="${STORE}"`)
  })
})

describe('uninstall page', () => {
  it('asks for feedback by email when no form is configured', async () => {
    const html = await renderPage('../src/uninstall', { VITE_FEEDBACK_FORM_URL: '' })
    expect(html).toContain('Sorry to see you go')
    expect(html).toContain('mailto:keepnotes.support@gmail.com?subject=Keep%20Notes%20feedback')
    expect(html).not.toContain('<iframe')
  })

  it('offers a labelled reinstall button once the extension is published', async () => {
    const html = await renderPage('../src/uninstall', { VITE_STORE_URL: STORE })
    expect(html).toContain('Reinstall Keep Notes')
    expect(html).toContain(`href="${STORE}"`)
  })

  it('hides the reinstall section before publication', async () => {
    const html = await renderPage('../src/uninstall', { VITE_STORE_URL: '' })
    expect(html).not.toContain('View on GitHub')
    expect(html).not.toContain('github.com')
    expect(html).not.toContain('Uninstalled by accident?')
  })

  it('embeds the feedback form when one is configured', async () => {
    const html = await renderPage('../src/uninstall', { VITE_FEEDBACK_FORM_URL: FORM })
    expect(html).toContain('Help us improve')
    expect(html).toContain('What made you decide to uninstall Keep Notes?')
    expect(html).toContain('<iframe')
    expect(html).toContain('width="640"')
    expect(html).toContain('height="600"')
    expect(html).toContain('embedded=true')
    expect(html).toContain('referrerPolicy="no-referrer"')
    expect(html).not.toContain('frameBorder')
    expect(html).not.toContain('marginHeight')
    expect(html).not.toContain('marginWidth')
    expect(html).toContain('Open it in a new tab')
  })

  it('falls back to email when the configured form URL is not https', async () => {
    const html = await renderPage('../src/uninstall', { VITE_FEEDBACK_FORM_URL: 'http://insecure.example/form' })
    expect(html).not.toContain('<iframe')
    expect(html).toContain('mailto:')
  })
})

describe('privacy page', () => {
  it('renders the privacy policy with safe external links', async () => {
    const html = await renderPage('../src/privacy')
    expect(html).toContain('prose-lite')
    expect(html).toMatch(/<h1>/)
    for (const [, tag] of html.matchAll(/(<a [^>]*href="https?:[^>]*>)/g)) {
      expect(tag).toContain('rel="noopener noreferrer"')
    }
  })
})
