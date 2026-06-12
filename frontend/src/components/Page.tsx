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
        // The page is a direct child of the flex-column .doc-area. Without this,
        // flex-shrink (default 1) squashes every page vertically to fit the
        // scroll viewport, so pages render shorter than US-Letter and their
        // content spills past the bottom / behind the next page.
        flex: "none",
        // Clip any content that does overflow so it can never bleed visibly past
        // the page edge (behind the following page) before re-pagination lands.
        overflow: "hidden",
        background: "white",
        borderRadius: 6,
        boxShadow: "0 12px 40px rgba(55, 45, 25, 0.10), 0 2px 6px rgba(55, 45, 25, 0.06)",
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
