# Audit simple du projet Mon Mariage

## À quoi sert ce document

Ce document explique l’état actuel de Mon Mariage avec des mots simples. Il ne faut pas être développeur pour le lire. Le but est de comprendre ce qui fonctionne déjà, ce qui peut provoquer des erreurs, ce qui manque encore par rapport aux grandes plateformes de mariage et surtout ce qui pourrait rendre ce projet vraiment différent.

Mon Mariage est déjà plus qu’une simple liste de tâches. L’application permet de suivre les invités, leurs accompagnateurs et leurs enfants, de préparer le plan de table, d’attribuer les couchages, de gérer le budget, de suivre les choses à faire et de conserver les informations des prestataires. Toutes ces données sont enregistrées dans une base de données PostgreSQL grâce à un serveur NestJS. L’interface visible par l’utilisateur est construite avec Angular.

L’idée générale est bonne. Les différentes parties du mariage sont regroupées au même endroit et certaines informations sont déjà reliées entre elles. Par exemple, un enfant peut être compté comme une vraie personne, puis placé dans une chambre et à une table. C’est beaucoup plus utile qu’un simple compteur d’invités.

En revanche, l’application n’est pas encore assez sûre pour être considérée comme terminée. Certains problèmes peuvent produire des chiffres faux, perdre une affectation ou même permettre à une personne extérieure de lire et modifier les données du mariage.

## Le problème le plus urgent concerne la sécurité

Aujourd’hui, le serveur ne demande aucune connexion. Il n’existe pas de compte utilisateur, de mot de passe, de session ou de contrôle indiquant qui a le droit d’accéder à un mariage. Le serveur accepte directement les demandes qui arrivent sur ses routes API.

Cela signifie que si l’application est accessible sur Internet, une personne qui découvre son adresse peut potentiellement lire la liste des invités, leurs régimes alimentaires, leurs notes, les montants du budget et les informations des prestataires. Cette personne pourrait également modifier ou supprimer ces données.

Le réglage CORS présent dans `server/src/main.ts` ne règle pas ce problème. CORS indique principalement à un navigateur quelles pages web ont le droit d’appeler le serveur. Il n’empêche pas quelqu’un d’utiliser un autre outil pour envoyer une requête directement à l’API. Il ne faut donc jamais considérer CORS comme un système de connexion.

Le fichier `docker-compose.prod.yml` publie également le port du serveur sur la machine qui héberge l’application. Dans la configuration actuelle, ce port peut écouter sur toutes les interfaces réseau. Même si un pare-feu protège peut-être la machine en production, le code ne garantit pas cette protection.

La première amélioration devrait donc être une vraie protection de l’espace privé. Pour une application utilisée par un seul couple, une authentification simple peut suffire au départ. Il faut néanmoins que toutes les routes sensibles vérifient l’identité de l’utilisateur. Le serveur pourrait aussi ne plus publier son port publiquement et rester accessible uniquement depuis le conteneur du site web.

## Une personne peut perdre sa table pendant un déplacement

Le plan de table contient une erreur importante dans `server/src/seating/seating.service.ts`. Quand une personne est déplacée vers une nouvelle table, le serveur commence par supprimer son ancienne affectation. Il vérifie seulement ensuite si la nouvelle table existe et si elle possède encore une place libre.

Imaginons que Paul soit assis à la table Famille. On essaie de le déplacer vers la table Amis, mais cette table vient juste d’être remplie par un autre utilisateur. Le serveur retire d’abord Paul de la table Famille. Il constate ensuite que la table Amis est complète et arrête le déplacement. Paul se retrouve alors sans table.

Le problème est encore plus difficile à comprendre pour l’utilisateur, car le serveur répond comme si l’opération s’était correctement terminée. L’interface ne montre donc pas forcément de message d’erreur.

Le déplacement devrait être effectué comme une seule opération indivisible. En langage de base de données, cela s’appelle une transaction. Le serveur doit vérifier la destination, réserver la place et seulement ensuite supprimer l’ancienne affectation. Si une étape échoue, rien ne doit changer.

Le logement possède un problème proche dans `server/src/housing/housing.service.ts`. Le serveur supprime l’ancienne chambre avant de vérifier complètement la nouvelle destination. Il ne contrôle pas non plus lui-même la capacité de la chambre. L’interface essaie d’empêcher un dépassement, mais une vérification présente uniquement dans l’interface n’est jamais suffisante. Deux personnes utilisant l’application au même moment peuvent voir la dernière place libre et tenter de l’utiliser ensemble.

