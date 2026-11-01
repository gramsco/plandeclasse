/** Moves the item `fromId` to the position of `toId` (the others shift), as when dropping it on that item. */
export function moveItem<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
  const from = items.findIndex((x) => x.id === fromId)
  const to = items.findIndex((x) => x.id === toId)
  if (from < 0 || to < 0 || from === to) return items
  const result = [...items]
  const [moved] = result.splice(from, 1)
  result.splice(to, 0, moved)
  return result
}

/** Sorts by a saved list of ids; items missing from it keep their relative order, after the others. */
export function sortByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const rank = (x: T) => {
    const i = ids.indexOf(x.id)
    return i < 0 ? ids.length : i
  }
  return [...items].sort((a, b) => rank(a) - rank(b))
}

/** Plans follow the order of their classes (stable: plans of the same class keep their own order). */
export function sortPlansByClass<P extends { classId: string }>(plans: P[], classes: { id: string }[]): P[] {
  const rank = (p: P) => {
    const i = classes.findIndex((c) => c.id === p.classId)
    return i < 0 ? classes.length : i
  }
  return [...plans].sort((a, b) => rank(a) - rank(b))
}
