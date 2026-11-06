// Public pages for Keep Notes, hosted on GitHub Pages (see website/).
// Nothing here is sent by the extension: Chrome (or the user's tab) opens these URLs.
export const SITE_URL = 'https://haribhandari-02.github.io/Keep_notes-chrome-extension/'

export const WELCOME_URL = `${SITE_URL}welcome.html`

export function uninstallUrl(version: string): string {
  return `${SITE_URL}uninstall.html?v=${encodeURIComponent(version)}`
}
