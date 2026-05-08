import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenPicker } from '../components/ScreenPicker'
import { collectSelectableScreens } from '../lib/figma/collectScreens'
import { FigmaApiError, getFile } from '../lib/figma/client'
import { parseFigmaDesignUrl } from '../lib/figma/parseUrl'
import type { SelectableScreen } from '../lib/figma/types'
import {
  DEFAULT_SCREEN_TYPE,
  isValidScreenType,
  SCREEN_TYPE_OPTIONS,
  type ScreenTypeOption,
} from '../lib/screenTypeAxis'
import { buildPairedQueue } from '../lib/pairScreens'
import { useComparisonsStore } from '../store/comparisonsStore'

type LoadedSide = {
  url: string
  apiFileKey: string
  fileName: string
  screens: SelectableScreen[]
}

export function Step1FigmaPick() {
  const navigate = useNavigate()
  const token = useComparisonsStore((s) => s.token)
  const draftReferenceUrl = useComparisonsStore((s) => s.draftReferenceUrl)
  const draftCompareUrl = useComparisonsStore((s) => s.draftCompareUrl)
  const setDraftReferenceUrl = useComparisonsStore((s) => s.setDraftReferenceUrl)
  const setDraftCompareUrl = useComparisonsStore((s) => s.setDraftCompareUrl)
  const createSession = useComparisonsStore((s) => s.createSession)

  const [refLoaded, setRefLoaded] = useState<LoadedSide | null>(null)
  const [cmpLoaded, setCmpLoaded] = useState<LoadedSide | null>(null)
  const [refSelected, setRefSelected] = useState<Set<string>>(new Set())
  const [cmpSelected, setCmpSelected] = useState<Set<string>>(new Set())
  const [refFilter, setRefFilter] = useState('')
  const [cmpFilter, setCmpFilter] = useState('')
  const [screenType, setScreenType] = useState<ScreenTypeOption>(DEFAULT_SCREEN_TYPE)
  const [busyRef, setBusyRef] = useState(false)
  const [busyCmp, setBusyCmp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** null = still checking. Vite proxy returns 401 JSON without a token. */
  const [proxyMissing, setProxyMissing] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/figma/v1/files/_proxy-check`,
        )
        const text = await res.text()
        if (cancelled) return
        const proxyOk =
          res.status === 401 && text.includes('Missing X-Figma-Token')
        setProxyMissing(!proxyOk)
      } catch {
        if (!cancelled) setProxyMissing(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadSide = async (
    urlInput: string,
    setLoaded: (v: LoadedSide | null) => void,
    setBusy: (v: boolean) => void,
  ) => {
    setError(null)
    if (!token.trim()) {
      setError('Add your Figma token: click the key icon in the top-right corner.')
      return
    }
    const parsed = parseFigmaDesignUrl(urlInput)
    if (!parsed) {
      setError('Could not parse Figma URL. Use a design file link from figma.com.')
      return
    }
    setBusy(true)
    try {
      const data = await getFile(parsed.apiFileKey, token.trim(), 4)
      const screens = collectSelectableScreens(data.document)
      setLoaded({
        url: urlInput.trim(),
        apiFileKey: parsed.apiFileKey,
        fileName: data.name,
        screens,
      })
    } catch (e) {
      if (e instanceof FigmaApiError) {
        setError(e.message)
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        const looksLikeNetwork =
          msg === 'Failed to fetch' ||
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError') ||
          msg.includes('Load failed')
        setError(
          looksLikeNetwork
            ? 'Could not reach the server. This app talks to Figma through a local proxy at /api/figma — that only exists when you run it from the project folder with npm run dev or npm run preview. Opening dist/index.html in the browser or using a simple “static files” server will show this error.'
            : msg,
        )
      }
      setLoaded(null)
    } finally {
      setBusy(false)
    }
  }

  const toggleRef = (id: string) => {
    setRefSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCmp = (id: string) => {
    setCmpSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllRefShown = (ids: string[]) => setRefSelected(new Set(ids))
  const clearRefSelection = () => setRefSelected(new Set())
  const addRefByPrefix = (prefix: string) => {
    const p = prefix.trim().toLowerCase()
    if (!p || !refLoaded) return
    setRefSelected((prev) => {
      const next = new Set(prev)
      for (const s of refLoaded.screens) {
        if (s.name.toLowerCase().startsWith(p)) next.add(s.id)
      }
      return next
    })
  }

  const selectAllCmpShown = (ids: string[]) => setCmpSelected(new Set(ids))
  const clearCmpSelection = () => setCmpSelected(new Set())
  const addCmpByPrefix = (prefix: string) => {
    const p = prefix.trim().toLowerCase()
    if (!p || !cmpLoaded) return
    setCmpSelected((prev) => {
      const next = new Set(prev)
      for (const s of cmpLoaded.screens) {
        if (s.name.toLowerCase().startsWith(p)) next.add(s.id)
      }
      return next
    })
  }

  const previewPairs = useMemo(() => {
    if (!refLoaded || !cmpLoaded || refSelected.size === 0 || cmpSelected.size === 0) return []
    const referenceScreens = refLoaded.screens
      .filter((s) => refSelected.has(s.id))
      .map((s) => ({ nodeId: s.id, name: s.name }))
    const compareScreens = cmpLoaded.screens
      .filter((s) => cmpSelected.has(s.id))
      .map((s) => ({ nodeId: s.id, name: s.name }))
    return buildPairedQueue(referenceScreens, compareScreens)
  }, [refLoaded, cmpLoaded, refSelected, cmpSelected])

  const canCreate = useMemo(() => {
    return (
      !!refLoaded &&
      !!cmpLoaded &&
      refSelected.size > 0 &&
      cmpSelected.size > 0 &&
      token.trim().length > 0
    )
  }, [refLoaded, cmpLoaded, refSelected.size, cmpSelected.size, token])

  const handleCreateSession = () => {
    if (!refLoaded || !cmpLoaded) return
    const referenceScreens = refLoaded.screens
      .filter((s) => refSelected.has(s.id))
      .map((s) => ({ nodeId: s.id, name: s.name }))
    const compareScreens = cmpLoaded.screens
      .filter((s) => cmpSelected.has(s.id))
      .map((s) => ({ nodeId: s.id, name: s.name }))
    const pairedQueue = buildPairedQueue(referenceScreens, compareScreens)
    createSession({
      title: `${refLoaded.fileName} vs ${cmpLoaded.fileName}`,
      screenType,
      referenceFileKey: refLoaded.apiFileKey,
      referenceFileName: refLoaded.fileName,
      compareFileKey: cmpLoaded.apiFileKey,
      compareFileName: cmpLoaded.fileName,
      referenceScreens,
      compareScreens,
      pairedQueue,
    })
    navigate('/compare')
  }

  return (
    <div className="step-page">
      <h1>Step 1 · Reference library & compare file</h1>
      <p className="lead">
        Paste two Figma file links: your <strong>reference</strong> (new visual) and the{' '}
        <strong>compare</strong> screen (existing flow). Load each file, then select which frames to
        use.
      </p>
      <p className="muted small step1-run-hint">
        Open this app from the <strong>localhost</strong> link shown in Terminal after{' '}
        <code className="kbd-hint">npm run dev</code> or <code className="kbd-hint">npm run preview</code>{' '}
        (not by opening <code className="kbd-hint">dist/index.html</code> directly).
      </p>

      {proxyMissing === true && (
        <div className="banner banner-error">
          The Figma connection proxy was not found. In Terminal, go to this project&apos;s folder, run{' '}
          <code className="kbd-hint">npm run dev</code>, then use the URL it prints (for example{' '}
          <code className="kbd-hint">http://localhost:5173</code>).
        </div>
      )}

      {error && <div className="banner banner-error">{error}</div>}

      <div className="grid-two">
        <div className="card figma-source-card">
          <div className="figma-source-card-banner">
            <h2>Reference library (new design)</h2>
          </div>
          <div className="figma-source-card-body">
            <label className="block-label" htmlFor="ref-url">
              Figma URL
            </label>
            <textarea
              id="ref-url"
              rows={2}
              className="input-wide"
              placeholder="https://www.figma.com/design/..."
              value={draftReferenceUrl}
              onChange={(e) => setDraftReferenceUrl(e.target.value)}
            />
            <div className="row-actions">
              <button
                type="button"
                onClick={() => loadSide(draftReferenceUrl, setRefLoaded, setBusyRef)}
                disabled={busyRef}
              >
                {busyRef ? 'Loading…' : 'Load file & list screens'}
              </button>
            </div>
            {refLoaded && (
              <p className="muted small">
                <strong>{refLoaded.fileName}</strong> · key <code>{refLoaded.apiFileKey}</code>
              </p>
            )}
            <ScreenPicker
              title="Select reference screens"
              screens={refLoaded?.screens ?? []}
              selectedIds={refSelected}
              onToggle={toggleRef}
              filter={refFilter}
              onFilterChange={setRefFilter}
              busy={busyRef}
              embedded
              onSelectAllShown={selectAllRefShown}
              onClearSelection={clearRefSelection}
              onAddByPrefix={addRefByPrefix}
            />
          </div>
        </div>

        <div className="card figma-source-card">
          <div className="figma-source-card-banner figma-source-card-banner--compare">
            <h2>Compare (existing / other flow)</h2>
          </div>
          <div className="figma-source-card-body">
            <label className="block-label" htmlFor="cmp-url">
              Figma URL
            </label>
            <textarea
              id="cmp-url"
              rows={2}
              className="input-wide"
              placeholder="https://www.figma.com/design/..."
              value={draftCompareUrl}
              onChange={(e) => setDraftCompareUrl(e.target.value)}
            />
            <div className="row-actions">
              <button
                type="button"
                onClick={() => loadSide(draftCompareUrl, setCmpLoaded, setBusyCmp)}
                disabled={busyCmp}
              >
                {busyCmp ? 'Loading…' : 'Load file & list screens'}
              </button>
            </div>
            {cmpLoaded && (
              <p className="muted small">
                <strong>{cmpLoaded.fileName}</strong> · key <code>{cmpLoaded.apiFileKey}</code>
              </p>
            )}
            <ScreenPicker
              title="Select compare screens"
              screens={cmpLoaded?.screens ?? []}
              selectedIds={cmpSelected}
              onToggle={toggleCmp}
              filter={cmpFilter}
              onFilterChange={setCmpFilter}
              busy={busyCmp}
              embedded
              onSelectAllShown={selectAllCmpShown}
              onClearSelection={clearCmpSelection}
              onAddByPrefix={addCmpByPrefix}
            />
          </div>
        </div>
      </div>

      <div className="card session-create">
        <label className="block-label" htmlFor="screen-type">
          Screen type
        </label>
        <select
          id="screen-type"
          className="input-wide"
          value={screenType}
          onChange={(e) => {
            const v = e.target.value
            if (isValidScreenType(v)) setScreenType(v)
          }}
        >
          {SCREEN_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {canCreate && previewPairs.length > 0 && (
          <p className="muted small session-pair-preview">
            <strong>{previewPairs.length}</strong> auto-matched pair{previewPairs.length === 1 ? '' : 's'} by
            screen name (used for the queue in step 2). Unmatched frames still appear in the dropdowns.
          </p>
        )}
        {canCreate && previewPairs.length === 0 && refSelected.size > 0 && cmpSelected.size > 0 && (
          <p className="muted small session-pair-preview">
            No name matches between selected reference and compare frames — step 2 will use dropdowns only
            (no queue).
          </p>
        )}
        <div className="row-actions">
          <button type="button" disabled={!canCreate} onClick={handleCreateSession}>
            Create session & go to Compare
          </button>
          {!canCreate && (
            <span className="muted small">Select at least one screen on each side and load both files.</span>
          )}
        </div>
      </div>
    </div>
  )
}
