# Mon Mariage — audit fonctionnel du 7 septembre 2026

L’application couvre déjà les grandes étapes de l’organisation. Son problème principal est la cohérence entre les modules : une personne peut avoir une réponse RSVP individuelle, être comptée comme tout son foyer, conserver une chambre après un refus et perdre son identité lors d’un import. La priorité est de rendre ces parcours fiables avant d’ajouter de nouvelles fonctions.

Cet audit décrit le code actuel. L’ancien `AUDIT-PRODUIT.md` et plusieurs passages de `IMPROVEMENT-PLAN.md` sont dépassés : authentification, droits, portail RSVP, navigation par URL, thèmes persistants, confirmations de suppression et tests existent désormais. Le plan de table utilise aussi une transaction pour les déplacements.

## Vérifications et limites

- Serveur : compilation et **23 tests réussis** avec `npm test`.
- Client : **11 tests réussis** avec `npm test -- --watch=false`.
- Build Angular de production réussi. Avertissement : bundle initial de **667,33 kB**, pour un budget configuré à 500 kB ; transfert estimé à 158,45 kB.
- **9 diagnostics reproduits** sur le code réel des services et du store, avec dépôts simulés et véritables signals Angular. Le script ne contacte ni base ni serveur et n’envoie aucun message.
- Navigation locale en démonstration : connexion → tableau de bord → hébergement → plan de table. Captures à **390 × 844**.
- Ce n’est pas une recette exhaustive sur PostgreSQL ni un audit du déploiement réel. Les scénarios de concurrence sont identifiés dans le code, sans simulation de transactions concurrentes sur une vraie base. L’examen mobile ne remplace pas un essai tactile sur téléphone.
- Aucune implémentation applicative n’a été modifiée pendant cet audit.

Le [script de reproduction](output/audit-2026-09-07/reproduce.cjs) se lance depuis la racine avec `node output/audit-2026-09-07/reproduce.cjs`, après compilation du serveur. Ses assertions documentent les anomalies actuelles ; elles devront être inversées ou remplacées par des tests de comportement attendu lors des corrections.

## Tour des fonctionnalités

| Fonctionnalité | Ce qui existe | Changement recommandé |
|---|---|---|
| Site public | Date, noms, programme, cartes, lieux à découvrir, thèmes | Programme modifiable depuis les réglages, horaires complets, contact pratique et ajout au calendrier |
| RSVP privé | Lien par foyer, réponse par personne, événements, alimentation, transport, couchage, rotation du lien | Réponses individuelles visibles et modifiables côté organisateur ; distinction événements proposés/acceptés ; informations alimentaires par personne |
| Invités | Familles, +1, enfants, catégories, recherche, tri, édition rapide | Une identité stable par personne ; propagation des changements aux autres modules |
| Import/export Excel | Lecture des deux premières feuilles, export de la liste | Aperçu, fusion par défaut, identifiants préservés, remplacement transactionnel et restaurable |
| Hébergement | Maisons, chambres, types de lits, glisser-déposer, suggestion du partenaire | Capacité garantie côté serveur, demandes de couchage prises en compte, affectations par nuit si nécessaire |
| Plan de table | Plan de salle, tables rectangulaires, sièges individuels, échanges, rotation, zoom, voisins | Réductions de capacité explicites, protection contre les conflits, vue adaptée au mobile, export imprimable |
| Budget | Catégories, prévisionnel, dépenses datées, édition, totaux | Distinguer prévisionnel, engagé, payé et restant à payer ; relier les dépenses aux prestataires |
| Prestataires | Contacts, statuts, champs spécialisés, contrat, notes ; montants globaux conservés dans le modèle | Remettre les montants et acomptes dans le formulaire, avec un échéancier lié au budget |
| À faire | Listes, tâches, échéances, responsables génériques, retards, progression | Modifier les échéances dans l’interface, affecter de vrais comptes, relier les tâches opérationnelles |
| Dernières semaines | Gantt, tâches récurrentes, responsables multiples, présences et repas | Étendre après le mariage, harmoniser les fuseaux horaires, rendre les sauvegardes atomiques |
| Administration et accès | Organisateurs, invitations de comptes, profils, permissions, sessions et CSRF | Séparer les données consultables des secrets d’invitation ; tester les profils partiels |
| Tableau de bord | RSVP, couchages, places, budget, prestataires, tâches et opérations | Corriger les calculs et afficher des actions concrètes : personnes à placer, réponses manquantes, échéances |
| Démonstration | Jeu fictif isolé dans le navigateur, réinitialisé au rechargement | Conserver ce parcours ; éviter de considérer la démo comme une preuve de fiabilité du serveur |

