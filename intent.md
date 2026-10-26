# Plan de classe — Spécifications

Application permettant de préparer des plans de classe.

## Glossaire

| Terme | Définition |
|---|---|
| **Classe** | Liste d'élèves (nom, photo…), indépendante de tout lieu. |
| **Salle** | Lieu physique : tables, bureau, places. |
| **Plan** | Une classe placée dans une salle. |

## Spécifications fonctionnelles

### Élèves et classes

- **SF-01** — Il est possible d'associer une photo à chaque élève.
- **SF-02** — Il est possible de saisir le nom de chaque élève.
- **SF-03** — Il est possible de créer plusieurs classes.
- **SF-04** — Il est possible de regrouper les élèves (par étiquette).
- **SF-05** — À la création d'une classe, des modèles par défaut sont proposés pour qu'elle soit déjà prête à remplir.

### Salles

- **SF-10** — Il existe plusieurs salles ; une même salle peut servir à plusieurs classes, et une classe peut être placée dans plusieurs salles.
- **SF-11** — Il est possible de changer l'organisation d'une salle par glisser-déposer sur un canvas semi-magnétique (aimantation aux autres tables et à une grille, désactivable).
- **SF-12** — Des modèles de salle sont proposés à la création, avec un aperçu de leur forme avant validation.
- **SF-13** — Les tables doubles et les îlots distinguent visuellement les places qui sont en réalité des tables individuelles regroupées.

### Plans

- **SF-20** — Il est possible de placer les élèves sur les places d'une salle par glisser-déposer, **sans déplacer les tables**.
- **SF-21** — Il est possible de définir des règles de non-proximité entre élèves.
- **SF-22** — Il est possible d'imprimer le plan de classe (PDF ou autre), avec les photos.
- **SF-23** — L'utilisateur choisit ce qui apparaît à l'impression (photos, noms, couleurs, annotations…) et dispose d'une version « neutre » sans couleurs ni annotations.

## Spécifications de sécurité

- **SS-01** — Aucune donnée d'élève (noms, photos, annotations) n'est envoyée hors de l'appareil de l'utilisateur.
- **SS-02** — Aucun compte, aucun serveur, aucune base de données en ligne : pas de souci légal ni RGPD lié à un hébergement de données.
- **SS-03** — L'application n'utilise aucune ressource externe (pas de CDN, police ou script tiers) et le navigateur est empêché de contacter d'autres adresses que la sienne.
- **SS-04** — L'hébergement statique du code (sans aucune donnée) est toléré, à condition que les données restent exclusivement locales.
- **SS-05** — Les limites de sécurité (absence de chiffrement et de mot de passe, fichiers en clair, risques de perte) sont documentées pour l'utilisateur.

## Spécifications techniques

- **ST-01** — Toutes les données sont stockées localement dans le navigateur.
- **ST-02** — Il est possible d'enregistrer et de recharger ses données dans un fichier JSON portant l'extension « .classe ».
- **ST-03** — L'application fonctionne hors ligne et peut s'installer comme application (PWA).
- **ST-04** — Les formats de données et de fichiers sont versionnés ; les anciennes données et anciens fichiers sont migrés automatiquement, et les données plus récentes que l'application ne sont jamais modifiées.
- **ST-05** — Un guide d'utilisation (installation, utilisation, sécurité des données) est fourni et accessible dans l'application.

## Références

### [plandeclasse.ca](https://plandeclasse.ca/exemples.php)

- À conserver : les photos des élèves ; la possibilité de bouger les élèves sans bouger les tables.
- À éviter : dépendance à Internet, sécurité des données, interface peu soignée.

### [Ubisit](https://ubisit.forge.apps.education.fr/ubisit-plan-de-classe-aleatoire/)

- À éviter : interface peu ergonomique.
