// Shared editor chrome: the BLoX wordmark / logo and the light–dark toggle,
// reused by both the top bar and the welcome screen.
import type { CSSProperties } from "react";

// One flipping letter of the logo: shows `front` normally, `back` on hover.
function FlipLetter({ front, back, delay, frontBlue, backBlue }: any) {
  const blue = { color: "var(--ui-blue)" };
  return (
    <span className="logo-flip" style={{ transitionDelay: delay }}>
      <span className="logo-face logo-front" style={frontBlue ? blue : undefined}>{front}</span>
      <span className="logo-face logo-back" style={backBlue ? blue : undefined}>{back}</span>
    </span>
  );
}

// The "BLoX" wordmark. In the editor (`flip` on) the "LoX" letters rotate to
// "aCK" on hover so it reads "BaCK" and clicking returns to the chooser. As a
// plain wordmark (`flip` off, used in the welcome title) it's a static, non-
// interactive "BLoX". `large` enlarges it for the expanded top bar; `style`
// lets the welcome title size it to the heading.
export function Logo({
  onClick, large, flip = true, style
}: { onClick?: () => void; large?: boolean; flip?: boolean; style?: CSSProperties }) {
  const cls = `blox-logo${large ? " large" : ""}`;
  if (!flip) {
    return (
      <div className={cls} style={{ cursor: onClick ? "pointer" : "default", ...style }} onClick={onClick}>
        <span>B</span>
        <span>L</span>
        <span style={{ color: "var(--ui-blue)" }}>o</span>
        <span>X</span>
      </div>
    );
  }
  return (
    <div className={cls} style={style} onClick={onClick} title="Back to templates">
      <span>B</span>
      <FlipLetter front="L" back="a" delay="0s" backBlue />
      <FlipLetter front="o" back="C" delay="0.05s" frontBlue />
      <FlipLetter front="X" back="K" delay="0.1s" />
    </div>
  );
}

// An iOS-style switch that flips the app between light and dark.
export function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-pressed={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      <span className="theme-track" data-on={dark ? "true" : "false"}>
        <span className="theme-thumb">
          {dark ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          )}
        </span>
      </span>
      <span className="theme-label">{dark ? "Dark" : "Light"}</span>
    </button>
  );
}
