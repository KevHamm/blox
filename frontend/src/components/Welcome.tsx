import type { CSSProperties } from "react";

interface WelcomeProps {
  onStart: () => void;
}

// San-Francisco-first system stack — the Apple typography feel.
const APPLE_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

// DIN-A4 portrait proportions for the choice cards.
const CARD_W = 232;
const CARD_H = Math.round((CARD_W * 297) / 210); // ≈ 328

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

const desc: CSSProperties = {
  marginTop: 18,
  maxWidth: CARD_W,
  textAlign: "center",
  fontSize: 14,
  lineHeight: 1.5,
  color: "#6e6e73",
  fontFamily: APPLE_FONT
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

export function Welcome({ onStart }: WelcomeProps) {
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

      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
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
            fontFamily: APPLE_FONT
          }}
        >
          Beautiful documents, designed visually.
        </p>

        <div style={{ display: "flex", gap: 60, alignItems: "flex-start", justifyContent: "center" }}>
          {/* Design page — disabled for now */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: CARD_W }}>
            <div
              aria-disabled
              style={{ ...card, color: "#86868b", opacity: 0.6, cursor: "not-allowed" }}
            >
              Design page
            </div>
            <p style={desc}>
              Design single or multiple pages such as resumes, cover pages, and more.
            </p>
          </div>

          {/* Work on project — opens the editor */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: CARD_W }}>
            <button
              className="welcome-card"
              onClick={onStart}
              style={{ ...card, color: "#1d1d1f", cursor: "pointer" }}
            >
              Work on project
            </button>
            <p style={desc}>
              Edit existing projects or choose a template to start a new one.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
