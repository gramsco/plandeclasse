import { useState } from 'react'
import { PLAN_STATUS_LABELS } from '../model/types'
import { useApp } from '../store'
import { askConfirm, askText } from './ask'
import { NewClassDialog, NewPlanDialog, NewRoomDialog } from './dialogs'
import { ListNav } from './ListNav'
import { PlanEditor } from './PlanEditor'

type Dialog = 'plan' | 'class' | 'room'

export function PlansView() {
  const { plans, currentPlanId, selectPlan, renamePlan, deletePlan, classes, rooms, setView } = useApp()
  const [dialog, setDialog] = useState<Dialog>()
  const plan = plans.find((p) => p.id === currentPlanId)
  const schoolClass = plan && classes.find((c) => c.id === plan.classId)
  const room = plan && rooms.find((r) => r.id === plan.roomId)

  return (
    <>
      <div className="toolbar no-print">
        <button className="primary" onClick={() => setDialog('plan')}>
          + Nouveau plan
        </button>
        {plan && (
          <>
            <button
              onClick={async () => {
                const name = await askText('Renommer le plan', 'Nouveau nom', plan.name)
                if (name) renamePlan(plan.id, name)
              }}
            >
              Renommer
            </button>
            <button
              className="danger"
              onClick={async () => {
                const confirmed = await askConfirm(`Supprimer le plan « ${plan.name} » ?`, {
                  confirmLabel: 'Supprimer',
                })
                if (confirmed) deletePlan(plan.id)
              }}
            >
              Supprimer
            </button>
            <span className="info">
              Classe : <b>{schoolClass?.name}</b> · Salle : <b>{room?.name}</b>
            </span>
          </>
        )}
      </div>
      {plans.length > 0 && (
        <ListNav
          horizontal
          label="Plans"
          currentId={currentPlanId}
          onSelect={selectPlan}
          items={plans.map((p) => ({
            id: p.id,
            label: p.status === 'adopted' ? `✓ ${p.name}` : p.name,
            detail: p.status === 'adopted' ? undefined : PLAN_STATUS_LABELS[p.status],
          }))}
        />
      )}
      <main className="wide">
        {plan && schoolClass && room ? (
          <PlanEditor key={plan.id} plan={plan} schoolClass={schoolClass} room={room} />
        ) : (
          <div className="welcome">
            <h2>Que voulez-vous faire aujourd'hui ?</h2>
            <p>
              Un <b>plan</b> place une <b>classe</b> (vos élèves) dans une <b>salle</b> (le lieu).
            </p>
            <div className="welcome-actions">
              <button className="primary big" onClick={() => setDialog('plan')}>
                Créer un plan de classe
              </button>
              <button className="big" onClick={() => setDialog('class')}>
                Ajouter une classe
              </button>
              <button className="big" onClick={() => setDialog('room')}>
                Ajouter une salle
              </button>
            </div>
            <p>
              <button className="link-button" onClick={() => setView('help')}>
                Lire le guide d'utilisation
              </button>
            </p>
          </div>
        )}
      </main>
      {dialog === 'plan' && <NewPlanDialog onClose={() => setDialog(undefined)} />}
      {dialog === 'class' && <NewClassDialog onClose={() => setDialog(undefined)} />}
      {dialog === 'room' && <NewRoomDialog onClose={() => setDialog(undefined)} />}
    </>
  )
}
