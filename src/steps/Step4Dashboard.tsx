import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { HiringFlowCoverageChart } from '../components/HiringFlowCoverageChart'
import {
  exportSessionToCsv,
  sessionCoverage,
  useComparisonsStore,
} from '../store/comparisonsStore'

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function Step4Dashboard() {
  const sessions = useComparisonsStore((s) => s.sessions)
  const activeSessionId = useComparisonsStore((s) => s.activeSessionId)
  const setActiveSession = useComparisonsStore((s) => s.setActiveSession)
  const deleteSession = useComparisonsStore((s) => s.deleteSession)

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => b.createdAt - a.createdAt),
    [sessions],
  )

  const totals = useMemo(() => {
    let gaps = 0
    let addressed = 0
    for (const s of sessions) {
      const c = sessionCoverage(s)
      gaps += c.totalGaps
      addressed += c.addressed
    }
    const pct = gaps === 0 ? null : Math.round((addressed / gaps) * 1000) / 10
    return { gaps, addressed, pct }
  }, [sessions])

  return (
    <div className="step-page">
      <h1>Step 4 · Dashboard</h1>
      <p className="lead">
        All saved comparison sessions live in this browser (local storage). Export CSV for
        spreadsheets or sharing.
      </p>

      <div className="card metrics">
        <div>
          <span className="metric-value">{sessions.length}</span>
          <span className="metric-label">Sessions</span>
        </div>
        <div>
          <span className="metric-value">{totals.gaps}</span>
          <span className="metric-label">Gaps (all)</span>
        </div>
        <div>
          <span className="metric-value">{totals.addressed}</span>
          <span className="metric-label">Addressed (all)</span>
        </div>
        <div>
          <span className="metric-value">{totals.pct !== null ? `${totals.pct}%` : '—'}</span>
          <span className="metric-label">Overall coverage</span>
        </div>
      </div>

      {sessions.length > 0 ? (
        <HiringFlowCoverageChart sessions={sessions} activeSessionId={activeSessionId} />
      ) : (
        <p className="muted hiring-flow-chart-prompt">
          Create a session on step 1 to see coverage by screen type.
        </p>
      )}

      {sorted.length === 0 && (
        <p className="muted">
          No sessions yet. <Link to="/">Start at step 1</Link>.
        </p>
      )}

      <ul className="session-dashboard-list">
        {sorted.map((s) => {
          const c = sessionCoverage(s)
          const active = s.id === activeSessionId
          return (
            <li key={s.id} className={`card session-dash-card ${active ? 'session-dash-active' : ''}`}>
              <div className="session-dash-top">
                <h3>{s.title}</h3>
                <span className="muted small">
                  {new Date(s.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="muted small">
                Screen type: <strong>{s.screenType}</strong>
              </p>
              <p className="muted small">
                Ref: {s.referenceFileName} · Compare: {s.compareFileName}
              </p>
              <p className="session-dash-stats">
                <span>{c.totalGaps} gaps</span>
                <span>{c.addressed} addressed</span>
                <span>{c.percent !== null ? `${c.percent}% coverage` : '—'}</span>
              </p>
              <div className="row-actions">
                <button type="button" onClick={() => setActiveSession(s.id)}>
                  Set active
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => downloadCsv(`screen-comparison-${s.id}.csv`, exportSessionToCsv(s))}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    if (confirm('Delete this session and all its gaps?')) deleteSession(s.id)
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="muted small">
        <Link to="/compare">Compare</Link> · <Link to="/score">Coverage</Link> ·{' '}
        <Link to="/">New session</Link>
      </p>
    </div>
  )
}
