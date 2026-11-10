import path from 'node:path'
import process from 'node:process'
import { build, loadConfigFromFile } from 'vite'

const watch = process.argv.includes('--watch')
const root = process.cwd()

async function config(name) {
  const result = await loadConfigFromFile(
    { command: 'build', mode: watch ? 'development' : 'production' },
    path.resolve(root, name),
    undefined,
    'silent'
  )
  if (!result) {
    throw new Error(`Unable to load ${name}`)
  }
  return result.config
}

async function main() {
  const background = await config('vite.config.ts')
  const content = await config('vite.content.config.ts')

  await build({
    ...background,
    configFile: false,
    build: {
      ...background.build,
      emptyOutDir: true,
      minify: watch ? false : 'oxc',
      ...(watch ? { watch: {} } : {}),
    },
  })

  await build({
    ...content,
    configFile: false,
    build: {
      ...content.build,
      emptyOutDir: false,
      minify: watch ? false : 'oxc',
      ...(watch ? { watch: {} } : {}),
    },
  })

  if (watch) {
    console.log('\nWatching for changes... Reload the extension in chrome://extensions after each rebuild.')
  } else {
    console.log('\nBuild complete: dist/')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
