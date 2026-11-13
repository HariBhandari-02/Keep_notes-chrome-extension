import { STORE_URL } from '../config'

/** Install/reinstall link: shown only once the extension is published. */
export function GetExtensionButton({ label = 'Add to Chrome' }: Readonly<{ label?: string }>) {
  if (!STORE_URL) return null

  return (
    <a className="btn btn-primary" href={STORE_URL} rel="noopener noreferrer">
      {label}
    </a>
  )
}
