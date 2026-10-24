import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const dist = path.resolve(process.cwd(), 'dist')
const required = [
  'manifest.json',
  'background.js',
  'content.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
]
const allowedPermissions = new Set(['storage', 'activeTab', 'scripting'])
const forbiddenScriptPatterns = [
  /\beval\s*\(/,
  /\bnew\s+Function\b/,
  /\bdocument\.write\s*\(/,
  /\bimportScripts\s*\(/,
]
const failures = []

for (const file of required) {
  if (!fs.existsSync(path.join(dist, file))) {
    failures.push(`missing ${file}`)
  }
}

if (fs.existsSync(path.join(dist, 'manifest.json'))) {
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'))
  } catch (error) {
    failures.push(`manifest.json is not valid JSON: ${error.message}`)
  }

  if (manifest) {
    if (manifest.manifest_version !== 3) failures.push('manifest_version must be 3')
    if (manifest.background?.service_worker !== 'background.js') {
      failures.push('background.service_worker must point to background.js')
    }
    if (manifest.background?.type !== 'module') {
      failures.push('background.type must be "module"')
    }
    if (!Array.isArray(manifest.permissions) || !manifest.permissions.includes('storage')) {
      failures.push('permissions must include storage')
    }
    if (Array.isArray(manifest.permissions)) {
      for (const permission of manifest.permissions) {
        if (!allowedPermissions.has(permission)) {
          failures.push(`unexpected permission: ${permission}`)
        }
      }
    }
    if (manifest.content_scripts && manifest.content_scripts.length > 0) {
      failures.push('content_scripts should not be declared (the panel is injected on demand)')
    }
    if (manifest.host_permissions && manifest.host_permissions.length > 0) {
      failures.push('host_permissions should not be declared (activeTab is used instead)')
    }
    if (manifest.web_accessible_resources) {
      failures.push('web_accessible_resources must not expose extension files to web pages')
    }
    if (manifest.externally_connectable) {
      failures.push('externally_connectable must not let websites message the extension')
    }

    const csp = manifest.content_security_policy?.extension_pages
    if (typeof csp !== 'string') {
      failures.push('content_security_policy.extension_pages must be declared')
    } else {
      if (!/script-src\s+'self'/.test(csp)) {
        failures.push("CSP script-src must be limited to 'self'")
      }
      if (/unsafe-eval|unsafe-inline|https?:|\*/i.test(csp)) {
        failures.push('CSP must not allow unsafe-eval, unsafe-inline, remote, or wildcard scripts')
      }
      if (!/object-src\s+'self'|object-src\s+'none'/.test(csp)) {
        failures.push('CSP must restrict object-src')
      }
    }
  }
}

for (const file of ['background.js', 'content.js']) {
  const fullPath = path.join(dist, file)
  if (!fs.existsSync(fullPath)) continue
  const source = fs.readFileSync(fullPath, 'utf8')
  for (const pattern of forbiddenScriptPatterns) {
    if (pattern.test(source)) {
      failures.push(`${file} contains forbidden dynamic code execution: ${pattern}`)
    }
  }
  if (/\bchrome\.runtime\.onMessageExternal\b/.test(source)) {
    failures.push(`${file} must not listen for external extension messages`)
  }
}

if (fs.existsSync(path.join(dist, 'content.js'))) {
  const content = fs.readFileSync(path.join(dist, 'content.js'), 'utf8')
  if (!content.includes('keep-notes-extension-root')) {
    failures.push('content.js does not appear to mount the Keep Notes panel')
  }
}

if (failures.length) {
  console.error('Extension verification failed:')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}

console.log(
  'Verified dist/: Manifest V3, minimal permissions, strict CSP, no dynamic code execution, and required files.'
)
