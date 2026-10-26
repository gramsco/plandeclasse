import { useEffect, useRef, type ReactNode } from 'react'

type Props = { title: string; onClose(): void; children: ReactNode; wide?: boolean }

/** Open modals, the last one being on top: Escape only closes that one. */
const openModals: symbol[] = []

export function Modal({ title, onClose, children, wide }: Props) {
  // The latest callback, so that a re-render does not move this modal to the top of the stack.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const token = Symbol()
    openModals.push(token)
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && openModals.at(-1) === token && close.current()
    window.addEventListener('keydown', onKeyDown)
    return () => {
      openModals.splice(openModals.indexOf(token), 1)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
  return (
    <div className="modal-backdrop no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}
