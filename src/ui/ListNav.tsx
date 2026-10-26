import { useState, type ReactNode } from 'react'

export type ListItem = { id: string; label: string; detail?: string; muted?: boolean }

/** Sidebar listing classes, plans or rooms, with the current one highlighted. */
export function ListNav({
  label,
  items,
  currentId,
  onSelect,
  header,
  horizontal,
  onReorder,
}: {
  label: string
  items: ListItem[]
  currentId: string | null | undefined
  onSelect(id: string): void
  header?: ReactNode
  /** A strip above the content instead of a column beside it (when the content has columns of its own). */
  horizontal?: boolean
  /** When set, items can be dragged onto each other (or moved with Alt + arrow keys). */
  onReorder?(fromId: string, toId: string): void
}) {
  const [draggedId, setDraggedId] = useState<string>()
  const [overId, setOverId] = useState<string>()
  const move = (id: string, step: number) => {
    const target = items[items.findIndex((x) => x.id === id) + step]
    if (target) onReorder?.(id, target.id)
  }
  return (
    <nav className={`class-list no-print ${horizontal ? 'strip' : ''}`} aria-label={label}>
      {header}
      <ul>
        {items.map((item) => (
          <li
            key={item.id}
            className={item.id === overId && item.id !== draggedId ? 'drop-target' : undefined}
            draggable={Boolean(onReorder)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              setDraggedId(item.id)
            }}
            onDragOver={(e) => {
              if (!draggedId) return
              e.preventDefault()
              setOverId(item.id)
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (draggedId) onReorder?.(draggedId, item.id)
              setDraggedId(undefined)
              setOverId(undefined)
            }}
            onDragEnd={() => {
              setDraggedId(undefined)
              setOverId(undefined)
            }}
          >
            <button
              title={onReorder ? 'Glisser pour changer l’ordre (ou Alt + flèches)' : undefined}
              onKeyDown={(e) => {
                if (!onReorder || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
                e.preventDefault()
                move(item.id, e.key === 'ArrowUp' ? -1 : 1)
              }}
              className={`${item.id === currentId ? 'active' : ''} ${item.muted ? 'no-match' : ''}`}
              aria-current={item.id === currentId ? 'true' : undefined}
              onClick={() => onSelect(item.id)}
            >
              <span>{item.label}</span>
              {item.detail && <small>{item.detail}</small>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
