# Architecture

Recap is organised into four layers: **capture**, **storage**, **visualisation**, and **playback**. Each layer has a clear boundary and can be understood independently.

## Module structure

```
src/
  index.ts              # Public API, init, keyboard shortcut, auto-init from script tag
  react.tsx             # React component wrapper (separate sub-export: recap-ux/react)
  types.ts              # Shared TypeScript types
  capture/
    clicks.ts           # Click event listener, CSS selector generation, element labelling
    scroll.ts           # Scroll depth tracking (milestone + continuous)
    navigation.ts       # Page navigation / SPA route change detection
    moves.ts            # Sampled cursor trails (polyline batches, coordinates only)
    suppress.ts         # Global capture suppression flag (held during replay)
    session.ts          # Session ID (sessionStorage UUID), session metadata
  storage/
    buffer.ts           # In-memory event buffer, periodic flush (10s / 50 events)
    idb.ts              # IndexedDB read/write (recap-sessions DB, events store)
    export.ts           # JSON, CSV, and AI summary download helpers
    beacon.ts           # Optional real-time POST to a researcher endpoint
  viz/
    heatmap.ts          # Click heatmap overlay (simpleheat algorithm, vendored BSD-2)
    scroll-depth.ts     # Scroll depth visualisation overlay
    screenshot.ts       # Screenshot prompt (OS tool — no html2canvas dependency)
    flow-diagram.ts     # Navigation flow diagram
    panel.ts            # Researcher panel DOM, tab switching, session list
  playback/
    scheduler.ts        # Virtual-clock rAF loop (play/pause/seek/speed), DI'd timing
    import.ts           # Session JSON validation, timeline prep, cursor interpolation
    visuals.ts          # Synthetic cursor, click ripples, navigation banner
    controls.ts         # Playback bar UI (bottom-centre: scrubber, speed, exit)
    replay.ts           # Orchestrator: event application + suppression lifecycle
    launch.ts           # Ties a replay session to its controls bar
  analysis/
    summarize.ts        # Generates AI-readable session-summary.json
  privacy/
    sanitize.ts         # Element exclusion (.ut-block, data-ut-no-track), text masking (.ut-mask)
```

## Three-layer architecture

### Capture layer (`src/capture/`)

Attaches lightweight event listeners to the document. Each module is self-contained and can be enabled or disabled independently. Captured events are plain objects (`ClickEvent`, `ScrollEvent`, `NavigationEvent`) defined in `src/types.ts` and pushed into the in-memory buffer.

Privacy filtering happens at capture time: `sanitize.ts` is called before any event is recorded.

### Storage layer (`src/storage/`)

`buffer.ts` holds events in memory and flushes to IndexedDB every 10 seconds, or immediately when the buffer reaches 50 events. `idb.ts` manages the `recap-sessions` database (v2) with a single `events` object store. Events older than 30 days are purged on startup using the `wallTime` index (epoch ms) — `timestamp` is a `performance.now()` value that resets on each page load and is only meaningful within one load.

`export.ts` reads from IndexedDB (never from the live buffer) to produce downloads, ensuring exports always reflect the persisted state.

`beacon.ts` is opt-in: when `endpoint` is set in the config, events are POSTed in real time using `navigator.sendBeacon` with JSON fallback.

### Visualisation layer (`src/viz/`)

`panel.ts` builds the researcher panel as a self-contained DOM subtree (no Shadow DOM — intentional, to allow host-page CSS to apply to the panel if desired). It loads session data from IndexedDB on open and re-loads on re-open to pick up events flushed since the last view.

The heatmap uses a vendored implementation of the simpleheat algorithm (BSD-2 licence). It draws to a `<canvas>` element overlaid on the page at the correct z-index.

`screenshot.ts` prompts the user to use their OS screenshot tool rather than importing html2canvas, keeping the bundle small.

### Playback layer (`src/playback/`)

Session replay reconstructs a recorded session **on top of the live prototype** — no DOM snapshots or screen recording are ever stored. The facilitator opens the same prototype, picks a session (local IndexedDB or an imported JSON export), and Recap replays it:

- `import.ts` validates the export, orders events (IDB `id`, then `wallTime`), zero-bases them onto a virtual timeline, and segments across page reloads (a `timestamp` that goes backwards means `performance.now()` reset). Move polylines are flattened for per-frame cursor interpolation.
- `scheduler.ts` is a pure virtual clock over one rAF loop — timing sources are injected so the whole engine is unit-testable under jsdom. Seeking hands back only the state-bearing events (last navigation + last scroll) rather than replaying everything in between.
- `replay.ts` applies events: navigation drives the host SPA via the original `pushState` + a synthetic `popstate` (the same pattern the panel uses); scroll is applied as a percentage so differing page heights self-correct; clicks re-anchor to live elements via the recorded selector and element-relative ratios, falling back to raw coordinates.
- While a replay is active, `capture/suppress.ts` disables **all** capture — synthetic replay actions and the facilitator's own input are equally non-events. Replay DOM also carries `data-ut-no-track` as a second line of defence.

## Mode detection

The `data-mode` attribute on the script tag controls which experience loads:

- **`researcher` (default):** Full researcher panel accessible via `Alt+Shift+R`. No visible UI during recording.
- **`participant`:** Simplified UI with a "Finish test" pill. No access to the researcher panel. On finish, prompts the participant to download and share their session file.

Mode is read once at init from `document.currentScript.dataset.mode` and stored in the session config. It cannot be changed after init.

## Privacy guarantees

- No network requests are made unless `endpoint` is explicitly set.
- Form input values are never captured — the capture layer ignores all `input`, `textarea`, and `select` value changes.
- Cursor trails are coordinates only — no selectors, labels, or element content — and sampling skips excluded elements. Disable entirely with `data-capture-moves="false"`.
- Elements with `.ut-block` or `data-ut-no-track` are skipped entirely at capture time.
- Text inside `.ut-mask` elements is replaced with `***` before storage.
- Session data is stored in IndexedDB, scoped to the origin, and auto-purged after 30 days.
- No cookies. Session identity uses `sessionStorage` (cleared when the tab closes).

## Build

Two Vite configs produce five output files:

| Config | Output |
|--------|--------|
| `vite.config.ts` | `dist/recap.min.js` (UMD), `dist/recap.esm.js`, `dist/recap.cjs.js` |
| `vite.react.config.ts` | `dist/react.esm.js`, `dist/react.cjs.js` |

TypeScript declarations are emitted separately via `tsc --emitDeclarationOnly` after both Vite builds complete (to avoid Vite's `emptyOutDir` deleting the generated `.d.ts` files).

The React build externalises `recap-ux` (the main package) using Rollup's `external` + `output.paths` pattern — it does not bundle the core library inline.
