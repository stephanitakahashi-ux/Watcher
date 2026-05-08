import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { normalizeScreenType } from '../lib/screenTypeAxis'
import type { ScreenTypeOption } from '../lib/screenTypeAxis'
import { buildPairedQueue } from '../lib/pairScreens'
import type { ScreenPair } from '../lib/pairScreens'
import { pairKey, parsePairKey } from '../lib/figma/parseUrl'

const TOKEN_KEY = 'figma-token-session'

export function getStoredToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setStoredToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

/** Normalized 0–1 rect relative to natural image size */
export type AnnotationRect = {
  x: number
  y: number
  width: number
  height: number
}

export type GapAnnotation = {
  id: string
  label: string
  rect: AnnotationRect
  addressed: boolean
  compliantToNuds: boolean
  note: string
  tags: string[]
}

export type ScreenRef = {
  nodeId: string
  name: string
}

export type ComparisonSession = {
  id: string
  createdAt: number
  title: string
  /** Dashboard X-axis bucket; one of SCREEN_TYPE_OPTIONS */
  screenType: ScreenTypeOption
  referenceFileKey: string
  referenceFileName: string
  compareFileKey: string
  compareFileName: string
  referenceScreens: ScreenRef[]
  compareScreens: ScreenRef[]
  /** Auto-matched pairs by screen name — walk order for Step 2 */
  pairedQueue: ScreenPair[]
  /** gaps per ref:compare pair */
  annotationsByPair: Record<string, GapAnnotation[]>
}

type State = {
  token: string
  setToken: (t: string) => void
  sessions: ComparisonSession[]
  activeSessionId: string | null
  /** Step 2: which pair is being edited */
  activeRefNodeId: string | null
  activeCompareNodeId: string | null
  draftReferenceUrl: string
  draftCompareUrl: string
  setDraftReferenceUrl: (u: string) => void
  setDraftCompareUrl: (u: string) => void
  createSession: (payload: Omit<ComparisonSession, 'id' | 'createdAt' | 'annotationsByPair'>) => string
  setActiveSession: (id: string | null) => void
  updateSession: (id: string, patch: Partial<ComparisonSession>) => void
  deleteSession: (id: string) => void
  setActivePair: (refNodeId: string | null, compareNodeId: string | null) => void
  setAnnotationsForPair: (
    sessionId: string,
    refNodeId: string,
    compareNodeId: string,
    annotations: GapAnnotation[],
  ) => void
  updateGap: (
    sessionId: string,
    pair: string,
    gapId: string,
    patch: Partial<Pick<GapAnnotation, 'label' | 'addressed' | 'compliantToNuds' | 'note' | 'tags'>>,
  ) => void
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const PERSIST_KEY = 'screen-comparison-sessions'

function normalizeGap(raw: unknown): GapAnnotation {
  const g = raw as Partial<GapAnnotation>
  const r = g.rect
  const rect: AnnotationRect =
    r &&
    typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    typeof r.width === 'number' &&
    typeof r.height === 'number'
      ? r
      : { x: 0, y: 0, width: 0, height: 0 }
  return {
    id: typeof g.id === 'string' ? g.id : newId(),
    label: typeof g.label === 'string' ? g.label : 'Gap',
    rect,
    addressed: Boolean(g.addressed),
    compliantToNuds: Boolean(g.compliantToNuds),
    note: typeof g.note === 'string' ? g.note : '',
    tags: Array.isArray(g.tags) ? g.tags.filter((t): t is string => typeof t === 'string') : [],
  }
}

function normalizeSession(s: ComparisonSession): ComparisonSession {
  const annotationsByPair: Record<string, GapAnnotation[]> = {}
  for (const [k, list] of Object.entries(s.annotationsByPair ?? {})) {
    annotationsByPair[k] = (list ?? []).map((g) => normalizeGap(g))
  }
  const referenceScreens = Array.isArray(s.referenceScreens) ? s.referenceScreens : []
  const compareScreens = Array.isArray(s.compareScreens) ? s.compareScreens : []
  const pairedQueue =
    Array.isArray(s.pairedQueue) && s.pairedQueue.length > 0
      ? s.pairedQueue
      : buildPairedQueue(referenceScreens, compareScreens)
  return {
    ...s,
    screenType: normalizeScreenType((s as ComparisonSession).screenType),
    referenceScreens,
    compareScreens,
    pairedQueue,
    annotationsByPair,
  }
}

/** Avoid a blank page if localStorage JSON is corrupt or from an old shape */
const safeSessionStorage = createJSONStorage(() => ({
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name)
      if (!raw) return null
      JSON.parse(raw)
      return raw
    } catch {
      try {
        localStorage.removeItem(name)
      } catch {
        /* ignore */
      }
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      /* quota / private mode */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}))

