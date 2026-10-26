import { TRAFFIC_LIGHTS, TRAFFIC_LIGHT_LABELS, type TrafficLight } from '../model/types'

export function TrafficLightPicker({ value, onChange }: { value: TrafficLight; onChange(light: TrafficLight): void }) {
  return (
    <div className="light-picker" role="radiogroup" aria-label="Feu tricolore">
      {TRAFFIC_LIGHTS.map((light) => (
        <button
          key={light}
          role="radio"
          aria-checked={value === light}
          title={TRAFFIC_LIGHT_LABELS[light]}
          className={`light light-${light} ${value === light ? 'active' : ''}`}
          onClick={() => onChange(light)}
        />
      ))}
    </div>
  )
}