## Les enfants ou accompagnateurs retirés peuvent rester présents en secret

Lorsqu’un invité est modifié dans `server/src/guests/guests.service.ts`, le serveur doit comparer son ancienne version avec sa nouvelle version. Cette comparaison sert notamment à découvrir qu’un accompagnateur ou un enfant a été retiré. Le serveur peut alors supprimer ses anciennes affectations de chambre et de table.

Le code actuel modifie cependant l’ancien objet avant d’effectuer cette comparaison. Au moment où il cherche les différences, l’ancienne version ressemble déjà à la nouvelle. Le serveur peut donc croire que personne n’a été retiré.

L’interface masque une partie de ce problème en filtrant les identifiants qui ne correspondent plus à un invité visible. La donnée incorrecte peut néanmoins rester dans la base. Le tableau de bord calcule ses chiffres directement depuis le serveur et peut alors compter une affectation que les pages de logement ou de plan de table ne montrent plus.

Le même type d’incohérence apparaît lorsqu’un invité déjà placé décline finalement l’invitation. Son statut change, mais son lit et sa chaise ne sont pas automatiquement libérés. Le tableau de bord peut continuer à annoncer qu’une place est occupée. L’application devrait demander si les affectations doivent être retirées, ou le faire automatiquement en affichant clairement ce qui vient de changer.

## Réduire une capacité ne règle pas les personnes en trop

Une chambre peut par exemple contenir quatre personnes, puis être modifiée pour ne plus en accepter que deux. L’interface prépare une version de la chambre avec seulement deux identifiants, mais le serveur ignore cette partie de la demande. Les quatre affectations restent donc enregistrées.

Le plan de table a le même problème. Il est possible de réduire le nombre de sièges sans décider où doivent aller les personnes devenues excédentaires. Une table peut finir par afficher huit personnes pour quatre places.

Il ne serait pas prudent de retirer silencieusement les dernières personnes de la liste. Le meilleur comportement consiste à bloquer la réduction et à expliquer que certaines personnes doivent d’abord être déplacées. L’utilisateur doit voir leurs noms et pouvoir choisir leur nouvelle destination.

## L’import Excel peut remplacer toute la liste sans avertissement suffisant

Le bouton d’import donne l’impression d’ajouter des invités. En réalité, la méthode appelée dans `client/src/app/features/guests/guests.component.ts` remplace la liste complète.

Le serveur commence par vider la table des invités dans `server/src/guests/guests.service.ts`, puis il insère le contenu du fichier. Ces opérations ne sont pas regroupées dans une transaction. Si le fichier contient un problème ou si la base de données rencontre une erreur après la suppression, la liste peut rester vide ou incomplète.

Un import plus sûr devrait d’abord afficher un aperçu. L’application pourrait expliquer combien de personnes seront ajoutées, modifiées, ignorées ou supprimées. L’utilisateur choisirait ensuite entre fusionner les données et remplacer complètement la liste. Avant un remplacement, l’application devrait créer une sauvegarde restaurable.

## La base de données peut changer automatiquement en production

Le fichier `server/src/app.module.ts` active par défaut l’option `synchronize` de TypeORM. Cette option demande à l’outil de modifier automatiquement la structure de la base pour qu’elle ressemble aux classes du code.

C’est pratique au début d’un projet local, mais dangereux en production. Une modification de colonne ou de relation peut produire une transformation inattendue. Il est préférable d’utiliser des migrations. Une migration est un petit fichier qui décrit précisément le changement à appliquer à la base et qui peut être relu avant le déploiement.

Le volume PostgreSQL déclaré dans Docker conserve normalement les données entre les redéploiements, mais un volume n’est pas une sauvegarde. Si le volume est supprimé, corrompu ou remplacé par erreur, les données disparaissent avec lui. Il faut programmer des sauvegardes régulières avec `pg_dump`, les conserver en dehors du serveur principal et vérifier de temps en temps qu’elles peuvent réellement être restaurées.

## Le serveur accepte trop facilement des données incorrectes

Les contrôleurs NestJS reçoivent actuellement des objets TypeScript simples. Les types TypeScript aident le développeur pendant la compilation, mais ils disparaissent lorsque le programme fonctionne. Une personne peut envoyer une valeur qui ne fait pas partie des choix prévus, un nombre négatif de sièges, un prix invalide ou une date mal formée.

