# Watcher — Screen Comparison

Watcher is an internal design QA tool for **comparing two Figma files screen by screen**, annotating visual or content gaps directly on the screenshots, classifying each gap (addressed / NuDS-compliant / tagged), and producing a coverage dashboard across screen types.

It was built for design audits where one Figma file is the **reference** (e.g. the most recent or "source of truth" design) and another is the **comparison** (e.g. the implemented version, an older variant, or a competitor screen).

---

## What it does

The app walks the user through a 4-step flow:

1. **Pick screens (`/`)** — Paste two Figma URLs (reference + comparison), authenticate with a personal Figma token, and select which top-level frames from each file should be compared.
2. **Compare (`/compare`)** — For each auto-paired ref/compare screen, the app shows the two screenshots side by side. The user draws rectangles over visual differences ("gaps"), labels each one, marks whether it's `addressed` and whether the implementation is `compliantToNuds`, and optionally adds notes and tags.
3. **Score (`/score`)** — Summary view of all annotations in the current session, plus the screen-type bucket the session belongs to.
4. **Dashboard (`/dashboard`)** — Pooled coverage chart across all sessions, grouped by **screen type** (Offer Hub MDR, Simulation, Conditions, Simulation + payment date, Summary, T&C, Feedback). Shows total gaps, addressed gaps, and a coverage percentage per bucket, plus a per-bucket gap list.

All sessions are persisted in the browser via `localStorage` (Zustand `persist` middleware). The Figma token lives in `sessionStorage` only — it is never sent anywhere except directly to the Figma API through a local proxy.

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Routing | `react-router-dom` v7 |
| State | `zustand` (with `persist` to localStorage) |
| Styling | Plain CSS (`App.css`, `index.css`, `Layout.css`) |
| Fonts | Plus Jakarta Sans (Google Fonts) |
| Lint | ESLint 9 + `typescript-eslint` |
| Figma API | Fetched through a Vite middleware that proxies `/api/figma/*` → `https://api.figma.com/*` |

---

## Project structure

```
.
├── index.html                 # Vite entry HTML
├── vite.config.ts             # Vite config + Figma API proxy middleware
├── package.json
├── tsconfig*.json
├── eslint.config.js
├── public/                    # Static assets (favicon, icons)
└── src/
    ├── main.tsx               # React entry point
    ├── App.tsx                # BrowserRouter + 4 step routes
    ├── App.css / index.css    # Global styles
    ├── components/            # Shared UI
    │   ├── Layout.tsx              # App shell (top bar + outlet)
    │   ├── FigmaTokenButton.tsx    # Token entry / clear
    │   ├── ScreenPicker.tsx        # Frame selection per file
    │   ├── ImageAnnotator.tsx      # Draw / edit gap rectangles
    │   ├── HiringFlowCoverageChart.tsx  # Dashboard chart
    │   ├── ScreenTypeGapsModal.tsx
    │   └── ErrorBoundary.tsx
    ├── steps/                 # One file per route
    │   ├── Step1FigmaPick.tsx
    │   ├── Step2Compare.tsx
    │   ├── Step3Scoring.tsx
    │   └── Step4Dashboard.tsx
    ├── lib/
    │   ├── figma/             # Figma URL parsing, API client, screen collection
    │   ├── pairScreens.ts     # Auto-pair ref/compare frames by normalized name
    │   └── screenTypeAxis.ts  # Screen-type buckets + pooled coverage math
    └── store/
        └── comparisonsStore.ts  # Zustand store: sessions, annotations, drafts, token
```

### Key domain concepts

- **`ComparisonSession`** — One audit. Holds the two Figma file keys, the selected screens on each side, the auto-paired queue, and a map of annotations per pair.
- **`GapAnnotation`** — A rectangle drawn on a screenshot, plus `label`, `note`, `tags`, `addressed: boolean`, and `compliantToNuds: boolean`. Coordinates are normalized 0–1 so they survive image resizing.
- **`ScreenTypeOption`** — One of seven hiring-flow buckets the dashboard groups by. Defined in `src/lib/screenTypeAxis.ts`.
- **Pairing** — `buildPairedQueue` matches each reference screen to a compare screen with the same normalized name (case-insensitive, trims whitespace, ignores trailing `copy`). First unused compare wins.

---

## Running locally

> Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:5173` and opens automatically.

### Figma token

The app needs a **personal Figma access token** to read your files:

1. Generate one at https://www.figma.com/developers/api#access-tokens.
2. Click the **token button** in the top bar of the app and paste it in.
3. The token is stored in `sessionStorage` (cleared when the tab closes) and only sent to `api.figma.com` via the local Vite proxy.

The proxy lives in `vite.config.ts` and is required in **both** `vite dev` and `vite preview` — without it, browser requests to `/api/figma/...` would hit the SPA fallback and return HTML.

### Other scripts

```bash
npm run build      # tsc -b && vite build → outputs dist/
npm run preview    # serve dist/ on http://localhost:4173 (proxy still active)
npm run lint       # eslint .
```

---

## How a typical session works

1. User opens `/`, pastes a token, then pastes a Figma URL into **Reference** and another into **Compare**.
2. App fetches both files, lists their top-level frames, and lets the user check the ones to include.
3. User picks a **Screen type** (which dashboard bucket this session belongs to) and clicks **Start comparison** → `createSession` in the store builds the paired queue and navigates to `/compare`.
4. On `/compare`, for each pair the user draws rectangles over differences, labels them, and toggles `addressed` / `compliantToNuds`.
5. `/score` summarizes the current session.
6. `/dashboard` aggregates **all** persisted sessions into per-screen-type coverage cards.

---

## Notes for downstream agents / contributors

- This is a **client-only** app. There is no backend; all data lives in the user's browser.
- The Figma proxy is **intentionally limited to `GET` and `HEAD`** and only runs on localhost. Do not deploy this app publicly without rethinking the proxy or moving token handling server-side.
- `base: './'` in `vite.config.ts` makes the build portable — `dist/index.html` opens correctly when served from any subpath or the file system.
- All annotation coordinates are normalized 0–1 relative to the **natural image size**, so they remain correct after re-rendering at different display sizes.
- Screen-type buckets in `src/lib/screenTypeAxis.ts` are domain-specific (lending hiring-flow stages). Edit `SCREEN_TYPE_OPTIONS` to repurpose the dashboard for another flow.
- The repo name on GitHub is **Watcher**; the package name in `package.json` is `screen-comparison`. They are the same project.
