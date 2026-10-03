#!/usr/bin/env bash
# Build the production image from this checkout. Needs Docker with buildx and
# ~10 GB RAM available to the Docker VM (Meteor build). Takes 30-60 min cold.
set -euo pipefail
cd "$(dirname "$0")/../.."

IMAGE="${IMAGE:-ghcr.io/khalidkhnz/technotribes-chat}"
TAG="${TAG:-$(git rev-parse --short HEAD)}"
PUSH="${PUSH:-false}"

args=(--platform linux/amd64 -f deploy/prod/Dockerfile -t "$IMAGE:$TAG" -t "$IMAGE:latest")
if [ "$PUSH" = "true" ]; then args+=(--push); else args+=(--load); fi

docker buildx build "${args[@]}" .
echo "built $IMAGE:$TAG"
