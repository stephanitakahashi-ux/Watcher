import type { FigmaNode, SelectableScreen } from './types'

/**
 * Top-level artboard frames only: direct children of a page surface (CANVAS / SECTION)
 * that are not nested inside another frame. Skips inner layout frames, component
 * instances as roots (they are not FRAME type), and other node types.
 */
function walk(
  node: FigmaNode,
  parent: FigmaNode | null,
  depthInsideFrame: number,
  out: SelectableScreen[],
): void {
  const parentType = parent?.type ?? ''

  if (node.type === 'FRAME') {
    const onPageSurface = parentType === 'CANVAS' || parentType === 'SECTION'
    if (depthInsideFrame === 0 && onPageSurface) {
      out.push({ id: node.id, name: node.name, type: node.type })
    }
    if (node.children) {
      const nextDepth = depthInsideFrame + 1
      for (const c of node.children) walk(c, node, nextDepth, out)
    }
    return
  }

  if (node.children) {
    for (const c of node.children) walk(c, node, depthInsideFrame, out)
  }
}

export function collectSelectableScreens(document: FigmaNode): SelectableScreen[] {
  const out: SelectableScreen[] = []
  walk(document, null, 0, out)
  return out
}
