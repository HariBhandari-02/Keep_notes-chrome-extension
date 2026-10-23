# Keep Notes

Keep Notes is a small, local-first floating notepad for Chrome. Click the toolbar icon while reading an article, documentation page, or research paper and a compact notes panel appears on top of the page — no new tab, no account, and no context switch.

## Features

- **Floating panel on the current page** — injected on demand, rendered inside a Shadow DOM so page CSS cannot leak into the panel.
- **Draggable, resizable window** — drag from the header and resize from any edge or corner. The panel stays inside the viewport and remembers both its position and size.
- **Multiple notes** — create, switch, search, and delete notes with a confirmation step.
- **Automatic saving** — debounced writes to `chrome.storage.local` with clear `Saving…`, `Saved`, and `Unable to save` states.
- **Automatic titles** — a title is derived from the first meaningful line until you type your own. Clearing a custom title resumes automatic titles.
- **Search** — case-insensitive filtering across note titles and content.
- **Light, dark, and system themes** — follows the system by default and remembers your choice.
- **Capture page selections** — select text on the page and use **Add selected text** to append it to the current note.
- **Keyboard friendly** — `Ctrl/Cmd+Enter` creates a note, `Escape` dismisses the panel or leaves the editor, and `Alt+Shift+K` toggles the panel through a Chrome command.
- **Privacy-first** — notes never leave the device. There is no backend, analytics, account, or network request.

## Technology

- Chrome Extension Manifest V3
- React 19 + TypeScript
- Vite (two build passes: an ES module service worker and an IIFE content script)
- Tailwind CSS 3
- Lucide React icons
- `re-resizable` for edge and corner resizing
- `chrome.storage.local` for persistence
- Vitest + Testing Library for tests

## Requirements

- Node.js 20.19+ (Node 22+ recommended)
- npm 10+
- Google Chrome (or another Chromium browser with Manifest V3 support)

## Install dependencies

```bash
npm install
```

## Build the extension

```bash
npm run build
```

The unpacked extension is written to `dist/`:

```text
dist/
├── manifest.json
├── background.js      # MV3 service worker (ES module)
├── content.js         # IIFE content script with the React panel
└── icons/
```

Verify the output is a valid Manifest V3 bundle:

```bash
npm run verify
```

## Load into Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the `dist/` directory from this project.
6. Pin **Keep Notes** from the extensions menu if desired.
7. Open any normal web page, then click the Keep Notes icon.

The panel opens on the page you are reading. The page is not reloaded or navigated.

## Development workflow

```bash
npm run dev
```

This runs a watch build for both extension bundles. After a rebuild:

1. Open `chrome://extensions`.
2. Click the reload button on the Keep Notes card.
3. Refresh the page where the panel was open (the old content script is invalidated when the extension reloads).

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Watch build (unminified) |
| `npm run build` | Production build into `dist/` |
| `npm run typecheck` | TypeScript check with `tsc --noEmit` |
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run verify` | Validate the built extension in `dist/` |
| `npm run clean` | Remove `dist/` |

## How permissions work

Keep Notes requests only three permissions, with no host permissions:

- **`storage`** — saves notes and settings in `chrome.storage.local`.
- **`activeTab`** — grants temporary access to the active tab only after you click the extension icon or use the keyboard command.
- **`scripting`** — injects `content.js` into that active tab on demand.

There is intentionally no `content_scripts` entry and no `<all_urls>` host permission. The content script is injected only when you invoke the extension, which keeps the extension idle on pages you never use it on.

Chrome does not allow extensions to inject scripts into internal pages such as `chrome://settings`, `chrome://extensions`, or the Chrome Web Store. Keep Notes catches that case and shows a red `!` badge with an explanatory tooltip instead of failing silently.

## Where notes are stored

Everything is stored locally by Chrome:

- `keepnotes:note:<id>` — one key per note (`id`, `title`, `customTitle`, `content`, `createdAt`, `updatedAt`). One note's save never overwrites another note's key.
- `keepnotes:settings` — theme, last panel position and size, minimized state, and selected note.

Notes survive the panel closing, page reloads, and Chrome restarts. They are local to the Chrome profile and are not synced to `chrome.storage.sync` or any server. Uninstalling the extension removes its storage.

Malformed or partially written values are validated and ignored. Per-note writes are serialized and coalesced so an older asynchronous write cannot overwrite a newer edit. Open tabs listen to `chrome.storage.onChanged` to merge changes from other tabs when it is safe to do so.

## Using Keep Notes