## Corrections prioritaires — avant un usage intensif

### 1. Les placements peuvent disparaître à l’écran selon l’ordre de chargement

**Reproduit — priorité haute.** Les requêtes invités, chambres et tables partent ensemble. Chaque réponse est appliquée immédiatement. Or le store élimine les affectations dont il ne connaît pas encore l’invité.

Si les chambres arrivent avant les invités, leurs occupants sont supprimés du store. L’arrivée ultérieure des invités ne les restaure pas. Les données restent en base, mais l’interface peut afficher des chambres et tables vides. Un profil autorisé à consulter les chambres sans accès à la liste des invités rencontre aussi cette dépendance.

**Changement :** conserver les affectations brutes, puis construire l’affichage quand les données nécessaires sont disponibles. Distinguer « inconnu car non chargé » de « personne supprimée ». Pour les profils partiels, fournir une projection minimale des occupants autorisés, sans exposer toute la fiche invité.

**Validation :** retarder artificiellement la réponse invités ; les affectations doivent être identiques quel que soit l’ordre des réponses. Tester aussi un profil hébergement uniquement.

Sources : `wedding-shell.component.ts:119`, `store.ts:114`, `store.ts:299`.

### 2. Les totaux RSVP ne respectent pas les réponses individuelles

**Reproduit — priorité haute.** Un invité confirmé, un accompagnateur qui refuse et un enfant en attente sont comptés comme **trois confirmés**. Le calcul existe à la fois dans le dashboard serveur et dans le store. Le plan de table, lui, sait lire les statuts individuels.

L’interface organisateur ne propose qu’un RSVP principal : aucun sélecteur pour celui du +1 ou des enfants. Une confirmation reçue par téléphone ne peut donc pas être saisie correctement pour toute la famille depuis cette fiche.

**Changement :** centraliser l’expansion d’un foyer en personnes et compter les statuts de chaque personne. Afficher explicitement « foyers » et « personnes ». Ajouter un RSVP pour chaque membre et une action volontaire « appliquer à tout le foyer ».

**Validation :** le foyer de l’exemple doit donner 1 confirmé, 1 refus et 1 attente sur toutes les pages.

Sources : `dashboard.service.ts:77`, `store.ts:51`, `wedding-utils.ts:118`, `guest-modal.component.html`.

### 3. L’import peut effacer la liste et casser les liens existants

**Échec d’insertion reproduit ; pertes d’identité constatées dans le code — priorité haute.** Choisir un fichier déclenche directement un remplacement complet. Le serveur efface les invités avant d’insérer la nouvelle liste, sans transaction : une erreur d’insertion laisse la liste vide.

Même un import réussi recrée les identifiants des invités et remet les jetons RSVP à `null`. Les anciens liens d’invitation deviennent invalides. Les affectations des personnes dont l’identité change sont nettoyées ; les présences liées aux anciens identifiants ne sont pas réassociées. Le rapprochement des comptes par e-mail ne restaure pas ces liens métier.

**Changement :** importer d’abord dans un aperçu validé, afficher ajouts/modifications/doublons/rejets et proposer une fusion par défaut. Préserver les identifiants. Pour un remplacement explicite : transaction couvrant les changements associés, sauvegarde restaurable et bilan des conséquences avant validation. Ne pas utiliser le seul nom comme identifiant de rapprochement.

