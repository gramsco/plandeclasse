/** Shapes of the neutral avatar (a head and shoulders) in a 100×100 circle. */
export function NeutralAvatarShapes() {
  return (
    <>
      <circle cx={50} cy={50} r={50} className="neutral-bg" />
      <circle cx={50} cy={40} r={17} className="neutral-body" />
      <path d="M17.5 88 C20 66 38 62 50 62 C62 62 80 66 82.5 88 A50 50 0 0 1 17.5 88 Z" className="neutral-body" />
    </>
  )
}

/** Shown instead of a photo when a person has none. */
export function NeutralAvatar() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="neutral-avatar">
      <NeutralAvatarShapes />
    </svg>
  )
}

/** The crown that marks a class representative (gold) or their deputy (silver), drawn at the origin (16×10). */
export function CrownShape({ silver = false }: { silver?: boolean }) {
  return <path d="M0 10 L1 1 L5 5 L8 0 L11 5 L15 1 L16 10 Z" className={silver ? 'crown crown-silver' : 'crown'} />
}
