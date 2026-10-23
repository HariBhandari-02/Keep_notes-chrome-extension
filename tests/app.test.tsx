// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { __resetPanelBusForTests } from '../src/content/panelBus'
import {
  NOTE_KEY_PREFIX,
  SETTINGS_KEY,
  __resetStorageStateForTests,
} from '../src/services/notesStorage'
import type { Note } from '../src/types/note'
import { installFakeChrome } from './helpers/fakeChrome'

function storedNotes(data: Record<string, unknown>): Note[] {
  return Object.entries(data)
    .filter(([key]) => key.startsWith(NOTE_KEY_PREFIX))
    .map(([, value]) => value as Note)
}

describe('Keep Notes panel', () => {
  beforeEach(() => {
    __resetStorageStateForTests()
    __resetPanelBusForTests()
  })

  afterEach(() => {
    __resetStorageStateForTests()
    vi.unstubAllGlobals()
  })

  it('creates, edits, searches, reopens, and deletes notes', async () => {
    const fake = installFakeChrome()
    const user = userEvent.setup()

    render(<App getPageSelection={() => ''} />)

    expect(await screen.findByText('A quiet place for your thoughts')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Create your first note' }))

    const content = await screen.findByRole('textbox', { name: 'Note content' })
    expect(content).toBeTruthy()

    await user.click(content)
    await user.type(content, 'My first note{enter}Body text about Chrome extensions')
    expect((content as HTMLTextAreaElement).value).toContain('Chrome extensions')

    const title = screen.getByRole('textbox', { name: 'Note title' }) as HTMLInputElement
    await waitFor(() => expect(title.value).toBe('My first note'))

    await user.click(title)
    await user.clear(title)
    await user.type(title, 'Project ideas')
    await user.click(content)
    await waitFor(() => expect(title.value).toBe('Project ideas'))

    await waitFor(
      () => {
        const notes = storedNotes(fake.data)
        expect(notes).toHaveLength(1)
        expect(notes[0].title).toBe('Project ideas')
        expect(notes[0].content).toContain('Body text')
      },
      { timeout: 2500 }
    )

    await user.click(screen.getByRole('button', { name: 'Show notes list' }))
    expect(screen.getByText('Project ideas')).toBeTruthy()
    expect(screen.getByText(/Body text about Chrome extensions/)).toBeTruthy()

    const search = screen.getByRole('searchbox', { name: 'Search notes' })
    await user.type(search, 'chrome')
    expect(screen.getByText('Project ideas')).toBeTruthy()

    await user.clear(search)
    await user.type(search, 'zzz-no-match')
    expect(screen.getByText(/No notes match/)).toBeTruthy()

    await user.click(screen.getByText('Clear search'))
    await user.click(screen.getByText('Project ideas'))

    const reopenedContent = await screen.findByRole('textbox', { name: 'Note content' })
    expect((reopenedContent as HTMLTextAreaElement).value).toContain('Body text')

    await user.click(screen.getByRole('button', { name: 'Show notes list' }))
    await user.click(screen.getByRole('button', { name: 'Delete note: Project ideas' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.getByText('No notes yet')).toBeTruthy())
    expect(storedNotes(fake.data)).toHaveLength(0)
  })

  it('shows resize handles and hides them while minimized', async () => {
    installFakeChrome()
    const user = userEvent.setup()
    const { container } = render(<App getPageSelection={() => ''} />)

    await screen.findByText('A quiet place for your thoughts')
    expect(container.querySelectorAll('.keep-notes-resize-handle')).toHaveLength(8)

    await user.click(screen.getByRole('button', { name: 'Minimize Keep Notes' }))
    await waitFor(() =>
      expect(container.querySelectorAll('.keep-notes-resize-handle')).toHaveLength(0)
    )

    await user.click(screen.getByRole('button', { name: 'Expand Keep Notes' }))
    await waitFor(() =>
      expect(container.querySelectorAll('.keep-notes-resize-handle')).toHaveLength(8)
    )
  })

  it('restores saved notes and the selected note on reopen', async () => {
    const fake = installFakeChrome()
    const now = Date.now()
    const existing: Note = {
      id: 'existing-note',
      title: 'Saved title',
      customTitle: true,
      content: 'Saved note content that survives a remount.',
      createdAt: now - 1000,
      updatedAt: now - 500,
    }

    fake.data[`${NOTE_KEY_PREFIX}existing-note`] = existing
    fake.data[SETTINGS_KEY] = {
      theme: 'light',
      panelPosition: { x: 40, y: 40 },
      panelMinimized: false,
      selectedNoteId: 'existing-note',
    }

    __resetPanelBusForTests()
    render(<App getPageSelection={() => ''} />)

    const content = await screen.findByRole('textbox', { name: 'Note content' })
    expect((content as HTMLTextAreaElement).value).toBe(existing.content)

    const title = screen.getByRole('textbox', { name: 'Note title' }) as HTMLInputElement
    expect(title.value).toBe('Saved title')
  })

  it('resumes automatic titles after a custom title is cleared', async () => {
    installFakeChrome()
    const user = userEvent.setup()

    render(<App getPageSelection={() => ''} />)
    await screen.findByText('A quiet place for your thoughts')
    await user.click(screen.getByRole('button', { name: 'Create your first note' }))

    const content = await screen.findByRole('textbox', { name: 'Note content' })
    await user.type(content, 'Automatic title from content{enter}More text')

    const title = screen.getByRole('textbox', { name: 'Note title' }) as HTMLInputElement
    await waitFor(() => expect(title.value).toBe('Automatic title from content'))

    await user.click(title)
    await user.clear(title)
    await user.type(title, 'Temporary custom title')
    await waitFor(() => expect(title.value).toBe('Temporary custom title'))

    await user.clear(title)
    await user.click(content)
    await waitFor(() => expect(title.value).toBe('Automatic title from content'))
  })
})
