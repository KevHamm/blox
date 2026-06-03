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
}

export function Page({ children, pageNumber }: PageProps) {
  return (
    <div
      style={{
        position: "relative",
        width: PAGE_WIDTH,
        minHeight: PAGE_HEIGHT,
        background: "white",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        marginBottom: 40,
        paddingTop: PAGE_PADDING_TOP,
        paddingBottom: PAGE_PADDING_BOTTOM,
        paddingLeft: PAGE_PADDING_LEFT,
        paddingRight: PAGE_PADDING_RIGHT,
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
          bottom: 48,
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
