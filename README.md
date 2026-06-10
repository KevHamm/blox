# Blox

**Blox is a visual, block-based editor for building LaTeX-style documents.**
Instead of writing LaTeX by hand, you compose a paper out of draggable blocks —
sections, subsections, paragraphs, tables and figures — on a live, paginated
page that looks like the final PDF. When you're done, Blox exports the document
to LaTeX source you can compile or drop into Overleaf.

Think "WYSIWYG front-end for a LaTeX `article`": you get the structure and
typographic feel of LaTeX without touching the markup until export time.

---

## What you can do

- **Write structured documents** — sections, subsections and subsubsections with
  automatic numbering (`1`, `1.2`, `1.2.3`), plus editable paragraphs.
- **See real pages, live** — content flows onto A4 pages with LaTeX-style
  margins. Text reflows automatically and breaks across columns and pages —
  even in the middle of a section or subsection — as you type.
- **One- or two-column layouts** — switch between a single column and a
  newspaper-style two-column flow (content fills the left column, then the
  right, then the next page).
- **Tables** — drag a table block from the **Blox** palette into the document; it
  starts as a 3×3 grid with drag-resizable columns that always fit the page.
- **Figures / images** — upload images to the right-hand panel, then drag them
  into the document. Images can be resized, dropped side-by-side into a shared
  container with a single caption, rearranged, or dragged back out to remove
  them.
- **Typography controls** — adjust text width, line spacing and font size with
  paired sliders and number inputs; the body uses a Computer Modern–style face
  (via KaTeX fonts) for an authentic LaTeX look.
- **Export to LaTeX** — send the document to the backend and download a `.tex`
  file.

---

## Architecture

Blox is a small two-part app:

| Part | Stack | Responsibility |
| --- | --- | --- |
| `frontend/` | React 19 + TypeScript + Vite | The editor UI: block model, live pagination, drag-and-drop, typography, page rendering. |
| `backend/` | FastAPI (Python) | Converts the document JSON into LaTeX source via the `/export-latex` endpoint. |

The editor keeps the document as a tree of nodes (`document → section →
subsection → subsubsection → paragraph / table / figure`). A height-measuring
pagination pass flows that tree into fixed-height columns and pages, so what you
see on screen mirrors how the content will break in print. Drag-and-drop is
built on [`@dnd-kit`](https://dndkit.com/).

> The LaTeX exporter covers the whole document model: sections / subsections /
> subsubsections, paragraphs (with bold / italic / underline, centering,
> footnotes and inline Greek letters), abstracts, lists, tables, figures,
> display equations and inline math, beamer frames, and the cover / contents /
> bibliography pages. The preamble pulls in `amsmath` (math) and `graphicx`
> (images); a document containing beamer frames is emitted as
> `\documentclass{beamer}`. Figures reference exported image filenames (the
> editor stores images inline as data URLs).

---

## Getting started

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+

### 1. Backend (LaTeX export service)

From the repository root:

```bash
python -m venv venv
# Windows: venv\Scripts\activate   •   macOS/Linux: source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The API serves at `http://localhost:8000` and accepts `POST /export-latex`.
CORS is configured for the Vite dev server (`http://localhost:5173`).

### 2. Frontend (editor)

```bash
cd frontend
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`). Use **Export LaTeX** in
the left sidebar to download a `.tex` file (requires the backend running).

### Production build

```bash
cd frontend
npm run build      # type-checks (tsc -b) and bundles with Vite
npm run preview    # serve the built output locally
```

---

## Project layout

```
blox/
├── frontend/            # React + TypeScript + Vite editor
│   └── src/
│       ├── App.tsx              # top-level editor state, sidebars, drag-and-drop
│       ├── renderer/            # recursive page/column/chunk rendering
│       ├── utils/               # pagination, numbering, page geometry, export
│       ├── components/          # Page, icons, etc.
│       └── types/               # the document node model
└── backend/             # FastAPI LaTeX exporter
    ├── main.py                  # /export-latex endpoint
    └── exporter.py              # document JSON → LaTeX source
```
