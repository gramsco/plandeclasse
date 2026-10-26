# Plan de réalisation — Plan de classe

Basé sur `intent.md`. Application 100 % locale, sans backend, sans compte, sans réseau.

## 1. Choix techniques

| Sujet | Choix | Raison |
|---|---|---|
| Build | Vite + TypeScript | Démarrage rapide, build statique (`dist/` ouvrable en local) |
| UI | React + Zustand | État centralisé simple, persistance facile |
| Canvas | DOM/SVG + Pointer Events (pas de lib) | Drag and drop simple, impression nette, pas de dépendance |
| Stockage | **IndexedDB** : store `classes` (JSON) + store `photos` (Blobs, clé = id, « faux S3 ») ; `localStorage` seulement pour les préférences UI | Pas de limite 5 Mo, Blobs natifs, photos hors du JSON des classes |
| Fichier | JSON renommé `.classe` (import / export) | Sauvegarde et partage manuels |
| Impression | CSS `@media print` + `window.print()` (« Enregistrer en PDF ») | Zéro dépendance, photos incluses |
| Tests | Vitest (logique pure) + Playwright (parcours principaux) | |

Sécurité / RGPD : aucune requête réseau, pas de CDN, polices embarquées, CSP `default-src 'self'` dans `index.html`. Les photos ne quittent jamais le navigateur.

## 2. Modèle de données

