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
