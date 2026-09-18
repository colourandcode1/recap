<div align="center">
  <img src="./assets/recap-logo-full.png" alt="Recap" width="280" />
  <h1>Recap</h1>
  <p><strong>Lightweight, privacy-first usability testing for web prototypes.</strong></p>
  <p>Drop-in click heatmaps, scroll depth tracking, and AI-ready session exports. Zero cookies, zero backend, under 10KB.</p>

  <p>
    <a href="https://www.npmjs.com/package/recap-ux"><img src="https://img.shields.io/npm/v/recap-ux?color=0891b2&label=npm" alt="npm version" /></a>
    <a href="https://bundlephobia.com/package/recap-ux"><img src="https://img.shields.io/bundlephobia/minzip/recap-ux?color=0891b2&label=size" alt="bundle size" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/npm/l/recap-ux?color=0891b2" alt="MIT license" /></a>
    <a href="https://recaux.com"><img src="https://img.shields.io/badge/demo-live-0891b2" alt="live demo" /></a>
  </p>

  <br />
  <!-- TODO: record and add demo GIF -->
  <img src="./assets/recap-demo.gif" alt="Recap researcher panel showing a heatmap overlay" width="720" />
  <br /><br />
</div>

## Quick start

Add one line to any prototype:

```html
<script defer src="https://cdn.jsdelivr.net/npm/recap-ux@1/dist/recap.min.js"></script>
```

That's it. Recap starts recording silently. When you're ready to review, press `Alt+Shift+R` to open the researcher panel.

### In-person moderated tests

When you're testing in person and need to add another participant, open the same prototype in a new browser tab. Recap creates a new session per tab, so each participant is captured separately.

On a phone or tablet there's no keyboard for `Alt+Shift+R` — hold **three fingers** on the screen for about **1.5 seconds** instead. It's a deliberately "hidden" gesture (no on-screen button), so it never shows up as something for the participant to notice or tap.

The researcher panel now includes:

- A `Session` help icon directly beside the label
- A hover/focus tooltip with: "To add another participant, open this prototype in a new tab."
- An `Open in new tab` shortcut inside the tooltip

For lightweight instrumentation, Recap emits a `recap:participant-guidance` browser event and stores aggregate counts in local storage under `recap-participant-guidance-metrics`.

A ready-to-run moderated validation script lives at [`examples/in-person-usability-validation.md`](./examples/in-person-usability-validation.md).

## What Recap captures

- **Click positions** with auto-generated CSS selectors and semantic element labels
- **Scroll depth** per page, with milestone and continuous tracking
- **Navigation flow** — which pages users visited, in what order, for how long
- **Interaction patterns** — hesitation, rapid clicks, backtracking, ignored regions

Everything is processed entirely in the browser. No cookies. No IP addresses. No text or form values captured. No data ever leaves the participant's device unless they explicitly download and share it.

## Why Recap

**One line of HTML.** No accounts, no keys, no dashboards to configure. Add the script tag and you're recording.

**Privacy by architecture.** GDPR-friendly because there's nothing to be compliant about — Recap collects no personal data and sends nothing over the network. Perfect for testing with real users in regulated industries.

**AI-ready.** Exports a structured session summary that Claude or ChatGPT can actually reason about — not just raw coordinates, but a narrative of hesitation, frustration, backtracking, and friction points. Comes with a ready-to-use prompt template.

**Under 10KB.** Drops into Claude artefacts, Vercel previews, Framer sites, plain HTML — anywhere a `<script>` tag works.

## Live demo

Try Recap on a live prototype at **[recap-ux.com](https://recap-ux.com)** — the site itself is instrumented with Recap, so you can click around, then press `Alt+Shift+R` to see your own session as a heatmap.

## Configuration

All options are `data-*` attributes on the script tag:

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-session-name` | auto | Label for this session, e.g. `"participant-04"` |
| `data-show-panel` | `"false"` | Show researcher panel on load |
| `data-shortcut` | `"alt+shift+r"` | Custom keyboard shortcut for the researcher panel |
| `data-touch-trigger` | `"true"` | Hold 3 fingers on screen to open/close the panel on touch devices |
| `data-touch-trigger-fingers` | `3` | Number of simultaneous touch points required |
| `data-touch-trigger-hold-ms` | `1500` | Hold duration (ms) before the panel toggles |

## Element labelling

Recap auto-detects labels from `aria-label`, `title`, `alt`, and inner text. For ambiguous elements, add explicit labels:

```html
<button data-ut-label="Submit assessment">Save</button>
<div data-ut-label="Filter panel">...</div>
```

To exclude sensitive elements from tracking:

```html
<input type="password" data-ut-no-track />
<div class="ut-block">Hidden from tracking entirely</div>
<span class="ut-mask">Text replaced with asterisks</span>
```

## AI analysis export

Click **"Export for AI"** in the researcher panel to get a structured JSON summary optimised for LLM analysis. Paste it into Claude with the included prompt template to get a full UX analysis covering friction points, navigation patterns, accessibility observations, and specific recommendations.

The summary is a human-readable narrative of the session, not raw coordinates — an AI can reason about *"Participant hesitated for 12 seconds, then clicked an unlabelled element three times in rapid succession before backtracking"* in a way it never could with a dump of `pageX`/`pageY` values.

## Development

```bash
git clone https://github.com/tonyarbor/recap-ux.git
cd recap-ux
npm install
npm run dev          # Watch mode with example page
npm test             # Run unit tests
npm run build        # Build dist/ bundles
```

Project structure and architecture details are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Contributing

Contributions welcome. Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull request. For significant changes, open an issue first to discuss what you'd like to change.

## Licence

MIT © [Tony Craig](https://www.npmjs.com/~tonyarbor)

---

<div align="center">
  <sub>Built with care for designers who want to ship better prototypes.</sub>
</div>
