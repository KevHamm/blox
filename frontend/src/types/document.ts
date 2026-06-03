/**
 * A node in the document tree. The editor is intentionally loose: a single
 * shape covers documents, sections, subsections, paragraphs, tables and
 * figures, with only the fields relevant to each `type` populated.
 */
export interface DocumentNode {
  id: string;
  type: "document" | "section" | "subsection" | "paragraph" | "table" | "figure";
  title?: string;
  text?: string;
  src?: string;
  caption?: string;
  rows?: string[][];
  colWidths?: number[];
  sectionNumber?: number;
  children?: DocumentNode[];
}
