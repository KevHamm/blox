# BLoX — Hand-off Summary

A visual, block-based LaTeX editor. You compose documents on a true-to-size page (drag-and-drop
blocks, edit in place) and export compilable `.tex`. There's also a free-form "design a page"
cover editor, a stub-auth signed-in workspace with projects/templates, and a read-only template
viewer.

**Stack:** React 19 + TypeScript + Vite frontend (`C:\blox\frontend`), FastAPI backend
(`C:\blox\backend`), Windows + PowerShell. Claude's memory dir
`C:\Users\Kevin\.claude\projects\C--blox\memory\` (MEMORY.md + per-topic notes) is auto-loaded
into new threads — read it; this hand-off expands on it.

---

## Running & verifying (read this first)

- **Frontend dev server MUST be on port 5173** — the backend CORS allows only
  `http://localhost:5173`. Use the `preview_start` MCP tool with name `dev` (reads
  `.claude/launch.json`), or `npm run dev` in `frontend`. If 5173 is held by a stale Vite, free
  it: `Get-NetTCPConnection -LocalPort 5173 -State Listen` → `Stop-Process -Id <pid> -Force`.
- **Backend** (only needed for LaTeX export): from `C:\blox`, `uvicorn backend.main:app --reload`
  (port 8000, Python 3.8).
