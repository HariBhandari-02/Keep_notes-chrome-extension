import Markdown, { type Components } from 'react-markdown'
import policy from '../../PRIVACY.md?raw'
import { Layout } from './components/Layout'
import { mount } from './mount'

const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} rel="noopener noreferrer">
      {children}
    </a>
  ),
}

function Privacy() {
  return (
    <Layout>
      <article className="prose-lite">
        <Markdown components={MARKDOWN_COMPONENTS}>{policy}</Markdown>
      </article>
    </Layout>
  )
}

mount(<Privacy />)
