import { newClasse, newEleve, type Classe, type Eleve, type Feu } from './types'

const ELEVES: [string, string][] = [
  ['Emma', 'Martin'], ['Lucas', 'Bernard'], ['Léa', 'Dubois'], ['Hugo', 'Thomas'],
  ['Chloé', 'Robert'], ['Louis', 'Richard'], ['Inès', 'Petit'], ['Gabriel', 'Durand'],
  ['Jade', 'Leroy'], ['Arthur', 'Moreau'], ['Manon', 'Simon'], ['Jules', 'Laurent'],
  ['Camille', 'Lefebvre'], ['Raphaël', 'Michel'], ['Sarah', 'Garcia'], ['Nathan', 'David'],
  ['Zoé', 'Bertrand'], ['Adam', 'Roux'], ['Lina', 'Vincent'], ['Tom', 'Fournier'],
  ['Alice', 'Morel'], ['Noah', 'Girard'], ['Louise', 'André'], ['Ethan', 'Lefèvre'],
  ['Juliette', 'Mercier'], ['Maël', 'Dupont'], ['Anaïs', 'Lambert'], ['Yanis', 'Bonnet'],
]

/** Répartition réaliste : 1-2 rouges, 5-6 oranges, le reste vert (réduite si la classe est petite). */
export function feuxAleatoires(n: number, rng = Math.random): Feu[] {
  const rouges = Math.min(n, 1 + Math.floor(rng() * 2))
  const oranges = Math.min(n - rouges, 5 + Math.floor(rng() * 2))
  const feux: Feu[] = [
    ...Array<Feu>(rouges).fill('rouge'),
    ...Array<Feu>(oranges).fill('orange'),
    ...Array<Feu>(n - rouges - oranges).fill('vert'),
  ]
  for (let i = feux.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[feux[i], feux[j]] = [feux[j], feux[i]]
  }
  return feux
}

/** Applique une répartition aléatoire aux élèves (les AESH sont ignorés). */
export function melangerFeux(eleves: Eleve[], rng = Math.random): Eleve[] {
  const cibles = eleves.filter((e) => e.role === 'eleve')
  const feux = feuxAleatoires(cibles.length, rng)
  const par = new Map(cibles.map((e, i) => [e.id, feux[i]]))
  return eleves.map((e) => (par.has(e.id) ? { ...e, feu: par.get(e.id)! } : e))
}

/** Classe fictive de 28 élèves pour essayer l'application. */
export function classeDemo(): Classe {
  const c = newClasse('Classe de test (28 élèves)')
  const FILLES = new Set(['Alice', 'Anaïs', 'Camille', 'Chloé', 'Emma', 'Inès', 'Jade', 'Juliette', 'Lina', 'Louise', 'Léa', 'Manon', 'Sarah', 'Zoé'])
  c.eleves = ELEVES.map(([prenom, nom]) => ({ ...newEleve(prenom, nom), genre: FILLES.has(prenom) ? 'fille' : 'garcon' }))
  c.eleves = melangerFeux(c.eleves)
  // Quelques annotations pour essayer : 2-3 PAP, 1-2 DYS, 1 PAI.
  const ordre = c.eleves.map((_, i) => i).sort(() => Math.random() - 0.5)
  const pose = (label: string, n: number) => ordre.splice(0, n).forEach((i) => c.eleves[i].annotations.push(label))
  pose('PAP', 2 + Math.floor(Math.random() * 2))
  pose('DYS', 1 + Math.floor(Math.random() * 2))
  pose('PAI', 1)
  return c
}
