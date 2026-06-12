// macOS Finder icon view uses 64pt icons; render at ~80% (52px) of that baseline.
const workspaceFileManagerIconGridIconSizePx = 52;
const workspaceFileManagerIconGridTileMinWidthPx = 108;
const workspaceFileManagerIconGridTileMaxWidthPx = 120;

export const workspaceFileManagerIconGridLayout = {
  iconSizePx: workspaceFileManagerIconGridIconSizePx,
  tileMaxWidthPx: workspaceFileManagerIconGridTileMaxWidthPx,
  tileMinWidthPx: workspaceFileManagerIconGridTileMinWidthPx
} as const;

export function workspaceFileManagerIconGridIconClassName(): string {
  return "size-[52px]";
}

export function workspaceFileManagerIconGridFrameClassName(): string {
  return "size-[60px]";
}
