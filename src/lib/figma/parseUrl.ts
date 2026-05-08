/** Normalize Figma URL node-id query param to API format (1:2). */
export function normalizeNodeId(nodeId: string | null): string | null {
  if (!nodeId) return null
  return decodeURIComponent(nodeId).replace(/-/g, ':')
}

export type ParsedFigmaDesignUrl = {
  fileKey: string
  /** When opening a branch, API uses branch file key */
  apiFileKey: string
  nodeId: string | null
}

/**
 * Supports:
 * - figma.com/design/:fileKey/...
 * - figma.com/design/:fileKey/branch/:branchKey/...
 */
export function parseFigmaDesignUrl(input: string): ParsedFigmaDesignUrl | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '')
  if (!host.endsWith('figma.com')) return null

  const parts = url.pathname.split('/').filter(Boolean)
  const designIdx = parts.indexOf('design')
  if (designIdx === -1 || !parts[designIdx + 1]) return null

  const fileKey = parts[designIdx + 1]
  let apiFileKey = fileKey
  let nodeId: string | null = null

  if (parts[designIdx + 2] === 'branch' && parts[designIdx + 3]) {
    apiFileKey = parts[designIdx + 3]
  }

  const raw = url.searchParams.get('node-id')
  nodeId = normalizeNodeId(raw)

  return { fileKey, apiFileKey, nodeId }
}

const PAIR_SEP = '|||'

/** Figma node ids contain ":" — use an unambiguous separator */
export function pairKey(refNodeId: string, compareNodeId: string): string {
  return `${encodeURIComponent(refNodeId)}${PAIR_SEP}${encodeURIComponent(compareNodeId)}`
}

export function parsePairKey(key: string): { refNodeId: string; compareNodeId: string } {
  const idx = key.indexOf(PAIR_SEP)
  if (idx === -1) return { refNodeId: key, compareNodeId: '' }
  return {
    refNodeId: decodeURIComponent(key.slice(0, idx)),
    compareNodeId: decodeURIComponent(key.slice(idx + PAIR_SEP.length)),
  }
}
