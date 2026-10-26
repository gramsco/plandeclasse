import { useRef, useState, type DragEvent } from 'react'
import { ANNOTATIONS_COURANTES, estAesh, nomComplet, parseListeEleves, type Classe, type Eleve } from '../model/types'
import { ajouterPhotosFictives } from '../storage/avatar'
import { redimensionnerPhoto } from '../storage/photo'
import { useApp } from '../store'
import { FeuPicker } from './FeuPicker'

const genres = (l: Eleve[]) => {
  const f = l.filter((e) => e.genre === 'fille').length
  const g = l.filter((e) => e.genre === 'garcon').length
  return f + g > 0 ? ` (${f} filles, ${g} garçons)` : ''
}

export function ElevesPanel({ classe }: { classe: Classe }) {
  const { ajouterEleve, ajouterAesh, ajouterEleves, feuxAleatoires } = useApp()
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [masse, setMasse] = useState(false)
  const [texte, setTexte] = useState('')
  const eleves = classe.eleves.filter((e) => !estAesh(e))
  const aesh = classe.eleves.filter(estAesh)

  const soumettre = (ajout: (p: string, n: string) => void) => {
    if (!prenom.trim()) return
    ajout(prenom.trim(), nom.trim())
    setPrenom('')
    setNom('')
  }

  return (
    <section className="eleves">
      <h2>
        {classe.nom} <small>{eleves.length} élèves{genres(eleves)}{aesh.length > 0 && ` · ${aesh.length} AESH`}</small>
      </h2>
      <form className="ajout" onSubmit={(e) => { e.preventDefault(); soumettre(ajouterEleve) }}>
        <input placeholder="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
        <input placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        <button type="submit">Ajouter un élève</button>
        <button type="button" onClick={() => soumettre(ajouterAesh)} title="Ajoute une personne qui accompagne un ou plusieurs élèves">
          Ajouter un AESH
        </button>
        <button type="button" onClick={() => setMasse(!masse)}>Coller une liste</button>
        <button type="button" onClick={() => confirm('Remplacer les feux de tous les élèves par une répartition aléatoire ?') && feuxAleatoires()} title="1-2 rouges, 5-6 oranges, le reste vert (pour tester)">
          Feux aléatoires
        </button>
        <button type="button" onClick={() => void ajouterPhotosFictives(classe.id)} title="Dessine un visage pour chaque personne sans photo (pour tester)">
          Photos fictives
        </button>
      </form>
      {masse && (
        <div className="masse">
          <textarea rows={6} placeholder={'Une ligne par élève\nPrénom Nom  ou  Nom, Prénom'} value={texte} onChange={(e) => setTexte(e.target.value)} />
          <button onClick={() => { ajouterEleves(parseListeEleves(texte)); setTexte(''); setMasse(false) }}>Importer</button>
        </div>
      )}
      <ul className="grille-eleves">
        {eleves.map((e) => <EleveCarte key={e.id} eleve={e} classe={classe} />)}
      </ul>
      {aesh.length > 0 && (
        <>
          <h3>AESH</h3>
          <ul className="grille-eleves">
            {aesh.map((e) => <EleveCarte key={e.id} eleve={e} classe={classe} />)}
          </ul>
        </>
      )}
    </section>
  )
}

function EleveCarte({ eleve, classe }: { eleve: Eleve; classe: Classe }) {
  const { photoUrls, modifierEleve, supprimerEleve, definirPhoto, retirerPhoto, definirFeu, definirGenre, definirAccompagnes, basculerAnnotation } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const url = eleve.photoId ? photoUrls[eleve.photoId] : undefined
  const aesh = estAesh(eleve)

  const recevoir = async (file?: File) => {
    if (!file?.type.startsWith('image/')) return
    await definirPhoto(eleve.id, await redimensionnerPhoto(file))
  }
  const onDrop = (ev: DragEvent) => {
    ev.preventDefault()
    void recevoir(ev.dataTransfer.files[0])
  }
  const suivis = eleve.accompagne.map((id) => classe.eleves.find((x) => x.id === id)).filter(Boolean) as Eleve[]

  return (
    <li className={`carte ${aesh ? 'carte-aesh' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <button className="photo" title="Choisir une photo (ou glisser un fichier)" onClick={() => input.current?.click()}>
        {url ? <img src={url} alt="" /> : <span>📷</span>}
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void recevoir(e.target.files?.[0])} />
      <input aria-label="Prénom" value={eleve.prenom} onChange={(e) => modifierEleve(eleve.id, { prenom: e.target.value })} />
      <input aria-label="Nom" value={eleve.nom} onChange={(e) => modifierEleve(eleve.id, { nom: e.target.value })} />
      {aesh ? (
        <details className="accompagne">
          <summary>
            {suivis.length ? `Accompagne : ${suivis.map((s) => s.prenom).join(', ')}` : 'Choisir les élèves accompagnés'}
          </summary>
          <div className="liste-coches">
            {classe.eleves.filter((x) => !estAesh(x)).map((x) => (
              <label key={x.id} className="coche">
                <input
                  type="checkbox"
                  checked={eleve.accompagne.includes(x.id)}
                  onChange={(ev) =>
                    definirAccompagnes(eleve.id, ev.target.checked ? [...eleve.accompagne, x.id] : eleve.accompagne.filter((i) => i !== x.id))
                  }
                />
                {nomComplet(x)}
              </label>
            ))}
          </div>
        </details>
      ) : (
        <>
          <div className="genre-picker" role="radiogroup" aria-label="Genre">
            {(['fille', 'garcon'] as const).map((g) => (
              <button
                key={g}
                role="radio"
                aria-checked={eleve.genre === g}
                className={eleve.genre === g ? 'actif' : ''}
                onClick={() => definirGenre(eleve.id, eleve.genre === g ? undefined : g)}
              >
                {g === 'fille' ? 'Fille' : 'Garçon'}
              </button>
            ))}
          </div>
          <FeuPicker value={eleve.feu} onChange={(f) => definirFeu(eleve.id, f)} />
        </>
      )}
      {!aesh && (
        <div className="annotations">
          {eleve.annotations.map((a) => (
            <button key={a} className="chip" title={`${ANNOTATIONS_COURANTES[a] ?? a} — cliquer pour retirer`} onClick={() => basculerAnnotation(eleve.id, a)}>
              {a} ✕
            </button>
          ))}
          <select
            aria-label="Ajouter une annotation"
            value=""
            onChange={(e) => {
              const v = e.target.value === '__autre' ? prompt('Annotation ?')?.trim().toUpperCase() : e.target.value
              if (v && !eleve.annotations.includes(v)) basculerAnnotation(eleve.id, v)
            }}
          >
            <option value="">+ Annotation</option>
            {Object.entries(ANNOTATIONS_COURANTES).filter(([k]) => !eleve.annotations.includes(k)).map(([k, v]) => (
              <option key={k} value={k}>{k} — {v}</option>
            ))}
            <option value="__autre">Autre…</option>
          </select>
        </div>
      )}
      <div className="actions">
        {url && <button onClick={() => retirerPhoto(eleve.id)}>Retirer la photo</button>}
        <button className="danger" onClick={() => supprimerEleve(eleve.id)}>Supprimer</button>
      </div>
    </li>
  )
}
