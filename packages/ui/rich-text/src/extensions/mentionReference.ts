import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { mentionReferenceNodeName } from "./names.ts";
import { MentionReferenceNodeView } from "./MentionReferenceNodeView.tsx";

export interface MentionReferenceAttrs {
  entityId: string;
  href?: string;
  kind?: string;
  label: string;
  meta?: Readonly<Record<string, string>>;
  plugin: string;
  trigger: "@";
  version?: string;
}

export const MentionReference = Node.create({
  name: mentionReferenceNodeName,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      entityId: {
        default: ""
      },
      href: {
        default: null
      },
      kind: {
        default: null
      },
      label: {
        default: ""
      },
      meta: {
        default: null
      },
      plugin: {
        default: ""
      },
      trigger: {
        default: "@"
      },
      version: {
        default: null
      }
    };
  },

  parseHTML() {
    return [{ tag: "span[data-rich-text-mention-reference]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const label =
      typeof HTMLAttributes.label === "string" ? HTMLAttributes.label : "";

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-rich-text-mention-reference": "true",
        class:
          "inline-flex max-w-full items-center overflow-hidden rounded-md bg-transparency-block px-1.5 py-0.5 align-baseline text-[13px] font-medium text-[var(--text-primary)]"
      }),
      `@${label}`
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionReferenceNodeView);
  }
});
