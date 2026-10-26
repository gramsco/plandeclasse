import { useEffect, type ReactNode } from 'react'

type Props = { title: string; onClose(): void; children: ReactNode; wide?: boolean }

export function Modal({ title, onClose, children, wide }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return (
    <div className="modal-backdrop no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}
