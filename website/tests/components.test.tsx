import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function button(env: Record<string, string>, label?: string) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const { GetExtensionButton } = await import('../src/components/Buttons')
  return renderToStaticMarkup(<GetExtensionButton label={label} />)
}

describe('GetExtensionButton', () => {
  it('links to the Web Store with the default label when a store URL is set', async () => {
    const html = await button({ VITE_STORE_URL: 'https://store.example/keep' })
    expect(html).toContain('href="https://store.example/keep"')
    expect(html).toContain('>Add to Chrome<')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('uses a custom label when a store URL is set', async () => {
    const html = await button({ VITE_STORE_URL: 'https://store.example/keep' }, 'Reinstall Keep Notes')
    expect(html).toContain('>Reinstall Keep Notes<')
  })

  it('renders nothing before the extension is published', async () => {
    expect(await button({ VITE_STORE_URL: '' })).toBe('')
  })
})

describe('Layout', () => {
  async function layout(wide?: boolean) {
    const { Layout } = await import('../src/components/Layout')
    return renderToStaticMarkup(
      <Layout wide={wide}>
        <p>child content</p>
      </Layout>,
    )
  }

  it('renders the brand, navigation, children and support footer', async () => {
    const html = await layout()
    expect(html).toContain('<span>Keep Notes</span>')
    expect(html).toContain('href="/privacy.html"')
    expect(html).not.toContain('github.com')
    expect(html).toContain('child content')
    expect(html).toContain('mailto:keepnotes.support@gmail.com')
  })

  it('uses a narrow column by default and a wide one on request', async () => {
    expect(await layout()).toContain('max-w-2xl')
    expect(await layout(true)).toContain('pb-16 max-w-4xl')
  })
})
