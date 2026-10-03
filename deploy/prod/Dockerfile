# syntax=docker/dockerfile:1.7
# Builds the TechnoTribes chat image from source. Must be built for linux/amd64:
#   docker buildx build --platform linux/amd64 -f deploy/prod/Dockerfile -t technotribes-chat .
# Stage 1 mirrors CI (.github/actions/meteor-build): yarn → turbo build → meteor build.
# Stage 2 mirrors apps/meteor/.docker/Dockerfile.alpine (release-standard).

FROM node:24.15.0-bullseye AS bundle

ENV LANG=C.UTF-8 \
    METEOR_ALLOW_SUPERUSER=1 \
    NODE_OPTIONS=--max-old-space-size=8192 \
    TOOL_NODE_FLAGS=--max-old-space-size=8192 \
    CI=true

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && npm install -g meteor@3.5.2

WORKDIR /src
COPY . .

RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install --immutable

RUN yarn build

RUN cd apps/meteor \
    && METEOR_DISABLE_OPTIMISTIC_CACHING=1 meteor build --server-only --directory /tmp/dist \
    && cd /tmp/dist/bundle/programs/server \
    && find . -type d \( -name '@swc' -o -name 'typescript' \) -prune -exec rm -rf {} + \
    && find /tmp/dist/bundle -type f -name '*.d.ts' -delete


FROM node:24.15.0-alpine3.23 AS deps

ENV LANG=C.UTF-8 NODE_ENV=production
RUN apk add --no-cache python3 make g++ py3-setuptools libc6-compat

COPY --from=bundle /tmp/dist/bundle /app/bundle

RUN cd /app/bundle/programs/server \
    && npm install --omit=dev \
    && npm cache clean --force \
    && find /app/bundle/programs/server/npm/node_modules -type f -name '*.map' -delete \
    && find /app/bundle/programs/web.browser -type f -name '*.map' -delete \
    && STALE_BUILDS="$(find /app/bundle/programs/server/npm/node_modules -type d -name prebuilds)" \
    && for d in $STALE_BUILDS; do rm -rf "${d%/prebuilds}/build"; done


FROM node:24.15.0-alpine3.23 AS release

LABEL org.opencontainers.image.title="TechnoTribes Chat" \
      org.opencontainers.image.source="https://github.com/khalidkhnz/Rocket.Chat"

ENV LANG=C.UTF-8

RUN apk add --no-cache shadow ttf-dejavu \
    && apk upgrade --no-cache openssl \
    && groupmod -n rocketchat nogroup \
    && useradd -u 65533 -r -g rocketchat rocketchat

ENV DEPLOY_METHOD=docker \
    NODE_ENV=production \
    MONGO_URL=mongodb://mongo:27017/technotribes?replicaSet=rs0 \
    HOME=/tmp \
    PORT=3000 \
    ROOT_URL=http://localhost:3000 \
    Accounts_AvatarStorePath=/app/uploads

USER rocketchat
COPY --from=deps --chown=rocketchat:rocketchat /app /app
VOLUME /app/uploads
WORKDIR /app/bundle
EXPOSE 3000
CMD ["node", "main.js"]
