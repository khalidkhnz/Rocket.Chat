#!/usr/bin/env bash
# Starts Mongo (docker) and the Meteor dev server with deploy/dev/.env loaded.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ ! -f deploy/dev/.env ]; then
  cp deploy/dev/.env.example deploy/dev/.env
  echo "created deploy/dev/.env from example — edit ADMIN_PASS before exposing this instance"
fi
docker compose -f deploy/dev/docker-compose.yml up -d --wait
set -a; . deploy/dev/.env; set +a
exec yarn dsv
