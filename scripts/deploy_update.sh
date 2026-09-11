#!/bin/bash
set -Eeuo pipefail

PROJECT_DIR="/opt/plexsync"
RELEASE_ARCHIVE="/tmp/plexsync-release.tar.gz"
BACKUP_DIR="/opt/plexsync-security-backups/$(date -u +%Y%m%dT%H%M%SZ)"

echo "[1/6] Creando respaldo previo de seguridad en $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"
cd "$PROJECT_DIR"

docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' | gzip -9 > "$BACKUP_DIR/database.sql.gz"
tar \
  --exclude='./backend/node_modules' \
  --exclude='./backend/dist' \
  --exclude='./frontend/node_modules' \
  --exclude='./frontend/.next' \
  -czf "$BACKUP_DIR/source.tar.gz" .

echo "[2/6] Extrayendo nueva versión en $PROJECT_DIR..."
tar -xzf "$RELEASE_ARCHIVE" -C "$PROJECT_DIR"
chmod 600 .env

echo "[3/6] Sincronizando esquema de base de datos con Prisma..."
docker compose run --rm --no-deps --entrypoint ./node_modules/.bin/prisma backend db push --skip-generate --accept-data-loss

echo "[4/6] Reconstruyendo imágenes de Backend y Frontend..."
docker compose build

echo "[5/6] Iniciando contenedores actualizados..."
docker compose up -d --remove-orphans

echo "[6/6] Verificando estado de salud de PlexSync..."
# El frontend escucha en FRONTEND_BIND_IP (por defecto 127.0.0.1).
BIND_IP="$(awk -F= '/^FRONTEND_BIND_IP=/{print $2}' .env | tr -d '\r' | tail -n 1)"
BIND_IP="${BIND_IP:-127.0.0.1}"
HEALTHY=0
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://${BIND_IP}:3000/api/setup/status" || curl -fsS -o /dev/null http://127.0.0.1:3000/api/setup/status; then
    echo "PlexSync está activo y respondiendo correctamente (intento $i)."
    HEALTHY=1
    break
  fi
  sleep 2
done

if [ "$HEALTHY" -ne 1 ]; then
  echo "Error: la aplicación no respondió a tiempo." >&2
  exit 1
fi

echo "=========================================="
echo "Estado de los contenedores en Producción:"
echo "=========================================="
docker compose ps
echo "Despliegue completado con éxito."
