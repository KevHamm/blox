import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  PAGE_PADDING_TOP,
  PAGE_PADDING_BOTTOM,
  PAGE_PADDING_LEFT,
  PAGE_PADDING_RIGHT
} from "../utils/pageConfig";

interface PageProps {
  children: React.ReactNode;
  pageNumber: number;
  // Page geometry (defaults to the article / US-Letter constants).
  width?: number;
  height?: number;
  padTop?: number;
  padBottom?: number;
  padLeft?: number;
  padRight?: number;
}

export function Page({
  children,
  pageNumber,
  width = PAGE_WIDTH,
  height = PAGE_HEIGHT,
  padTop = PAGE_PADDING_TOP,
  padBottom = PAGE_PADDING_BOTTOM,
  padLeft = PAGE_PADDING_LEFT,
  padRight = PAGE_PADDING_RIGHT
}: PageProps) {
  return (
    <div
      className="blox-page"
      style={{
        position: "relative",
        width,
        // Fixed height — a page never grows; overflowing content is paginated
        // onto the next page instead.
        height,
        background: "white",
        borderRadius: 6,
        boxShadow: "0 12px 40px rgba(20, 20, 50, 0.10), 0 2px 6px rgba(20, 20, 50, 0.06)",
        marginBottom: 44,
        paddingTop: padTop,
        paddingBottom: padBottom,
        paddingLeft: padLeft,
        paddingRight: padRight,
        boxSizing: "border-box",
        textAlign: "left",
        color: "var(--text)",
        fontFamily: "var(--sans)"
      }}
    >
      {children}

      {/* LaTeX-style centered page number in the bottom margin */}
      <div
        style={{
          position: "absolute",
          bottom: Math.max(16, padBottom - 72),
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 12,
          color: "#555",
          fontFamily: "var(--sans)",
          userSelect: "none"
        }}
      >
        {pageNumber}
      </div>
    </div>
  );
}
