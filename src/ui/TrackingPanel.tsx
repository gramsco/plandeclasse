import { PLAN_STATUS_LABELS, type Plan, type PlanStatus } from '../model/types'
import { useApp } from '../store'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')

/** Status, notes and sibling hypotheses of a plan. */
export function TrackingPanel({ plan }: { plan: Plan }) {
  const { plans, classes, duplicatePlan, setStatus, setNotes, selectPlan } = useApp()
  const siblings = plans.filter((p) => p.classId === plan.classId)
  const parent = plan.parentId ? plans.find((p) => p.id === plan.parentId) : undefined
  const schoolClass = classes.find((c) => c.id === plan.classId)

  return (
    <>
      <h3>Statut de cette hypothèse</h3>
      <select value={plan.status} onChange={(e) => setStatus(plan.id, e.target.value as PlanStatus)}>
        {(Object.keys(PLAN_STATUS_LABELS) as PlanStatus[]).map((status) => (
          <option key={status} value={status}>
            {PLAN_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <p className="hint">
        Créé le {formatDate(plan.createdAt)}
        {plan.testingSince && ` · en test depuis le ${formatDate(plan.testingSince)}`}
        {parent && (
          <>
            {' '}
            · dérivé de{' '}
            <button className="link-button" onClick={() => selectPlan(parent.id)}>
              {parent.name}
            </button>
          </>
        )}
      </p>
      <h3>Observations</h3>
      <textarea
        rows={6}
        value={plan.notes}
        placeholder="Ce que ça donne dans la vraie classe : bavardages, élèves à changer…"
        onChange={(e) => setNotes(plan.id, e.target.value)}
      />
      <button className="primary" onClick={() => duplicatePlan(plan.id)}>
        Essayer autre chose : nouvelle hypothèse à partir de celle-ci
      </button>

      <h3>
        Hypothèses pour {schoolClass?.name} <small>{siblings.length}</small>
      </h3>
      <ul className="hypotheses">
        {siblings.map((p) => (
          <li key={p.id}>
            <button className={p.id === plan.id ? 'active' : ''} onClick={() => selectPlan(p.id)}>
              <span className={`status status-${p.status}`}>{PLAN_STATUS_LABELS[p.status]}</span> {p.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
