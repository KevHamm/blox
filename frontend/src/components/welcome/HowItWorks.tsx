// A restrained, editorial tutorial shown from the welcome's "How it works"
// button: a short serif intro then a handful of numbered step cards (each a
// small inline SVG motif + one line of copy), echoing the welcome aesthetic.

type Step = { title: string; body: string; glyph: React.ReactNode };

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const STEPS: Step[] = [
  {
    title: "Drag blocks onto the page",
    body: "Pick sections, paragraphs, figures, tables, lists or equations from the palette and drop them straight onto a true-to-size page.",
    glyph: (
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
        <rect x="5" y="6" width="13" height="9" rx="2" {...S} />
        <rect x="22" y="20" width="13" height="13" rx="2" {...S} />
        <path d="M18 10h7a3 3 0 0 1 3 3v4" {...S} opacity={0.7} />
      </svg>
    )
  },
  {
    title: "Edit in place",
    body: "Type directly on the page — what you see is the page you'll get. Select text for bold, italic, footnotes and citations.",
    glyph: (
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
        <path d="M7 28h16" {...S} />
        <path d="M26 9l5 5-14 14-6 1 1-6z" {...S} />
      </svg>
    )
  },
  {
    title: "Tune typography & margins",
    body: "The Typography panel adjusts the font, size, line spacing and every page margin — top, bottom, left and right.",
    glyph: (
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
        <rect x="7" y="6" width="26" height="28" rx="2.5" {...S} />
        <path d="M13 13h14M13 19h14M13 25h9" {...S} opacity={0.8} />
        <path d="M7 6v28M33 6v28" {...S} />
      </svg>
    )
  },
  {
    title: "Add figures, tables & citations",
    body: "Upload images and drop them into figures, build tables cell by cell, and quote sources to auto-number a bibliography.",
    glyph: (
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
        <rect x="6" y="8" width="16" height="13" rx="2" {...S} />
        <circle cx="11" cy="13" r="1.6" {...S} />
        <path d="M7 19l4-4 3 3 3-3 4 4" {...S} />
        <path d="M26 24h8M26 29h8M30 24v9" {...S} opacity={0.8} />
      </svg>
    )
  },
  {
    title: "Design free-form pages",
    body: "Switch to a cover or page designer to place text, logos and shapes anywhere — your creative playground.",
    glyph: (
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
        <rect x="7" y="6" width="26" height="28" rx="2.5" {...S} />
        <rect x="12" y="11" width="10" height="6" rx="1" {...S} />
        <circle cx="27" cy="25" r="3.5" {...S} />
        <path d="M12 24h7" {...S} opacity={0.8} />
      </svg>
    )
  },
  {
    title: "Export to LaTeX",
    body: "One click produces clean, compilable .tex — figures bundled in a zip — so your visual page becomes real LaTeX.",
    glyph: (
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
        <path d="M20 6v18" {...S} />
        <path d="M13 17l7 7 7-7" {...S} />
        <path d="M8 30h24" {...S} />
      </svg>
    )
  }
];

export function HowItWorks({ onBack }: { onBack: () => void }) {
  return (
    <section className="howto" aria-label="How it works">
      <div className="howto-head">
        <button className="picker-back" onClick={onBack} aria-label="Back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div>
          <div className="howto-eyebrow"><span className="hero-eyebrow-mark" />A two-minute tour</div>
          <h2 className="howto-title">How BLoX works</h2>
          <p className="howto-sub">Compose documents visually on a real page — then export compilable LaTeX. Here's the whole loop.</p>
        </div>
      </div>

      <div className="howto-grid">
        {STEPS.map((s, i) => (
          <div className="howto-card" key={s.title}>
            <span className="howto-num">{i + 1}</span>
            <span className="howto-glyph">{s.glyph}</span>
            <span className="howto-card-title">{s.title}</span>
            <span className="howto-card-body">{s.body}</span>
          </div>
        ))}
      </div>

      <div className="howto-foot">
        Sign in with <b>dev</b> / <b>123</b> to open your projects, browse templates and start designing.
      </div>
    </section>
  );
}
