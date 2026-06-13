import { Fragment, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { TrashIcon } from "../components/TrashIcon";
import { confirmDialog } from "../components/ConfirmDialog";
import { FigureDropZone, clampFrac, CaptionField } from "./shared";

/* -----------------------------
   FIGURE — a container of one or more equally-sized images that share a
   single caption. A single image is centered; resizing controls how wide each
   image is (and therefore whether another image can fit beside it).
----------------------------- */
function DocImage({ figureId, image, deleteFigureImage }: any) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `docimg::${figureId}::${image.id}`
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        flex: 1,
        minWidth: 0,
        position: "relative",
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1
      }}
    >
      {/* per-image trash; stops the pointer from starting a drag */}
      <button
        onClick={() => {
          confirmDialog({ title: "Delete image?", message: "This image will be removed from the figure.", confirmLabel: "Delete", danger: true })
            .then((ok) => { if (ok) deleteFigureImage(figureId, image.id); });
        }}
        onPointerDown={(e) => e.stopPropagation()}
        title="Delete image"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          display: "inline-flex",
          padding: 3,
          background: "rgba(0,0,0,0.6)",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          zIndex: 2
        }}
      >
        <TrashIcon size={14} />
      </button>

      <img
        src={image.src}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "auto", display: "block", pointerEvents: "none" }}
      />
    </div>
  );
}

export function FigureBlock({
  node,
  updateFigureCaption,
  updateFigureWidth,
  deleteFigureImage,
  figureNumber
}: any) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const images: any[] = node.images ?? [];
  const width: number = node.width ?? 1;          // remembered per-image width
  const n = images.length || 1;
  // Cap the visible size so n images always fit; the stored width is preserved
  // so removing images restores the previous (wider) size.
  const perImage = Math.min(width, 1 / n);
  const containerFrac = n * perImage;

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const colW = wrapperRef.current?.offsetWidth || 1;
    const startX = e.clientX;
    const startW = perImage;   // start from the currently visible size

    function onMove(ev: MouseEvent) {
      const dw = (ev.clientX - startX) / (colW * n);
      updateFigureWidth(node.id, clampFrac(startW + dw, 0.1, 1));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div ref={wrapperRef} style={{ margin: "12px 0" }}>
      <div
        style={{
          width: `${containerFrac * 100}%`,
          margin: "0 auto",
          border: "1px solid #ccc",
          background: "white",
          padding: 8,
          position: "relative",
          boxSizing: "border-box"
        }}
      >
        {/* images, with a drop slot to the left/right of each one */}
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <FigureDropZone id={`figdz::${node.id}::0`} />
          {images.map((im, i) => (
            <Fragment key={im.id}>
              <DocImage
                figureId={node.id}
                image={im}
                deleteFigureImage={deleteFigureImage}
              />
              <FigureDropZone id={`figdz::${node.id}::${i + 1}`} />
            </Fragment>
          ))}
        </div>

        {/* drag the right edge to resize every image in the container */}
        <div
          onMouseDown={startResize}
          title="Resize"
          style={{
            position: "absolute",
            top: 0,
            right: -4,
            width: 8,
            height: "100%",
            cursor: "col-resize",
            zIndex: 2
          }}
        />

        <CaptionField
          tag={`Figure ${figureNumber}:`}
          value={node.caption || ""}
          onChange={(v) => updateFigureCaption(node.id, v)}
        />
      </div>
    </div>
  );
}
