export type ScreenPair = { refNodeId: string; compareNodeId: string }

type NamedNode = { nodeId: string; name: string }

/** Normalize frame names for matching (trim, case, spaces, trailing "copy") */
export function normalizeScreenName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*copy\s*$/i, '')
    .replace(/\s+copy\s*$/i, '')
}

/**
 * Greedy match: each reference screen pairs with one compare screen of the same
 * normalized name (first unused compare wins). Order: reference names sorted A→Z.
 */
export function buildPairedQueue(referenceScreens: NamedNode[], compareScreens: NamedNode[]): ScreenPair[] {
  const cmpByNorm = new Map<string, NamedNode[]>()
  for (const c of compareScreens) {
    const k = normalizeScreenName(c.name)
    const list = cmpByNorm.get(k) ?? []
    list.push(c)
    cmpByNorm.set(k, list)
  }
  const usedCompare = new Set<string>()
  const pairs: ScreenPair[] = []
  const sortedRef = [...referenceScreens].sort((a, b) => a.name.localeCompare(b.name))
  for (const r of sortedRef) {
    const k = normalizeScreenName(r.name)
    const candidates = cmpByNorm.get(k)
    if (!candidates?.length) continue
    const c = candidates.find((x) => !usedCompare.has(x.nodeId))
    if (!c) continue
    usedCompare.add(c.nodeId)
    pairs.push({ refNodeId: r.nodeId, compareNodeId: c.nodeId })
  }
  return pairs
}
