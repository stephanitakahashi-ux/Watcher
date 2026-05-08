import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useComparisonsStore } from '../store/comparisonsStore'

function KeyIcon() {
  return (
    <svg className="figma-token-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.108-1.554.497l-2.407 2.407a1.875 1.875 0 01-2.651-2.651l2.407-2.407c.389-.395.594-.99.597-1.555a6 6 0 017.029-5.912z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FigmaTokenButton() {
  const token = useComparisonsStore((s) => s.token)
  const setToken = useComparisonsStore((s) => s.setToken)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const hasToken = Boolean(token.trim())

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointer = (e: MouseEvent) => {
      const el = rootRef.current
      if (el && !el.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open, close])

  return (
    <div className="figma-token-root" ref={rootRef}>
      <button
        type="button"
        className={`figma-token-trigger${hasToken ? ' figma-token-trigger--set' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        title={hasToken ? 'Figma token saved (this tab) — click to edit' : 'Add Figma personal access token'}
        onClick={() => setOpen((o) => !o)}
      >
        <KeyIcon />
        <span className="figma-token-trigger-dot" aria-hidden />
      </button>

      {open && (
        <div className="figma-token-popover" id={panelId} role="dialog" aria-label="Figma token">
          <h2 className="figma-token-popover-title">Figma access</h2>
          <p className="figma-token-popover-hint">
            Personal access token from Figma → Settings → Security. Stored in this tab only; sent to your
            local dev server, not the internet.
          </p>
          <label className="block-label" htmlFor="figma-token-popover-input">
            Token
          </label>
          <input
            id="figma-token-popover-input"
            type="password"
            autoComplete="off"
            placeholder="Paste token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="input-wide figma-token-input"
            autoFocus
          />
          <div className="figma-token-popover-actions">
            <button type="button" className="btn-ghost" onClick={() => setToken('')}>
              Clear
            </button>
            <button type="button" onClick={close}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
