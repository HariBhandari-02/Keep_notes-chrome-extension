import { vi } from 'vitest'

type StorageItems = Record<string, unknown>

export interface FakeChromeOptions {
  writeDelayMs?: number
  failWrites?: boolean
}

export interface FakeChrome {
  data: StorageItems
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function selectKeys(data: StorageItems, keys: unknown): StorageItems {
  if (keys === null || typeof keys === 'undefined') return clone(data)
  if (typeof keys === 'string') {
    return keys in data ? { [keys]: clone(data[keys]) } : {}
  }
  if (Array.isArray(keys)) {
    const result: StorageItems = {}
    for (const key of keys) {
      if (typeof key === 'string' && key in data) result[key] = clone(data[key])
    }
    return result
  }
  if (typeof keys === 'object') return selectKeys(data, Object.keys(keys as object))
  return {}
}

export function installFakeChrome(options: FakeChromeOptions = {}): FakeChrome {
  const data: StorageItems = {}

  const get = vi.fn(async (keys: unknown) => selectKeys(data, keys))

  const set = vi.fn(async (items: StorageItems) => {
    if (options.writeDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.writeDelayMs))
    }
    if (options.failWrites) throw new Error('storage write failed')
    Object.assign(data, clone(items))
  })

  const remove = vi.fn(async (keys: string | string[]) => {
    const list = Array.isArray(keys) ? keys : [keys]
    for (const key of list) delete data[key]
  })

  vi.stubGlobal('chrome', {
    storage: {
      local: { get, set, remove },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  })

  return { data, get, set, remove }
}