**Validation :** erreur injectée pendant l’import → état initial intact ; export puis réimport de la même liste → personnes, placements et invitations conservés.

Sources : `guests.component.ts:189`, `guest-import.ts:109`, `guests.service.ts:113`.

### 4. L’hébergement ne garantit pas les capacités et peut perdre une affectation

**Déplacement invalide et réduction de capacité reproduits — priorité haute.** Le serveur supprime la chambre initiale avant de vérifier la destination. Une destination inexistante provoque donc une erreur après perte de l’affectation.

Il ne vérifie pas la capacité au placement. Réduire une chambre de quatre places à une laisse aussi les quatre affectations : le client transmet une liste raccourcie que le serveur ignore.

**Changement :** valider destination, personne et capacité dans une transaction, avec verrouillage approprié. Refuser une réduction sous l’occupation et présenter les personnes à déplacer. Une erreur ne doit jamais modifier l’affectation initiale.

**Validation :** destination supprimée, chambre pleine, deux utilisateurs visant la dernière place, réduction sous occupation ; aucun occupant perdu ni surnombre accepté.

Source : `housing.service.ts:62`, `housing.service.ts:78`.

### 5. Supprimer un enfant peut laisser une place occupée en base

**Reproduit — priorité haute.** La méthode de mise à jour fusionne les nouvelles données dans l’objet initial avant de comparer les anciens et nouveaux membres du foyer. L’ancienne liste n’existe donc plus au moment de rechercher les personnes retirées. Le nettoyage ne s’exécute pas.

Le client masque certaines affectations orphelines, ce qui peut donner une impression de correction alors que les totaux serveur restent faux. Le passage à « refusé » ne déclenche pas non plus de réconciliation des chambres, sièges et présences.

**Changement :** capturer les identifiants initiaux avant toute mutation ; enregistrer la modification et nettoyer les dépendances dans une transaction. Définir explicitement le comportement d’un refus : avertissement avec libération des réservations concernées, et mise à jour des présences selon la décision prise.

**Validation :** retirer un enfant ou un +1, recharger, puis comparer données serveur, cartes de chambres, sièges et compteurs.

Source : `guests.service.ts:83`, `guests.service.ts:92`, `guests.service.ts:157`.

### 6. Un lecteur de la liste peut récupérer les liens permettant de modifier les RSVP

**Jeton reproduit dans le payload ; chaîne d’autorisation vérifiée dans le code — priorité haute.** `GET /guests` renvoie les entités complètes, y compris les `inviteToken` déjà générés. Cette route requiert seulement le droit de lecture. Le jeton permet ensuite une modification via l’API publique RSVP, sans droit d’édition du module invités.

L’authentification existe et protège les routes privées ; le problème est que la réponse de lecture distribue une capacité d’écriture supplémentaire.

**Changement :** utiliser des réponses explicitement filtrées. Renvoyer éventuellement `hasInviteLink`, mais réserver la récupération et la génération du lien au droit prévu pour cette action. Si des liens ont déjà été distribués à des lecteurs, prévoir une rotation coordonnée, car elle invalide aussi les liens des invités.

**Validation :** un compte avec `guests.canView=true` et `canEdit=false` ne doit recevoir aucun jeton RSVP. Le parcours public normal reste utilisable avec le lien remis au foyer.

Sources : `guests.controller.ts:18`, `guest.entity.ts:71`, `public.controller.ts`, `auth.guards.ts`.

## Autres changements importants

### Plan de table : éviter les surprises et les conflits

Le déplacement est désormais transactionnel, ce qui améliore l’ancien comportement. En revanche, réduire le nombre de sièges supprime silencieusement les affectations en trop : ce cas est reproduit. Une tentative sans place disponible peut aussi retourner normalement sans expliquer le refus.

La transaction ne suffit pas à garantir la concurrence : le code ne verrouille pas les places et la base impose l’unicité de `guestId`, mais pas celle de `(tableId, seat)`. Deux placements simultanés peuvent donc viser le même siège ; ce risque reste à confirmer avec PostgreSQL.

