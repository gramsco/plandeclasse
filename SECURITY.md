# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir de ticket public pour une faille de sécurité.
Utilisez le signalement privé de GitHub : onglet **Security** → **Report a vulnerability**
(<https://github.com/gramsco/plandeclasse/security/advisories/new>).

Merci de décrire ce que vous avez constaté, comment le reproduire, et l'impact que vous imaginez.

## Versions prises en charge

Seule la dernière version publiée (https://gramsco.github.io/plandeclasse/) reçoit des correctifs.

## Ce que l'application garantit — et ne garantit pas

- Les données (élèves, photos, annotations) restent dans le navigateur de l'utilisateur ; l'application n'envoie rien sur Internet, n'utilise aucune ressource externe, et une politique `Content-Security-Policy` l'impose au navigateur.
- Les données **ne sont pas chiffrées** et les fichiers `.classe` sont lisibles en clair : voir la section « Sécurité et confidentialité des données » du [guide d'utilisation](docs/guide.md).

## Contrôles automatisés

| Contrôle | Outil | Quand |
|---|---|---|
| Mises à jour des dépendances et des actions GitHub | Dependabot (délai de 5 jours avant adoption d'une nouvelle version) | chaque semaine |
| Alertes de vulnérabilités, correctifs de sécurité automatiques | Dependabot alerts / security updates | en continu |
| Vulnérabilités des dépendances, secrets, configuration | Trivy (échec sur HIGH/CRITICAL) | chaque push, PR, et chaque semaine |
| Analyse statique du code | CodeQL (`security-extended`) | chaque push, PR |
| Dépendances ajoutées par une PR | Dependency Review | chaque PR |
| Secrets committés | Secret scanning + push protection (GitHub), Trivy | en continu |
| Signatures et provenance des paquets npm | `npm audit signatures` | chaque exécution du CI |
| Vulnérabilités connues en production | `npm audit --omit=dev` | chaque exécution du CI |
| Bonnes pratiques de la chaîne de livraison | OpenSSF Scorecard | chaque semaine |

Mesures de durcissement : actions GitHub épinglées par empreinte de commit, permissions minimales par job, jetons non conservés (`persist-credentials: false`), scripts d'installation npm désactivés (`ignore-scripts=true`).
