import { describe, expect, it } from 'vitest'
import { MAX_NOTE_MARKS } from '../src/utils/noteLimits'
import { alignHeadingLines, buildSegments, marksEqual, normalizeMarks } from '../src/utils/noteMarks'

describe('link marks', () => {
  const A = 'https://a.example/page'
  const B = 'https://b.example/'

  it('keeps only safe http(s) links and strips credentials', () => {
    expect(
      normalizeMarks(
        [
          { type: 'link', start: 0, end: 2 },
          { type: 'link', start: 0, end: 2, href: 'javascript' + ':alert(1)' },
          { type: 'link', start: 0, end: 2, href: 'data:text/html,hi' },
          { type: 'link', start: 3, end: 5, href: 'https://user:pass@a.example/page' },
        ],
        10
      )
    ).toEqual([{ type: 'link', start: 3, end: 5, href: A }])
  })

  it('merges touching links to the same URL but not to different URLs', () => {
    expect(
      normalizeMarks(
        [
          { type: 'link', start: 0, end: 3, href: A },
          { type: 'link', start: 3, end: 5, href: A },
          { type: 'link', start: 4, end: 8, href: B },
        ],
        10
      )
    ).toEqual([
      { type: 'link', start: 0, end: 5, href: A },
      { type: 'link', start: 5, end: 8, href: B },
    ])
  })

  it('compares hrefs and carries them into segments', () => {
    const a = [{ type: 'link' as const, start: 0, end: 2, href: A }]
    const b = [{ type: 'link' as const, start: 0, end: 2, href: B }]
    expect(marksEqual(a, b)).toBe(false)
    expect(
      buildSegments('abc', [{ type: 'bold', start: 0, end: 1 }, ...a])
    ).toEqual([
      { text: 'a', types: ['bold'], href: A },
      { text: 'b', types: [], href: A },
      { text: 'c', types: [] },
    ])
  })
})

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

describe('heading marks', () => {
  it('are kept, merged, and ordered after the text formats', () => {
    expect(
      normalizeMarks(
        [
          { type: 'heading', start: 4, end: 9 },
          { type: 'heading', start: 0, end: 3 },
          { type: 'heading', start: 2, end: 3 },
          { type: 'link', start: 0, end: 2, href: 'https://a.example/' },
          { type: 'bold', start: 1, end: 2 },
        ],
        10
      )
    ).toEqual([
      { type: 'bold', start: 1, end: 2 },
      { type: 'heading', start: 0, end: 3 },
      { type: 'heading', start: 4, end: 9 },
      { type: 'link', start: 0, end: 2, href: 'https://a.example/' },
    ])
  })

  it('flag the segments they cover', () => {
    expect(
      buildSegments('Hi\nyou', [
        { type: 'bold', start: 1, end: 2 },
        { type: 'heading', start: 0, end: 2 },
      ])
    ).toEqual([
      { text: 'H', types: [], heading: true },
      { text: 'i', types: ['bold'], heading: true },
      { text: '\nyou', types: [] },
    ])
  })

  it('are widened to whole lines and split at line breaks', () => {
    const content = 'one\ntwo\n\nthree'
    expect(
      alignHeadingLines(content, [
        { type: 'bold', start: 0, end: 1 },
        { type: 'heading', start: 1, end: 2 },
        { type: 'heading', start: 2, end: 6 },
        { type: 'heading', start: 8, end: 10 },
      ])
    ).toEqual([
      { type: 'bold', start: 0, end: 1 },
      { type: 'heading', start: 0, end: 3 },
      { type: 'heading', start: 4, end: 7 },
      { type: 'heading', start: 9, end: 14 },
    ])
  })

  it('cover no line when they only span a line break', () => {
    expect(alignHeadingLines('a\n\nb', [{ type: 'heading', start: 2, end: 3 }])).toEqual([])
  })
})
