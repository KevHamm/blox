/* -----------------------------------------------------------------
   Inline character formatting for paragraphs (bold / italic / underline).

   A paragraph keeps its plain `text` as the source of truth — every offset,
   page-split slice, footnote word index and measurement still works on that
   plain string. Formatting is stored separately as `marks`: non-overlapping
   character ranges, each carrying any of b / i / u. This keeps formatting
   purely additive: anything that ignores `marks` behaves exactly as before.
----------------------------------------------------------------- */
export type Mark = { start: number; end: number; b?: boolean; i?: boolean; u?: boolean };
export type Fmt = { b: boolean; i: boolean; u: boolean };

const fmtEq = (a: Fmt | Mark, b: Fmt | Mark) =>
  !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u;
const isPlain = (m: Mark) => !m.b && !m.i && !m.u;

// Sort, drop empty/plain ranges, and merge touching ranges with equal formats.
export function normalizeMarks(runs: Mark[]): Mark[] {
  const sorted = runs.filter((r) => r.end > r.start && !isPlain(r)).sort((a, b) => a.start - b.start);
  const out: Mark[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.end === r.start && fmtEq(last, r)) last.end = r.end;
    else out.push({ ...r });
  }
  return out;
}

// The active format at character position `pos`.
export function formatAt(marks: Mark[], pos: number): Fmt {
  for (const m of marks) if (pos >= m.start && pos < m.end) return { b: !!m.b, i: !!m.i, u: !!m.u };
  return { b: false, i: false, u: false };
}

// Marks restricted to [start, end), rebased to slice-local coordinates.
export function sliceMarks(marks: Mark[], start: number, end: number): Mark[] {
  const out: Mark[] = [];
  for (const m of marks) {
    const s = Math.max(m.start, start), e = Math.min(m.end, end);
    if (s < e) out.push({ start: s - start, end: e - start, b: m.b, i: m.i, u: m.u });
  }
  return out;
}

// Replace the marks covering [start, end) with `sliceRuns` (given in slice-local
// coordinates), shifting every mark after `end` by the change in text length.
// Used when committing an edit to one page-split slice back into the whole node.
export function spliceMarks(
  full: Mark[],
  start: number,
  end: number,
  sliceRuns: Mark[],
  newLen: number
): Mark[] {
  const delta = newLen - (end - start);
  const out: Mark[] = [];
  for (const m of full) {
    if (m.end <= start) out.push({ ...m });
    else if (m.start >= end) out.push({ ...m, start: m.start + delta, end: m.end + delta });
    else {
      if (m.start < start) out.push({ ...m, start: m.start, end: start });
      if (m.end > end) out.push({ ...m, start: end + delta, end: m.end + delta });
    }
  }
  for (const r of sliceRuns) out.push({ start: r.start + start, end: r.end + start, b: r.b, i: r.i, u: r.u });
  return normalizeMarks(out);
}

export function marksEqual(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.start !== y.start || x.end !== y.end || !!x.b !== !!y.b || !!x.i !== !!y.i || !!x.u !== !!y.u)
      return false;
  }
  return true;
}
