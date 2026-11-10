/**
 * Inline vector of the extension icon's sticky note (assets/icon-source.png).
 * Drawn as SVG instead of an <img> so host-page CSP and the ban on web_accessible_resources don't apply.
 */
export function BrandMark() {
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" className="shrink-0 drop-shadow-sm" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="#f4e9d8" />
      <g transform="rotate(-12 14 14)" stroke="#1f1f1f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 7h10a2 2 0 0 1 2 2v8l-4 4H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" fill="#fdd740" />
        <path d="M21 17h-2.6a1.4 1.4 0 0 0-1.4 1.4V21" fill="#fde98f" strokeWidth="1.2" />
        <path d="M10.5 11h7M10.5 14h7M10.5 17h4" fill="none" />
      </g>
    </svg>
  )
}
