// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '../src/mount'

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('mount', () => {
  it('renders the element into #root', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    await act(async () => mount(<p>hello</p>))
    expect(document.getElementById('root')?.innerHTML).toBe('<p>hello</p>')
  })

  it('throws when #root is missing', () => {
    expect(() => mount(<p>hello</p>)).toThrow('Missing #root element')
  })
})
