import { useRef, useState } from 'react'
import { buildFile, download, readFile, type ExportFile } from '../io/file'
import { storage, useApp } from '../store'
import { Modal } from './Modal'

const LAST_EXPORT_KEY = 'lastExport'
const LEGACY_LAST_EXPORT_KEY = 'derniereSauvegarde'

export const getLastExport = () => localStorage.getItem(LAST_EXPORT_KEY) ?? localStorage.getItem(LEGACY_LAST_EXPORT_KEY)

export function FileMenu({ onExported }: { onExported(): void }) {
  const state = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<ExportFile>()
  const [error, setError] = useState<string>()

  const exportAll = async () => {
    const exportFile = await buildFile(state, storage)
    download(exportFile, `plandeclasse-${new Date().toISOString().slice(0, 10)}.classe`)
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString())
    onExported()
  }

  const pickFile = async (picked?: File) => {
    if (!picked) return
    try {
      setFile(readFile(await picked.text()))
    } catch (e) {
      setError((e as Error).message)
    }
    if (input.current) input.current.value = ''
  }

  const importFile = async (mode: 'merge' | 'replace') => {
    if (!file) return
    if (mode === 'replace' && !confirm("Tout ce qui est actuellement dans l'application sera supprimé. Continuer ?"))
      return
    await state.importData(file, mode)
    setFile(undefined)
  }

  return (
    <div className="file-menu">
      <button onClick={() => void exportAll()} title="Enregistre tout dans un fichier .classe">
        ⬇ Exporter
      </button>
      <button onClick={() => input.current?.click()}>⬆ Importer</button>
      <input
        ref={input}
        type="file"
        accept=".classe,application/json"
        hidden
        onChange={(e) => void pickFile(e.target.files?.[0])}
      />
      {error && (
        <Modal title="Import impossible" onClose={() => setError(undefined)}>
          <p>{error}</p>
          <div className="form-actions">
            <button className="primary" onClick={() => setError(undefined)}>
              OK
            </button>
          </div>
        </Modal>
      )}
      {file && (
        <Modal title="Importer un fichier .classe" onClose={() => setFile(undefined)}>
          <p>
            Ce fichier contient {file.classes.length} classe(s), {file.rooms.length} salle(s) et {file.plans.length}{' '}
            plan(s).
          </p>
          <p className="hint">
            « Ajouter » conserve vos données ; les éléments déjà présents (même identifiant) sont mis à jour par ceux du
            fichier.
          </p>
          <div className="form-actions">
            <button onClick={() => setFile(undefined)}>Annuler</button>
            <button className="danger" onClick={() => void importFile('replace')}>
              Tout remplacer
            </button>
            <button className="primary" onClick={() => void importFile('merge')}>
              Ajouter
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
