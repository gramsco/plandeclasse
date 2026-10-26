import { useState } from 'react'
import { create } from 'zustand'
import { Modal } from './Modal'

type Request =
  | { kind: 'confirm'; title: string; message?: string; confirmLabel: string; resolve(value: boolean): void }
  | { kind: 'text'; title: string; label: string; initial: string; resolve(value: string | undefined): void }

const useRequest = create<{ current?: Request }>(() => ({}))

/** Only one question is shown at a time: a new one cancels the one still open. */
function open(request: Request) {
  const previous = useRequest.getState().current
  if (previous?.kind === 'confirm') previous.resolve(false)
  else previous?.resolve(undefined)
  useRequest.setState({ current: request })
}

const close = () => useRequest.setState({ current: undefined })

/** Replacement for `window.confirm`: resolves to true when the user confirms a destructive action. */
export const askConfirm = (title: string, options: { message?: string; confirmLabel?: string } = {}) =>
  new Promise<boolean>((resolve) =>
    open({
      kind: 'confirm',
      title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirmer',
      resolve,
    }),
  )

/** Replacement for `window.prompt`: resolves to the trimmed text, or undefined when cancelled or left empty. */
export const askText = (title: string, label: string, initial = '') =>
  new Promise<string | undefined>((resolve) => open({ kind: 'text', title, label, initial, resolve }))

/** Mounted once in the app: shows the question asked through `askConfirm` / `askText`. */
export function AskHost() {
  const request = useRequest((s) => s.current)
  if (!request) return null
  const answer = (value: boolean | string | undefined) => {
    close()
    if (request.kind === 'confirm') request.resolve(value === true)
    else request.resolve(typeof value === 'string' ? value : undefined)
  }
  if (request.kind === 'confirm')
    return (
      <Modal title={request.title} onClose={() => answer(false)}>
        {request.message && <p>{request.message}</p>}
        <div className="form-actions">
          <button autoFocus onClick={() => answer(false)}>
            Annuler
          </button>
          <button className="danger" onClick={() => answer(true)}>
            {request.confirmLabel}
          </button>
        </div>
      </Modal>
    )
  return <TextQuestion key={request.title + request.initial} request={request} onAnswer={answer} />
}

function TextQuestion({
  request,
  onAnswer,
}: {
  request: Extract<Request, { kind: 'text' }>
  onAnswer(value: string | undefined): void
}) {
  const [value, setValue] = useState(request.initial)
  return (
    <Modal title={request.title} onClose={() => onAnswer(undefined)}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          onAnswer(value.trim() || undefined)
        }}
      >
        <label>
          {request.label}
          <input
            autoFocus
            value={value}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <div className="form-actions">
          <button type="button" onClick={() => onAnswer(undefined)}>
            Annuler
          </button>
          <button className="primary">OK</button>
        </div>
      </form>
    </Modal>
  )
}
