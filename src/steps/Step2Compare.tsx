import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImageAnnotator } from '../components/ImageAnnotator'
import { FigmaApiError, getImages } from '../lib/figma/client'
import { pairKey } from '../lib/figma/parseUrl'
import type { ComparisonSession } from '../store/comparisonsStore'
import {
  getPairAnnotations,
  useComparisonsStore,
  type GapAnnotation,
} from '../store/comparisonsStore'

type CachedPair = { ref: string; cmp: string }

function findQueueIndex(
  session: ComparisonSession,
  refId: string | null,
  cmpId: string | null,
): number {
  if (!refId || !cmpId) return -1
  return session.pairedQueue.findIndex((p) => p.refNodeId === refId && p.compareNodeId === cmpId)
}

export function Step2Compare() {
  const token = useComparisonsStore((s) => s.token)
  const sessions = useComparisonsStore((s) => s.sessions)
  const activeSessionId = useComparisonsStore((s) => s.activeSessionId)
  const activeRefNodeId = useComparisonsStore((s) => s.activeRefNodeId)
  const activeCompareNodeId = useComparisonsStore((s) => s.activeCompareNodeId)
  const setActivePair = useComparisonsStore((s) => s.setActivePair)
  const setAnnotationsForPair = useComparisonsStore((s) => s.setAnnotationsForPair)

  const session = sessions.find((x) => x.id === activeSessionId)
  const cacheRef = useRef<Record<string, CachedPair>>({})

  const [refUrl, setRefUrl] = useState<string | null>(null)
  const [cmpUrl, setCmpUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const queueIndex = useMemo(() => {
    if (!session) return -1
    return findQueueIndex(session, activeRefNodeId, activeCompareNodeId)
  }, [session, activeRefNodeId, activeCompareNodeId])

  const annotations: GapAnnotation[] =
    session && activeRefNodeId && activeCompareNodeId
      ? getPairAnnotations(session, activeRefNodeId, activeCompareNodeId)
      : []

  const onAnnotationsChange = useCallback(
    (next: GapAnnotation[]) => {
      if (!session || !activeRefNodeId || !activeCompareNodeId) return
      setAnnotationsForPair(session.id, activeRefNodeId, activeCompareNodeId, next)
    },
    [session, activeRefNodeId, activeCompareNodeId, setAnnotationsForPair],
  )

  useEffect(() => {
    cacheRef.current = {}
  }, [session?.id])

  const loadPairIntoState = useCallback(
    async (refId: string, cmpId: string) => {
      if (!session || !token.trim()) return
      const key = pairKey(refId, cmpId)
      const hit = cacheRef.current[key]
      if (hit?.ref && hit?.cmp) {
        setRefUrl(hit.ref)
        setCmpUrl(hit.cmp)
        setLoadError(null)
        return
      }
      setLoading(true)
      setLoadError(null)
      try {
        const [refImg, cmpImg] = await Promise.all([
          getImages(session.referenceFileKey, [refId], token.trim()),
          getImages(session.compareFileKey, [cmpId], token.trim()),
        ])
        const r = refImg.images[refId]
        const c = cmpImg.images[cmpId]
        if (refImg.err || cmpImg.err) {
          setLoadError(refImg.err || cmpImg.err || 'Image export error')
        }
        if (!r || !c) {
          setLoadError((e) => e ?? 'Figma returned no image URL for this node.')
        }
        if (r && c) {
          cacheRef.current[key] = { ref: r, cmp: c }
          setRefUrl(r)
          setCmpUrl(c)
        } else {
          setRefUrl(null)
          setCmpUrl(null)
        }
      } catch (e) {
        setLoadError(e instanceof FigmaApiError ? e.message : String(e))
        setRefUrl(null)
        setCmpUrl(null)
      } finally {
        setLoading(false)
      }
    },
    [session, token],
  )

  useEffect(() => {
    async function run() {
      if (!session || !activeRefNodeId || !activeCompareNodeId || !token.trim()) {
        setRefUrl(null)
        setCmpUrl(null)
        return
      }
      const key = pairKey(activeRefNodeId, activeCompareNodeId)
      const hit = cacheRef.current[key]
      if (hit?.ref && hit?.cmp) {
        setRefUrl(hit.ref)
        setCmpUrl(hit.cmp)
        setLoadError(null)
        setLoading(false)
        return
      }
      await loadPairIntoState(activeRefNodeId, activeCompareNodeId)
    }
    void run()
  }, [session, activeRefNodeId, activeCompareNodeId, token, loadPairIntoState])

  useEffect(() => {
    if (!session || !token.trim()) return
    const idx = findQueueIndex(session, activeRefNodeId, activeCompareNodeId)
    const nextPair =
      idx >= 0 && idx < session.pairedQueue.length - 1 ? session.pairedQueue[idx + 1] : null
    if (!nextPair) return

    const nk = pairKey(nextPair.refNodeId, nextPair.compareNodeId)
    if (cacheRef.current[nk]?.ref && cacheRef.current[nk]?.cmp) return

    let cancelled = false
    void (async () => {
      try {
        const [refImg, cmpImg] = await Promise.all([
          getImages(session.referenceFileKey, [nextPair.refNodeId], token.trim()),
          getImages(session.compareFileKey, [nextPair.compareNodeId], token.trim()),
        ])
        if (cancelled) return
        const r = refImg.images[nextPair.refNodeId]
        const c = cmpImg.images[nextPair.compareNodeId]
        if (r && c && !refImg.err && !cmpImg.err) {
          cacheRef.current[nk] = { ref: r, cmp: c }
        }
      } catch {
        /* prefetch is best-effort */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, activeRefNodeId, activeCompareNodeId, token])

  const goNext = useCallback(() => {
    if (!session?.pairedQueue.length) return
    const i = findQueueIndex(session, activeRefNodeId, activeCompareNodeId)
    if (i === -1) {
      const p = session.pairedQueue[0]
      setActivePair(p.refNodeId, p.compareNodeId)
      return
    }
    if (i < session.pairedQueue.length - 1) {
      const p = session.pairedQueue[i + 1]
      setActivePair(p.refNodeId, p.compareNodeId)
    }
  }, [session, activeRefNodeId, activeCompareNodeId, setActivePair])

  const goPrev = useCallback(() => {
    if (!session?.pairedQueue.length) return
    const i = findQueueIndex(session, activeRefNodeId, activeCompareNodeId)
    if (i === -1) {
      const p = session.pairedQueue[session.pairedQueue.length - 1]
      setActivePair(p.refNodeId, p.compareNodeId)
      return
    }
    if (i > 0) {
      const p = session.pairedQueue[i - 1]
      setActivePair(p.refNodeId, p.compareNodeId)
    }
  }, [session, activeRefNodeId, activeCompareNodeId, setActivePair])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return
      }
      if (e.key === 'ArrowRight' || (e.key === 'n' && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault()
        goNext()
      }
      if (e.key === 'ArrowLeft' || (e.key === 'p' && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  if (!session) {
    return (
      <div className="step-page">
        <h1>Step 2 · Side-by-side compare</h1>
        <p className="lead">Create a session first.</p>
        <Link to="/">Go to step 1</Link>
      </div>
    )
  }

  const refName =
    session.referenceScreens.find((s) => s.nodeId === activeRefNodeId)?.name ?? 'Reference'
  const cmpName =
    session.compareScreens.find((s) => s.nodeId === activeCompareNodeId)?.name ?? 'Compare'

  const qLen = session.pairedQueue.length
  const queuePosition =
    queueIndex >= 0 ? `${queueIndex + 1} / ${qLen}` : qLen > 0 ? 'Custom' : '—'
  const atQueueEnd = queueIndex >= 0 && queueIndex >= qLen - 1

  return (
    <div className="step-page">
      <h1>Step 2 · Side-by-side compare</h1>
      <p className="lead">
        Walk auto-matched pairs with <strong>Next</strong> / <strong>Prev</strong> (or{' '}
        <kbd className="kbd-hint">→</kbd> <kbd className="kbd-hint">←</kbd> / <kbd className="kbd-hint">n</kbd>{' '}
        <kbd className="kbd-hint">p</kbd>). Draw rectangles on the <strong>compare</strong> image to log
        gaps.
      </p>

      {qLen > 0 && (
        <div className="card pair-queue-bar">
          <div className="pair-queue-nav">
            <button type="button" className="btn-queue" onClick={goPrev} disabled={queueIndex === 0}>
              ← Prev
            </button>
            <span className="pair-queue-position">
              Pair <strong>{queuePosition}</strong>
              {queueIndex === -1 && qLen > 0 && (
                <span className="muted small"> — not in auto-match list; dropdowns are free</span>
              )}
            </span>
            <button type="button" className="btn-queue" onClick={goNext} disabled={atQueueEnd}>
              Next →
            </button>
          </div>
          <p className="muted small pair-queue-meta">
            {qLen} auto-matched pair{qLen === 1 ? '' : 's'} · dropdowns below still switch any frame
          </p>
        </div>
      )}

      {qLen === 0 && (
        <div className="banner banner-soft">
          No auto-matched pairs (names did not line up). Use the reference and compare dropdowns to pick
          screens.
        </div>
      )}

      <div className="card row-pair-select">
        <div className="field-inline">
          <label htmlFor="pick-ref">Reference screen</label>
          <select
            id="pick-ref"
            value={activeRefNodeId ?? ''}
            onChange={(e) =>
              setActivePair(e.target.value || null, activeCompareNodeId)
            }
          >
            {session.referenceScreens.map((s) => (
              <option key={s.nodeId} value={s.nodeId}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field-inline">
          <label htmlFor="pick-cmp">Compare screen</label>
          <select
            id="pick-cmp"
            value={activeCompareNodeId ?? ''}
            onChange={(e) =>
              setActivePair(activeRefNodeId, e.target.value || null)
            }
          >
            {session.compareScreens.map((s) => (
              <option key={s.nodeId} value={s.nodeId}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <p className="muted small">
          Session: <strong>{session.title}</strong> · Screen type:{' '}
          <strong>{session.screenType}</strong>
        </p>
      </div>

      {loadError && <div className="banner banner-error">{loadError}</div>}
      {loading && <p className="muted">Loading exports…</p>}

      <div className="compare-grid">
        <div className="compare-pane">
          <h3>Reference (new)</h3>
          {!refUrl && !loading && <p className="muted">No image.</p>}
          {refUrl && (
            <div className="compare-screen-viewport">
              <img src={refUrl} alt={refName} className="compare-img" />
            </div>
          )}
        </div>
        <ImageAnnotator
          imageUrl={cmpUrl}
          imageAlt={`Compare — ${cmpName}`}
          annotations={annotations}
          onAnnotationsChange={onAnnotationsChange}
          disabled={!token.trim()}
          compactViewport
        />
      </div>

      <p className="muted small">
        Tip: Figma image links expire; switch pair or reload this page and ensure your token is set
        to refresh exports.
      </p>
      <Link to="/score">Continue to coverage →</Link>
    </div>
  )
}