- **Build/typecheck:** `cd /c/blox/frontend && node_modules/.bin/tsc -b . --force && npm run build`.
  (The Bash tool's working dir resets to `C:\blox`, so `cd` into `frontend` each time.) A "chunks
  larger than 500 kB" warning is pre-existing and benign.
- **⚠️ Preview screenshot capture was wedged the entire last session** — `preview_screenshot`
  times out and some `getComputedStyle` reads go stale (transforms read as identity,
  `:hover`/background colors stale, View-Transition theme reads stale right after toggling). The
  page itself stays fully responsive via `preview_eval`. **Verify structurally** (DOM presence,
  attributes, `getBoundingClientRect`, inline `el.style`) rather than via screenshots. A fresh
  session may restore screenshots; try once. Promise-returning `preview_eval` sometimes returns
  `{}` when degraded — prefer two synchronous eval calls (act, then read).
- **localStorage keys:** `blox-theme` (light|dark), `blox-user` (`dev` when signed in),
  `blox-autosave` (single session slot), `blox-favorites` (array of fav keys), `blox-my-projects`
  (array of added projects). Reset auth/state by removing these.
- **Stub login:** username `dev`, password `123` (in `App.tsx` `login()`).

---

## Repo layout (frontend/src)

- **`App.tsx`** (~1400 lines) — the heavyweight. Contains: the `Editor` component (the document
  editor: blocks, dnd, live pagination, typography, citations, export — plus a guarded **`viewer`
  mode** for read-only previews); `TemplateViewer` + `DesignViewer` (the View overlay); and the
  `App` orchestrator (phases `welcome → morph → editor`, `mode: doc|design`, auth, theme,
  `viewerState`).
- **`components/Welcome.tsx`** — welcome screen. Logged-out: hero (primary **LoGIN** button,
  **How it works**, `PaperMockup`) + template/design pickers + the how-it-works tutorial section.
  Logged-in: renders `LibraryPanel` full-width.
- **`components/welcome/`** — `LibraryPanel.tsx` (the signed-in workspace; tabs, sections, cards,
  create flow, favorites, hover actions), `PaperMockup.tsx`, `LoginModal.tsx`, `HowItWorks.tsx`,
  `ViewerBar.tsx` (+ exported `HeartIcon`), `DesignPreview.tsx` (shared read-only design renderer).
- **`components/design/`** — `CoverDesigner.tsx` (free-form page editor surface),
  `DesignElementView.tsx` (move/resize/select/toolbar per element, adapted from `shapes.tsx`).
- **`components/`** — `TopBar.tsx` (editor top bar + document outline), `Page.tsx`, `chrome.tsx`
  (`Logo` w/ BLoX→BaCK flip, `ThemeToggle`), `editorUi.tsx` (`DroppableDocArea`, `EdgeToggle`,
  `NumberControl`, `Collapsible`…), `blocks.tsx`, `shapes.tsx` (`ShapeView`/`ShapeLayer`),
  `citations.tsx`, `ConfirmDialog.tsx`.
- **`renderer/`** — `DocumentRenderer.tsx` + per-block files (`Paragraph`, `SectionBlocks`,
  `TableBlock`, `FigureBlock`, `MathBlock`, `ListBlock`, `FrameBlock`, `AbstractBlock`,
  `PageBlock`, `shared`). Editing is via `contentEditable` (`Paragraph.tsx`, `HeadingInput`).
- **`hooks/`** — `useDocument` (doc tree + undo/redo + all mutations), `useDesign`, `useShapes`,
  `useCitations`, `useImageGallery`, `useEditorDnd`.
- **`utils/`** — `persistence.ts` (`.blox`/autosave, `BloxProject`), `library.ts` (seed
  `LIBRARY_PROJECTS`/`LIBRARY_PAGES` + `getTemplates()`), `myProjects.ts`, `favorites.ts`
  (+ `useFavorites` hook, `favKey`), `fonts.ts` (`DOC_FONTS`/`docFontCss`), `templates.ts`
  (`TEMPLATES`, `templateFor`, `templateDoc`), `exportLatex.ts`, `exportCover.ts`, and the doc
  engine (`docTree`, `measure`, `paginateDocument`, `numberDocument`, `marks`, `arrows`, `greek`,
  `dnd`, `pageConfig`).
- **`types/`** — `document.ts` (`DocumentNode`, `Shape`), `design.ts` (`DesignPage`,
  `DesignElement`).
- **`index.css`** — **all** styles live here (one big file).

**Backend:** `main.py` (FastAPI: `/export-latex`, `/export-zip`, `/export-cover`,
`/export-cover-zip`; CORS = 5173 only), `exporter.py` (doc→LaTeX and design→LaTeX; designs use a
TikZ overlay via `\AddToShipoutPictureFG` at absolute `bp` coords, `_BP=0.75` px→bp).

---

## Subsystems & key conventions

**Design language ("Studio"):** electric violet→fuchsia. `--ui-blue` `#7c3aed` light / `#c4b5fd`
dark; `--ui-accent-fill` `#7c3aed`. Fonts via Google `@import`: Inter (`--ui-font`), Space Grotesk
(`--ui-display`), Fraunces (`--ui-serif`). Theme = `data-theme` on `<html>`; toggle uses the View
Transitions API for a crossfade. **The document paper stays white in both themes — never theme
it.** The user wants redesigns that are **bold and obviously different**, and the welcome/product
aesthetic **clean/minimal/elegant** (a playful 3D welcome was rejected twice). Always verify
visuals.

**Welcome tokens gotcha:** the `--w3-*` tokens (`--w3-card`, `--w3-paper`, `--w3-soft`,
`--w3-hair`, `--w3-glow*`, `--w3-dot`, …) are **scoped to `.welcome3`** (with a
`:root[data-theme="dark"] .welcome3` override), NOT `:root`. Read them off the `.welcome3`
element; child components inherit them.

**The morph contract:** welcome cards / Resume / template actions call `onStart(preset, rect)` /
`onOpen(project, rect)` / `onDesign(kind, rect)` with `e.currentTarget.getBoundingClientRect()`.
`App.beginSession` grows a white overlay from that rect into `.doc-area .blox-page`. **Scope page
queries to `.doc-area`** — the top bar clones `.blox-page` nodes into its outline.

**Persistence:** a `.blox` file / autosave slot = one `BloxProject` JSON
`{ app, version, kind?: "doc"|"design", cls, title, layout?, doc?, images?, design? }`. Single
localStorage autosave slot. The signed-in **library is seeded sample data**, not server
persistence; only "Open in editor" additions persist (`blox-my-projects`).

**Editor `viewer` mode** (the read-only preview): a guarded optional prop on `Editor`. When set
it skips autosave, renders `ViewerBar` instead of `TopBar`, omits sidebars/edge-toggles/frame/
toolbars, and sets `.doc-area-readonly` (`pointer-events:none` on `.blox-page`). `DroppableDocArea`
takes `readOnly`. Documents reuse this; design pages use `DesignViewer` + `DesignPreview`.

---

## Current functional state (what works end-to-end)

- **Document editor**: blocks (sections/sub/subsub, paragraphs w/ bold-italic-underline marks +
  footnotes + inline citations, abstract, lists, tables w/ per-cell color, figures w/ uploaded
  images, display + inline math, beamer frames), drag-and-drop, **live pagination**, Typography
  panel (font, size, line spacing, all four margins, columns, citation style), free-form shape
  overlay, undo/redo, **export to compilable LaTeX** (figures bundled to a zip).
- **Cover page designer**: free-form text / image / rect / line, move/resize/select, per-element
  toolbar, page background + size, exports a TikZ titlepage (`/export-cover`).
- **Welcome (logged out)**: hero with **LoGIN** (primary, opens modal) + **How it works** (6-step
  tutorial that slides in/out) + paper mockup. (New document / Design a page / Open project /
  Resume were removed — the logged-out app is essentially a sign-in gate; the old pickers still
  exist in code but are unreachable.)
- **Workspace (logged in, `dev`/`123`)**: 3 tabs — **My projects · Favorites · Templates**.
  Collapsible **Documents / Presentations(beamer) / Pages** sections, fixed 5-col grid. My projects
  has New project/Import in section headers + the slide create-flow (Start from empty →
  Report/Article/Book, or straight to beamer editor / cover designer). Templates show 9 previews +
  "Show more" (loads 10). **Heart** to favorite (top-right of card) → Favorites tab. **Hover
  actions**: *Open in editor* (opens + persists a copy to My projects) and *View* (read-only
  template viewer — a **sliding carousel**: a persistent top bar (it never re-renders) above a
  `.tv-track` that slides the current page out and the neighbour in on prev/next (←/→, always-on
  edge buttons that hug the page, or Esc to close). Document panes use the Editor's `viewer.bare`
  mode (no per-pane bar); design panes render `DesignPreview`. The dev account includes a `wip`
  **"Sandbox — 50-page stress test"** (opens to ~53 pages).
- **User templates** (2026-06-20): the page designer's top bar has **"Save as template"**, which
  stores the current page in `blox-my-templates` (`utils/userTemplates.ts`). The **Templates** tab
  has an inner **My templates ↔ Browse templates** toggle (`.ws-subtabs`); "My templates" lists the
  user's own saved pages with View / Open-in-editor / **remove (trash)**, plus an empty-state CTA.
  Re-saving the same page in one designer session updates the one entry (stable per-session id).

---

## Deferred / not-real (good next-step candidates)

- The **Browse** catalogue is **seeded sample data** — no server-side storage or real accounts.
  ("My templates" are real, but localStorage-only: `blox-my-templates`.) The create-flow's "Browse
  templates" button is still intentionally disabled. **Import now works**: it reads a `.tex` file
  (`utils/importLatex.ts`, a best-effort LaTeX→`DocumentNode` parser) and opens it in the editor.
- Only **page (design) templates** can be saved by the user today — there's no "save document as
  template" yet. The "My templates" Templates source therefore only ever holds design pages.
- Design pages: only **cover** type exists; **bibliography** and **section-divider** types are
  listed as "Soon".
- "Open in editor" persistence is a localStorage list (`blox-my-projects`); flag if it should not
  persist.
- No automated tests; verification is manual via the preview tools.

---

## Working agreements with this user

- They iterate fast with detailed, prescriptive specs and react to results — but several recent
  features were large/architectural enough to warrant **plan mode first** (the user approved plans
  for the cover designer and the favorites/viewer work). Use judgment: trivial → just build;
  large/forky → `EnterPlanMode`.
- Be decisive, verify your work (DOM probes given the screenshot wedge), keep `tsc` + build +
  console clean, and update the memory files after substantial features.
- The most recent approved plan (favorites/tutorial/viewer) lived at
  `C:\Users\Kevin\.claude\plans\iterative-booping-zephyr.md` and is fully implemented.
