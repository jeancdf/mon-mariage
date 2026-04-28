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

La base est exposée sur `localhost:5433` pour éviter les conflits avec une installation Postgres locale.

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
- `GET /health`
