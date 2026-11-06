import { REPO_URL, STORE_URL } from '../config'

/** Install/reinstall link: Web Store when published, GitHub otherwise. */
export function GetExtensionButton({ label = 'Add to Chrome' }: { label?: string }) {
  const href = STORE_URL || REPO_URL
  return (
    <a className="btn btn-primary" href={href} rel="noopener noreferrer">
      {STORE_URL ? label : 'View on GitHub'}
    </a>
  )
}
