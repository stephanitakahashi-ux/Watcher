import { useState } from 'react'
import type { SelectableScreen } from '../lib/figma/types'

type Props = {
  title: string
  screens: SelectableScreen[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  filter: string
  onFilterChange: (v: string) => void
  busy?: boolean
  /** Inside figma-source-card: no outer card chrome, divider above */
  embedded?: boolean
  /** Replace selection with exactly these ids (e.g. all currently filtered) */
  onSelectAllShown?: (ids: string[]) => void
  /** Clear selection for this side */
  onClearSelection?: () => void
  /** Add to selection every screen whose name starts with prefix (case-insensitive) */
  onAddByPrefix?: (prefix: string) => void
}

export function ScreenPicker({
  title,
  screens,
  selectedIds,
  onToggle,
  filter,
  onFilterChange,
  busy,
  embedded,
  onSelectAllShown,
  onClearSelection,
  onAddByPrefix,
}: Props) {
  const [prefix, setPrefix] = useState('')
  const q = filter.trim().toLowerCase()
  const filtered = q
    ? screens.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q))
    : screens

  const bulkEnabled = Boolean(onSelectAllShown || onClearSelection || onAddByPrefix)

  return (
    <section
      className={
        embedded ? 'screen-picker screen-picker--embedded' : 'screen-picker card'
      }
    >
      <div className="screen-picker-head">
        <h2>{title}</h2>
        <input
          type="search"
          placeholder="Filter by name or id…"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="input-filter"
          disabled={busy}
        />
      </div>
      <p className="muted small">
        {selectedIds.size} selected · {filtered.length} shown
      </p>
      {bulkEnabled && (
        <div className="screen-picker-bulk">
          {onSelectAllShown && (
            <button
              type="button"
              className="btn-bulk"
              disabled={busy || filtered.length === 0}
              onClick={() => onSelectAllShown(filtered.map((s) => s.id))}
            >
              Select all shown
            </button>
          )}
          {onClearSelection && (
            <button
              type="button"
              className="btn-bulk"
              disabled={busy || selectedIds.size === 0}
              onClick={() => onClearSelection()}
            >
              Clear all
            </button>
          )}
          {onAddByPrefix && (
            <div className="screen-picker-prefix">
              <input
                type="text"
                className="input-prefix"
                placeholder="Prefix…"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                disabled={busy}
                aria-label="Prefix for bulk add"
              />
              <button
                type="button"
                className="btn-bulk"
                disabled={busy || !prefix.trim()}
                onClick={() => {
                  onAddByPrefix(prefix.trim())
                  setPrefix('')
                }}
              >
                Add matching
              </button>
            </div>
          )}
        </div>
      )}
      <div className="screen-list" role="list">
        {filtered.map((s) => {
          const on = selectedIds.has(s.id)
          return (
            <label key={s.id} className={`screen-row ${on ? 'screen-row-on' : ''}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(s.id)}
                disabled={busy}
              />
              <span className="screen-name">{s.name}</span>
            </label>
          )
        })}
        {filtered.length === 0 && !busy && (
          <p className="muted">No screens match. Load a file URL first.</p>
        )}
      </div>
    </section>
  )
}
