/* -----------------------------------------------------------------
   ASCII → arrow autocorrect for paragraph text.

   As the user types, sequences like "->" turn into the matching arrow glyph.
   "<-" and "<=" are prefixes of "<->" / "<=>", so they aren't converted the
   instant they're typed — they wait one keystroke: a following ">" extends them
   to the double arrow, anything else resolves them to the single arrow.
----------------------------------------------------------------- */

// Longest-first so a longer trigger always wins over a shorter suffix.
const ARROWS: { seq: string; sym: string }[] = [
  { seq: "|-->", sym: "⟼" },
  { seq: "<=>", sym: "⇔" },
  { seq: "<->", sym: "↔" },
  { seq: "|->", sym: "↦" },
  { seq: "->", sym: "→" },
  { seq: "<-", sym: "←" },
  { seq: "=>", sym: "⇒" },
  { seq: "<=", sym: "⇐" }
];

// Triggers that are a prefix of a longer one (extended by ">").
const AMBIGUOUS: Record<string, string> = { "<-": "←", "<=": "⇐" };

// If the text just before `caret` ends in an arrow trigger, return the range to
// replace and the glyph to insert; otherwise null.
export function arrowAutocorrect(
  text: string,
  caret: number
): { from: number; to: number; symbol: string } | null {
  // Longest trigger ending exactly at the caret.
  for (const a of ARROWS) {
    if (caret >= a.seq.length && text.slice(caret - a.seq.length, caret) === a.seq) {
      // "<-" / "<=" might still grow into "<->" / "<=>" — wait one keystroke.
      if (a.seq in AMBIGUOUS) break;
      return { from: caret - a.seq.length, to: caret, symbol: a.sym };
    }
  }
  // A pending "<-" / "<=" followed by a just-typed char that isn't ">": resolve.
  if (caret >= 3) {
    const two = text.slice(caret - 3, caret - 1);
    if (two in AMBIGUOUS && text[caret - 1] !== ">") {
      return { from: caret - 3, to: caret - 1, symbol: AMBIGUOUS[two] };
    }
  }
  return null;
}
