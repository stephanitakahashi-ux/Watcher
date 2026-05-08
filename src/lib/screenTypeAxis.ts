import { parsePairKey } from './figma/parseUrl'
import type { ComparisonSession, GapAnnotation } from '../store/comparisonsStore'

export const SCREEN_TYPE_OPTIONS = [
  'Offer Hub MDR',
  'Simulation',
  'Conditions',
  'Simulation + payment date',
  'Summary',
  'T&C',
  'Feedback',
] as const

export type ScreenTypeOption = (typeof SCREEN_TYPE_OPTIONS)[number]

export const DEFAULT_SCREEN_TYPE: ScreenTypeOption = SCREEN_TYPE_OPTIONS[0]

export function isValidScreenType(v: string): v is ScreenTypeOption {
  return (SCREEN_TYPE_OPTIONS as readonly string[]).includes(v)
}

export function normalizeScreenType(v: unknown): ScreenTypeOption {
  if (typeof v === 'string' && isValidScreenType(v)) return v
  return DEFAULT_SCREEN_TYPE
}

export type PooledBucket = {
  screenType: ScreenTypeOption
  totalGaps: number
  addressed: number
  /** null when there are no gaps in this bucket */
  percent: number | null
}

export function pooledCoverageByScreenType(sessions: ComparisonSession[]): PooledBucket[] {
  return SCREEN_TYPE_OPTIONS.map((screenType) => {
    let total = 0
    let addressed = 0
    for (const s of sessions) {
      if (s.screenType !== screenType) continue
      for (const list of Object.values(s.annotationsByPair)) {
        for (const g of list) {
          total += 1
          if (g.addressed) addressed += 1
        }
      }
    }
    const percent = total === 0 ? null : Math.round((addressed / total) * 1000) / 10
    return { screenType, totalGaps: total, addressed, percent }
  })
}

export type GapListRow = {
  sessionId: string
  sessionTitle: string
  pairKey: string
  refName: string
  cmpName: string
  gap: GapAnnotation
}

function pairScreenNames(session: ComparisonSession, pairKey: string): { ref: string; cmp: string } {
  const { refNodeId, compareNodeId } = parsePairKey(pairKey)
  const refById = Object.fromEntries(session.referenceScreens.map((s) => [s.nodeId, s.name]))
  const cmpById = Object.fromEntries(session.compareScreens.map((s) => [s.nodeId, s.name]))
  return {
    ref: refById[refNodeId] ?? refNodeId,
    cmp: cmpById[compareNodeId] ?? compareNodeId,
  }
}

export function gapsForScreenType(
  sessions: ComparisonSession[],
  screenType: ScreenTypeOption,
): GapListRow[] {
  const rows: GapListRow[] = []
  for (const s of sessions) {
    if (s.screenType !== screenType) continue
    for (const [pairKey, list] of Object.entries(s.annotationsByPair)) {
      const { ref, cmp } = pairScreenNames(s, pairKey)
      for (const gap of list) {
        rows.push({
          sessionId: s.id,
          sessionTitle: s.title,
          pairKey,
          refName: ref,
          cmpName: cmp,
          gap,
        })
      }
    }
  }
  return rows
}
