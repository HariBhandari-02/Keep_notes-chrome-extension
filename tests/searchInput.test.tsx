// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchInput } from '../src/components/SearchInput'

describe('SearchInput', () => {
  it('clears the query with the clear button', () => {
    const onChange = vi.fn()
    render(<SearchInput value="notes" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('clears the query on Escape', () => {
    const onChange = vi.fn()
    render(<SearchInput value="notes" onChange={onChange} />)

    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search notes' }), {
      key: 'Escape',
    })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('blurs the input on Escape when the query is empty', () => {
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} />)

    const input = screen.getByRole('searchbox', { name: 'Search notes' })
    const blur = vi.spyOn(input, 'blur')

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(blur).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })
})