- **Open/focus:** click the toolbar icon. If the panel is already open it is focused, not duplicated.
- **New note:** click **+** or press `Ctrl+Enter` (`Cmd+Enter` on macOS).
- **Switch notes:** click the notes-list button, then a note.
- **Search:** open the notes list and type in the search field. `Escape` clears the search.
- **Delete:** reveal the trash icon on a note row, then confirm.
- **Minimize:** collapses the panel to its header. Notes stay saved.
- **Close:** hides the panel. Clicking the icon again restores your notes and last selection.
- **Drag:** grab the header background (not a button or input).
- **Resize:** drag any edge or corner handle. The opposite edge stays anchored, the panel remains inside the viewport, and its size is remembered.
- **Theme:** cycle System → Light → Dark with the footer theme button.
- **Add selected text (optional):** select text on the page, then click **Add selected text** in the editor. Keep Notes only reads the selection when you click that button.
- **Toggle from keyboard:** `Alt+Shift+K` (configurable at `chrome://extensions/shortcuts`).

Titles are automatic until you edit the title field. Typing a title makes it custom; deleting it resumes automatic generation and will not overwrite custom titles.

## Privacy and security

- All note data stays in `chrome.storage.local` on your machine.
- No analytics, tracking, ads, accounts, cookies, browsing history, or remote calls.
- Note content is rendered as plain text in a `<textarea>`; no user HTML is injected or executed.
- The panel uses Shadow DOM for style isolation.
- All executable code is bundled locally. There is no `eval`, remote script, or remotely hosted code.
- Permissions are limited to `storage`, `activeTab`, and `scripting`.
- Selected page text is read only in response to the **Add selected text** action.

## Tests

```bash
npm test
```

The suite covers:

- Automatic title generation (empty notes, first meaningful line, whitespace, truncation, Unicode).
- Custom-title preservation and resuming automatic titles after a custom title is cleared.
- Note validation and malformed-storage handling.
- Per-note persistence, independence, deletion, and coalescing of rapid edits.
- Search matching across titles and content.
- Panel sizing/clamping, resize constraints, edge anchoring, and drag-target detection.
- Manifest V3 requirements, permissions, and icons.
- UI integration: creating, editing, custom titles, searching, reopening, and deleting notes; restoring notes after a remount.
- Manual Chrome smoke testing with an unpacked extension covers injection, resizing from multiple handles, minimum constraints, viewport clamping, and size persistence across reloads.

`npm run build && npm run verify` checks that the built extension has the expected manifest, service worker, content script, and icon files.

## Project structure

```text
.
├── public/
│   ├── manifest.json
│   └── icons/                  # 16, 32, 48, 128 px PNGs
├── scripts/
│   ├── build.mjs               # two-pass Vite build / watch
│   ├── verify-dist.mjs         # post-build extension validation
│   └── generate-icons.py       # optional icon regeneration (Pillow)
├── src/
│   ├── background/service-worker.ts
│   ├── content/content.tsx     # Shadow DOM injection + message bridge
│   ├── content/panelBus.ts     # visibility/focus store for the injected panel
│   ├── components/             # FloatingPanel, header, editor, list, status, theme
│   ├── hooks/                  # useNotes, useDraggable, useTheme
│   ├── services/notesStorage.ts
│   ├── styles/globals.css
│   ├── types/note.ts
│   ├── utils/                  # title generation, note helpers, position, classnames
│   ├── App.tsx
│   └── vite-env.d.ts
├── tests/
├── package.json
├── tailwind.config.js
├── vite.config.ts              # service worker bundle
├── vite.content.config.ts      # content script bundle
├── vitest.config.ts
└── tsconfig.json
```

The content bundle imports the compiled Tailwind CSS as an inline string and installs it into the Shadow DOM via a constructed stylesheet (with a `<style>` fallback), so no page-level CSS can affect the panel.

## Limitations and troubleshooting

- **Nothing happens on a page:** If the toolbar badge shows `!`, the page is restricted (for example `chrome://`, the Chrome Web Store, or a browser-internal page). Try a regular website.
- **Extension was reloaded:** After rebuilding or reloading the extension at `chrome://extensions`, refresh the webpage. The old content script can no longer talk to Chrome and the panel is replaced on the next injection.
- **`file://` pages:** Chrome requires you to enable **Allow access to file URLs** for the extension in its details page. Without that, Keep Notes reports the page as unsupported.
- **Theme button does nothing / wrong theme:** Use the footer button to cycle themes. The default **System** mode follows `prefers-color-scheme`.
- **Large notes:** Notes are limited by Chrome's local storage quota (about 10 MB for the extension). If storage fills up, the footer shows **Unable to save** with a Retry action.
- **No cross-device sync:** Storage is intentionally local. There is no cloud backend or account.
- **Keyboard command conflict:** Reassign the command at `chrome://extensions/shortcuts`.
- **Panel off-screen after resizing:** The panel reclamps itself on window resize; drag it by the header if needed.

## Icon regeneration (optional)

The PNG icons are committed. To regenerate them:

```bash
python3 -m pip install pillow
python3 scripts/generate-icons.py
```
