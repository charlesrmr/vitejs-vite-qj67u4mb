# Pilot'Officine — Architecture produit et usages

Dernière mise à jour : 30 septembre 2026

## 1. Positionnement

Pilot'Officine n'est pas un LGO et ne doit pas chercher à remplacer Winpharma, LGPI, Smart RX, Pharmagest ou un autre logiciel métier.

Le LGO exécute :
- délivrance et ordonnance ;
- tiers payant ;
- commandes et réceptions ;
- stock opérationnel ;
- facturation ;
- historique patient ;
- statistiques de base.

Pilot'Officine doit agir au-dessus du LGO :

> Voir ce qui mérite l'attention, comprendre pourquoi, décider quoi faire, attribuer l'action, puis vérifier le mois suivant si cela a produit un effet.

La promesse produit est donc :
1. **Lecture** des exports et documents existants.
2. **Diagnostic** limité aux données réellement présentes.
3. **Priorisation** de 3 à 5 sujets maximum.
4. **Plan d'action** concret, chiffrable et attribuable.
5. **Suivi dans le temps** pour mesurer si les décisions ont fonctionné.
6. **Relecture humaine** lorsqu'un diagnostic final est produit.

## 2. Ce que Pilot'Officine ne doit pas devenir

Ne pas construire :
- un logiciel de dispensation ;
- une caisse ;
- un dossier patient ;
- un outil de prescription ;
- une gestion détaillée des commandes en temps réel ;
- une copie des statistiques natives du LGO ;
- un CRM patient ;
- un stockage de données nominatives de santé.

Tant que Pilot'Officine reste sur des données de gestion d'officine anonymes/non patient, l'architecture peut rester volontairement plus légère. Toute future fonctionnalité manipulant des données de santé identifiantes devra être traitée comme un autre produit technique et réglementaire.

## 3. Les usages à concevoir avant les écrans

### Usage A — Le lundi matin en 5 minutes
Question du titulaire : **"Qu'est-ce qui mérite mon attention cette semaine ?"**

L'écran doit répondre immédiatement avec :
- 3 signaux prioritaires ;
- impact estimé ou ordre de grandeur ;
- données qui justifient le signal ;
- 1 action concrète par signal ;
- statut des actions ouvertes.

### Usage B — Le point mensuel en 20 à 30 minutes
Question : **"Est-ce que mon officine s'améliore ?"**

Le parcours doit permettre :
1. importer les nouvelles données ;
2. contrôler la qualité des données ;
3. comparer M vs M-1, N-1 ou période précédente ;
4. voir les écarts importants ;
5. clôturer / poursuivre les actions précédentes ;
6. décider 3 nouvelles priorités ;
7. enregistrer un commentaire dirigeant.

### Usage C — Une décision ponctuelle
Questions typiques :
- "Puis-je recruter un préparateur ?"
- "Que me rapporte réellement +0,5 point de marge ?"
- "Combien de CA supplémentaire faut-il pour absorber cette embauche ?"
- "Quel est l'impact de +2 € de panier moyen ?"
- "Combien représente ce stock sans vente ?"
- "Quelles missions pharmaceutiques sont sous-exploitées ?"

Ces questions nécessitent des **simulateurs décisionnels**, pas seulement des graphiques.

### Usage D — Préparer une réunion d'équipe
Question : **"Qu'est-ce que je partage à l'équipe ?"**

Pilot'Officine doit pouvoir transformer les constats en :
- objectif clair ;
- métrique simple ;
- responsable ;
- échéance ;
- rituel de suivi ;
- résultat.

### Usage E — Audit / accompagnement CRC Pharma
Question : **"Que faut-il travailler pendant les prochains mois ?"**

Le diagnostic doit pouvoir devenir :
- constat ;
- priorité ;
- action ;
- responsable ;
- échéance ;
- gain ou résultat attendu ;
- preuve / commentaire ;
- statut ;
- mesure après action.

C'est un différenciateur majeur par rapport à un simple outil BI.

---

