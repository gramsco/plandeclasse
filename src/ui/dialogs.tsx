import { useMemo, useState } from 'react'
import { modeleSalle } from '../model/salles'
import { SalleSvg } from './SalleSvg'
import { MODELES_SALLE } from '../model/salles'
import { creerClasseDemo } from '../storage/avatar'
import { useApp } from '../store'
import { Modal } from './Modal'

/** Aperçu de la forme générale d'un modèle de salle. */
function ApercuModele({ cle }: { cle: string }) {
  const salle = useMemo(() => modeleSalle(cle)?.creer(), [cle])
  if (!salle) return null
  const places = salle.meubles.reduce((n, m) => n + m.places.length, 0)
  return (
    <figure className="apercu">
      <SalleSvg salle={salle} />
      <figcaption>{places} places</figcaption>
    </figure>
  )
}

export function NouvelleClasseDialog({ onClose }: { onClose(): void }) {
  const { ajouterClasse } = useApp()
  const [nom, setNom] = useState('')
  const [nb, setNb] = useState(24)
  return (
    <Modal titre="Nouvelle classe" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          ajouterClasse(nom.trim() || 'Nouvelle classe', nb)
          onClose()
        }}
      >
        <label>
          Nom
          <input autoFocus value={nom} placeholder="6e A" onChange={(e) => setNom(e.target.value)} />
        </label>
        <label>
          Nombre d'élèves à créer
          <input type="number" min={0} max={60} value={nb} onChange={(e) => setNb(Number(e.target.value))} />
          <small>Des élèves « Élève 1… » à renommer (ou 0 pour coller votre liste ensuite).</small>
        </label>
        <div className="form-actions">
          <button type="button" className="gauche" onClick={() => { void creerClasseDemo(); onClose() }}>
            Classe fictive de test (28 élèves)
          </button>
          <button type="button" onClick={onClose}>Annuler</button>
          <button className="primaire">Créer</button>
        </div>
      </form>
    </Modal>
  )
}

export function NouvelleSalleDialog({ onClose }: { onClose(): void }) {
  const ajouterSalle = useApp((s) => s.ajouterSalle)
  const [cle, setCle] = useState(MODELES_SALLE[0].key)
  return (
    <Modal titre="Nouvelle salle" onClose={onClose} large>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          ajouterSalle(cle)
          onClose()
        }}
      >
        <div className="choix-apercu">
        <div className="choix">
          {MODELES_SALLE.map((m) => (
            <label key={m.key} className={cle === m.key ? 'actif' : ''}>
              <input type="radio" name="modele" checked={cle === m.key} onChange={() => setCle(m.key)} />
              <b>{m.nom}</b>
              <small>{m.description}</small>
            </label>
          ))}
        </div>
        <ApercuModele cle={cle} />
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>Annuler</button>
          <button className="primaire">Créer</button>
        </div>
      </form>
    </Modal>
  )
}

/** Un plan = une classe dans une salle. Tout peut être créé à la volée. */
export function NouveauPlanDialog({ onClose }: { onClose(): void }) {
  const { classes, salles, ajouterClasse, ajouterSalle, creerPlan } = useApp()
  const [classeChoix, setClasseChoix] = useState(classes[0]?.id ?? 'new')
  const [nomClasse, setNomClasse] = useState('')
  const [nb, setNb] = useState(24)
  const [salleChoix, setSalleChoix] = useState(salles[0]?.id ?? `tpl:${MODELES_SALLE[0].key}`)

  return (
    <Modal titre="Nouveau plan de classe" onClose={onClose} large>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          const classeId =
            classeChoix === 'new'
              ? ajouterClasse(nomClasse.trim() || 'Nouvelle classe', nb)
              : classeChoix === 'demo'
                ? await creerClasseDemo()
                : classeChoix
          const salleId = salleChoix.startsWith('tpl:') ? ajouterSalle(salleChoix.slice(4)) : salleChoix
          creerPlan(classeId, salleId)
          onClose()
        }}
      >
        <label>
          Classe (les élèves)
          <select value={classeChoix} onChange={(e) => setClasseChoix(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom} ({c.eleves.length} élèves)</option>
            ))}
            <option value="new">+ Nouvelle classe…</option>
            <option value="demo">+ Classe fictive de test (28 élèves)</option>
          </select>
        </label>
        {classeChoix === 'new' && (
          <div className="ligne">
            <input placeholder="Nom (6e A)" value={nomClasse} onChange={(e) => setNomClasse(e.target.value)} />
            <input type="number" min={0} max={60} value={nb} onChange={(e) => setNb(Number(e.target.value))} title="Nombre d'élèves" />
          </div>
        )}
        <label>
          Salle (le lieu)
          <select value={salleChoix} onChange={(e) => setSalleChoix(e.target.value)}>
            {salles.length > 0 && (
              <optgroup label="Mes salles">
                {salles.map((s) => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Nouvelle salle depuis un modèle">
              {MODELES_SALLE.map((m) => (
                <option key={m.key} value={`tpl:${m.key}`}>{m.nom}</option>
              ))}
            </optgroup>
          </select>
        </label>
        {salleChoix.startsWith('tpl:') ? (
          <ApercuModele cle={salleChoix.slice(4)} />
        ) : (
          <ApercuSalle id={salleChoix} />
        )}
        <div className="form-actions">
          <button type="button" onClick={onClose}>Annuler</button>
          <button className="primaire">Créer le plan</button>
        </div>
      </form>
    </Modal>
  )
}

function ApercuSalle({ id }: { id: string }) {
  const salle = useApp((s) => s.salles.find((x) => x.id === id))
  if (!salle) return null
  return (
    <figure className="apercu">
      <SalleSvg salle={salle} />
    </figure>
  )
}
