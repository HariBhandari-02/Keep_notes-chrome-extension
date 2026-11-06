import { Layout } from './components/Layout'
import { mount } from './mount'

const STEPS = [
  ['Pin the extension', 'Click the puzzle-piece icon in the Chrome toolbar and pin Keep Notes so it is one click away.'],
  ['Open your notepad', 'Click the Keep Notes icon on any regular website, or press Alt + Shift + K to toggle the panel.'],
  ['Capture while you read', 'Select text on a page and click Add selected text. It is saved with a link back to the page.'],
  ['Make it yours', 'Switch between light, dark and system themes, pin important notes, and search them all.'],
] as const

function Welcome() {
  return (
    <Layout>
      <section className="py-10 text-center">
        <p className="text-5xl" aria-hidden="true">
          🎉
        </p>
        <h1 className="mt-4 text-3xl font-bold">Thanks for installing Keep Notes</h1>
        <p className="mt-3 opacity-80">You are all set. Here is how to get started.</p>
      </section>
      <ol className="space-y-3">
        {STEPS.map(([title, body], index) => (
          <li key={title} className="card flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-note-400 font-bold text-note-900">
              {index + 1}
            </span>
            <div>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm opacity-80">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 rounded-xl bg-note-100 p-4 text-sm dark:bg-zinc-900">
        <strong>Your notes stay private.</strong> They are saved only in this browser. Keep Notes has no account, no
        backend and no analytics. Note that Keep Notes cannot run on Chrome&apos;s own pages (like chrome://settings) or
        the Chrome Web Store.
      </p>
    </Layout>
  )
}

mount(<Welcome />)
