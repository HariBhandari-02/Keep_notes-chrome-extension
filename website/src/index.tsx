import { GetExtensionButton } from './components/Buttons'
import { Layout } from './components/Layout'
import { mount } from './mount'

const FEATURES = [
  ['Floating panel', 'Open a notepad on any page and keep reading. Drag it, resize it, minimize it.'],
  ['Local-first', 'Notes are saved on your device with autosave. No account, no server, no tracking.'],
  ['Capture as you read', 'Select text and click Add selected text to save it with a link back to the page.'],
  ['Search and organize', 'Multiple notes, pinning, automatic titles, search, and light, dark or system themes.'],
] as const

function Home() {
  return (
    <Layout wide>
      <section className="py-12 text-center">
        <h1 className="text-4xl font-bold sm:text-5xl">A floating notepad for Chrome</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg opacity-80">
          Capture notes while you read without leaving the page. Fast, private and always one shortcut away.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <GetExtensionButton />
        </div>
        <p className="mt-3 text-sm opacity-70">
          Shortcut: <span className="kbd">Alt</span> + <span className="kbd">Shift</span> + <span className="kbd">K</span>
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(([title, body]) => (
          <div key={title} className="card">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm opacity-80">{body}</p>
          </div>
        ))}
      </section>
    </Layout>
  )
}

mount(<Home />)
