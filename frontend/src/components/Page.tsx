export function Page({ children }: { children: any }) {
  return (
    <div
      style={{
        width: 816,
        height: 1056,
        textAlign: "left",
        color: "#000",
        fontFamily: "var(--sans)",
        overflow: "hidden",
        background: "white",
        marginBottom: 24,
        padding: "72px 72px 96px",
        boxSizing: "border-box",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)"
      }}
    >
      {children}
    </div>


  );
}