export const useComparisonsStore = create<State>()(
  persist(
    (set) => ({
      token: typeof sessionStorage !== 'undefined' ? getStoredToken() : '',
      setToken: (t) => {
        setStoredToken(t)
        set({ token: t })
      },
      sessions: [],
      activeSessionId: null,
      activeRefNodeId: null,
      activeCompareNodeId: null,
      draftReferenceUrl: '',
      draftCompareUrl: '',
      setDraftReferenceUrl: (u) => set({ draftReferenceUrl: u }),
      setDraftCompareUrl: (u) => set({ draftCompareUrl: u }),

      createSession: (payload) => {
        const id = newId()
        const session: ComparisonSession = {
          ...payload,
          id,
          createdAt: Date.now(),
          annotationsByPair: {},
        }
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
          activeRefNodeId:
            payload.pairedQueue[0]?.refNodeId ?? payload.referenceScreens[0]?.nodeId ?? null,
          activeCompareNodeId:
            payload.pairedQueue[0]?.compareNodeId ?? payload.compareScreens[0]?.nodeId ?? null,
        }))
        return id
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

      updateSession: (id, patch) =>
        set((s) => ({
          sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),

      deleteSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter((x) => x.id !== id),
          activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        })),

      setActivePair: (refNodeId, compareNodeId) =>
        set({ activeRefNodeId: refNodeId, activeCompareNodeId: compareNodeId }),

      setAnnotationsForPair: (sessionId, refNodeId, compareNodeId, annotations) => {
        const key = pairKey(refNodeId, compareNodeId)
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId
              ? { ...x, annotationsByPair: { ...x.annotationsByPair, [key]: annotations } }
              : x,
          ),
        }))
      },

      updateGap: (sessionId, pair, gapId, patch) =>
        set((s) => ({
          sessions: s.sessions.map((x) => {
            if (x.id !== sessionId) return x
            const list = x.annotationsByPair[pair] ?? []
            return {
              ...x,
              annotationsByPair: {
                ...x.annotationsByPair,
                [pair]: list.map((g) => (g.id === gapId ? { ...g, ...patch } : g)),
              },
            }
          }),
        })),
    }),
    {
      name: PERSIST_KEY,
      storage: safeSessionStorage,
      partialize: (s) => ({
        sessions: s.sessions,
        draftReferenceUrl: s.draftReferenceUrl,
        draftCompareUrl: s.draftCompareUrl,
      }),
      merge: (persisted, current) => {
        const p = persisted as {
          sessions?: ComparisonSession[]
          draftReferenceUrl?: string
          draftCompareUrl?: string
        } | null
        const sessions = Array.isArray(p?.sessions)
          ? p.sessions.map((x) => normalizeSession(x))
          : current.sessions
        return {
          ...current,
          sessions,
          draftReferenceUrl: typeof p?.draftReferenceUrl === 'string' ? p.draftReferenceUrl : current.draftReferenceUrl,
          draftCompareUrl: typeof p?.draftCompareUrl === 'string' ? p.draftCompareUrl : current.draftCompareUrl,
        }
      },
    },
  ),
)

export function getPairAnnotations(
  session: ComparisonSession | undefined,
  refNodeId: string,
  compareNodeId: string,
): GapAnnotation[] {
  if (!session) return []
  return session.annotationsByPair[pairKey(refNodeId, compareNodeId)] ?? []
}

export function sessionCoverage(session: ComparisonSession): {
  totalGaps: number
  addressed: number
  percent: number | null
} {
  let total = 0
  let done = 0
  for (const list of Object.values(session.annotationsByPair)) {
    for (const g of list) {
      total += 1
      if (g.addressed) done += 1
    }
  }
  if (total === 0) return { totalGaps: 0, addressed: 0, percent: null }
  return { totalGaps: total, addressed: done, percent: Math.round((done / total) * 1000) / 10 }
}

export function exportSessionToCsv(session: ComparisonSession): string {
  const rows: string[][] = [
    [
      'screen_type',
      'pair',
      'reference_screen',
      'compare_screen',
      'gap_id',
      'label',
      'addressed',
      'compliant_to_nuds',
      'note',
      'tags',
      'rect_x',
      'rect_y',
      'rect_w',
      'rect_h',
    ],
  ]
  const refById = Object.fromEntries(session.referenceScreens.map((s) => [s.nodeId, s.name]))
  const cmpById = Object.fromEntries(session.compareScreens.map((s) => [s.nodeId, s.name]))

  for (const [pk, list] of Object.entries(session.annotationsByPair)) {
    const { refNodeId: rid, compareNodeId: cid } = parsePairKey(pk)
    const rname = refById[rid] ?? rid
    const cname = cmpById[cid] ?? cid
    for (const g of list) {
      rows.push([
        session.screenType,
        pk,
        rname,
        cname,
        g.id,
        g.label,
        g.addressed ? 'yes' : 'no',
        g.compliantToNuds ? 'yes' : 'no',
        (g.note ?? '').replace(/\r?\n/g, ' '),
        (g.tags ?? []).join(';'),
        String(g.rect.x),
        String(g.rect.y),
        String(g.rect.width),
        String(g.rect.height),
      ])
    }
  }

  return rows
    .map((r) =>
      r
        .map((cell) => {
          const q = String(cell).replace(/"/g, '""')
          return `"${q}"`
        })
        .join(','),
    )
    .join('\n')
}
