import type { Gender } from '../model/types'

/** Two buttons, one click to choose; clicking the chosen one again clears it. */
export function GenderPicker({
  value,
  onChange,
}: {
  value: Gender | undefined
  onChange(gender: Gender | undefined): void
}) {
  return (
    <div className="gender-picker" role="radiogroup" aria-label="Genre">
      {(['girl', 'boy'] as const).map((gender) => (
        <button
          key={gender}
          role="radio"
          aria-checked={value === gender}
          className={value === gender ? 'active' : ''}
          onClick={() => onChange(value === gender ? undefined : gender)}
        >
          {gender === 'girl' ? 'Fille' : 'Garçon'}
        </button>
      ))}
    </div>
  )
}
