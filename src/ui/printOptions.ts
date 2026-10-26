/** What appears on the printed plan (and on screen in "preview" mode). */
export type PrintOptions = {
  photos: boolean
  firstNames: boolean
  lastNames: boolean
  colors: boolean
  annotations: boolean
  gender: boolean
  delegate: boolean
}

export const FULL_OPTIONS: PrintOptions = {
  photos: true,
  firstNames: true,
  lastNames: true,
  colors: true,
  annotations: true,
  gender: true,
  delegate: true,
}

/** The "neutral" version: photos and names only, safe to display in the classroom. */
export const NEUTRAL_OPTIONS: PrintOptions = { ...FULL_OPTIONS, colors: false, annotations: false, gender: false }

export const PRINT_OPTION_LABELS: Record<keyof PrintOptions, string> = {
  photos: 'Photos',
  firstNames: 'Prénoms',
  lastNames: 'Noms',
  colors: 'Couleurs (feu tricolore, AESH)',
  annotations: 'Annotations (PAP…)',
  gender: 'Genre (F / G)',
  delegate: 'Délégués et suppléants (couronnes)',
}

const STORAGE_KEY = 'printOptions'
const LEGACY_STORAGE_KEY = 'optionsImpression'

export function loadPrintOptions(): PrintOptions {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? '{}'
    return { ...FULL_OPTIONS, ...pickKnownOptions(JSON.parse(stored)) }
  } catch {
    return FULL_OPTIONS
  }
}

export const savePrintOptions = (options: PrintOptions) => localStorage.setItem(STORAGE_KEY, JSON.stringify(options))

/**
 * Options saved by older releases used French keys: translate them so that users keep their choices.
 */
function pickKnownOptions(stored: Record<string, unknown>): Partial<PrintOptions> {
  const legacy = new Map<string, keyof PrintOptions>([
    ['prenoms', 'firstNames'],
    ['noms', 'lastNames'],
    ['couleurs', 'colors'],
    ['genre', 'gender'],
  ])
  const result: Partial<PrintOptions> = {}
  for (const [key, value] of Object.entries(stored)) {
    const name = (legacy.get(key) ?? key) as keyof PrintOptions
    if (name in FULL_OPTIONS && typeof value === 'boolean') result[name] = value
  }
  return result
}

/** CSS classes of the plan canvas; the stylesheet hides the parts that are switched off. */
export const canvasClassName = (options: PrintOptions, flipped: boolean, preview: boolean) =>
  [
    'canvas-area',
    'plan-print',
    flipped && 'flipped',
    preview && 'preview-mode',
    !options.photos && 'hide-photo',
    !options.firstNames && 'hide-first-name',
    !options.lastNames && 'hide-last-name',
    !options.colors && 'hide-colors',
    !options.annotations && 'hide-annotations',
    !options.gender && 'hide-gender',
    !options.delegate && 'hide-delegate',
  ]
    .filter(Boolean)
    .join(' ')
