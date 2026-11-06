const clean = (value: string | undefined): string => (value ?? '').trim()

export const BASE_URL = import.meta.env.BASE_URL
export const REPO_URL = 'https://github.com/HariBhandari-02/Keep_notes-chrome-extension'
export const SUPPORT_EMAIL = 'keepnotes.support@gmail.com'

/** Chrome Web Store listing. Empty until the extension is published. */
export const STORE_URL = clean(import.meta.env.VITE_STORE_URL)

/** Embeddable feedback form (Google Forms or Tally). Empty falls back to email. */
export const FEEDBACK_FORM_URL = clean(import.meta.env.VITE_FEEDBACK_FORM_URL)

export const page = (name: string): string => `${BASE_URL}${name}`

/** Only https URLs are embedded; anything else is ignored. */
export function embedUrl(raw: string): string | undefined {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:') return undefined
  if (url.hostname === 'docs.google.com' && !url.searchParams.has('embedded')) {
    url.searchParams.set('embedded', 'true')
  }
  if (url.hostname === 'tally.so' && !url.searchParams.has('transparentBackground')) {
    url.searchParams.set('transparentBackground', '1')
  }
  return url.toString()
}
