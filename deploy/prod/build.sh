#!/usr/bin/env bash
# Build the production image (linux/amd64).
#
#   MODE=host   (default) bundle the Meteor app on this machine with the local
#               Node/Yarn/Meteor toolchain, then package it with upstream's
#               release Dockerfile. Fast; works on macOS arm64 and Linux.
#   MODE=docker build everything inside Docker from deploy/prod/Dockerfile.
#               Needs an amd64 Docker host with >= 10 GB RAM; use on CI/servers.
#
#   IMAGE=... TAG=... PUSH=true ./build.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

MODE="${MODE:-host}"
IMAGE="${IMAGE:-ghcr.io/khalidkhnz/technotribes-chat}"
TAG="${TAG:-$(git rev-parse --short HEAD)}"
PUSH="${PUSH:-false}"
DIST="${DIST:-/tmp/technotribes-dist}"

docker_args=(--platform linux/amd64 -t "$IMAGE:$TAG" -t "$IMAGE:latest")
if [ "$PUSH" = "true" ]; then docker_args+=(--push); else docker_args+=(--load); fi

if [ "$MODE" = "docker" ]; then
  docker buildx build "${docker_args[@]}" -f deploy/prod/Dockerfile .
  echo "built $IMAGE:$TAG"
  exit 0
fi

command -v meteor >/dev/null || { echo "meteor not found (curl https://install.meteor.com | sh)"; exit 1; }
command -v yarn >/dev/null || { echo "yarn not found (corepack enable)"; exit 1; }

# Pull native binaries for the target image (linux x64, musl) alongside the host's,
# the same way CI does, then restore the committed yarn config.
cp .yarnrc.yml .yarnrc.yml.bak
trap 'mv .yarnrc.yml.bak .yarnrc.yml' EXIT
yarn config set supportedArchitectures --json '{"os":["darwin","linux"],"cpu":["arm64","x64"],"libc":["glibc","musl"]}'
yarn install
yarn build

rm -rf "$DIST"
(
  cd apps/meteor
  METEOR_DISABLE_OPTIMISTIC_CACHING=1 TOOL_NODE_FLAGS="${TOOL_NODE_FLAGS:---max-old-space-size=8192}" \
    meteor build --server-only --directory "$DIST" --architecture os.linux.x86_64
)

# Same pruning CI applies before docker build: build-time-only packages and
# native binaries for other platforms. @swc/helpers is a runtime dependency; keep it.
NPM="$DIST/bundle/programs/server/npm/node_modules"
find "$DIST/bundle/programs/server" -type d -path '*/node_modules/typescript' -prune -exec rm -rf {} +
find "$DIST/bundle/programs/server" -type d -path '*/@swc/core-*' -not -name 'core-linux-x64-musl' -prune -exec rm -rf {} +
[ -d "$NPM/@img" ] && find "$NPM/@img" -mindepth 1 -maxdepth 1 -type d -name 'sharp-*' -not -name '*-linuxmusl-x64' -exec rm -rf {} +
[ -d "$NPM/@napi-rs" ] && find "$NPM/@napi-rs" -mindepth 1 -maxdepth 1 -type d -name 'pinyin-*' -not -name '*-linux-x64-*' -exec rm -rf {} +
[ -d "$NPM/@esbuild" ] && find "$NPM/@esbuild" -mindepth 1 -maxdepth 1 -type d -not -name 'linux-x64' -exec rm -rf {} +

docker buildx build "${docker_args[@]}" -f apps/meteor/.docker/Dockerfile.alpine --target release-standard "$DIST"
echo "built $IMAGE:$TAG from $DIST"
