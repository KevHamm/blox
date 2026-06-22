import { docFontCss } from "../../utils/fonts";
import type { DesignElement, DesignPage } from "../../types/design";

// A faithful, read-only render of a design page that scales to its container
// (text sized in cqw; the sheet is a `container-type: inline-size` box). Used
// for both the workspace thumbnail and the full-size template viewer.
export function DesignPreview({ design }: { design: DesignPage }) {
  const { pageWidth: W, pageHeight: H, elements } = design;
  const pc = (v: number, total: number) => `${(v / total) * 100}%`;
  return (
    <span className="mini-design">
      {elements.map((el) => <Element key={el.id} el={el} W={W} H={H} pc={pc} />)}
    </span>
  );
}

function Element({ el, W, H, pc }: { el: DesignElement; W: number; H: number; pc: (v: number, t: number) => string }) {
  const box = { position: "absolute" as const, left: pc(el.x, W), top: pc(el.y, H), width: pc(el.w, W) };
  if (el.kind === "text") {
    return (
      <span style={{
        ...box, height: pc(el.h, H),
        fontFamily: docFontCss(el.fontFamily ?? "cm"),
        fontSize: `${(el.fontSize ?? 24) / W * 100}cqw`,
        fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? "italic" : "normal",
        textDecoration: el.underline ? "underline" : "none",
        color: el.color ?? "#111111",
        textAlign: (el.align ?? "left"),
        lineHeight: 1.18, whiteSpace: "pre-wrap", overflow: "hidden", display: "block"
      }}>{el.text}</span>
    );
  }
  if (el.kind === "image" && el.src) {
    return <img src={el.src} alt="" style={{ ...box, height: pc(el.h, H), objectFit: "contain", transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, transformOrigin: "center" }} />;
  }
  if (el.kind === "rect") {
    return <span style={{
      ...box, height: pc(el.h, H), display: "block",
      background: el.fill ?? "transparent",
      border: (el.strokeWidth ?? 0) > 0 ? `${(el.strokeWidth ?? 0) / W * 100}cqw solid ${el.stroke ?? "#111"}` : "none",
      boxSizing: "border-box"
    }} />;
  }
  return <span style={{
    ...box, height: `${Math.max((el.strokeWidth ?? 2) / H * 100, 0.4)}%`,
    background: el.stroke ?? "#111", display: "block", minHeight: "1px"
  }} />;
}
