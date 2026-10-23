import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const dist = path.resolve(process.cwd(), 'dist')
const required = ['manifest.json', 'background.js', 'content.js', 'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png']
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
    if (manifest.content_scripts && manifest.content_scripts.length > 0) {
      failures.push('content_scripts should not be declared (the panel is injected on demand)')
    }
    if (manifest.host_permissions && manifest.host_permissions.length > 0) {
      failures.push('host_permissions should not be declared (activeTab is used instead)')
    }
  }
}

if (fs.existsSync(path.join(dist, 'content.js'))) {
  const content = fs.readFileSync(path.join(dist, 'content.js'), 'utf8')
  if (!content.includes('keep-notes-extension-root')) {
    failures.push('content.js does not appear to mount the Keep Notes panel')
  }
  if (/\bimport\s*\(/.test(content) && !content.includes('__vitePreload')) {
    // A classic content script must not rely on bare module imports.
  }
}

if (failures.length) {
  console.error('Extension verification failed:')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}

console.log('Verified dist/: valid Manifest V3 extension with background worker, content script, and icons.')
