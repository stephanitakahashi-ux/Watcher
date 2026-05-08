import { useCallback, useRef, useState, type ReactNode } from 'react'
import type { AnnotationRect, GapAnnotation } from '../store/comparisonsStore'

type DragState =
  | null
  | {
      startX: number
      startY: number
      curX: number
      curY: number
    }

type Props = {
  imageUrl: string | null
  imageAlt: string
  annotations: GapAnnotation[]
  onAnnotationsChange: (next: GapAnnotation[]) => void
  disabled?: boolean
  /** Constrain image to 375×800 (step 2 phone-style preview) */
  compactViewport?: boolean
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function newGapId() {
  return `gap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function ViewportMaybe({ active, children }: { active: boolean; children: ReactNode }) {
  if (active) return <div className="compare-screen-viewport">{children}</div>
  return children
}

export function ImageAnnotator({
  imageUrl,
  imageAlt,
  annotations,
  onAnnotationsChange,
  disabled,
  compactViewport,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const [pendingRect, setPendingRect] = useState<AnnotationRect | null>(null)
  const [pendingLabel, setPendingLabel] = useState('')
  const [natural, setNatural] = useState({ w: 1, h: 1 })

  const toNorm = useCallback(
    (clientX: number, clientY: number): { nx: number; ny: number } | null => {
      const img = imgRef.current
      if (!img || !img.naturalWidth) return null
      const r = img.getBoundingClientRect()
      const nx = (clientX - r.left) / r.width
      const ny = (clientY - r.top) / r.height
      return {
        nx: clamp(nx, 0, 1),
        ny: clamp(ny, 0, 1),
      }
    },
    [],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || !imageUrl) return
    const p = toNorm(e.clientX, e.clientY)
    if (!p) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDrag({
      startX: p.nx,
      startY: p.ny,
      curX: p.nx,
      curY: p.ny,
    })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    const p = toNorm(e.clientX, e.clientY)
    if (!p) return
    setDrag({ ...drag, curX: p.nx, curY: p.ny })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return
    const p = toNorm(e.clientX, e.clientY)
    if (!p) {
      setDrag(null)
      return
    }
    const x0 = Math.min(drag.startX, p.nx)
    const y0 = Math.min(drag.startY, p.ny)
    const w = Math.abs(p.nx - drag.startX)
    const h = Math.abs(p.ny - drag.startY)
    setDrag(null)
    if (w < 0.01 || h < 0.01) return
    setPendingRect({ x: x0, y: y0, width: w, height: h })
    setPendingLabel('')
  }

  const commitPending = () => {
    if (!pendingRect) return
    const label = pendingLabel.trim() || 'Untitled gap'
    const next: GapAnnotation = {
      id: newGapId(),
      label,
      rect: pendingRect,
      addressed: false,
      compliantToNuds: false,
      note: '',
      tags: [],
    }
    onAnnotationsChange([...annotations, next])
    setPendingRect(null)
    setPendingLabel('')
  }

  const cancelPending = () => {
    setPendingRect(null)
    setPendingLabel('')
  }

  const removeAnnotation = (id: string) => {
    onAnnotationsChange(annotations.filter((a) => a.id !== id))
  }

  const previewRect =
    drag &&
    (() => {
      const x0 = Math.min(drag.startX, drag.curX)
      const y0 = Math.min(drag.startY, drag.curY)
      return {
        left: `${x0 * 100}%`,
        top: `${y0 * 100}%`,
        width: `${Math.abs(drag.curX - drag.startX) * 100}%`,
        height: `${Math.abs(drag.curY - drag.startY) * 100}%`,
      }
    })()

  return (
    <div className="annotator card">
      <h3>{imageAlt}</h3>
      <p className="muted small">
        Drag on the image to draw a rectangle. Name each gap after you release.
      </p>
      {!imageUrl && <p className="muted">No image — pick a screen and load exports.</p>}
      {imageUrl && (
        <ViewportMaybe active={Boolean(compactViewport)}>
          <div className="annotator-wrap">
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt={imageAlt}
              className="annotator-img"
              draggable={false}
              onLoad={() => {
                const img = imgRef.current
                if (img) setNatural({ w: img.naturalWidth, h: img.naturalHeight })
              }}
            />
            <div
              className="annotator-overlay"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              style={{ touchAction: 'none' }}
              role="presentation"
            >
              {previewRect && <div className="annotator-box annotator-box-preview" style={previewRect} />}
              {annotations.map((a) => (
                <div
                  key={a.id}
                  className="annotator-box"
                  style={{
                    left: `${a.rect.x * 100}%`,
                    top: `${a.rect.y * 100}%`,
                    width: `${a.rect.width * 100}%`,
                    height: `${a.rect.height * 100}%`,
                  }}
                >
                  <span className="annotator-label">{a.label}</span>
                  <button
                    type="button"
                    className="annotator-remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAnnotation(a.id)
                    }}
                    disabled={disabled}
                    aria-label={`Remove ${a.label}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </ViewportMaybe>
      )}

      {pendingRect && (
        <div className="annotator-modal">
          <div className="annotator-modal-inner">
            <h4>Name this gap</h4>
            <input
              autoFocus
              value={pendingLabel}
              onChange={(e) => setPendingLabel(e.target.value)}
              placeholder="e.g. Legal disclaimer, secondary CTA"
              className="input-wide"
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPending()
                if (e.key === 'Escape') cancelPending()
              }}
            />
            <div className="row-actions">
              <button type="button" onClick={commitPending}>
                Add to backlog
              </button>
              <button type="button" className="btn-ghost" onClick={cancelPending}>
                Cancel
              </button>
            </div>
            <p className="muted small">
              Normalized rect (ref): x {pendingRect.x.toFixed(3)}, y {pendingRect.y.toFixed(3)}, w{' '}
              {pendingRect.width.toFixed(3)}, h {pendingRect.height.toFixed(3)} · natural{' '}
              {natural.w}×{natural.h}px
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