Il faut ajouter des objets de validation, souvent appelés DTO, ainsi qu’un `ValidationPipe` global. Le serveur pourra alors refuser proprement les données incorrectes avec un message compréhensible. Les règles importantes, comme la capacité d’une table ou l’existence d’un invité, doivent également être vérifiées dans le service et pas seulement dans le formulaire Angular.

## Plusieurs personnes peuvent écraser leurs modifications

Le projet ne possède pas encore de véritable système de collaboration. Deux personnes peuvent ouvrir l’application en même temps, mais le serveur ne détecte pas qu’elles travaillent sur des versions différentes d’une même information.

Imaginons qu’une personne corrige le téléphone d’un prestataire pendant qu’une autre modifie son prix depuis une page ouverte plus tôt. La seconde sauvegarde peut renvoyer une ancienne copie du téléphone et annuler la première correction sans avertissement.

Une colonne de version ou une date de dernière modification permettrait au serveur de détecter ce conflit. Il pourrait alors demander à l’utilisateur de recharger ou de choisir les informations à conserver. Un historique des changements rendrait aussi possible l’annulation d’une erreur.

## Les tests actuels ne protègent presque pas les règles importantes

Le serveur se compile correctement et son contrôle TypeScript passe. Le code Angular et les modèles HTML passent également la compilation statique. Cela confirme que les fichiers sont syntaxiquement cohérents.

En revanche, le projet ne contient aucun test métier du serveur. Le client possède seulement deux tests très généraux dans `client/src/app/app.spec.ts`. Ils vérifient essentiellement que l’application se crée et que le titre du tableau de bord apparaît. Ils ne testent pas un déplacement vers une table pleine, le retrait d’un enfant, un import interrompu ou une réduction de capacité.

Ces scénarios devraient devenir des tests automatiques. Un bon test créerait une situation précise dans une base temporaire, effectuerait l’action et vérifierait à la fois le résultat visible et le contenu réellement enregistré.

Le build Angular complet n’a pas pu être exécuté pendant cet audit parce que le dossier `node_modules` contient le binaire Windows d’esbuild alors que l’environnement d’analyse utilise WSL. Ce problème concerne l’environnement de développement, pas directement le fonctionnement métier de l’application. La compilation TypeScript et la vérification des modèles Angular ont tout de même réussi.

## Ce que proposent déjà les plateformes connues

