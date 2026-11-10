import { Layout } from './components/Layout'
import { BASE_URL } from './config'
import { mount } from './mount'

type Step = {
  title: string
  body: string
  image: string
  alt: string
}

const STEPS: readonly Step[] = [
  {
    title: 'Open your notepad',
    body: 'Click the Keep Notes icon in the toolbar on any website, or press Alt + Shift + K, and the floating panel appears beside the page you are reading. Pin the extension from the puzzle-piece menu to keep it one click away.',
    image: 'guide-open.webp',
    alt: 'The Keep Notes panel open beside an article, showing an empty My Notes list and a New Note button',
  },
  {
    title: 'Write and format a note',
    body: 'Click New Note and start typing. Use the toolbar for bold, italic, underline and headings. Your note saves automatically, so there is no save button to hunt for.',
    image: 'guide-write.webp',
    alt: 'The note editor with a formatting toolbar, a heading, bold and italic text, and a Save automatically badge',
  },
  {
    title: 'Capture text while you read',
    body: 'Highlight a passage on the page, then click Add selected text in the panel. It becomes a note with a source link back to the page, so you can always find where an idea came from.',
    image: 'guide-capture.webp',
    alt: 'Four steps: highlight text on the page, click Add selected text, a note is created, and the source link is attached',
  },
  {
    title: 'Pin, search and organize',
    body: 'Pin the notes you need most so they stay at the top, and search by title or content to find anything fast. Edit, pin or delete a note from its menu.',
    image: 'guide-organize.webp',
    alt: 'The Keep Notes panel with a search box, a Pinned Notes section and an All Notes list with edit, pin and delete actions',
  },
  {
    title: 'Your notes stay on your device',
    body: 'Notes are saved only in this browser. Keep Notes has no account, no backend and no analytics, so nothing you write ever leaves your computer.',
    image: 'guide-private.webp',
    alt: 'A laptop with a padlock shield over the Keep Notes panel, illustrating local-first storage',
  },
]

function Welcome() {
  return (
    <Layout wide>
      <section className="py-10 text-center">
        <p className="text-5xl" aria-hidden="true">
          🎉
        </p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Thanks for installing Keep Notes</h1>
        <p className="mt-3 opacity-80">You are all set. Here is how to get the most out of it in five quick steps.</p>
        <p className="mt-3 text-sm opacity-70">
          Shortcut: <span className="kbd">Alt</span> + <span className="kbd">Shift</span> + <span className="kbd">K</span>
        </p>
      </section>

      <ol className="space-y-8">
        {STEPS.map((step, index) => (
          <li key={step.title} className="card overflow-hidden p-0">
            <img
              src={`${BASE_URL}images/${step.image}`}
              alt={step.alt}
              width={1376}
              height={768}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="block h-auto w-full"
            />
            <div className="flex gap-4 p-6">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-note-400 font-bold text-note-900"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div>
                <h2 className="text-lg font-semibold">{step.title}</h2>
                <p className="mt-1 text-sm opacity-80">{step.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-8 rounded-xl bg-note-100 p-4 text-sm dark:bg-zinc-900">
        Keep Notes cannot run on Chrome&apos;s own pages (like chrome://settings) or the Chrome Web Store. Open any
        regular website and it will work.
      </p>
    </Layout>
  )
}

mount(<Welcome />)
