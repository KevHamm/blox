import { Logo, ThemeToggle } from "../chrome";

export function HeartIcon({ filled, size = 15 }: { filled?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

// The read-only viewer's slim top bar — mirrors the editor's collapsed top bar:
// the BLoX/BaCK logo at the far left, the open / favorite actions in the centre,
// and the theme toggle + Export on the right.
export function ViewerBar({
  onBack, onOpenInEditor, isFav, onToggleFav, dark, onToggleTheme, onExport
}: {
  onBack: () => void;
  onOpenInEditor: () => void;
  isFav: boolean;
  onToggleFav: () => void;
  dark: boolean;
  onToggleTheme: () => void;
  onExport: () => void;
}) {
  return (
    <div className="ui-panel viewer-bar">
      <div className="viewer-bar-side">
        <Logo onClick={onBack} />
      </div>
      <div className="viewer-bar-center">
        <button className="ui-btn primary" onClick={onOpenInEditor}>Open in editor</button>
        <button className={`ui-btn viewer-fav${isFav ? " on" : ""}`} onClick={onToggleFav}>
          <HeartIcon filled={isFav} />
          {isFav ? "Remove from favorites" : "Save as favorite"}
        </button>
      </div>
      <div className="viewer-bar-side viewer-bar-right">
        <ThemeToggle dark={dark} onToggle={onToggleTheme} />
        <button className="ui-btn primary" onClick={onExport}>Export LaTeX</button>
      </div>
    </div>
  );
}
