import { useState } from 'react'
import type { Alert } from '../model/analysis'
import {
  fullName,
  isAesh,
  TRAFFIC_LIGHTS,
  TRAFFIC_LIGHT_COLOR_NAMES as COLOR_NAME,
  type Plan,
  type Rule,
  type SchoolClass,
  type Student,
  type TrafficLight,
} from '../model/types'
import { useApp } from '../store'

function describeRule(rule: Rule, byId: Map<string, Student>) {
  const name = (id: string) => (byId.get(id) ? fullName(byId.get(id)!) : '?')
  if (rule.type === 'separate') return `${name(rule.studentA)} ≠ ${name(rule.studentB)} (séparés)`
  if (rule.type === 'colors') return `${COLOR_NAME[rule.a]} ≠ ${COLOR_NAME[rule.b]} côte à côte`
  return `${name(rule.student)} devient ${COLOR_NAME[rule.becomes]} près de ${name(rule.near)}`
}

/** Alerts of the plan and the rules that produce them. */
export function RulesPanel({ plan, schoolClass, alerts }: { plan: Plan; schoolClass: SchoolClass; alerts: Alert[] }) {
  const { addRule, deleteRule } = useApp()
  const students = schoolClass.students.filter((s) => !isAesh(s))
  const byId = new Map(schoolClass.students.map((s) => [s.id, s]))
  const [type, setType] = useState<Rule['type']>('separate')
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [lightA, setLightA] = useState<TrafficLight>('red')
  const [lightB, setLightB] = useState<TrafficLight>('red')
  const [becomes, setBecomes] = useState<TrafficLight>('orange')

  const isValid = type === 'colors' || (first && second && first !== second)
  const submit = () => {
    if (!isValid) return
    if (type === 'separate') addRule(plan.id, { type, studentA: first, studentB: second })
    else if (type === 'colors') addRule(plan.id, { type, a: lightA, b: lightB })
    else addRule(plan.id, { type, student: first, near: second, becomes })
  }
  const studentSelect = (value: string, onChange: (id: string) => void, placeholder: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {students.map((s) => (
        <option key={s.id} value={s.id}>
          {fullName(s)}
        </option>
      ))}
    </select>
  )
  const lightSelect = (value: TrafficLight, onChange: (light: TrafficLight) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value as TrafficLight)}>
      {TRAFFIC_LIGHTS.map((light) => (
        <option key={light} value={light}>
          {COLOR_NAME[light]}
        </option>
      ))}
    </select>
  )

  return (
    <>
      <h3>
        Alertes <small>{alerts.length}</small>
      </h3>
      {alerts.length === 0 && <p className="hint">Aucune alerte ✔</p>}
      <ul className="alerts">
        {alerts.map((alert) => (
          <li key={alert.id} className={`alert ${alert.level}`}>
            {alert.message}
          </li>
        ))}
      </ul>

      <h3>Règles de ce plan</h3>
      <ul className="rules">
        {plan.rules.map((rule) => (
          <li key={rule.id}>
            <span>{describeRule(rule, byId)}</span>
            <button className="danger" aria-label="Supprimer la règle" onClick={() => deleteRule(plan.id, rule.id)}>
              ✕
            </button>
          </li>
        ))}
        {plan.rules.length === 0 && <li className="hint">Aucune règle.</li>}
      </ul>

      <div className="rule-form">
        <select value={type} onChange={(e) => setType(e.target.value as Rule['type'])}>
          <option value="separate">Séparer deux élèves</option>
          <option value="colors">Couleurs à ne pas rapprocher</option>
          <option value="influence">Un élève change de couleur près d'un autre</option>
        </select>
        {type === 'separate' && (
          <>
            {studentSelect(first, setFirst, 'Élève 1…')}
            {studentSelect(second, setSecond, 'Élève 2…')}
          </>
        )}
        {type === 'colors' && (
          <div className="row">
            {lightSelect(lightA, setLightA)}
            <span>avec</span>
            {lightSelect(lightB, setLightB)}
          </div>
        )}
        {type === 'influence' && (
          <>
            {studentSelect(first, setFirst, 'Cet élève…')}
            <div className="row">
              <span>devient</span>
              {lightSelect(becomes, setBecomes)}
            </div>
            {studentSelect(second, setSecond, 'près de…')}
          </>
        )}
        <button className="primary" disabled={!isValid} onClick={submit}>
          Ajouter la règle
        </button>
        <p className="hint">
          « Côte à côte » = erreur ; devant, derrière, diagonale ou de l'autre côté d'une allée = attention. L'influence
          joue côte à côte et devant/derrière.
        </p>
      </div>
    </>
  )
}
