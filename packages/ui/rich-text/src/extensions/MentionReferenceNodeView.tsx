import type { JSX } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export function MentionReferenceNodeView({
  node,
  selected
}: NodeViewProps): JSX.Element {
  const label =
    typeof node.attrs.label === "string" ? node.attrs.label.trim() : "";

  return (
    <NodeViewWrapper
      as="span"
      className={`inline-flex max-w-full align-baseline ${
        selected ? "is-selected" : ""
      }`}
      contentEditable={false}
      data-rich-text-mention-reference="true"
    >
      <span
        className={`inline-flex max-w-full items-center overflow-hidden rounded-md px-1.5 py-0.5 text-[13px] font-medium ${
          selected
            ? "bg-[var(--background-fronted)] text-[var(--text-primary)] shadow-soft"
            : "bg-transparency-block text-[var(--text-primary)]"
        }`}
      >
        @{label}
      </span>
    </NodeViewWrapper>
  );
}
