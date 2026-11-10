import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(`${root}/public/manifest.json`, 'utf8')) as Record<string, any>

describe('manifest', () => {
  it('is a Manifest V3 extension with a module service worker', () => {
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.background).toEqual({ service_worker: 'background.js', type: 'module' })
  })

  it('requests only the permissions needed for the floating panel', () => {
    expect(manifest.permissions).toEqual(['storage', 'activeTab', 'scripting'])
    expect(manifest.host_permissions).toBeUndefined()
    expect(manifest.content_scripts).toBeUndefined()
  })

  it('declares a restrictive extension CSP and exposes no web resources', () => {
    const csp = manifest.content_security_policy?.extension_pages
    expect(typeof csp).toBe('string')
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toMatch(/unsafe-eval|unsafe-inline|https?:|\*/)
    expect(manifest.web_accessible_resources).toBeUndefined()
    expect(manifest.externally_connectable).toBeUndefined()
  })

  it('declares icons at the required sizes', () => {
    for (const size of [16, 32, 48, 128]) {
      expect(manifest.icons[String(size)]).toBe(`icons/icon${size}.png`)
      expect(existsSync(`${root}/public/icons/icon${size}.png`)).toBe(true)
    }
  })

  it('exposes a keyboard command to toggle the panel', () => {
    expect(manifest.commands['toggle-panel']).toBeDefined()
    expect(manifest.commands['toggle-panel'].suggested_key.default).toBeTruthy()
  })
})
