# Mon Mariage API

Backend NestJS pour l'application de planning de mariage.

## Prérequis

- Node.js
- Docker

## Démarrer Postgres

Depuis la racine du repo :

```bash
docker compose up -d postgres
```

La base est exposée sur `localhost:5432` par défaut. Pour utiliser un autre port hôte, définissez `POSTGRES_HOST_PORT` avant de lancer Docker Compose.

## Configuration

```bash
cp .env.example .env
```

## Démarrer l'API

```bash
npm install
npm run start:dev
```

Endpoints de base :

- `GET /`
- `GET /api/health`

## Hébergement par nuit

Le calendrier couvre les nuits de J-7 à J+1, selon `WEDDING_DATE`. Une réservation
va de `from` inclus à `until` exclu (date de départ). Une personne peut avoir une
chambre différente chaque nuit, mais une seule chambre par nuit. Les changements
sur plusieurs nuits sont atomiques : un conflit de capacité annule toute la période.

- `GET /api/housing/calendar` : personnes, séjours, logements et réservations.
- `PUT /api/housing/people/:guestId/stay` : `arrivalDate`, `departureDate`.
- `PUT /api/housing/assignments/:guestId` : `roomId` (ou `null` pour libérer), `from`, `until`.
- L'endpoint historique `GET /api/housing` conserve la vue de la nuit du mariage.

À la mise à jour, les placements existants sont conservés comme réservations de la
nuit du mariage. Vérifier `WEDDING_DATE` avant le premier démarrage. Avec la configuration
actuelle `DB_SYNCHRONIZE=true`, TypeORM ajoute le schéma et le démarrage renseigne les
anciennes nuits manquantes. Avec `DB_SYNCHRONIZE=false`, appliquer
`sql/2026-09-19-nightly-housing.sql` avant de démarrer la nouvelle API, après sauvegarde
de la base et arrêt de l'ancienne API. Ne pas exécuter simultanément les deux versions.

Les tests `test/guests-housing.test.js` couvrent les conflits, changements de lieu,
départs exclusifs et conservation des données avec des repositories simulés. Ils
ne remplacent pas une validation de migration et de concurrence sur PostgreSQL.
La chaîne de production exécute également `node test-postgres/nightly-housing.js`
sur PostgreSQL 16 avant tout déploiement : reprise de l'ancien schéma avec TypeORM
et avec le script SQL, conservation des placements, conflits atomiques et réservations
concurrentes. Ce test exige une base jetable nommée `mon_mariage_test` via
`TEST_DATABASE_URL` et en recrée le schéma.
