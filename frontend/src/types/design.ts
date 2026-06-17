// A free-form "design page" (a cover page for now): a single sheet on which the
// user places elements anywhere — floating text fields, images/logos and basic
// shapes — and positions / resizes them freely. Unlike the flowing document
// model, nothing is paginated; every element is absolutely positioned in page
// pixels measured from the page's top-left corner.

export type DesignElementKind = "text" | "image" | "rect" | "line";

export interface DesignElement {
  id: string;
  kind: DesignElementKind;
  // Box geometry, in page pixels from the top-left corner.
  x: number;
  y: number;
  w: number;
  h: number;
  // --- text -------------------------------------------------------------
  text?: string;
  fontSize?: number;            // px
  fontFamily?: string;          // a DOC_FONTS id
  color?: string;               // hex
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  // --- image ------------------------------------------------------------
  src?: string;                 // data URL
  // --- shapes (rect / line) --------------------------------------------
  fill?: string | null;         // rect fill, or null for none
  stroke?: string;              // stroke / line colour (hex)
  strokeWidth?: number;         // px
}

export interface DesignPage {
  // Which kind of page this is. Only "cover" exists today; bibliography /
  // section-divider pages will reuse the same model later.
  kind: "cover";
  pageWidth: number;
  pageHeight: number;
  bg: string;                   // page background colour (hex)
  elements: DesignElement[];
}

// US-Letter at 96 DPI — matches the document templates so the two editors share
// a page size. A4 is offered as an alternative in the designer.
export const LETTER: { pageWidth: number; pageHeight: number } = { pageWidth: 816, pageHeight: 1056 };
export const A4: { pageWidth: number; pageHeight: number } = { pageWidth: 794, pageHeight: 1123 };

export function blankDesign(kind: DesignPage["kind"] = "cover"): DesignPage {
  return { kind, pageWidth: LETTER.pageWidth, pageHeight: LETTER.pageHeight, bg: "#ffffff", elements: [] };
}
