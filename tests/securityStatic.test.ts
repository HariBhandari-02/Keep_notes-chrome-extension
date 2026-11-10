import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = path.join(root, 'src')

const FORBIDDEN_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'dangerouslySetInnerHTML', pattern: /dangerouslySetInnerHTML/ },
  { name: 'eval()', pattern: /\beval\s*\(/ },
  { name: 'new Function', pattern: /\bnew\s+Function\b/ },
  { name: 'innerHTML assignment', pattern: /\.innerHTML\s*=/ },
  { name: 'outerHTML assignment', pattern: /\.outerHTML\s*=/ },
  { name: 'insertAdjacentHTML', pattern: /insertAdjacentHTML/ },
  { name: 'document.write', pattern: /\bdocument\.write\s*\(/ },
  { name: 'iframe srcdoc', pattern: /\bsrcdoc\b/ },
  { name: 'javascript: URL', pattern: /javascript:/i },
  { name: 'external message handler', pattern: /\bonMessageExternal\b/ },
  { name: 'window.postMessage', pattern: /\bpostMessage\s*\(/ },
]

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(fullPath)
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : []
  })
}

describe('security static checks', () => {
  it('does not use unsafe HTML, code execution, or external messaging APIs in source', () => {
    const findings: string[] = []

    for (const file of sourceFiles(sourceRoot)) {
      const source = readFileSync(file, 'utf8')
      for (const rule of FORBIDDEN_PATTERNS) {
        if (rule.pattern.test(source)) {
          findings.push(`${path.relative(root, file)}: ${rule.name}`)
        }
      }
    }

    expect(findings).toEqual([])
  })

  it('does not load executable code from remote origins', () => {
    const findings: string[] = []

    for (const file of sourceFiles(sourceRoot)) {
      const source = readFileSync(file, 'utf8')
      if (/(?:src|href)\s*=\s*['"]https?:/i.test(source)) {
        findings.push(`${path.relative(root, file)}: remote script or resource`)
      }
    }

    expect(findings).toEqual([])
  })
})
