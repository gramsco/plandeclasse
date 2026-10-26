import { FEUX, LIBELLE_FEU, type Feu } from '../model/types'

export function FeuPicker({ value, onChange }: { value: Feu; onChange(f: Feu): void }) {
  return (
    <div className="feu-picker" role="radiogroup" aria-label="Feu tricolore">
      {FEUX.map((f) => (
        <button
          key={f}
          role="radio"
          aria-checked={value === f}
          title={LIBELLE_FEU[f]}
          className={`feu feu-${f} ${value === f ? 'actif' : ''}`}
          onClick={() => onChange(f)}
        />
      ))}
    </div>
  )
}
