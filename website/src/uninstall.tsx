import { GetExtensionButton } from './components/Buttons'
import { Layout } from './components/Layout'
import { embedUrl, FEEDBACK_FORM_URL, SUPPORT_EMAIL } from './config'
import { mount } from './mount'

function FeedbackForm() {
  const src = FEEDBACK_FORM_URL ? embedUrl(FEEDBACK_FORM_URL) : undefined

  if (!src) {
    return (
      <div className="card text-center">
        <p>
          We would love to know what went wrong. Email us at{' '}
          <a
            className="font-semibold underline"
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Keep Notes feedback')}`}
          >
            {SUPPORT_EMAIL}
          </a>.
        </p>
      </div>
    )
  }

  return (
    <div>
      <iframe
        title="Keep Notes uninstall feedback form"
        src={src}
        className="h-[720px] w-full rounded-2xl border border-note-200 bg-white dark:border-zinc-800"
        loading="lazy"
        referrerPolicy="no-referrer"
      >
        Loading…
      </iframe>
      <p className="mt-3 text-center text-sm opacity-70">
        Form not loading?{' '}
        <a href={FEEDBACK_FORM_URL} rel="noopener noreferrer" target="_blank">
          Open it in a new tab
        </a>.
      </p>
    </div>
  )
}

function Uninstall() {
  return (
    <Layout>
      <section className="py-10 text-center">
        <h1 className="text-3xl font-bold">Sorry to see you go</h1>
        <p className="mt-3 opacity-80">
          Keep Notes has been removed and its notes were deleted from this browser. A minute of feedback helps us make
          it better for others. Nothing here is linked to you.
        </p>
      </section>
      <FeedbackForm />
      <section className="mt-10 text-center">
        <p className="mb-3 text-sm opacity-80">Uninstalled by accident?</p>
        <GetExtensionButton label="Reinstall Keep Notes" />
      </section>
    </Layout>
  )
}

mount(<Uninstall />)
