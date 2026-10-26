import { useState } from 'react'
import { useApp } from '../store'
import { NouvelleClasseDialog } from './dialogs'
import { ElevesPanel } from './ElevesPanel'

export function ClassesView() {
  const { classes, courante, choisirClasse, renommerClasse, dupliquerClasse, supprimerClasse, plans } = useApp()
  const [dialog, setDialog] = useState(false)
  const classe = classes.find((c) => c.id === courante)
  const nbPlans = plans.filter((p) => p.classeId === courante).length

  return (
    <>
      <div className="sous-bar">
        <select value={courante ?? ''} onChange={(e) => choisirClasse(e.target.value)} disabled={!classes.length}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <button onClick={() => setDialog(true)}>+ Nouvelle classe</button>
        {classe && (
          <>
            <button onClick={() => { const n = prompt('Nouveau nom ?', classe.nom)?.trim(); if (n) renommerClasse(classe.id, n) }}>Renommer</button>
            <button onClick={() => void dupliquerClasse(classe.id)}>Dupliquer</button>
            <button className="danger" onClick={() =>
              confirm(`Supprimer « ${classe.nom} », ses photos et ${nbPlans} plan(s) ?`) && supprimerClasse(classe.id)}>Supprimer</button>
          </>
        )}
      </div>
      <main>
        {classe ? <ElevesPanel classe={classe} /> : <p className="vide">Aucune classe. Créez-en une pour saisir vos élèves.</p>}
      </main>
      {dialog && <NouvelleClasseDialog onClose={() => setDialog(false)} />}
    </>
  )
}