**À faire :** bloquer les réductions incompatibles, renvoyer une erreur métier explicite, et protéger la réservation d’un siège. La contrainte d’unicité devra tenir compte des échanges : on ne peut pas simplement l’ajouter sans adapter l’ordre des écritures.

Sources : `seating.service.ts:61`, `seating.service.ts:108`, `table-guest.entity.ts`.

### Budget et prestataires : donner un sens stable aux montants

**Calcul reproduit.** Un prestataire « à contacter » avec une estimation de 5 000 € ajoute déjà 5 000 € aux engagements du dashboard. Le calcul exclut seulement les prestataires écartés, donc plusieurs devis concurrents peuvent gonfler le montant engagé.

Le budget et les prestataires enregistrent leurs montants séparément. Sélectionner une offre ne crée pas de mouvement lié dans le budget. **Le formulaire prestataire ne permet même plus de saisir les montants globaux** : `priceEstimate`, `priceFinal`, `depositAmount`, `depositPaid` et `balanceDueDate` existent dans le modèle, mais ne sont pas reliés à des champs du template. Les prix spécialisés comme « prix par invité » alimentent `details`, sans recalculer ces montants. Le dashboard utilise donc des valeurs que l’utilisateur ne peut pas corriger depuis la fiche actuelle.

**À faire :** rétablir une section financière éditable, puis distinguer estimation, engagement accepté, paiement effectué et échéance restante. Relier une ligne budgétaire à un prestataire et enregistrer les paiements une seule fois. Calculer les statuts financiers à partir des paiements, ou refuser les combinaisons incohérentes. Afficher les échéances à venir et en retard.

Sources : `dashboard.service.ts:102`, `vendors.service.ts`, `vendors.component.html`, `vendor-categories.ts`, `budget.service.ts`, `budget-item.entity.ts`.

### RSVP : distinguer les personnes et les événements

Les statuts sont individuels, mais alimentation, événements, transport et besoin de couchage sont des champs du foyer. Le formulaire propose la liste complète des événements et le serveur accepte toute valeur connue : il n’existe pas de séparation entre événements auxquels le foyer est invité et événements auxquels il répond présent.

**À faire :** si certains événements sont réservés, stocker cette autorisation séparément et limiter les réponses. Prévoir des choix par personne lorsque nécessaire. Une restriction alimentaire doit pouvoir être attribuée à son porteur, puis apparaître dans une liste exploitable pour les repas.

Sources : `guest.entity.ts`, `guests.service.ts:157`, `rsvp.component.ts`, `public.types.ts`.

### Hébergement : utiliser réellement les demandes de couchage

La liste « sans logement » contient tous les non-refusés sans chambre ; elle ignore `needsHousing`. Elle ne permet donc pas d’isoler les personnes qui ont demandé un lit. Elle mélange aussi réponses en attente et confirmées.

**À faire :** afficher « couchage demandé », « à confirmer » et « déjà logé ». Garder la possibilité d’affecter manuellement une personne sans demande. Si les arrivées sont échelonnées, relier les chambres aux nuits : une affectation globale ne permet pas la réutilisation d’un lit après un départ.

Source : `housing.component.ts:55`, `wedding-utils.ts`.

### Dernières semaines : couvrir la fin réelle du séjour

La fenêtre est limitée à J−56 jusqu’au jour du mariage inclus. Un départ le lendemain, le rangement après minuit ou un brunch à J+1 est refusé. C’est une limitation produit explicite, particulièrement gênante pour un mariage avec hébergement.

Les repas dépendent des horaires et des sélections ; ils ne consultent pas les RSVP. Une personne avec un séjour renseigné peut rester comptée après un refus. Il faut rendre cette divergence visible et demander la bonne correction, plutôt que supposer que présence sur place et participation au mariage sont toujours identiques.

Les heures sont également interprétées selon le fuseau du navigateur côté client et selon `TIMEZONE` côté serveur. Depuis un autre fuseau, une même sélection peut produire un comptage différent.

