// A4 page at 96 DPI — matches an Overleaf / LaTeX `article` page.
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

// `\documentclass{article}` margins. The defining feature of the article look
// is its ~345pt (≈ 66-character) text column, which LaTeX keeps narrow and
// centers on the page. 345pt × 96/72.27 ≈ 458px, so the side margins are
// (794 − 458) / 2 ≈ 168px. Vertical margins mirror article's ~1in + header /
// footer allowance.
export const PAGE_PADDING_TOP = 135;
export const PAGE_PADDING_BOTTOM = 145;
export const PAGE_PADDING_LEFT = 168;
export const PAGE_PADDING_RIGHT = 168;

// Gutter between text columns in two-column mode.
export const COLUMN_GAP = 28;

// Usable text area that sits between the margins.
export const CONTENT_WIDTH =
  PAGE_WIDTH - PAGE_PADDING_LEFT - PAGE_PADDING_RIGHT;

export const CONTENT_HEIGHT =
  PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
