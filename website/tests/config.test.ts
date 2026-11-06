import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function loadConfig() {
  vi.resetModules()
  return import('../src/config')
}

describe('embedUrl', () => {
  it('rejects values that are not URLs', async () => {
    const { embedUrl } = await loadConfig()
    expect(embedUrl('not a url')).toBeUndefined()
    expect(embedUrl('')).toBeUndefined()
  })

  it('rejects non-https URLs', async () => {
    const { embedUrl } = await loadConfig()
    expect(embedUrl('http://tally.so/r/abc')).toBeUndefined()
    expect(embedUrl('javascript:alert(1)')).toBeUndefined()
  })

  it('adds embedded=true to Google Forms URLs', async () => {
    const { embedUrl } = await loadConfig()
    expect(embedUrl('https://docs.google.com/forms/d/e/X/viewform')).toBe(
      'https://docs.google.com/forms/d/e/X/viewform?embedded=true',
    )
  })

  it('keeps an existing embedded parameter on Google Forms URLs', async () => {
    const { embedUrl } = await loadConfig()
    expect(embedUrl('https://docs.google.com/forms/d/e/X/viewform?embedded=false')).toBe(
      'https://docs.google.com/forms/d/e/X/viewform?embedded=false',
    )
  })

  it('adds transparentBackground to Tally URLs', async () => {
    const { embedUrl } = await loadConfig()
    expect(embedUrl('https://tally.so/r/abc')).toBe('https://tally.so/r/abc?transparentBackground=1')
    expect(embedUrl('https://tally.so/r/abc?transparentBackground=0')).toBe(
      'https://tally.so/r/abc?transparentBackground=0',
    )
  })

  it('leaves other https URLs untouched', async () => {
    const { embedUrl } = await loadConfig()
    expect(embedUrl('https://example.com/form')).toBe('https://example.com/form')
  })
})

describe('config values', () => {
  it('builds page URLs from the base path', async () => {
    const { page, BASE_URL } = await loadConfig()
    expect(page('privacy.html')).toBe(`${BASE_URL}privacy.html`)
  })

  it('defaults optional URLs to empty strings', async () => {
    vi.stubEnv('VITE_STORE_URL', undefined as unknown as string)
    vi.stubEnv('VITE_FEEDBACK_FORM_URL', undefined as unknown as string)
    const { STORE_URL, FEEDBACK_FORM_URL } = await loadConfig()
    expect(STORE_URL).toBe('')
    expect(FEEDBACK_FORM_URL).toBe('')
  })

  it('trims configured URLs', async () => {
    vi.stubEnv('VITE_STORE_URL', '  https://store.example/keep  ')
    const { STORE_URL } = await loadConfig()
    expect(STORE_URL).toBe('https://store.example/keep')
  })
})
