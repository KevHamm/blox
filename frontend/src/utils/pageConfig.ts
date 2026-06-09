// US-Letter page at 96 DPI (8.5in × 11in) — the default paper for
// `\documentclass{article}`.
export const PAGE_WIDTH = 816;
export const PAGE_HEIGHT = 1056;

// `\documentclass{article}` margins. The defining feature of the article look
// is its ~345pt (≈ 66-character) text column, which LaTeX keeps narrow and
// centers on the page. 345pt × 96/72.27 ≈ 458px, so on US-Letter the side
// margins are (816 − 458) / 2 ≈ 179px. Vertical margins mirror article's
// ~1in + header / footer allowance.
export const PAGE_PADDING_TOP = 135;
export const PAGE_PADDING_BOTTOM = 145;
export const PAGE_PADDING_LEFT = 179;
export const PAGE_PADDING_RIGHT = 179;

// Gutter between text columns in two-column mode.
export const COLUMN_GAP = 28;

// Usable text area that sits between the margins.
export const CONTENT_WIDTH =
  PAGE_WIDTH - PAGE_PADDING_LEFT - PAGE_PADDING_RIGHT;

export const CONTENT_HEIGHT =
  PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
