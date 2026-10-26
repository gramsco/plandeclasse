import { useState } from 'react'
import { LIBELLE_STATUT } from '../model/types'
import { useApp } from '../store'
import { NouveauPlanDialog } from './dialogs'
import { PlanEditor } from './PlanEditor'

export function PlansView() {
  const { plans, planCourant, choisirPlan, renommerPlan, supprimerPlan, classes, salles, setVue } = useApp()
  const [dialog, setDialog] = useState(false)
  const plan = plans.find((p) => p.id === planCourant)
  const classe = plan && classes.find((c) => c.id === plan.classeId)
  const salle = plan && salles.find((s) => s.id === plan.salleId)

  return (
    <>
      <div className="sous-bar no-print">
        <select value={planCourant ?? ''} onChange={(e) => choisirPlan(e.target.value)} disabled={!plans.length}>
          {plans.map((p) => <option key={p.id} value={p.id}>[{LIBELLE_STATUT[p.statut]}] {p.nom}</option>)}
        </select>
        <button className="primaire" onClick={() => setDialog(true)}>+ Nouveau plan</button>
        {plan && (
          <>
            <button onClick={() => { const n = prompt('Nouveau nom ?', plan.nom)?.trim(); if (n) renommerPlan(plan.id, n) }}>Renommer</button>
            <button className="danger" onClick={() => confirm(`Supprimer le plan « ${plan.nom} » ?`) && supprimerPlan(plan.id)}>Supprimer</button>
            <span className="info">Classe : <b>{classe?.nom}</b> · Salle : <b>{salle?.nom}</b></span>
          </>
        )}
      </div>
      <main className="large">
        {plan && classe && salle ? (
          <PlanEditor key={plan.id} plan={plan} classe={classe} salle={salle} />
        ) : (
          <div className="accueil">
            <h2>Bienvenue 👋</h2>
            <p>Un <b>plan</b> place une <b>classe</b> (vos élèves) dans une <b>salle</b> (le lieu).</p>
            <p>Choisissez un modèle de salle, indiquez le nombre d'élèves, et c'est prêt à remplir.</p>
            <button className="primaire grand" onClick={() => setDialog(true)}>Créer mon premier plan</button>
            <p><button className="lien" onClick={() => setVue('aide')}>Lire le guide d'utilisation</button></p>
          </div>
        )}
      </main>
      {dialog && <NouveauPlanDialog onClose={() => setDialog(false)} />}
    </>
  )
}
