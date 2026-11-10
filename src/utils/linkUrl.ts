import { MAX_LINK_URL_LENGTH } from './noteLimits'

/**
 * Returns a URL that is safe to store and render as a link, or null. Only http(s)
 * is allowed so stored data can never become a script or local-file link, and
 * embedded credentials are dropped so they are not copied into notes.
 */
export function toLinkHref(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LINK_URL_LENGTH) return null

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  url.username = ''
  url.password = ''
  return url.href.length <= MAX_LINK_URL_LENGTH ? url.href : null
}
