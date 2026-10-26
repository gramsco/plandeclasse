import { useState } from 'react'
import { useApp } from '../store'
import { NouvelleSalleDialog } from './dialogs'
import { SalleEditor } from './SalleEditor'

export function SallesView() {
  const { salles, salleCourante, choisirSalle, renommerSalle, dupliquerSalle, supprimerSalle, plans } = useApp()
  const [dialog, setDialog] = useState(false)
  const salle = salles.find((s) => s.id === salleCourante)
  const nbPlans = plans.filter((p) => p.salleId === salleCourante).length

  return (
    <>
      <div className="sous-bar no-print">
        <select value={salleCourante ?? ''} onChange={(e) => choisirSalle(e.target.value)} disabled={!salles.length}>
          {salles.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
        <button onClick={() => setDialog(true)}>+ Nouvelle salle</button>
        {salle && (
          <>
            <button onClick={() => { const n = prompt('Nouveau nom ?', salle.nom)?.trim(); if (n) renommerSalle(salle.id, n) }}>Renommer</button>
            <button onClick={() => dupliquerSalle(salle.id)}>Dupliquer</button>
            <button className="danger" onClick={() =>
              confirm(`Supprimer « ${salle.nom} » et ${nbPlans} plan(s) qui l'utilisent ?`) && supprimerSalle(salle.id)}>Supprimer</button>
          </>
        )}
      </div>
      <main className="large">
        {salle ? <SalleEditor key={salle.id} salle={salle} /> : <p className="vide">Aucune salle. Créez-en une à partir d'un modèle.</p>}
      </main>
      {dialog && <NouvelleSalleDialog onClose={() => setDialog(false)} />}
    </>
  )
}