**À faire :** dates de début et de fin configurables, au moins jusqu’à J+2 selon le programme ; horaires exprimés dans le fuseau du mariage ; avertissements sur les contradictions RSVP/séjour.

Sources : `event-config.service.ts`, `final-weeks.service.ts:234`, `final-weeks.service.ts:303`, `final-weeks.service.ts:358`, `final-weeks.component.ts:511`.

### Dernières semaines : sauvegarder les opérations en entier

La création des occurrences récurrentes se fait dans une boucle, sans transaction globale. Si une occurrence tardive dépasse la fenêtre ou si une écriture échoue, les précédentes peuvent rester créées malgré l’erreur. La modification d’une tâche est enregistrée avant la validation complète des nouveaux responsables. La sauvegarde d’un repas précède aussi la validation de ses cuisiniers.

Dans le client, cocher un repas modifie l’objet affiché avant la requête ; l’erreur ne restaure pas sa valeur initiale. Les fonctions autorisant l’édition d’une présence ou d’un repas ne vérifient pas non plus le droit global `final_weeks.edit`, contrairement au serveur.

**À faire :** valider toutes les occurrences et personnes avant écriture, utiliser des transactions, puis restaurer ou recharger l’état lors d’un échec. Combiner droit global et droit sur l’objet dans l’interface.

Sources : `final-weeks.service.ts:140`, `final-weeks.service.ts:220`, `final-weeks.component.ts:278`.

### Collaboration : éviter l’écrasement des corrections de l’autre organisateur

De nombreuses modifications rapides renvoient l’objet entier. Une page ancienne peut ainsi renvoyer un ancien téléphone en changeant seulement le statut d’un prestataire, ou une ancienne réponse familiale en corrigeant un nom. Les entités concernées n’ont pas de vérification de version dans ces chemins.

**À faire :** requêtes limitées aux champs modifiés, version attendue côté serveur et message de conflit compréhensible. Ajouter un historique aux opérations sensibles. Prévoir une actualisation au retour sur une page pour récupérer les RSVP reçus entre-temps.

Sources : `guests.component.ts:178`, `vendors.component.ts:227`, `guest-api.service.ts`, services de mise à jour serveur.

### Validation serveur : refuser les valeurs incohérentes

Les contrôles existent pour certains parcours récents, mais restent incomplets dans les modules historiques. Par exemple, `Number(input.beds) || 1` accepte une capacité négative et le service prestataires conserve une catégorie inconnue. Les types TypeScript des corps de requête ne valident pas les valeurs à l’exécution.

**À faire :** validation explicite des corps de requête, des catégories, des dates et des bornes numériques, puis contraintes métier au niveau du service. Retourner des erreurs précises, sans convertir silencieusement une saisie invalide en zéro. Tester aussi les requêtes directes, pas seulement les formulaires.

Sources : `main.ts`, `housing.service.ts`, `vendors.service.ts`, `budget.service.ts`.

### Déploiement : rendre l’évolution de la base maîtrisable

La synchronisation automatique TypeORM reste activée par défaut. Le Compose de production ne fournit pas de valeur la désactivant. Aucune migration ni procédure de sauvegarde automatisée n’a été trouvée dans les fichiers inspectés ; une sauvegarde externe à ce dépôt peut néanmoins exister.

**À faire :** introduire les migrations et une procédure de restauration vérifiée avant de désactiver la synchronisation en production. Le volume PostgreSQL est bien nommé et persistant, mais cela ne remplace pas une sauvegarde.

Sources : `app.module.ts:35`, `docker-compose.prod.yml`.

## Petits changements qui amélioreraient beaucoup le quotidien

