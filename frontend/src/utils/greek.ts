/* -----------------------------------------------------------------
   Symbol typing helper (Greek letters + math symbols).

   When a word the user types spells a Greek letter ("alpha", "Pi", …) or a math
   symbol command ("times", "leq", "in", …) the paragraph editor offers the
   matching glyph as a small superscript menu — click it (or press Enter while
   it's showing) to swap the word for the symbol. The lookup is exact (the whole
   word must be the name) so ordinary words like "alphabet" don't trigger; Greek
   names are case-folded (alpha → α, Alpha → Α), math commands are case-exact.
----------------------------------------------------------------- */
const NAMES = [
  "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
  "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "pi", "rho",
  "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega"
];
const LOWER = "αβγδεζηθικλμνξοπρστυφχψω";
const UPPER = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";

const GREEK_LOWER: Record<string, string> = {};
const GREEK_UPPER: Record<string, string> = {};
NAMES.forEach((name, i) => {
  GREEK_LOWER[name] = LOWER[i];
  GREEK_UPPER[name] = UPPER[i];
});

// Math symbol command → glyph. Keyed by the exact LaTeX command name. Kept in
// sync with the exporter's glyph → command map (backend/exporter.py).
export const MATH_SYMBOLS: Record<string, string> = {
  // arrows / harpoons
  leftarrow: "←", Leftarrow: "⇐", rightarrow: "→", Rightarrow: "⇒",
  leftrightarrow: "↔", rightleftharpoons: "⇌", uparrow: "↑", downarrow: "↓",
  Uparrow: "⇑", Downarrow: "⇓", Leftrightarrow: "⇔", Updownarrow: "⇕",
  mapsto: "↦", longmapsto: "⟼", nearrow: "↗", searrow: "↘",
  swarrow: "↙", nwarrow: "↖", leftharpoonup: "↼", rightharpoonup: "⇀",
  leftharpoondown: "↽", rightharpoondown: "⇁",
  // misc symbols
  infty: "∞", forall: "∀", Re: "ℜ", Im: "ℑ", nabla: "∇", exists: "∃",
  partial: "∂", nexists: "∄", emptyset: "∅", varnothing: "⌀", wp: "℘",
  complement: "∁", neg: "¬", cdots: "⋯", square: "□", blacksquare: "■",
  triangle: "△",
  // binary operators / relations
  times: "×", cdot: "⋅", div: "÷", cap: "∩", cup: "∪", neq: "≠",
  leq: "≤", geq: "≥", in: "∈", perp: "⊥", notin: "∉", subset: "⊂",
  simeq: "≃", approx: "≈", wedge: "∧", vee: "∨", oplus: "⊕", otimes: "⊗",
  Box: "□", boxtimes: "⊠", equiv: "≡", cong: "≅"
};

// The glyph for a typed word — a math symbol command (exact) or a Greek letter
// name (case-folded). Null if the word isn't a known symbol name.
export function symbolFor(word: string): string | null {
  if (!word) return null;
  if (word in MATH_SYMBOLS) return MATH_SYMBOLS[word];
  const lower = word.toLowerCase();
  if (lower in GREEK_LOWER) {
    const startsUpper = word[0] !== word[0].toLowerCase() && word[0] === word[0].toUpperCase();
    return startsUpper ? GREEK_UPPER[lower] : GREEK_LOWER[lower];
  }
  return null;
}

// The run of letters the caret sits inside or is attached to (either edge),
// with its character range. Returns null when the caret isn't on a letter run.
export function wordAround(text: string, caret: number): { word: string; start: number; end: number } | null {
  const isLetter = (c: string) => /[A-Za-z]/.test(c);
  let s = caret, e = caret;
  while (s > 0 && isLetter(text[s - 1])) s--;
  while (e < text.length && isLetter(text[e])) e++;
  if (s === e) return null;
  return { word: text.slice(s, e), start: s, end: e };
}
