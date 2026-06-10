import { useState } from "react";
import type { CSSProperties, MouseEvent } from "react";

interface WelcomeProps {
  onStart: (preset?: string, rect?: DOMRect) => void;
}

// San-Francisco-first system stack — the Apple typography feel.
const APPLE_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

// DIN-A4 portrait proportions for the choice cards.
const CARD_W = 232;
const CARD_H = Math.round((CARD_W * 297) / 210); // ≈ 328
const GAP = 26;

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

const card: CSSProperties = {
  width: CARD_W,
  height: CARD_H,
  borderRadius: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 22,
  boxSizing: "border-box",
  textAlign: "center",
  fontSize: 21,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  fontFamily: APPLE_FONT,
  background: "rgba(255, 255, 255, 0.66)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid rgba(255, 255, 255, 0.7)",
  boxShadow: "0 10px 34px rgba(30, 25, 70, 0.10)"
};

const descText: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "#6e6e73",
  fontFamily: APPLE_FONT,
  padding: "0 4px"
};

// The five document presets. The two ends (article / book) are the cards the
// intro buttons morph into; the three in the middle fade in between them.
const PRESETS = [
  { id: "article", label: "Article", desc: "A clean single-column article — LaTeX’s article class." },
  { id: "report",  label: "Report",  desc: "A longer document with a title page, chapters and sections." },
  { id: "letter",  label: "Letter",  desc: "Formal correspondence with sender, recipient and a signature." },
  { id: "beamer",  label: "Beamer",  desc: "A slide deck built from individual frames." },
  { id: "book",    label: "Book",    desc: "A multi-chapter book with front- and back-matter." },
  { id: "wip",     label: "WIP",     desc: "A ~50-page stress-test document for developing pagination & the outline." }
];

// The three intro buttons live in the middle slots (1, 2, 3). Clicking
// "Start new project" fans the two end cards (0, 4) outward and morphs all
// three into the document presets.
const INTRO: Record<number, { label: string; desc: string; enabled: boolean }> = {
  1: {
    label: "Design page",
    desc: "Design single or multiple pages such as resumes, cover pages, and more.",
    enabled: false
  },
  2: {
    label: "Open project",
    desc: "Continue working on one of your saved projects.",
    enabled: false
  },
  3: {
    label: "Start new project",
    desc: "Pick a template and start from a clean document.",
    enabled: true
  }
};

// Decorative floating "paper sheets" in the background.
const sheets: any[] = [
  { width: 124, height: 168, top: "12%", left: "8%",  "--rot": "-13deg", animationDelay: "0s" },
  { width: 88,  height: 120, top: "15%", right: "13%", "--rot": "11deg",  animationDelay: "1.7s" },
  { width: 152, height: 205, bottom: "9%", right: "9%", "--rot": "-7deg",  animationDelay: "0.7s" },
  { width: 100, height: 138, bottom: "13%", left: "10%", "--rot": "9deg",  animationDelay: "3s" },
  { width: 60,  height: 84,  top: "46%", left: "4%",  "--rot": "6deg",   animationDelay: "2.3s" },
  { width: 70,  height: 96,  top: "40%", right: "5%",  "--rot": "-5deg",  animationDelay: "1.1s" }
];

const labelLayer = (show: boolean): CSSProperties => ({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 22,
  boxSizing: "border-box",
  opacity: show ? 1 : 0,
  transition: "opacity 0.35s ease"
});

const descLayer = (show: boolean): CSSProperties => ({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  textAlign: "center",
  opacity: show ? 1 : 0,
  transition: "opacity 0.35s ease",
  ...descText
});

export function Welcome({ onStart }: WelcomeProps) {
  const [picking, setPicking] = useState(false);

  return (
    <div
      className="welcome-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: APPLE_FONT
      }}
    >
      {sheets.map((s, i) => (
        <div key={i} className="welcome-sheet" style={s} />
      ))}

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 1320,
          padding: "0 24px",
          boxSizing: "border-box",
          textAlign: "center"
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 54,
            fontWeight: 600,
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
            color: "#1d1d1f",
            fontFamily: APPLE_FONT
          }}
        >
          Welcome to Blox
        </h1>
        <p
          style={{
            margin: "0 0 48px",
            fontSize: 20,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: "#6e6e73",
            fontFamily: APPLE_FONT,
            transition: "opacity 0.3s ease"
          }}
        >
          {picking
            ? "Choose a template to start a new project."
            : "Beautiful documents, designed visually."}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            rowGap: 28,
            justifyContent: "center",
            alignItems: "flex-start",
            maxWidth: "100%"
          }}
        >
          {PRESETS.map((p, i) => {
            const intro = INTRO[i];
            // Slots 1-3 are the intro buttons; every other card (the two ends and
            // any extra presets like WIP) stays hidden until "Start new project"
            // fans them in.
            const isExtra = !intro;
            const isEnd = i === 0 || i === PRESETS.length - 1;
            const collapsed = !picking && isExtra;
            const interactive = picking || (intro?.enabled ?? false);
            const disabled = !interactive;

            const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
              if (!picking) {
                if (intro?.enabled) setPicking(true); // "Start new project" fans out the presets
              } else {
                // Hand the card's exact rect to App so it can grow into the page.
                onStart(p.id, e.currentTarget.getBoundingClientRect());
              }
            };

            return (
              <div
                key={p.id}
                style={{
                  flex: "0 0 auto",
                  width: collapsed ? 0 : CARD_W,
                  marginLeft: collapsed ? 0 : i === 0 ? 0 : GAP / 2,
                  marginRight: collapsed ? 0 : i === PRESETS.length - 1 ? 0 : GAP / 2,
                  opacity: collapsed ? 0 : 1,
                  transform: collapsed ? "scale(0.92)" : "scale(1)",
                  transition: `width 0.5s ${EASE}, margin 0.5s ${EASE}, opacity 0.45s ease, transform 0.45s ease`,
                  transitionDelay: collapsed ? "0s" : isEnd ? "0.12s" : "0s",
                  overflow: "hidden",
                  pointerEvents: collapsed ? "none" : "auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <button
                  className={interactive ? "welcome-card" : undefined}
                  disabled={disabled}
                  onClick={handleClick}
                  style={{
                    ...card,
                    position: "relative",
                    color: "#1d1d1f",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.6 : 1
                  }}
                >
                  {intro ? (
                    <>
                      <span style={labelLayer(!picking)}>{intro.label}</span>
                      <span style={labelLayer(picking)}>{p.label}</span>
                    </>
                  ) : (
                    p.label
                  )}
                </button>

                <div style={{ position: "relative", width: CARD_W, height: 70, marginTop: 16 }}>
                  {intro ? (
                    <>
                      <span style={descLayer(!picking)}>{intro.desc}</span>
                      <span style={descLayer(picking)}>{p.desc}</span>
                    </>
                  ) : (
                    <span style={descLayer(true)}>{p.desc}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