1. **Mobile : rendre le sélecteur d’invités explicite.** À 390 px, les lignes d’invités apparaissent comprimées dans une bande très basse. L’ouverture dépend de `hover` ou du focus. Utiliser un bouton « Voir les personnes » et un panneau adapté, avec une action « Affecter à… » utilisable sans glisser-déposer. [Capture hébergement](output/playwright/audit-housing-mobile.png).
2. **Plan de salle : proposer « Tout voir ».** La page arrive à 100 % de zoom sur mobile, et la capture initiale montre une zone de plan vide alors que des tables existent hors de cette portion visible. Ajuster le cadrage au contenu et ajouter une vue par liste. [Capture plan de table](output/playwright/audit-seating-mobile.png).
3. **Confirmation : respecter le bouton Annuler au clavier.** Le gestionnaire global de la touche Entrée confirme quelle que soit la cible du focus. Supprimer ce raccourci global, laisser les boutons gérer Entrée, contenir le focus dans la fenêtre et le restaurer à la fermeture. `confirm-dialog.component.ts`.
4. **Afficher les vraies erreurs.** Une adresse déjà utilisée devient actuellement « Impossible d’enregistrer l’invité ». Présenter le message métier renvoyé par le serveur et proposer une correction. Distinguer chargement, échec et absence de données ; le dashboard reste actuellement sur « Chargement… » après une erreur.
5. **Empêcher les doubles enregistrements.** Plusieurs formulaires, dont invités et prestataires, n’ont pas d’état de sauvegarde désactivant les actions. Ajouter cet état et préserver les saisies en cas d’échec.
6. **Corriger l’aller-retour Excel.** Les prénoms composés sont reconstruits puis redécoupés, malgré des colonnes distinctes. Les rôles exportés `sibling` et `friend_cousin` ne sont pas reconnus tels quels par l’import. Les RSVP individuels et le besoin de couchage ne sont pas exportés ; un +1 sans nom disparaît au réimport. Versionner un format complet et tester sa réversibilité. `guest-import.ts:106`, `guest-import.ts:189`, `guests.component.ts:149`.
7. **Conserver les centimes.** `fmtCurrency` arrondit à l’euro. Pour le suivi des paiements, afficher les centimes lorsqu’ils existent. Une estimation à zéro avec des dépenses ne devrait pas produire une jauge rassurante à 0 % sans explication.
8. **Rendre les tâches modifiables jusqu’au bout.** L’interface « À faire » édite le libellé et le responsable, mais pas l’échéance après création. Ajouter cette édition ; à terme, relier cette liste au planning opérationnel plutôt que maintenir deux listes indépendantes.
9. **Configurer le programme public.** Les horaires, lieux et adresses sont codés dans le composant, tandis que la date et les noms viennent de la configuration serveur. Prévoir un seul écran de réglages, avec prévisualisation publique.
10. **Alléger l’ouverture du site.** Le bundle dépasse son budget et la plupart des pages privées sont importées directement. Charger les pages privées à la navigation et mesurer l’ouverture de la page publique avant/après.

## Ordre de réalisation proposé

| Lot | Objectif | Critère de sortie |
|---|---|---|
| 1 — Cohérence des personnes | Chargement indépendant de l’ordre, RSVP individuels, nettoyage des dépendances, réponses de lecture sans jetons | Une même famille donne les mêmes personnes et statuts partout ; aucun lecteur ne reçoit de secret RSVP |
| 2 — Protection des données | Import avec aperçu et fusion, transactions chambres/tables, conflits de capacité, migrations et restauration | Une opération refusée ou interrompue conserve l’état initial ; l’import ne casse pas les invitations |
| 3 — Finances et organisation | Budget lié aux prestataires, échéancier, vrais responsables, sauvegardes opérationnelles atomiques | Un paiement n’est saisi qu’une fois ; chaque échéance possède un responsable et un état fiable |
| 4 — Usage pendant le mariage | Fenêtre jusqu’à la fin du séjour, mobile, affectation sans drag, exports imprimables | On peut retrouver chambres, tables, repas, horaires et contacts depuis un téléphone ou un dossier imprimé |

Le changement structurel le plus utile serait un modèle **Foyer → Personnes → Réponses par événement → Séjours et affectations**. Il peut être introduit progressivement derrière les API existantes, en préservant les identifiants actuels. Il ne justifie pas une réécriture complète de l’application.
