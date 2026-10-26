import { useRef, useState } from 'react'
import { construireFichier, lireFichier, telecharger, type FichierClasse } from '../io/fichier'
import { storage, useApp } from '../store'
import { Modal } from './Modal'

const CLE = 'derniereSauvegarde'

export const derniereSauvegarde = () => localStorage.getItem(CLE)

export function FichierMenu({ onChange }: { onChange(): void }) {
  const state = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [fichier, setFichier] = useState<FichierClasse>()
  const [erreur, setErreur] = useState<string>()

  const exporter = async () => {
    const f = await construireFichier(state, storage)
    telecharger(f, `plandeclasse-${new Date().toISOString().slice(0, 10)}.classe`)
    localStorage.setItem(CLE, new Date().toISOString())
    onChange()
  }

  const choisir = async (file?: File) => {
    if (!file) return
    try {
      setFichier(lireFichier(await file.text()))
    } catch (e) {
      setErreur((e as Error).message)
    }
    if (input.current) input.current.value = ''
  }

  const importer = async (mode: 'fusion' | 'remplacer') => {
    if (!fichier) return
    if (mode === 'remplacer' && !confirm('Tout ce qui est actuellement dans l\'application sera supprimé. Continuer ?')) return
    await state.importer(fichier, mode)
    setFichier(undefined)
  }

  return (
    <div className="fichier-menu">
      <button onClick={() => void exporter()} title="Enregistre tout dans un fichier .classe">⬇ Exporter</button>
      <button onClick={() => input.current?.click()}>⬆ Importer</button>
      <input ref={input} type="file" accept=".classe,application/json" hidden onChange={(e) => void choisir(e.target.files?.[0])} />
      {erreur && (
        <Modal titre="Import impossible" onClose={() => setErreur(undefined)}>
          <p>{erreur}</p>
          <div className="form-actions"><button className="primaire" onClick={() => setErreur(undefined)}>OK</button></div>
        </Modal>
      )}
      {fichier && (
        <Modal titre="Importer un fichier .classe" onClose={() => setFichier(undefined)}>
          <p>
            Ce fichier contient {fichier.classes.length} classe(s), {fichier.salles.length} salle(s) et {fichier.plans.length} plan(s).
          </p>
          <p className="aide">« Ajouter » conserve vos données ; les éléments déjà présents (même identifiant) sont mis à jour par ceux du fichier.</p>
          <div className="form-actions">
            <button onClick={() => setFichier(undefined)}>Annuler</button>
            <button className="danger" onClick={() => void importer('remplacer')}>Tout remplacer</button>
            <button className="primaire" onClick={() => void importer('fusion')}>Ajouter</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
