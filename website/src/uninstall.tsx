import { GetExtensionButton } from './components/Buttons'
import { Layout } from './components/Layout'
import { embedUrl, FEEDBACK_FORM_URL, STORE_URL, SUPPORT_EMAIL } from './config'
import { mount } from './mount'

function FeedbackForm() {
  const src = FEEDBACK_FORM_URL ? embedUrl(FEEDBACK_FORM_URL) : undefined

  return (
    <section className="feedback-section text-center">
      <h2 className="text-xl font-semibold">Help us improve</h2>
      <p className="mt-2 opacity-80">What made you decide to uninstall Keep Notes?</p>

      {src ? (
        <div className="mt-5">
          <iframe
            title="Keep Notes uninstall feedback form"
            src={src}
            width={640}
            height={600}
            frameBorder={0}
            marginHeight={0}
            marginWidth={0}
            className="mx-auto block h-[600px] w-full max-w-[640px] rounded-2xl border border-note-200 bg-white dark:border-zinc-800"
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
      ) : (
        <div className="card mt-5 text-center">
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
      )}
    </section>
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
      {STORE_URL ? (
        <section className="mt-10 text-center">
          <p className="mb-3 text-sm opacity-80">Uninstalled by accident?</p>
          <GetExtensionButton label="Reinstall Keep Notes" />
        </section>
      ) : null}
    </Layout>
  )
}

mount(<Uninstall />)
