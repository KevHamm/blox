import { Fragment } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Chunk } from "../utils/paginateDocument";
import { isContainerType } from "../utils/paginateDocument";
import { DropZone } from "./shared";
import { Paragraph } from "./Paragraph";
import { AbstractBlock } from "./AbstractBlock";
import { MathBlock } from "./MathBlock";
import { FigureBlock } from "./FigureBlock";
import { TableBlock } from "./TableBlock";
import { Subsection, Subsubsection, Section } from "./SectionBlocks";
import { PageBlock } from "./PageBlock";
import { ListBlock } from "./ListBlock";
import { FrameBlock } from "./FrameBlock";

// Re-exported so existing importers (App.tsx) keep working.
export { HeadingInput } from "./shared";

/* -----------------------------
   RECURSIVE CHUNK RENDERING
----------------------------- */
// The drop zones + child elements inside a container chunk.
function containerInner(chunk: Chunk, props: any) {
  const node = chunk.node;
  const fullChildren = node.children ?? [];

  // Only show the trailing "append to this container" zone when the block
  // actually rendered last in this chunk is a leaf. If it's another container,
  // that container already renders its own end zone at this spot, so an outer
  // one would just stack up dead/redundant slots beneath the trailing
  // "+ …" buttons (e.g. a section-level zone under "+ Subsubsection").
  const lastRendered = chunk.children[chunk.children.length - 1];
  const showEndZone =
    chunk.isLast && (!lastRendered || !isContainerType(lastRendered.node.type));

  return (
    <>
      {chunk.children.map((ch) => {
        const absIndex = fullChildren.findIndex((c: any) => c.id === ch.node.id);
        const prev = fullChildren[absIndex - 1];
        // LaTeX: a paragraph is unindented when it's the first block or follows
        // a heading (so a section's body text stays flush even after a
        // subsection is dropped in front of it).
        const noIndent = absIndex === 0 || (prev && isContainerType(prev.type));
        // A section may be dropped only next to a heading (sub/subsubsection).
        const headingAdjacent =
          isContainerType(ch.node.type) || (prev && isContainerType(prev.type));
        return (
          <Fragment key={ch.node.id}>
            <DropZone
              id={`dz::${node.id}::${absIndex}`}
              containerType={node.type}
              headingAdjacent={headingAdjacent}
            />
            {renderChunk(ch, props, noIndent)}
          </Fragment>
        );
      })}
      {showEndZone && (
        <DropZone
          id={`dz::${node.id}::${fullChildren.length}`}
          containerType={node.type}
          headingAdjacent={
            fullChildren.length > 0 &&
            isContainerType(fullChildren[fullChildren.length - 1].type)
          }
        />
      )}
    </>
  );
}

function renderChunk(chunk: Chunk, props: any, firstChild = false): any {
  const node = chunk.node;

  if (node.type === "frame") {
    return (
      <FrameBlock node={node} {...props}>
        {containerInner(chunk, props)}
      </FrameBlock>
    );
  }

  if (node.type === "paragraph") {
    // A split paragraph renders as several slice pieces; only the whole-node
    // form carries data-leaf-id (split heights come from line geometry instead).
    const sliceProps = chunk.slice
      ? { sliceStart: chunk.slice.start, sliceEnd: chunk.slice.end }
      : {};
    // Block-style (letter) paragraphs are separated by vertical space instead of
    // an indent. The gap lives on the wrapper. It leads every paragraph except
    // the first; a split continuation (slice starting mid-paragraph) gets none.
    const atParaStart = !chunk.slice || chunk.slice.start === 0;
    const blockGap =
      props.blockParagraphs && !firstChild && atParaStart ? (props.fontSize ?? 13) * 0.9 : 0;
    return (
      <div {...(chunk.slice ? {} : { "data-leaf-id": node.id })} style={blockGap ? { paddingTop: blockGap } : undefined}>
        <Paragraph node={node} {...props} firstChild={firstChild} {...sliceProps} />
      </div>
    );
  }
  if (node.type === "abstract") {
    return <AbstractBlock node={node} {...props} />;
  }
  if (node.type === "list") {
    return <ListBlock node={node} {...props} />;
  }
  if (node.type === "table") {
    return (
      <div data-leaf-id={node.id}>
        <TableBlock node={node} {...props} />
      </div>
    );
  }
  if (node.type === "math") {
    return (
      <div data-leaf-id={node.id}>
        <MathBlock node={node} {...props} equationNumber={props.equationNumbers?.[node.id]} />
      </div>
    );
  }
  if (node.type === "coverpage" || node.type === "toc" || node.type === "bibliography") {
    return (
      <div data-leaf-id={node.id}>
        <PageBlock node={node} {...props} />
      </div>
    );
  }
  if (node.type === "figure") {
    return (
      <div data-leaf-id={node.id}>
        <FigureBlock
          node={node}
          updateFigureCaption={props.updateFigureCaption}
          updateFigureWidth={props.updateFigureWidth}
          deleteFigureImage={props.deleteFigureImage}
          figureNumber={props.figureNumbers?.[node.id]}
        />
      </div>
    );
  }
  if (node.type === "subsection") {
    return (
      <Subsection node={node} showHeader={chunk.header} isLast={chunk.isLast} {...props}>
        {containerInner(chunk, props)}
      </Subsection>
    );
  }
  if (node.type === "subsubsection") {
    return (
      <Subsubsection node={node} showHeader={chunk.header} isLast={chunk.isLast} {...props}>
        {containerInner(chunk, props)}
      </Subsubsection>
    );
  }
  // section
  return (
    <Section node={node} showHeader={chunk.header} isLast={chunk.isLast} {...props}>
      {containerInner(chunk, props)}
    </Section>
  );
}

/* -----------------------------
   DOCUMENT ROOT (renders one column)
----------------------------- */
export function DocumentRenderer(props: any) {
  const { setNodeRef } = useDroppable({ id: props.droppableId ?? "document-root" });
  const column = props.column as Chunk[];

  return (
    <div ref={setNodeRef}>
      {column.map((chunk, i) => (
        <Fragment key={`${chunk.node.id}-${i}`}>
          {renderChunk(chunk, props, i === 0)}
        </Fragment>
      ))}
    </div>
  );
}
