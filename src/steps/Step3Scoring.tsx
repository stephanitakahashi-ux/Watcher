import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { parsePairKey } from '../lib/figma/parseUrl'
import {
  sessionCoverage,
  useComparisonsStore,
  type GapAnnotation,
} from '../store/comparisonsStore'

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const value = tags.join(', ')
  return (
    <input
      type="text"
      className="input-tags"
      placeholder="tags: copy, legal, CTA (comma-separated)"
      value={value}
      onChange={(e) =>
        onChange(
          e.target.value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        )
      }
    />
  )
}

export function Step3Scoring() {
  const sessions = useComparisonsStore((s) => s.sessions)
  const activeSessionId = useComparisonsStore((s) => s.activeSessionId)
  const updateGap = useComparisonsStore((s) => s.updateGap)

  const session = sessions.find((x) => x.id === activeSessionId)

  const rows = useMemo(() => {
    if (!session) return []
    const refById = Object.fromEntries(session.referenceScreens.map((s) => [s.nodeId, s.name]))
    const cmpById = Object.fromEntries(session.compareScreens.map((s) => [s.nodeId, s.name]))
    const out: {
      pairKey: string
      refName: string
      cmpName: string
      gap: GapAnnotation
    }[] = []
    for (const [pk, list] of Object.entries(session.annotationsByPair)) {
      const { refNodeId, compareNodeId } = parsePairKey(pk)
      const refName = refById[refNodeId] ?? refNodeId
      const cmpName = cmpById[compareNodeId] ?? compareNodeId
      for (const gap of list) {
        out.push({ pairKey: pk, refName, cmpName, gap })
      }
    }
    out.sort((a, b) => a.gap.label.localeCompare(b.gap.label))
    return out
  }, [session])

  if (!session) {
    return (
      <div className="step-page">
        <h1>Step 3 · Coverage</h1>
        <p className="lead">Create a session and add gaps in Compare first.</p>
        <Link to="/">Go to step 1</Link>
      </div>
    )
  }

  const cov = sessionCoverage(session)

  return (
    <div className="step-page">
      <h1>Step 3 · Coverage & backlog</h1>
      <p className="lead">
        Mark each gap as <strong>addressed</strong> when the new reference screen covers it. Coverage
        is the share of gaps you have closed.
      </p>

      <div className="card metrics">
        <div>
          <span className="metric-value">{cov.totalGaps}</span>
          <span className="metric-label">Total gaps</span>
        </div>
        <div>
          <span className="metric-value">{cov.addressed}</span>
          <span className="metric-label">Addressed</span>
        </div>
        <div>
          <span className="metric-value">{cov.percent !== null ? `${cov.percent}%` : '—'}</span>
          <span className="metric-label">Coverage</span>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="muted">No gaps yet. Use step 2 to draw regions on the compare screen.</p>
      )}

      <ul className="gap-list">
        {rows.map(({ pairKey, refName, cmpName, gap }) => (
          <li key={`${pairKey}-${gap.id}`} className="gap-card card">
            <div className="gap-card-head">
              <div className="gap-checkboxes">
                <label className="checkbox-addressed">
                  <input
                    type="checkbox"
                    checked={gap.addressed}
                    onChange={(e) =>
                      updateGap(session.id, pairKey, gap.id, { addressed: e.target.checked })
                    }
                  />
                  Addressed in new design
                </label>
                <label className="checkbox-addressed">
                  <input
                    type="checkbox"
                    checked={gap.compliantToNuds}
                    onChange={(e) =>
                      updateGap(session.id, pairKey, gap.id, {
                        compliantToNuds: e.target.checked,
                      })
                    }
                  />
                  Compliant to NuDS
                </label>
              </div>
              <span className="muted small">
                {refName} · {cmpName}
              </span>
            </div>
            <h4>{gap.label}</h4>
            <label className="block-label">Note</label>
            <textarea
              rows={2}
              className="input-wide"
              value={gap.note}
              onChange={(e) => updateGap(session.id, pairKey, gap.id, { note: e.target.value })}
              placeholder="How it’s covered or what’s still missing"
            />
            <label className="block-label">Tags</label>
            <TagEditor
              tags={gap.tags}
              onChange={(tags) => updateGap(session.id, pairKey, gap.id, { tags })}
            />
          </li>
        ))}
      </ul>

      <Link to="/dashboard">Open dashboard →</Link>
    </div>
  )
}
