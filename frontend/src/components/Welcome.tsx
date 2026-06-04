import type { CSSProperties } from "react";

interface WelcomeProps {
  onStart: () => void;
}

// DIN-A4 portrait proportions for the choice cards.
const CARD_W = 230;
const CARD_H = Math.round((CARD_W * 297) / 210); // ≈ 325

const card: CSSProperties = {
  width: CARD_W,
  height: CARD_H,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
  textAlign: "center",
  fontSize: 22,
  fontFamily: "var(--sans)",
  background: "white",
  border: "1px solid #d6d6d6",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
};

const desc: CSSProperties = {
  marginTop: 16,
  maxWidth: CARD_W,
  textAlign: "center",
  fontSize: 13,
  lineHeight: 1.5,
  color: "#666",
  fontFamily: "var(--sans)"
};

export function Welcome({ onStart }: WelcomeProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f3f3"
      }}
    >
      <div style={{ display: "flex", gap: 56, alignItems: "flex-start" }}>
        {/* Design page — disabled for now */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: CARD_W }}>
          <div
            aria-disabled
            style={{ ...card, color: "#999", opacity: 0.55, cursor: "not-allowed" }}
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
            style={{ ...card, color: "var(--text)", cursor: "pointer" }}
          >
            Work on project
          </button>
          <p style={desc}>
            Edit existing projects or choose a template to start a new one.
          </p>
        </div>
      </div>
    </div>
  );
}
