import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { parsePairKey } from '../lib/figma/parseUrl'
import type { ScreenTypeOption } from '../lib/screenTypeAxis'
import { gapsForScreenType } from '../lib/screenTypeAxis'
import type { ComparisonSession } from '../store/comparisonsStore'
import { useComparisonsStore } from '../store/comparisonsStore'

type Props = {
  screenType: ScreenTypeOption
  sessions: ComparisonSession[]
  onClose: () => void
}

export function ScreenTypeGapsModal({ screenType, sessions, onClose }: Props) {
  const navigate = useNavigate()
  const setActiveSession = useComparisonsStore((s) => s.setActiveSession)
  const setActivePair = useComparisonsStore((s) => s.setActivePair)

  const rows = gapsForScreenType(sessions, screenType)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const openInCompare = (sessionId: string, pairKey: string) => {
    const { refNodeId, compareNodeId } = parsePairKey(pairKey)
    setActiveSession(sessionId)
    setActivePair(refNodeId, compareNodeId)
    onClose()
    navigate('/compare')
  }

  return (
    <div
      className="gap-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="gap-modal-panel" role="dialog" aria-labelledby="gap-modal-title">
        <div className="gap-modal-head">
          <h2 id="gap-modal-title">Gaps · {screenType}</h2>
          <button type="button" className="gap-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="muted small gap-modal-count">
          {rows.length} gap{rows.length === 1 ? '' : 's'} pooled from all sessions with this screen
          type.
        </p>
        {rows.length === 0 ? (
          <p className="muted">No gaps in this bucket yet.</p>
        ) : (
          <div className="gap-modal-table-wrap">
            <table className="gap-modal-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Reference</th>
                  <th>Compare</th>
                  <th>Gap</th>
                  <th>Addressed</th>
                  <th>NUDs</th>
                  <th>Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.sessionId}-${r.pairKey}-${r.gap.id}`}>
                    <td>{r.sessionTitle}</td>
                    <td>{r.refName}</td>
                    <td>{r.cmpName}</td>
                    <td>{r.gap.label}</td>
                    <td>{r.gap.addressed ? 'Yes' : 'No'}</td>
                    <td>{r.gap.compliantToNuds ? 'Yes' : 'No'}</td>
                    <td className="gap-modal-note">{r.gap.note || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-ghost btn-compact"
                        onClick={() => openInCompare(r.sessionId, r.pairKey)}
                      >
                        Open in Compare
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
