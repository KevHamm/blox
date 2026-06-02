interface PageProps {
  children: React.ReactNode;
  pageNumber: number;
  totalPages: number;
}

export function Page({ children, pageNumber, totalPages }: PageProps) {
  return (
    <div
      style={{
        position: "relative",
        width: 794,
        minHeight: 1123,
        background: "white",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        marginBottom: 40,
        padding: "60px 80px",
        boxSizing: "border-box",
        textAlign: "left"
      }}
    >
      {/* Page content */}
      <div style={{ minHeight: 1003 }}>   {/* 1123 - 60top - 60bottom footer area */}
        {children}
      </div>

      {/* Footer: LaTeX-style centered page number */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 12,
          color: "#555",
          fontFamily: "var(--sans)",
          letterSpacing: "0.03em",
        }}
      >
        {pageNumber}
      </div>
    </div>
  );
}