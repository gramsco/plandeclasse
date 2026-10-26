import { describe, expect, it } from 'vitest'
import { checkSource } from './language-check.mjs'

const messages = (filename, source) => checkSource(filename, source).map((f) => f.message)

describe('language check', () => {
  it('accepts English code with French user-facing strings', () => {
    const source = `
      // Saves the class shortly after the last change.
      export function addStudent(firstName: string) {
        return <button title="Ajouter un élève">Supprimer</button>
      }
    `
    expect(checkSource('a.tsx', source)).toEqual([])
  })

  it('flags French comments', () => {
    expect(messages('a.ts', '// Sauvegarde la classe après le dernier changement\nconst x = 1')).toHaveLength(1)
    expect(messages('a.ts', '/* Retourne la liste des élèves */\nconst x = 1')).toHaveLength(1)
  })

  it('flags French identifiers, including inside camelCase and in object keys', () => {
    expect(messages('a.ts', 'const eleves = []')).toHaveLength(1)
    expect(messages('a.ts', 'function ajouterEleve() {}')).not.toHaveLength(0)
    expect(messages('a.ts', 'const x = { prenom: 1 }')).toHaveLength(1)
    expect(messages('a.ts', 'const élève = 1')).toHaveLength(1)
  })

  it('does not flag English words that look French', () => {
    expect(checkSource('a.ts', 'const classes = []; const table = 1; const plan = 2; const place = 3')).toEqual([])
  })

  it('flags French test titles but not English ones', () => {
    expect(messages('a.test.ts', "it('supprime les photos avec l\\'élève', () => {})")).toHaveLength(1)
    expect(messages('a.test.ts', "describe('plans et salles', () => {})")).toHaveLength(1)
    expect(checkSource('a.test.ts', "it('removes the photos with the student', () => {})")).toEqual([])
    expect(messages('a.test.ts', "it.each([1])('tient dans la salle', () => {})")).toHaveLength(1)
  })

  it('supports the escape hatches', () => {
    expect(checkSource('a.ts', 'const x = raw.salles // lang-ignore: legacy key')).toEqual([])
    expect(checkSource('a.ts', '/* lang-ignore-file: legacy data */\nconst { prenom } = old')).toEqual([])
    // ...but a French comment is still reported in an ignored file
    expect(messages('a.ts', '/* lang-ignore-file */\n// ceci est une erreur\nconst a = 1')).toHaveLength(1)
  })

  it('checks comments of CSS, YAML and shell files', () => {
    expect(messages('a.css', '/* Les élèves à placer */\n.a { color: red }')).toHaveLength(1)
    expect(checkSource('a.css', '/* Students to place */\n.a { color: red }')).toEqual([])
    expect(messages('a.yml', 'a: 1 # chaque lundi, pour la sécurité')).toHaveLength(1)
    expect(checkSource('a.yml', 'a: "du texte français" # every Monday')).toEqual([])
    expect(messages('pre-commit', '#!/bin/sh\n# vérifie le code avant de commiter\nexit 0')).toHaveLength(1)
  })
})