# 4. Architecture fonctionnelle cible

## 4.1 Accueil / Cockpit

Objectif : décision en moins de 60 secondes.

Contenu :
- période analysée et fraîcheur des données ;
- CA avec base clairement qualifiée (brut TTC, net TTC, HT...) ;
- marge € et % ;
- stock valorisé et date de photographie ;
- masse salariale / CA lorsque disponible ;
- nouvelles missions / honoraires lorsque disponible ;
- 3 alertes prioritaires ;
- 3 actions en cours ;
- indicateur de couverture / qualité des données.

Éviter un écran avec 20 KPI.

## 4.2 Imports

Fonctions :
- Activité / ventes ;
- Top produits ;
- Stock ;
- synthèse comptable ;
- masse salariale / charges ;
- données missions pharmaceutiques ;
- autres exports identifiés.

Chaque import doit afficher :
- type détecté ;
- période ;
- colonnes reconnues ;
- qualité ;
- limites ;
- usage autorisé.

Un fichier partiel ne doit jamais être présenté comme exhaustif.

## 4.3 Performance

Sous-modules :
- CA et évolution ;
- marge € / marge % ;
- ventilation par famille ;
- produits ;
- panier / passages si disponibles ;
- activité par période ;
- comparaison N-1 / période précédente.

Principe :
- aucune donnée inventée ;
- chaque KPI garde sa source et son périmètre.

## 4.4 Stock

À terme :
- valeur de stock ;
- nombre de références ;
- sans vente sur période ;
- valeur immobilisée ;
- produits à forte valeur ;
- rotation uniquement si base compatible ;
- dates de photographie ;
- incohérence temporelle stock / ventes.

Ne pas devenir un moteur de commandes : le LGO le fait déjà.

## 4.5 Missions pharmaceutiques

Ce module doit suivre **des volumes et revenus**, pas des patients.

Exemples :
- vaccination ;
- TROD angine ;
- dépistage cystite ;
- Mon bilan prévention ;
- bilans partagés de médication ;
- accompagnements AVK / AOD / asthme / anticancéreux ;
- téléconsultations ;
- actes et honoraires conventionnels pertinents.

Fonctions :
- actes réalisés par période ;
- revenu estimé / réalisé ;
- évolution ;
- capacité de l'équipe ;
- opportunité non exploitée ;
- objectifs.

Les tarifs doivent être versionnés avec :
- source ;
- date d'effet ;
- date de vérification.

Sources de référence actuelles :
- https://www.ameli.fr/pharmacien/exercice-professionnel/remunerations/honoraires-actes-pharmaciens
- https://www.ameli.fr/pharmacien/sante-prevention/vaccination/vaccination-par-pharmacien-officine
- https://www.ameli.fr/pharmacien/sante-prevention/trod-angine-officine-pharmacie
- https://www.ameli.fr/pharmacien/sante-prevention/depistage-cystite-officine-pharmacie
- https://www.ameli.fr/pharmacien/sante-prevention/bilan-prevention-ages-cles

## 4.6 Substitution et rémunérations conventionnelles

En 2026, les règles évoluent notamment sur génériques, hybrides et biosimilaires.

Le module futur peut suivre :
- taux de substitution lorsqu'il est disponible ;
- refus / non-substitution si les exports permettent une lecture agrégée ;
- évolution ;
- impact économique estimé ;
- indicateurs REMU NUM / ROSP BUPS ;
- check-list des indicateurs à sécuriser avant fin d'année.

Références :
- https://www.ameli.fr/pharmacien/exercice-professionnel/pratique-tiers-payant/tiers-payant-generiques
- https://www.ameli.fr/pharmacien/exercice-professionnel/remunerations/remunerations-sur-objectifs

Ne pas stocker d'identité patient.

## 4.7 Équipe / Management

Ne pas construire un logiciel de paie ou de planning complet.

