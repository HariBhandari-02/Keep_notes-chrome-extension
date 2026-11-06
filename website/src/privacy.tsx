import Markdown from 'react-markdown'
import policy from '../../PRIVACY.md?raw'
import { Layout } from './components/Layout'
import { mount } from './mount'

function Privacy() {
  return (
    <Layout>
      <article className="prose-lite">
        <Markdown
          components={{
            a: ({ href, children }) => (
              <a href={href} rel="noopener noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {policy}
        </Markdown>
      </article>
    </Layout>
  )
}

mount(<Privacy />)
