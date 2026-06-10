/* -----------------------------------------------------------------
   Greek-letter typing helper.

   When a word the user types spells a Greek letter ("alpha", "Pi", …) the
   paragraph editor offers the matching glyph as a small superscript menu that
   can be clicked to swap the word for the symbol. The lookup is exact (the whole
   word must be a letter name) so ordinary words like "alphabet" don't trigger;
   case decides upper vs lower (alpha → α, Alpha → Α).
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

// The Greek glyph for a typed word, or null if the word isn't a letter name.
export function greekFor(word: string): string | null {
  if (!word) return null;
  const lower = word.toLowerCase();
  if (!(lower in GREEK_LOWER)) return null;
  const startsUpper = word[0] !== word[0].toLowerCase() && word[0] === word[0].toUpperCase();
  return startsUpper ? GREEK_UPPER[lower] : GREEK_LOWER[lower];
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