Construire ce qui aide le titulaire à piloter :
- matrice de compétences ;
- habilitations / formations pour nouvelles missions ;
- responsabilités ;
- objectifs équipe ;
- trame de daily 5 min ;
- trame hebdo ;
- actions attribuées ;
- échéances ;
- entretiens annuels ;
- suivi d'actions issues des entretiens.

Exemple de compétences :
- vaccination ;
- TROD angine ;
- cystite ;
- bilans prévention ;
- orthopédie ;
- dermocosmétique ;
- micronutrition ;
- merchandising ;
- référent stock ;
- référent tiers payant.

## 4.8 Simulateurs décisionnels

Priorité forte car différenciant et directement utile.

### Recrutement
Entrées :
- salaire brut ;
- charges ;
- coût complet ;
- temps de travail ;
- CA / marge actuelle ;
- hypothèse de gain de capacité.

Sorties :
- coût mensuel et annuel ;
- CA additionnel requis selon marge ;
- seuil de rentabilité ;
- scénario prudent / central / ambitieux.

### Marge
- impact annuel de +0,2 / +0,5 / +1 point ;
- impact en résultat brut.

### Panier moyen
- impact de +1 / +2 / +3 € selon passages.

### Missions
- actes supplémentaires x tarif conventionnel ;
- revenu additionnel ;
- temps nécessaire.

### Stock
- cash libéré si réduction de X % ;
- valeur des références sans vente.

Les simulateurs doivent toujours distinguer :
- données observées ;
- hypothèses utilisateur ;
- résultat calculé.

## 4.9 Actions

C'est le cœur du produit.

Objet Action :
- titre ;
- problème lié ;
- KPI de référence ;
- responsable ;
- échéance ;
- priorité ;
- impact estimé ;
- effort estimé ;
- statut ;
- commentaire ;
- résultat mesuré ;
- date de clôture.

Statuts :
- à décider ;
- à faire ;
- en cours ;
- bloqué ;
- terminé ;
- abandonné.

Le cockpit doit montrer les actions avant les graphiques détaillés.

## 4.10 Historique

Chaque import crée un snapshot daté.

L'utilisateur doit pouvoir voir :
- périodes disponibles ;
- évolution des KPI ;
- actions décidées à chaque période ;
- commentaires ;
- résultats obtenus ;
- rapports PDF.

Aucune comparaison N-1 sérieuse n'est possible sans cette couche.

## 4.11 Rapports

Deux niveaux :
1. pré-analyse automatique ;
2. diagnostic relu / validé.

Le PDF final doit contenir :
- périmètre des données ;
- qualité / limites ;
- 4 à 6 KPI ;
- synthèse dirigeant ;
- constats ;
- 3 priorités ;
- plan d'action ;
- données manquantes ;
- date / version.

---

# 5. Architecture de navigation cible

Navigation principale future :

1. **Cockpit**
2. **Imports**
3. **Performance**
4. **Missions**
5. **Équipe**
6. **Actions**
7. **Historique**
8. **Rapports**
9. **Paramètres**

Pour le MVP pilote, ne pas afficher des sections vides.

Règle :
> Une entrée de navigation n'existe que lorsqu'elle permet déjà de réaliser une tâche utile de bout en bout.

---

# 6. Architecture de données cible

## Raw layer
Conserver :
- fichiers originaux ;
- nom ;
- hash ;
- taille ;
- type ;
- date d'import ;
- période détectée ;
- source LGO ;
- compte / officine.

## Normalized layer
Créer un modèle canonique indépendant du LGO.

Exemples :
- period_start ;
- period_end ;
- ca_value ;
- ca_basis ;
- margin_eur ;
- margin_pct ;
- stock_value ;
- stock_snapshot_date ;
- product_metrics ;
- family_metrics ;
- mission_metrics ;
- payroll_metrics.

Chaque métrique doit garder :
- source_file_id ;
- source_column ;
- parser_version ;
- confidence / warning éventuel.

## Analysis layer
Conserver :
- version moteur ;
- KPI calculés ;
- alertes ;
- synthèse ;
- limites ;
- ranking mode ;
- actions proposées.