Trois notions indépendantes : une **classe** (liste d'élèves), une **salle** (lieu physique avec ses tables), et un **plan** qui place une classe dans une salle. Une même classe peut avoir plusieurs plans (salles différentes), une même salle servir à plusieurs classes.

```ts
type Classe = { id; nom; eleves: Eleve[]; tags: Tag[]; regles: Regle[] };
type Eleve  = { id; prenom; nom; photoId?: string /* Blob dans le store `photos` */; tagIds: string[] };
type Salle  = { id; nom; largeur; hauteur; grille; meubles: Meuble[] };
type Meuble = { id; type: "individuelle"|"double"|"ilot"|"prof"; x; y; rotation: 0|90|180|270; largeur; hauteur; places: Place[] };
type Place  = { id; dx; dy };                                   // décalage depuis le centre de la table
type Plan   = { id; nom; classeId; salleId; affectations: Record<placeId, eleveId> };
type Regle  = { id; eleveA; eleveB; severite: "forte"|"faible" }; // côte à côte = forte, devant/derrière = faible
```

Modèles de salle fournis (création en un clic) : tables doubles 24/30 places, îlots de 4, tables individuelles, en U, salle vide. À la création d'une classe : nombre d'élèves « Élève 1… » à renommer, ou coller une liste.

Point clé (« on aime » de plandeclasse.ca) : élèves et tables sont **découplés** — dans un plan on déplace les élèves sans bouger les tables ; les tables se déplacent dans l'éditeur de salle.

## 3. Jalons

### Jalon 0 — Socle
- Init Vite/React/TS, lint, Vitest, CSP, structure `src/{model,store,ui,print,io}`.
- Couche `storage` (interface `Storage` : `loadClasses/saveClass/deleteClass/putPhoto/getPhoto/deletePhoto`) implémentée sur IndexedDB, wrapper maison sans dépendance ; implémentation en mémoire pour les tests.
- Store Zustand + sauvegarde auto (debounce) via cette couche + migration par `version`.
- `navigator.storage.persist()` demandé au démarrage pour éviter l'éviction par le navigateur.

### Jalon 1 — Classes et élèves
- Créer / renommer / dupliquer / supprimer une classe ; sélecteur de classe.
- Liste d'élèves : ajout prénom/nom, édition, suppression, import en masse (coller une liste de noms).
- Photo : sélection de fichier ou glisser-déposer, recadrage carré, redimensionnement ~200 px, JPEG qualité 0.8 (≈ 10–20 Ko), stockée en Blob dans IndexedDB ; affichage via `URL.createObjectURL` (cache + révocation).
- Photos orphelines (élève supprimé) nettoyées à la sauvegarde.
- Afficher l'espace utilisé (`navigator.storage.estimate()`).

### Jalon 2 — Salle et placement
- Canvas de salle : ajouter table (individuelle, double, îlot de 4, bureau prof), déplacer, pivoter, redimensionner.
- Magnétisme semi-souple : accroche à la grille et aux bords des autres tables sous un seuil (~8 px), désactivable avec `Alt`.
- Glisser un élève de la liste (ou d'une place) vers une place ; échange si place occupée ; zone « non placés ».
- Annuler / rétablir (pile d'historique dans le store), sélection multiple, zoom/pan.

### Jalon 3 — Tags et règles de non-proximité
- Tags colorés (groupes de niveau, rôles, etc.) ; filtre et surlignage par tag.
- Règles « A ne doit pas être près de B » : voisin de côté = conflit fort, devant/derrière = conflit faible (pondération, niveau de sévérité par règle).
- Détection en direct : liens rouges entre élèves en conflit, panneau listant les violations.
- Option « placement aléatoire / auto » respectant les règles (backtracking simple, avec message si impossible).

### Jalon 4 — Impression
- Vue d'impression : plan à l'échelle de la page A4 paysage, photos + noms, légende des tags.
- Options : photos oui/non, prénom seul ou complet, orientation (vue enseignant / vue élèves = rotation 180°).
- Export PDF via la boîte d'impression ; test sur Chrome et Firefox.

### Jalon 5 — Fichiers `.classe`
- Export d'une classe ou de toutes (JSON, extension `.classe`, photos incluses en base64 (Blob → base64 à l'export, inverse à l'import)).
- Import avec validation de schéma (zod) et gestion de version ; fusion ou remplacement au choix.
- Rappel de sauvegarde (IndexedDB peut être vidé par le navigateur ou l'utilisateur).

### Jalon 6 — Finition
- Design soigné (réponse au « c'est moche ») : palette sobre, typographie lisible, états hover/focus, mode sombre optionnel.
- Raccourcis clavier, accessibilité de base (focus, contrastes, alternative clavier au drag).
- README : lancer en local (`npm run dev` / `npm run build` puis ouvrir `dist/`), sauvegarde, vie privée.

## 4. Tests
- **Unitaires** : magnétisme, détection de conflits, placement auto, (dé)sérialisation `.classe`, migrations.
- **E2E** (Playwright) : créer classe → ajouter élèves + photo → placer → règle violée visible → export/import → impression (aperçu).

## 5. Risques et décisions ouvertes
- **Stockage (décidé)** : IndexedDB pour tout (classes + photos en Blobs). Risque : données liées à l'origine (`localhost:port` ≠ autre port) → garder un port fixe, et l'export `.classe` reste la vraie sauvegarde.
- **Proximité (décidé)** : à côté = le plus proche (conflit fort) ; devant/derrière = proche aussi mais moins (conflit faible). Pas de rayon en cm.
- **Forme des tables** : rectangles uniquement au départ, pas de formes libres.
- **Multi-appareils** : hors périmètre, le transfert passe par le fichier `.classe`.
- **Livraison (décidé)** : build statique lancé en local (`npm run build` + serveur local), éventuellement hébergeur simple plus tard. Pas de fichier HTML unique pour l'instant.

## 6. Ordre de livraison conseillé
J0 → J1 → J2 (premier MVP utilisable) → J5 (ne pas perdre ses données) → J4 (impression) → J3 → J6.

---

# V2 (voir `v2.md`)

## État de la V1
Fait : socle IndexedDB, classes / salles / plans, modèles de salle avec aperçu, éditeur de salle (aimantation), placement par glisser-déposer, impression, classe fictive.
Terminé en début de V2 : **import / export `.classe`** (J5). Les **tags** et les **règles** de la V1 sont remplacés par les mécanismes ci-dessous.

## Modèle V2

```ts
type Feu = "vert" | "orange" | "rouge";
type Eleve = { …; feu: Feu; role: "eleve" | "aesh"; accompagne: string[] /* ids des élèves suivis par un AESH */ };
type Regle =
  | { type: "separer";   eleveA; eleveB }                       // ne doivent pas être proches
  | { type: "couleurs";  a: Feu; b: Feu }                       // ex. rouge ≠ rouge
  | { type: "influence"; eleve; avec; devient: Feu };           // vert devient orange/rouge près de « avec »
type Plan = { …; regles: Regle[]; statut: "brouillon"|"en_test"|"retenu"|"abandonne"; notes: string; parentId?; creeLe; testeDepuis? };
```

- **AESH** : une personne de la classe avec `role: "aesh"`, liée à un ou plusieurs élèves. Elle occupe une place (table libre ou « chaise adulte »). Plan possible sans AESH placé, mais **alerte** : AESH non placé, ou trop loin d'un de ses élèves.
- **Feu tricolore** : couleur de base par élève ; la couleur *effective* dans un plan tient compte des règles d'influence. Bordure des cartes + pastille.
- **Proximité** (calculée dans le repère de la place, donc valable en U ou en îlots) : *à côté* (fort) ; *devant/derrière*, *diagonale*, *de l'autre côté d'une allée* (faibles). Les alertes sont en « erreur » pour le côte-à-côte, en « attention » sinon.
- **Règles par plan** : séparer deux élèves, couleurs incompatibles, influence. Se copient avec le plan.
- **Multi-sélection** (éditeur de salle) : Maj+clic, rectangle de sélection, Ctrl/Cmd+A, déplacement groupé aimanté, flèches, pivoter / dupliquer / supprimer en groupe.
- **Hypothèses** : un plan a un statut (brouillon → en test → retenu / abandonné), des notes d'observation, et « Nouvelle hypothèse à partir de celui-ci » le duplique (affectations + règles) en gardant le lien avec son parent.

## Étapes
1. Import / export `.classe` + normalisation des anciennes données.
2. Modèle V2 + moteur d'analyse (`model/analyse.ts`) testé.
3. Store : feu, AESH, règles, hypothèses, actions de groupe sur les tables.
4. UI classes : feu, AESH. UI plan : alertes, règles, suivi d'hypothèses. UI salle : multi-sélection.

---

# PWA, versions et migrations

- **PWA** (`vite-plugin-pwa`) : manifeste, icônes générées par `npm run icons` (`scripts/icons.mjs`), service worker qui met toute l'application en cache (hors ligne). Mode `prompt` : une nouvelle version n'est installée que sur clic (« Mettre à jour »), jamais en plein travail.
- **Version de l'application** : `version` de `package.json`, injectée (`__APP_VERSION__`), affichée en pied de page et écrite dans les fichiers exportés.
- **Version des données** (`src/model/migrations.ts`, `VERSION_DONNEES`) : commune à la base locale et aux fichiers `.classe`. Pour changer la structure : incrémenter `VERSION_DONNEES`, ajouter la migration `n → n+1` et, si besoin, compléter `normaliser*`.
  - Base locale : version stockée dans le store `meta`. Au démarrage, si elle est plus ancienne, une copie des données d'origine est gardée (`sauvegardeAvantMigration`), puis migrées et réécrites. Si elle est plus récente (ancien cache), l'application s'arrête sans rien modifier.
  - Fichiers : format ancien → migré à l'import ; format plus récent → refusé avec un message clair.
- **Structure IndexedDB** : tableau `MIGRATIONS_DB` dans `storage/indexeddb.ts` (une étape par version, jamais modifiée a posteriori).
