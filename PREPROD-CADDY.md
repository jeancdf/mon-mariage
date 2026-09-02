# Préproduction — Caddy, DuckDNS et secret GitHub

La stack préprod tourne sur le **même VPS** que la prod, avec des noms
et des ports qui ne peuvent pas collisionner :

| | Production | Préproduction |
|---|---|---|
| Branche | `main` | `preprod` |
| Projet Compose | `mon-mariage` | `mon-mariage-preprod` |
| Volume Postgres | `mon-mariage_postgres_data` | `mon-mariage-preprod_postgres_data` |
| Réseau Docker | `mon-mariage_default` | `mon-mariage-preprod_default` |
| Conteneur front | `mon-mariage-frontend-1` | `mon-mariage-preprod-frontend-1` |
| Port front (localhost) | `9003` | `9004` |
| Port API (localhost) | `3007` | `3008` |
| Domaine | `mon-mariage.duckdns.org` | `preprod-mon-mariage.duckdns.org` |
| Dossier distant | `~/mon-mariage` | `~/mon-mariage-preprod` |

HTTPS est terminé par `qr_caddy` dans le dépôt **qr-code**
(`github.com/jeancdf/qr-code`). Ne pas modifier ce dépôt depuis ici :
ajouter le bloc ci-dessous plus tard, à la main.

## 1. Enregistrement DuckDNS

DuckDNS n’accepte qu’un seul label. Créer l’enregistrement :

```
preprod-mon-mariage  →  <même IP publique que mon-mariage.duckdns.org>
```

Soit le FQDN `preprod-mon-mariage.duckdns.org`.

## 2. Secret GitHub `FULLSTACK_ENV_PREPROD`

Dans le dépôt `jeancdf/mon-mariage`, créer le secret d’Actions
`FULLSTACK_ENV_PREPROD` (contenu du fichier `.env` distant). Réutiliser
`VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` / `VPS_PORT`. Ne pas réutiliser
`FULLSTACK_ENV_PRODUCTION` : mots de passe Postgres, session et compte
organisateur doivent être **distincts** de la prod.

Modèle (valeurs factices uniquement) — voir aussi `.env.preprod.example` :

```
FRONTEND_HOST_PORT=9004
BACKEND_HOST_PORT=3008
PUBLIC_DOMAIN=preprod-mon-mariage.duckdns.org

POSTGRES_DB=mon_mariage_preprod
POSTGRES_USER=mon_mariage
POSTGRES_PASSWORD=replace-with-strong-password

BACKEND_PORT=3000
CLIENT_ORIGIN=https://preprod-mon-mariage.duckdns.org
DB_NAME=mon_mariage_preprod
DB_USER=mon_mariage
DB_PASSWORD=replace-with-strong-password
DB_SSL=false
DB_SYNCHRONIZE=true

SESSION_SECRET=replace-with-at-least-32-random-characters
PRIVATE_EVENT_CODE=replace-with-private-event-code
BOOTSTRAP_ORGANIZER_EMAIL=organizer@example.com
BOOTSTRAP_ORGANIZER_PASSWORD=replace-with-strong-password
WEDDING_DATE=2027-07-16
WEDDING_PLACE=Escayrac
TIMEZONE=Europe/Paris
COUPLE_NAME_1=
COUPLE_NAME_2=
```

Le workflow écrase les ports et le domaine ci-dessus à chaque déploiement.
`COUPLE_NAME_1` / `COUPLE_NAME_2` sont optionnels : le site public affiche
ces prénoms s’ils sont renseignés, sinon seulement la date et le lieu
(ne pas inventer de noms).

Secret optionnel : `REMOTE_PREPROD_APP_DIR` (défaut `~/mon-mariage-preprod`).

## 3. Caddy (dépôt qr-code)

La stack préprod doit être **déjà up** (le réseau externe n’existe qu’après
le premier `docker compose up` du projet `mon-mariage-preprod`).

Dans `qr-code/docker-compose.prod.yml` :

### Réseau du service `caddy`

Ajouter `mon_mariage_preprod_net` à `services.caddy.networks` :

```yaml
    networks:
      - app_net
      - agridom_net
      - mon_mariage_net
      - mon_mariage_preprod_net
      - cv_net
```

### Déclaration du réseau externe

```yaml
  # preprod mon-mariage (projet Compose mon-mariage-preprod)
  mon_mariage_preprod_net:
    external: true
    name: mon-mariage-preprod_default
```

### Bloc site dans le Caddyfile embarqué (`configs.caddyfile.content`)

À coller à côté du bloc prod `mon-mariage.duckdns.org` :

```
      preprod-mon-mariage.duckdns.org {
        reverse_proxy mon-mariage-preprod-frontend-1:80
      }
```

Puis redéployer `qr_caddy` depuis le dépôt qr-code (recréer le service
Caddy pour recharger le Caddyfile et joindre le nouveau réseau).

Le check HTTPS du workflow `deploy-preprod-compose.yml` a besoin de
DuckDNS **et** de ce proxy. Faire ces trois étapes avant (ou juste après)
le premier push sur `preprod`, puis relancer le workflow si le check public
a échoué.
