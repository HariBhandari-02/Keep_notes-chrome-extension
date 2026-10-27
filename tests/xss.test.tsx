// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../src/App'
import { NoteEditor } from '../src/components/NoteEditor'
import { NoteList } from '../src/components/NoteList'
import { __resetPanelBusForTests } from '../src/content/panelBus'
import {
  NOTE_KEY_PREFIX,
  SETTINGS_KEY,
  __resetStorageStateForTests,
} from '../src/services/notesStorage'
import type { Note } from '../src/types/note'
import { installFakeChrome } from './helpers/fakeChrome'

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
]

function makeNote(payload: string): Note {
  return {
    id: 'xss-note',
    title: payload,
    customTitle: true,
    content: payload,
    createdAt: 1,
    updatedAt: 1,
  }
}

function expectNoInjectedMarkup(container: HTMLElement): void {
  expect(container.querySelector('script, img, iframe, object, embed')).toBeNull()
  expect(container.querySelector('svg[onload], [onerror]')).toBeNull()
}

describe('untrusted note rendering', () => {
  beforeEach(() => {
    __resetStorageStateForTests()
    __resetPanelBusForTests()
    ;(window as unknown as Record<string, unknown>).__xss = 0
  })

  afterEach(() => {
    __resetStorageStateForTests()
    delete (window as unknown as Record<string, unknown>).__xss
  })

  it.each(PAYLOADS)('renders %s as text in the notes list', (payload) => {
    const { container } = render(
      <NoteList
        notes={[makeNote(payload)]}
        totalCount={1}
        query=""
        selectedId="xss-note"
        confirmDeleteId={null}
        onQueryChange={() => undefined}
        onSelect={() => undefined}
        onRequestDelete={() => undefined}
        onCancelDelete={() => undefined}
        onConfirmDelete={() => undefined}
        onCreate={() => undefined}
      />
    )

    expect(container.textContent).toContain(payload)
    expectNoInjectedMarkup(container)
    expect((window as unknown as Record<string, unknown>).__xss).toBe(0)
  })

  it.each(PAYLOADS)('renders %s as text in the editor fields', (payload) => {
    const { container } = render(
      <NoteEditor
        note={makeNote(payload)}
        focusSignal={0}
        getPageSelection={() => ''}
        onChangeContent={() => undefined}
        onChangeTitle={() => undefined}
        onNotice={() => undefined}
      />
    )

    const title = screen.getByRole('textbox', { name: 'Note title' }) as HTMLInputElement
    const content = screen.getByRole('textbox', { name: 'Note content' }) 
    expect(title.value).toBe(payload)
    expect(content.textContent).toBe(payload)
    expectNoInjectedMarkup(container)
    expect((window as unknown as Record<string, unknown>).__xss).toBe(0)
  })

  it.each(PAYLOADS)('does not execute %s loaded from storage', async (payload) => {
    const fake = installFakeChrome()
    fake.data[`${NOTE_KEY_PREFIX}xss-note`] = makeNote(payload)
    fake.data[SETTINGS_KEY] = { selectedNoteId: 'xss-note' }

    const { container } = render(<App getPageSelection={() => ''} />)

    const content = await screen.findByRole('textbox', { name: 'Note content' })
    await waitFor(() => expect(content.textContent).toBe(payload))
    expectNoInjectedMarkup(container)
    expect((window as unknown as Record<string, unknown>).__xss).toBe(0)
  })
})
