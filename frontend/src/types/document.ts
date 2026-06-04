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
    | "paragraph"
    | "table"
    | "figure"
    | "math";
  title?: string;
  text?: string;
  latex?: string;
  caption?: string;
  rows?: string[][];
  colWidths?: number[];
  colors?: (string | null)[][];
  removedRows?: any[];
  removedColumns?: any[];
  width?: number;
  images?: { id: string; src: string }[];
  sectionNumber?: number;
  children?: DocumentNode[];
}
