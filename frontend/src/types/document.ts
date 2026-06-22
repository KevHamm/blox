// A free-form vector shape that floats over the document (not part of the text
// flow). Anchored to a page by index, positioned/sized in page pixels measured
// from the page's top-left corner (margins included). Lines/arrows are drawn
// across the diagonal of their bounding box (top-left → bottom-right, or the
// other diagonal when `flip` is set); rects/circles fill their box.
export type ShapeKind = "line" | "arrow" | "rect" | "circle";
export interface Shape {
  id: string;
  kind: ShapeKind;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;        // stroke colour (hex)
  fill?: string | null; // fill colour (hex) for rect/circle, or null for none
  strokeWidth: number;  // stroke / wall thickness, in page px
  flip?: boolean;       // line/arrow: draw the bottom-left → top-right diagonal
}

/**
 * A node in the document tree. The editor is intentionally loose: a single
 * shape covers documents, sections, subsections, subsubsections, paragraphs,
 * tables and figures, with only the fields relevant to each `type` populated.
 */
export interface DocumentNode {
  id: string;
  type:
    | "document"
    | "coverpage"
    | "toc"
    | "bibliography"
    | "section"
    | "subsection"
    | "subsubsection"
    | "frame"
    | "paragraph"
    | "abstract"
    | "list"
    | "table"
    | "figure"
    | "math"
    | "verbatim"
    | "code";
  title?: string;
  text?: string;
  // Inline character formatting for paragraph text (bold / italic / underline),
  // stored as character ranges alongside the plain `text`. See utils/marks.ts.
  marks?: { start: number; end: number; b?: boolean; i?: boolean; u?: boolean }[];
  latex?: string;
  caption?: string;
  rows?: string[][];
  colWidths?: number[];
  colors?: (string | null)[][];
  removedRows?: any[];
  removedColumns?: any[];
  // Custom grid: internal separators removed, keyed "row:col" (vertical = line to
  // the right of the cell; horizontal = line below the cell).
  removedVBorders?: string[];
  removedHBorders?: string[];
  width?: number;
  images?: { id: string; src: string }[];
  sectionNumber?: number;
  numberLabel?: string;
  // Footnotes anchor to a character `offset` in the text (where the superscript
  // marker sits). The marker lives inline in the contentEditable, so it moves
  // with edits; when it is deleted along with its word, the footnote becomes
  // `unconnected` (painted red, prefixed with a warning) and is never reassigned
  // to a different word.
  footnotes?: { id: string; offset: number; text: string; unconnected?: boolean }[];
  // Inline citations anchored at a character offset, referencing a bibliography
  // entry. Rendered as a clickable [n] marker (n = the entry's number).
  citations?: { id: string; offset: number; entryId: string }[];
  // Document-level bibliography (only meaningful on the root node): the chosen
  // BibTeX style and the list of raw entries citations point at.
  bib?: { style: string; entries: { id: string; key: string; raw: string }[] };
  listStyle?: "dash" | "dot" | "number";
  // Source-code listing language (only meaningful on a "code" node); "text" = no
  // language. Verbatim/code content lives in `text`, stored and exported raw.
  language?: string;
  items?: { id: string; text?: string; latex?: string }[];
  // A math node rendered as a numbered display equation (\begin{equation}).
  display?: boolean;
  // Per-paragraph text alignment override ("center"); default is justified.
  align?: "center";
  // beamer slide (frame). "title" renders the centered title slide; otherwise a
  // normal frame with a frametitle bar.
  frameVariant?: "title" | "content";
  children?: DocumentNode[];
  // Free-form overlay shapes (only meaningful on the root document node).
  shapes?: Shape[];
}
