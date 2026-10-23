export const AUTO_TITLE_MAX_LENGTH = 50
export const UNTITLED = 'Untitled note'
const ELLIPSIS = '…'

export function firstMeaningfulLine(content: string): string {
  if (!content) return ''
  const lines = content.split(/\r\n|\r|\n/)
  for (const line of lines) {
    const normalized = line.replace(/\s+/g, ' ').trim()
    if (normalized.length > 0) return normalized
  }
  return ''
}

export function truncateText(value: string, maxLength: number): string {
  const characters = Array.from(value)
  if (characters.length <= maxLength) return value
  if (maxLength <= 1) return ELLIPSIS
  return `${characters.slice(0, maxLength - 1).join('').trimEnd()}${ELLIPSIS}`
}

export function deriveTitle(content: string, maxLength = AUTO_TITLE_MAX_LENGTH): string {
  const line = firstMeaningfulLine(content)
  if (!line) return UNTITLED
  return truncateText(line, maxLength)
}

export function deriveTitleInputValue(content: string, maxLength = AUTO_TITLE_MAX_LENGTH): string {
  const line = firstMeaningfulLine(content)
  return line ? truncateText(line, maxLength) : ''
}
