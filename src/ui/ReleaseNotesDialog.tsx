import { useMemo } from 'react'
import notes from '../../docs/release-notes.md?raw'
import { renderGuide } from './guide'
import { GUIDE_IMAGES } from './HelpView'
import { Modal } from './Modal'

/** The release notes, opened from the version number in the footer. */
export function ReleaseNotesDialog({ onClose }: { onClose(): void }) {
  const html = useMemo(() => renderGuide(notes, GUIDE_IMAGES), [])
  return (
    <Modal title="Notes de version" onClose={onClose} wide>
      <article className="guide release-notes" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="form-actions">
        <button className="primary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </Modal>
  )
}
