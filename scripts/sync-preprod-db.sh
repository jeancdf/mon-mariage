#!/usr/bin/env bash
# Replace the preprod database with a copy of the production database.
#
# Production is only read (pg_dump). Only the preprod Postgres is written.
# Runs on the VPS, from cron (daily) and from the preprod deploy workflow.
set -euo pipefail

container() {
  docker ps -q \
    --filter "label=com.docker.compose.project=$1" \
    --filter "label=com.docker.compose.service=$2"
}

PROD_DB="$(container mon-mariage postgres)"
PREPROD_DB="$(container mon-mariage-preprod postgres)"
PREPROD_BACKEND="$(container mon-mariage-preprod backend)"

if [ -z "${PROD_DB}" ] || [ -z "${PREPROD_DB}" ] || [ "${PROD_DB}" = "${PREPROD_DB}" ]; then
  echo "Refusing to sync: production or preprod Postgres container not found unambiguously." >&2
  exit 1
fi

DUMP="$(mktemp)"
cleanup() {
  rm -f "${DUMP}"
  # Always bring the preprod API back, even after a failed restore.
  if [ -n "${PREPROD_BACKEND}" ]; then docker start "${PREPROD_BACKEND}" > /dev/null || true; fi
}
trap cleanup EXIT

echo "$(date -u +%FT%TZ) dumping production"
docker exec "${PROD_DB}" sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges' < /dev/null > "${DUMP}"
test -s "${DUMP}"

# Stop the preprod API so nothing writes while the schema is replaced.
if [ -n "${PREPROD_BACKEND}" ]; then docker stop "${PREPROD_BACKEND}" > /dev/null; fi

echo "$(date -u +%FT%TZ) restoring into preprod"
docker exec "${PREPROD_DB}" sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"' < /dev/null
docker exec -i "${PREPROD_DB}" sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' < "${DUMP}"

echo "$(date -u +%FT%TZ) preprod now mirrors production"
