import { describe, expect, it } from 'vitest'
import {
  AUTO_TITLE_MAX_LENGTH,
  UNTITLED,
  deriveTitle,
  deriveTitleInputValue,
  firstMeaningfulLine,
  truncateText,
} from '../src/utils/generateTitle'

describe('firstMeaningfulLine', () => {
  it('skips leading blank lines and trims whitespace', () => {
    expect(firstMeaningfulLine('\n  \n   Grocery   list  \nsecond line')).toBe('Grocery list')
  })

  it('returns an empty string when the note has no content', () => {
    expect(firstMeaningfulLine('')).toBe('')
    expect(firstMeaningfulLine('   \n\t\n')).toBe('')
  })
})

describe('truncateText', () => {
  it('leaves short values untouched', () => {
    expect(truncateText('Short title', 50)).toBe('Short title')
  })

  it('truncates to the limit and appends an ellipsis', () => {
    const value = 'a'.repeat(80)
    const result = truncateText(value, AUTO_TITLE_MAX_LENGTH)
    expect(Array.from(result)).toHaveLength(AUTO_TITLE_MAX_LENGTH)
    expect(result.endsWith('…')).toBe(true)
    expect(result).not.toBe(value)
  })

  it('does not split surrogate pairs', () => {
    const value = '😀'.repeat(60)
    const result = truncateText(value, 10)
    expect(Array.from(result)).toHaveLength(10)
    expect(result).not.toContain('�')
  })
})

describe('deriveTitle', () => {
  it('uses Untitled note for an empty note', () => {
    expect(deriveTitle('')).toBe(UNTITLED)
    expect(deriveTitle('  \n\n  ')).toBe(UNTITLED)
  })

  it('derives a title from the first meaningful line', () => {
    expect(deriveTitle('\n\n  Reading notes about Chrome extensions  \nMore content')).toBe(
      'Reading notes about Chrome extensions'
    )
  })

  it('collapses whitespace within the line', () => {
    expect(deriveTitle('A    note\tabout   spacing')).toBe('A note about spacing')
  })

  it('truncates long first lines gracefully', () => {
    const content = `${'Long title '.repeat(12)}\nbody`
    const result = deriveTitle(content)
    expect(Array.from(result).length).toBeLessThanOrEqual(AUTO_TITLE_MAX_LENGTH)
    expect(result.endsWith('…')).toBe(true)
    expect(result.trimEnd()).toBe(result)
  })

  it('returns an empty input value for notes without content', () => {
    expect(deriveTitleInputValue('')).toBe('')
  })
})