## Decision layer
Conserver séparément :
- actions ;
- décisions ;
- commentaires ;
- objectifs ;
- résultats.

Ne jamais mélanger données observées et décisions humaines.

---

# 7. Architecture technique cible

## Court terme — pilote
- React/Vite ;
- Netlify Functions ;
- stockage privé Netlify Blobs ;
- parsing côté navigateur ;
- fichiers originaux côté serveur ;
- relecture humaine ;
- environnement preview isolé de production.

## Étape suivante
Extraire le moteur dans un module partagé :
- parsing ;
- normalisation ;
- règles ;
- calculs ;
- tests.

Le frontend et les fonctions serveur doivent utiliser le même moteur pour éviter deux interprétations différentes.

## Ensuite
Pour l'historisation :
- objet Pharmacy ;
- ImportSnapshot ;
- MetricSnapshot ;
- AnalysisVersion ;
- Action ;
- Review ;
- Report.

## Sécurité
- aucune donnée patient nominative ;
- auth par compte ;
- autorisation par officine ;
- stockage privé ;
- journalisation minimale des actions sensibles ;
- suppression complète ;
- durée de conservation explicite ;
- secrets uniquement côté serveur ;
- environnement preview séparé.

Si un jour Pilot'Officine traite des données individuelles de santé, arrêter l'architecture actuelle et revoir hébergement, conformité et modèle de sécurité avant développement.

---

# 8. Différenciation face au marché

Les LGO et outils BI savent déjà afficher :
- CA ;
- marge ;
- ventes ;
- stock ;
- top produits ;
- parfois achats, équipe et statistiques avancées.

Pilot'Officine doit donc gagner sur :

1. **lecture multi-LGO simple** ;
2. **explication des limites des données** ;
3. **priorisation** plutôt que catalogue de KPI ;
4. **simulateurs décisionnels** ;
5. **actions avec responsables et échéances** ;
6. **suivi du résultat dans le temps** ;
7. **nouvelles missions pharmaceutiques** ;
8. **management de l'équipe** ;
9. **relecture humaine / accompagnement CRC Pharma**.

Le produit ne doit pas vendre "plus de graphiques".
Il doit vendre **de meilleures décisions et leur exécution**.

---

# 9. Ordre de construction recommandé

## P0 — Fiabilité du socle
Avant toute nouvelle feature :
- imports réels ;
- parsing multi-format ;
- périodes ;
- mapping ;
- contrôle qualité ;
- sécurité ;
- parcours dossier complet ;
- PDF ;
- suppression ;
- self-test.

## P1 — Historique mensuel
C'est le prochain gros socle produit.

Objectif :
- importer une nouvelle période ;
- retrouver les précédentes ;
- comparer ;
- voir l'évolution ;
- éviter de repartir de zéro chaque mois.

Sans historique, Pilot'Officine reste un audit ponctuel.

## P2 — Actions
Créer le système d'actions persistant.

Sans actions, Pilot'Officine reste un dashboard.

## P3 — Simulateurs
Commencer par :
1. recrutement ;
2. marge ;
3. panier / passages ;
4. stock.

## P4 — Missions pharmaceutiques
Commencer sans données patient :
- volumes ;
- revenus ;
- objectifs ;
- matrice de capacité / formation équipe.

## P5 — Management
- compétences ;
- responsabilités ;
- rituels ;
- objectifs ;
- suivi.

## P6 — Multi-officine / expert-comptable / rôles
Seulement après usage validé par plusieurs officines.

---

# 10. Critère de réussite produit

Un titulaire doit pouvoir répondre, après 5 minutes dans Pilot'Officine :

1. **Où en est mon officine ?**
2. **Qu'est-ce qui pose problème ou représente une opportunité ?**
3. **Combien cela représente ?**
4. **Qu'est-ce que je décide maintenant ?**
5. **Qui le fait et pour quand ?**
6. **Le mois prochain : est-ce que ça a marché ?**

Si un écran ou une fonctionnalité ne contribue à aucune de ces réponses, elle n'est probablement pas prioritaire.