[Mariages.net](https://www.mariages.net/site-web-mariage) réunit une liste de tâches, un budget, un suivi des prestataires, un plan de table et une liste d’invités. La plateforme propose aussi un site public ou privé pour le mariage. Les invités peuvent y confirmer leur présence et transmettre des informations comme leurs allergies ou leurs besoins de logement. Le plan de table peut être imprimé et transmis au lieu de réception.

[The Knot](https://www.theknot.com/wedding-planning-app) relie également le budget, les tâches, la liste d’invités, les réponses RSVP, le site du mariage, les cadeaux et la recherche de prestataires. La plateforme ajoute des rappels et une messagerie avec les prestataires.

[Joy](https://withjoy.com/wedding-website/) va assez loin dans l’expérience des invités. Une réponse peut dépendre de chaque événement. Une famille peut répondre ensemble, indiquer ses choix de repas et répondre à des questions personnalisées. Certaines parties du programme peuvent être visibles seulement par les personnes concernées. Joy permet aussi d’inviter plusieurs personnes à modifier le mariage sans partager un même mot de passe.

Mon Mariage ne possède pas encore ce lien direct avec les invités. Toutes les informations doivent être saisies par les organisateurs. Ajouter un petit portail invité apporterait donc beaucoup de valeur. Chaque foyer recevrait un lien privé. Il pourrait confirmer les personnes présentes, choisir les événements, signaler les régimes alimentaires, renseigner le transport et indiquer un besoin de couchage. Les réponses mettraient immédiatement à jour les données déjà utilisées par le logement et le plan de table.

Le projet devrait également remplacer les informations codées directement dans le code, comme la date, le lieu et certains noms de responsables, par une page de réglages. Cela rendrait l’application réutilisable pour un autre mariage et éviterait de redéployer le site pour modifier une information simple.

Un mode consacré au jour du mariage serait aussi utile. Il pourrait produire une version imprimable ou utilisable hors connexion avec le programme, les contacts importants, les paiements restants, les allergies, les chambres, les tables et les responsabilités de chacun.

## La fonctionnalité qui pourrait vraiment différencier Mon Mariage

La meilleure occasion n’est probablement pas de créer un nouvel annuaire de prestataires. Les grandes plateformes possèdent déjà des dizaines de milliers de profils, des avis et une visibilité très difficile à reproduire.

Mon Mariage pourrait plutôt devenir un espace privé de comparaison des devis, entièrement du côté du couple. On peut appeler cette fonctionnalité la salle de décision des prestataires.

Pour un traiteur, un photographe ou un DJ, le couple ajouterait plusieurs propositions. L’application ne comparerait pas seulement le prix affiché. Elle calculerait le coût total en tenant compte du nombre d’invités, des heures supplémentaires, du déplacement, de la location de matériel, du nettoyage, des taxes, des acomptes et du solde restant.

L’application montrerait aussi ce qui est inclus, ce qui manque et les questions qui restent sans réponse. Elle pourrait signaler qu’un devis ne parle pas des heures supplémentaires, que les conditions d’annulation sont peu claires ou qu’une prestation apparemment moins chère devient plus coûteuse après l’ajout des options indispensables.

Quand un prestataire est choisi, le devis retenu pourrait automatiquement créer les bonnes lignes dans le budget, les dates de paiement et les tâches de suivi. Les informations déjà présentes dans `Vendor.details`, les prix, les acomptes, les contrats, le budget et les tâches donnent au projet une bonne base pour construire cette fonction sans repartir de zéro.

## Pourquoi les grandes places de marché auraient du mal à faire la même chose

Il serait faux de dire que leurs développeurs sont incapables de créer un comparateur. La difficulté est économique, pas technique.

[Mariages.net présente son offre professionnelle](https://www.mariages.net/emp-Acceso.php) comme une plateforme de communication et de marketing qui aide les prestataires à recevoir des demandes de devis et à signer davantage de mariages. [WeddingPro explique](https://pros.weddingpro.com/our-products/) que la visibilité sur The Knot et WeddingWire est vendue sous forme d’abonnement publicitaire. [Zola indique](https://www.zola.com/faq/360002891772-what-does-it-cost-to-be-listed-on-zola-) que les prestataires peuvent payer pour entrer en contact avec les prospects et utiliser des offres donnant davantage de visibilité.

Ces entreprises ont donc intérêt à générer des contacts et à conserver de bonnes relations avec les prestataires qui financent une partie de leur activité. Un outil réellement indépendant pourrait dire qu’un prestataire mis en avant est trop cher, que son contrat comporte un risque, qu’il vaut mieux négocier son prix ou qu’une entreprise trouvée en dehors de la plateforme propose une meilleure offre. Ce type de conclusion peut réduire le nombre de contacts payants et mécontenter les annonceurs.

Mon Mariage n’a pas ce conflit s’il est financé directement par le couple, par exemple avec un achat unique, un petit abonnement ou une version auto-hébergée. Son classement peut rester sans publicité et ne défendre que l’intérêt des futurs mariés. Cette indépendance est une différence beaucoup plus crédible qu’un catalogue moins complet que celui des acteurs historiques.

## La direction recommandée

Avant de développer cette salle de décision, il faut sécuriser les fondations. L’application doit d’abord protéger l’accès aux données, utiliser des migrations et disposer de sauvegardes restaurables. Les déplacements de personnes doivent devenir transactionnels et toutes les capacités doivent être contrôlées par le serveur. L’import doit proposer un aperçu et une possibilité de restauration. Les scénarios les plus dangereux doivent être couverts par des tests automatiques.

Une fois cette base fiable, le portail RSVP serait la fonctionnalité quotidienne la plus utile. La collaboration, l’historique et les réglages rendraient ensuite le produit beaucoup plus facile à utiliser par un vrai couple et ses proches.

La salle de décision des prestataires pourrait enfin devenir la fonction qui donne une identité commerciale au projet. Mon Mariage ne serait plus seulement une copie simplifiée d’un organisateur connu. Il deviendrait un outil privé qui transforme les informations du mariage en décisions vérifiables, sans publicité cachée et sans intérêt financier à pousser un prestataire plutôt qu’un autre.
