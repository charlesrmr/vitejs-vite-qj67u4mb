# Pilot'Officine — MVP pilote

Pilot'Officine transforme des exports LGO en pré-analyse, puis organise une relecture humaine avant restitution d'un diagnostic court et actionnable.

## Parcours MVP

1. Création d'un compte titulaire / officine
2. Création d'un dossier
3. Dépôt des exports PDF / CSV / XLS / XLSX
4. Stockage privé des fichiers originaux
5. Lecture locale + mapping des colonnes
6. Pré-analyse et KPIs
7. Envoi du dossier pour relecture
8. Back-office opérateur
9. Relecture, correction et validation
10. Génération serveur du PDF final
11. Diagnostic disponible dans l'espace officine et téléchargeable

## Architecture

- Front : React + Vite
- Hébergement : Netlify
- Backend : Netlify Functions
- Données : Netlify Blobs, stores site-wide configurés en `eu-central-1`
- Authentification : email + mot de passe
- Mot de passe : dérivation `scrypt` avec sel individuel, jamais stocké en clair
- Sessions : token opaque aléatoire, empreinte stockée côté serveur, durée 30 jours
- Fichiers : upload chunké de 3 Mo ; limite serveur 25 Mo / fichier
- Isolation : les Deploy Previews utilisent des stores Blob séparés des données de production
- PDF : parseur PDF.js empaqueté avec l'application, sans chargement de code parser depuis un CDN
- Excel : SheetJS CE 0.20.3 depuis la source officielle SheetJS, en remplacement de l'ancien paquet npm 0.18.5 vulnérable
- Back-office : protégé par `PILOT_ADMIN_TOKEN`
- Restitution : PDF A4 généré côté serveur avec `pdf-lib`, stocké dans le dossier puis téléchargeable

## Configuration Netlify indispensable

Le front et les fonctions se déploient automatiquement avec `netlify.toml`.

Une seule variable sensible est obligatoire pour utiliser le back-office :

```
PILOT_ADMIN_TOKEN=<secret long et aléatoire>
```

La capacité du cercle fondateur est configurable avec :

```
PILOT_MAX_FOUNDERS=10
```

Si cette variable n'est pas définie, la limite est de 10 pharmacies ayant réellement envoyé au moins un dossier. La simple création d'un compte ne consomme pas de place.

Variables optionnelles pour les notifications transactionnelles :

```
RESEND_API_KEY=<clé d'envoi Resend>
PILOT_EMAIL_FROM=Pilot'Officine <diagnostic@votre-domaine.fr>
PILOT_NOTIFY_TO=<email opérateur>
PILOT_PUBLIC_URL=https://pilotofficine.fr
```

Sans ces variables, le MVP fonctionne normalement : seule la notification email est désactivée.

Dans Netlify :

1. Project configuration
2. Environment variables
3. Ajouter `PILOT_ADMIN_TOKEN`
4. Scope : Functions si le plan propose le choix
5. Redéployer le site

Ne jamais mettre cette valeur dans GitHub, le JavaScript frontend ou un fichier du repo.

Le back-office est ensuite accessible avec :

```
https://<domaine>/?admin=1
```

Le token est demandé à l'ouverture et conservé uniquement dans `sessionStorage`.

## Test de bout en bout avant ouverture aux pilotes

### Côté titulaire

- Créer un compte avec une adresse de test
- Vérifier qu'un mot de passe < 8 caractères est refusé
- Déposer un export activité
- Ajouter un top produits et/ou un stock si disponibles
- Vérifier PDF / CSV / XLSX
- Vérifier le mapping
- Lancer la pré-analyse
- Vérifier le CA moyen/jour, le stock, le nombre de références et la valeur éventuelle du stock sans vente
- Confirmer explicitement l'absence de données nominatives patient
- Ouvrir l'étape relecture
- Envoyer le dossier
- Se déconnecter puis se reconnecter
- Vérifier que le dossier est visible avec le statut « Reçu · à relire »

### Côté Charles

- Ouvrir `/?admin=1`
- Saisir `PILOT_ADMIN_TOKEN`
- Vérifier que le dossier apparaît
- Télécharger chaque fichier original
- Relire les chiffres et les sources
- Corriger la synthèse préremplie
- Renseigner les constats, 3 priorités et plan 30 jours
- Enregistrer en « En relecture »
- Valider le diagnostic
- Vérifier que la validation génère réellement le PDF serveur
- Télécharger le PDF final depuis le back-office

### Retour titulaire

- Actualiser « Mes dossiers »
- Vérifier le statut « Diagnostic disponible »
- Ouvrir le diagnostic
- Vérifier toutes les valeurs
- Télécharger le PDF final serveur
- Tester aussi l'impression de la vue comme solution de secours
- Supprimer un dossier test et vérifier qu'il disparaît

## Règles de données

Pilot'Officine ne nécessite aucune donnée nominative patient.

Ne pas déposer :
- nom / prénom patient
- date de naissance nominative
- adresse ou téléphone patient
- ordonnance nominative
- historique de santé individuel

Le pilote travaille uniquement avec des données de gestion d'officine.

Notice accessible sur `/confidentialite.html`.

## Formats

- CSV
- XLS
- XLSX
- PDF texte structuré

Les PDF sont reconnus progressivement par format LGO. Les fichiers non structurés ou scannés peuvent nécessiter l'export Excel/CSV équivalent.

## Limites assumées du MVP

- Vérification d'email disponible si l'email transactionnel est configuré ; elle reste non bloquante pendant le pilote
- Récupération de mot de passe disponible si l'email transactionnel est configuré ; sinon support manuel pilote
- Les emails automatiques sont optionnels et nécessitent la configuration Resend ci-dessus
- Le PDF final est généré côté serveur ; l'impression navigateur reste uniquement un fallback
- Le moteur automatique reste une pré-analyse ; la restitution finale est relue
- Aucun traitement de donnée patient / donnée nominative de santé ne doit être introduit sans revue juridique et d'hébergement dédiée
- Le lockfile historique a été retiré car il ne correspondait plus aux dépendances du MVP ; les dépendances directes sont épinglées. Régénérer et committer un lockfile propre avant industrialisation

## Vérification technique rapide

Le backend expose un health check non sensible :

```
/api/health
```

Il permet de vérifier que les Functions et le stockage Blob répondent, ainsi que de savoir si le secret admin est configuré, sans exposer sa valeur.

## Critères de lancement des 10 pharmacies fondatrices

Ne pas ouvrir le pilote tant que les points suivants n'ont pas été testés au moins une fois sur le deploy preview :

- compte / connexion
- upload multi-fichiers
- PDF réel anonymisé
- CSV activité réel
- mapping
- soumission relecture
- téléchargement admin
- sauvegarde relecture
- validation
- restitution client
- suppression dossier
- modification du profil
- changement de mot de passe
- récupération de mot de passe
- vérification d'email
- génération et téléchargement du PDF final

## Branche de travail

Le MVP est actuellement développé sur :

```
fix/real-data-engine
```

La branche `main` ne doit pas être fusionnée sans validation finale du parcours.


## Vérification de déploiement

Avant toute nouvelle modification fonctionnelle, vérifier que le dernier deploy-preview Netlify est vert. Si un déploiement reste bloqué en `pending` alors que son parent direct est vert et que le commit ne touche qu'à la documentation ou au wording, déclencher un nouveau commit minimal avant de diagnostiquer le code applicatif.
