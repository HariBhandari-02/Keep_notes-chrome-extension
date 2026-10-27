import { describe, expect, it } from 'vitest'
import { MAX_NOTE_MARKS } from '../src/utils/noteLimits'
import { buildSegments, marksEqual, normalizeMarks } from '../src/utils/noteMarks'

describe('normalizeMarks', () => {
  it('rejects non-array input', () => {
    expect(normalizeMarks(undefined, 10)).toEqual([])
    expect(normalizeMarks({ type: 'bold', start: 0, end: 1 }, 10)).toEqual([])
  })

  it('drops invalid entries, empty ranges, and unknown types', () => {
    expect(
      normalizeMarks(
        [
          null,
          'bold',
          { type: 'strike', start: 0, end: 2 },
          { type: 'bold', start: -1, end: 2 },
          { type: 'bold', start: 1.5, end: 2 },
          { type: 'bold', start: '0', end: 2 },
          { type: 'bold', start: 3, end: 3 },
          { type: 'bold', start: 4, end: 2 },
          { type: 'italic', start: 0, end: 2 },
        ],
        10
      )
    ).toEqual([{ type: 'italic', start: 0, end: 2 }])
  })

  it('clamps ranges to the content length', () => {
    expect(normalizeMarks([{ type: 'underline', start: 2, end: 99 }], 5)).toEqual([
      { type: 'underline', start: 2, end: 5 },
    ])
    expect(normalizeMarks([{ type: 'underline', start: 7, end: 9 }], 5)).toEqual([])
  })

  it('merges overlapping and touching ranges per type and orders by type', () => {
    expect(
      normalizeMarks(
        [
          { type: 'italic', start: 6, end: 8 },
          { type: 'bold', start: 4, end: 6 },
          { type: 'bold', start: 0, end: 2 },
          { type: 'bold', start: 1, end: 4 },
          { type: 'bold', start: 8, end: 9 },
        ],
        10
      )
    ).toEqual([
      { type: 'bold', start: 0, end: 6 },
      { type: 'bold', start: 8, end: 9 },
      { type: 'italic', start: 6, end: 8 },
    ])
  })

  it('caps the number of marks read from untrusted data', () => {
    const raw = Array.from({ length: MAX_NOTE_MARKS + 50 }, (_, index) => ({
      type: 'bold',
      start: index * 2,
      end: index * 2 + 1,
    }))
    expect(normalizeMarks(raw, 100_000)).toHaveLength(MAX_NOTE_MARKS)
  })
})

describe('marksEqual', () => {
  it('compares marks by value', () => {
    const a = [{ type: 'bold' as const, start: 0, end: 2 }]
    expect(marksEqual(a, [{ type: 'bold', start: 0, end: 2 }])).toBe(true)
    expect(marksEqual(a, [{ type: 'bold', start: 0, end: 3 }])).toBe(false)
    expect(marksEqual(a, [{ type: 'italic', start: 0, end: 2 }])).toBe(false)
    expect(marksEqual(a, [])).toBe(false)
  })
})

describe('buildSegments', () => {
  it('returns one plain segment without marks', () => {
    expect(buildSegments('plain', [])).toEqual([{ text: 'plain', types: [] }])
  })

  it('returns no segments for empty content', () => {
    expect(buildSegments('', [])).toEqual([])
  })

  it('splits text where overlapping marks start and end', () => {
    const marks = normalizeMarks(
      [
        { type: 'bold', start: 0, end: 6 },
        { type: 'italic', start: 4, end: 9 },
        { type: 'underline', start: 11, end: 13 },
      ],
      13
    )
    expect(buildSegments('Hello, world!', marks)).toEqual([
      { text: 'Hell', types: ['bold'] },
      { text: 'o,', types: ['bold', 'italic'] },
      { text: ' wo', types: ['italic'] },
      { text: 'rl', types: [] },
      { text: 'd!', types: ['underline'] },
    ])
  })
})
