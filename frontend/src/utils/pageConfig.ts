// A4 page at 96 DPI — matches an Overleaf / LaTeX `article` page.
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

// LaTeX-style page margins — distinct on every side.
export const PAGE_PADDING_TOP = 96;
export const PAGE_PADDING_BOTTOM = 120;
export const PAGE_PADDING_LEFT = 100;
export const PAGE_PADDING_RIGHT = 110;

// Gutter between text columns in two-column mode.
export const COLUMN_GAP = 28;

// Usable text area that sits between the margins.
export const CONTENT_WIDTH =
  PAGE_WIDTH - PAGE_PADDING_LEFT - PAGE_PADDING_RIGHT;

export const CONTENT_HEIGHT =
  PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
