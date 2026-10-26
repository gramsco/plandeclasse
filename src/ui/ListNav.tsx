import type { ReactNode } from 'react'

export type ListItem = { id: string; label: string; detail?: string; muted?: boolean }

/** Sidebar listing classes, plans or rooms, with the current one highlighted. */
export function ListNav({
  label,
  items,
  currentId,
  onSelect,
  header,
  horizontal,
}: {
  label: string
  items: ListItem[]
  currentId: string | null | undefined
  onSelect(id: string): void
  header?: ReactNode
  /** A strip above the content instead of a column beside it (when the content has columns of its own). */
  horizontal?: boolean
}) {
  return (
    <nav className={`class-list ${horizontal ? 'strip' : ''}`} aria-label={label}>
      {header}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button
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
