/**
 * A node in the document tree. The editor is intentionally loose: a single
 * shape covers documents, sections, subsections, subsubsections, paragraphs,
 * tables and figures, with only the fields relevant to each `type` populated.
 */
export interface DocumentNode {
  id: string;
  type:
    | "document"
    | "section"
    | "subsection"
    | "subsubsection"
    | "paragraph"
    | "table"
    | "figure";
  title?: string;
  text?: string;
  caption?: string;
  rows?: string[][];
  colWidths?: number[];
  width?: number;
  images?: { id: string; src: string }[];
  sectionNumber?: number;
  children?: DocumentNode[];
}
