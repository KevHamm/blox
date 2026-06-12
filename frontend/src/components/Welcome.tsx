import { useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, MouseEvent } from "react";
import { Logo, ThemeToggle } from "./chrome";
import { parseProject, timeAgo, type BloxProject } from "../utils/persistence";

interface WelcomeProps {
  onStart: (preset?: string, rect?: DOMRect) => void;
  // Open a saved project (from a .blox file or the autosave slot).
  onOpen: (project: BloxProject, rect?: DOMRect) => void;
  // The autosaved session, if one exists — shown as a "continue" pill.
  autosave: BloxProject | null;
  dark: boolean;
  onToggleTheme: () => void;
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
  background: "var(--welcome-card-bg)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid var(--welcome-card-border)",
  boxShadow: "0 10px 34px rgba(30, 25, 70, 0.10)"
};

const descText: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "var(--ui-2nd)",
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
// three into the document presets; "Open project" opens a .blox file instead.
const INTRO: Record<number, { label: string; desc: string; enabled: boolean; action?: "new" | "open" }> = {
  1: {
    label: "Design page",
    desc: "Design single or multiple pages such as resumes, cover pages, and more.",
    enabled: false
  },
  2: {
    label: "Open project",
    desc: "Open a saved .blox project file and keep working on it.",
    enabled: true,
    action: "open"
  },
  3: {
    label: "Start new project",
    desc: "Pick a template and start from a clean document.",
    enabled: true,
    action: "new"
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

export function Welcome({ onStart, onOpen, autosave, dark, onToggleTheme }: WelcomeProps) {
  const [picking, setPicking] = useState(false);
  // Open-project plumbing: the hidden file input, the card rect captured at
  // click time (so the morph can start from the card), and a parse error.
  const fileRef = useRef<HTMLInputElement>(null);
  const openRectRef = useRef<DOMRect | undefined>(undefined);
  const errTimer = useRef<number | undefined>(undefined);
  const [openError, setOpenError] = useState<string | null>(null);

  function showOpenError(msg: string) {
    setOpenError(msg);
    window.clearTimeout(errTimer.current);
    errTimer.current = window.setTimeout(() => setOpenError(null), 5000);
  }

  async function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    try {
      onOpen(parseProject(await file.text()), openRectRef.current);
    } catch {
      showOpenError("That file doesn't look like a Blox project (.blox).");
    }
  }

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

      {/* Light / dark toggle, pinned to the top-right corner. */}
      <div style={{ position: "absolute", top: 20, right: 24, zIndex: 3 }}>
        <ThemeToggle dark={dark} onToggle={onToggleTheme} />
      </div>

      {/* Hidden picker behind the "Open project" card. */}
      <input
        ref={fileRef}
        type="file"
        accept=".blox,application/json"
        style={{ display: "none" }}
        onChange={handleFileChosen}
      />

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
            color: "var(--ui-text)",
            fontFamily: APPLE_FONT,
            display: "inline-flex",
            alignItems: "baseline",
            gap: "0.28em"
          }}
        >
          Welcome to <Logo flip={false} style={{ fontSize: "1em" }} />
        </h1>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 20,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: "var(--ui-2nd)",
            fontFamily: APPLE_FONT,
            transition: "opacity 0.3s ease"
          }}
        >
          {picking
            ? "Choose a template to start a new project."
            : "Beautiful documents, designed visually."}
        </p>

        {/* Fixed-height row under the subtitle: the continue-last-session pill
            (when an autosave exists), or an open-project error. Reserving the
            height keeps the cards from shifting when either appears. */}
        <div
          style={{
            height: 38,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center"
          }}
        >
          {openError ? (
            <span
              style={{
                fontSize: 14,
                color: "#e0383e",
                fontFamily: APPLE_FONT,
                padding: "5px 0"
              }}
            >
              {openError}
            </span>
          ) : autosave && !picking ? (
            <button
              className="welcome-resume"
              onClick={(e) => onOpen(autosave, e.currentTarget.getBoundingClientRect())}
              title="Restore the autosaved session"
            >
              Continue “{autosave.title || "Untitled"}”
              <span className="resume-when">· saved {timeAgo(autosave.savedAt)}</span>
            </button>
          ) : null}
        </div>

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
                if (!intro?.enabled) return;
                if (intro.action === "open") {
                  // Remember where the card sits so the morph can start there
                  // once the chosen file has been read.
                  openRectRef.current = e.currentTarget.getBoundingClientRect();
                  fileRef.current?.click();
                } else {
                  setPicking(true); // "Start new project" fans out the presets
                }
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
                    color: "var(--ui-text)",
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
