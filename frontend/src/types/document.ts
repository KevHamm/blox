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
    | "math";
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
  footnotes?: { id: string; word: number; text: string }[];
  listStyle?: "dash" | "dot" | "number";
  items?: { id: string; text?: string; latex?: string }[];
  // A math node rendered as a numbered display equation (\begin{equation}).
  display?: boolean;
  // Per-paragraph text alignment override ("center"); default is justified.
  align?: "center";
  // beamer slide (frame). "title" renders the centered title slide; otherwise a
  // normal frame with a frametitle bar.
  frameVariant?: "title" | "content";
  children?: DocumentNode[];
}
