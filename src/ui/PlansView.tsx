import { useState } from 'react'
import { PLAN_STATUS_LABELS } from '../model/types'
import { useApp } from '../store'
import { NewPlanDialog } from './dialogs'
import { PlanEditor } from './PlanEditor'

export function PlansView() {
  const { plans, currentPlanId, selectPlan, renamePlan, deletePlan, classes, rooms, setView } = useApp()
  const [dialogOpen, setDialogOpen] = useState(false)
  const plan = plans.find((p) => p.id === currentPlanId)
  const schoolClass = plan && classes.find((c) => c.id === plan.classId)
  const room = plan && rooms.find((r) => r.id === plan.roomId)

  return (
    <>
      <div className="toolbar no-print">
        <select value={currentPlanId ?? ''} onChange={(e) => selectPlan(e.target.value)} disabled={!plans.length}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              [{PLAN_STATUS_LABELS[p.status]}] {p.name}
            </option>
          ))}
        </select>
        <button className="primary" onClick={() => setDialogOpen(true)}>
          + Nouveau plan
        </button>
        {plan && (
          <>
            <button
              onClick={() => {
                const name = prompt('Nouveau nom ?', plan.name)?.trim()
                if (name) renamePlan(plan.id, name)
              }}
            >
              Renommer
            </button>
            <button
              className="danger"
              onClick={() => confirm(`Supprimer le plan « ${plan.name} » ?`) && deletePlan(plan.id)}
            >
              Supprimer
            </button>
            <span className="info">
              Classe : <b>{schoolClass?.name}</b> · Salle : <b>{room?.name}</b>
            </span>
          </>
        )}
      </div>
      <main className="wide">
        {plan && schoolClass && room ? (
          <PlanEditor key={plan.id} plan={plan} schoolClass={schoolClass} room={room} />
        ) : (
          <div className="welcome">
            <h2>Bienvenue 👋</h2>
            <p>
              Un <b>plan</b> place une <b>classe</b> (vos élèves) dans une <b>salle</b> (le lieu).
            </p>
            <p>Choisissez un modèle de salle, indiquez le nombre d'élèves, et c'est prêt à remplir.</p>
            <button className="primary big" onClick={() => setDialogOpen(true)}>
              Créer mon premier plan
            </button>
            <p>
              <button className="link-button" onClick={() => setView('help')}>
                Lire le guide d'utilisation
              </button>
            </p>
          </div>
        )}
      </main>
      {dialogOpen && <NewPlanDialog onClose={() => setDialogOpen(false)} />}
    </>
  )
}
