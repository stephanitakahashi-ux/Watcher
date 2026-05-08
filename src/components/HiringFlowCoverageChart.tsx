import { useMemo, useState } from 'react'
import {
  pooledCoverageByScreenType,
  SCREEN_TYPE_OPTIONS,
  type ScreenTypeOption,
} from '../lib/screenTypeAxis'
import type { ComparisonSession } from '../store/comparisonsStore'
import { ScreenTypeGapsModal } from './ScreenTypeGapsModal'

const W = 1120
const H = 480
const PAD_L = 52
const PAD_R = 28
const PAD_T = 40
const PAD_B = 120
const INNER_W = W - PAD_L - PAD_R
const INNER_H = H - PAD_T - PAD_B
const AXIS_BOTTOM = PAD_T + INNER_H
const N = SCREEN_TYPE_OPTIONS.length
const SLOT_W = INNER_W / N
const BAR_W = Math.min(SLOT_W * 0.52, 72)

function yAt(percent: number): number {
  return PAD_T + INNER_H * (1 - Math.min(100, Math.max(0, percent)) / 100)
}

type Props = {
  sessions: ComparisonSession[]
  activeSessionId: string | null
}

export function HiringFlowCoverageChart({ sessions, activeSessionId }: Props) {
  const [openType, setOpenType] = useState<ScreenTypeOption | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const buckets = useMemo(() => pooledCoverageByScreenType(sessions), [sessions])
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )

  const yTicks = [0, 25, 50, 75, 100]

  return (
    <div className="card hiring-flow-chart-card">
      <h2 className="hiring-flow-chart-title">Coverage by screen type</h2>
      <p className="muted small hiring-flow-chart-sub">
        Each bar pools all gaps from sessions tagged with that screen type (Step 1). Height is the
        share marked &quot;Addressed in new design&quot;. Types with no gaps show 0%.
        {activeSession ? (
          <>
            {' '}
            Active session: <strong>{activeSession.title}</strong> ({activeSession.screenType}).
          </>
        ) : (
          <> Set a session as active below to jump to it from the gap list.</>
        )}
      </p>
      <p className="muted small hiring-flow-chart-foot">
        Click a bar to see every gap in that bucket and open a pair in Compare.
      </p>

      <div className="hiring-flow-chart-wrap">
        <svg
          className="hiring-flow-chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Pooled gap coverage by screen type"
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_L}
                x2={PAD_L + INNER_W}
                y1={yAt(t)}
                y2={yAt(t)}
                className="hiring-flow-chart-grid"
              />
              <text
                x={PAD_L - 8}
                y={yAt(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="hiring-flow-chart-axis-text"
              >
                {t}%
              </text>
            </g>
          ))}

          <line
            x1={PAD_L}
            x2={PAD_L}
            y1={PAD_T}
            y2={AXIS_BOTTOM}
            className="hiring-flow-chart-axis"
          />
          <line
            x1={PAD_L}
            x2={PAD_L + INNER_W}
            y1={AXIS_BOTTOM}
            y2={AXIS_BOTTOM}
            className="hiring-flow-chart-axis"
          />

          {buckets.map((b, i) => {
            const cx = PAD_L + (i + 0.5) * SLOT_W
            const x = cx - BAR_W / 2
            const fillPct = b.percent ?? 0
            const h = AXIS_BOTTOM - yAt(fillPct)
            const y = yAt(fillPct)
            const label = b.screenType
            const tip =
              `${label}\n` +
              `${b.totalGaps} gap${b.totalGaps === 1 ? '' : 's'}\n` +
              (b.percent !== null ? `${b.percent}% addressed` : 'No gaps')
            return (
              <g
                key={b.screenType}
                className="screen-type-bar-group"
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={`${label}: ${tip.replace(/\n/g, ', ')}`}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={() => setOpenType(b.screenType)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setOpenType(b.screenType)
                  }
                }}
              >
                <title>{tip}</title>
                <rect
                  x={PAD_L + i * SLOT_W}
                  y={PAD_T}
                  width={SLOT_W}
                  height={INNER_H}
                  fill="transparent"
                />
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={Math.max(0, h)}
                  rx={4}
                  fill="var(--accent)"
                  opacity={hoverIndex === i ? 1 : 0.85}
                  className="screen-type-bar"
                  pointerEvents="none"
                />
                <text
                  x={cx}
                  y={AXIS_BOTTOM + 14}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  className="hiring-flow-chart-x-label screen-type-x-label"
                  pointerEvents="none"
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {openType && (
        <ScreenTypeGapsModal
          screenType={openType}
          sessions={sessions}
          onClose={() => setOpenType(null)}
        />
      )}
    </div>
  )
}
