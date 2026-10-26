import { useEffect, type ReactNode } from 'react'

export function Modal({ titre, onClose, children, large }: { titre: string; onClose(): void; children: ReactNode; large?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-fond no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${large ? "large" : ""}`} role="dialog" aria-label={titre}>
        <h3>{titre}</h3>
        {children}
      </div>
    </div>
  )
}
