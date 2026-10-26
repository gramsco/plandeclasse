# Plan de classe

Application web pour préparer des plans de classe : élèves avec photos, salles modulables, feu tricolore, AESH, règles de proximité, hypothèses à tester, impression. Tout reste dans le navigateur (aucun serveur, aucune donnée envoyée).

- **Utiliser** : https://gramsco.github.io/plandeclasse/
- **Guide d'utilisation** (installation, sécurité des données…) : [docs/guide.md](docs/guide.md)

## Sécurité

Voir [SECURITY.md](SECURITY.md) : signalement d'une faille et contrôles automatisés (Dependabot, Trivy, CodeQL, Scorecard).

## Développement

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # tests unitaires
npm run build        # build de production (PWA) dans dist/
npm run preview      # sert dist/ — nécessaire pour tester le service worker
npm run icons        # régénère les icônes PWA
npm run screenshots  # régénère les captures du guide (Google Chrome requis)
```

Voir `PLAN.md` pour l'architecture, le modèle de données et les règles de migration.
