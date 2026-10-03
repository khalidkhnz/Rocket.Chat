# TechnoTribes Chat — deployment

Self-hosted team chat built on the Rocket.Chat codebase (this fork, branch `technotribes`).

## Sizing

| Users | App container | MongoDB | Disk |
|---|---|---|---|
| ≤ 50 | 2 vCPU / 4 GB | 2 vCPU / 4 GB (`MONGO_CACHE_GB=1`) | 40 GB SSD |
| 50–500 | 4 vCPU / 8 GB | 4 vCPU / 8 GB (`MONGO_CACHE_GB=3`) | 100 GB+ SSD |
| 500–2000 | 2× app replicas behind Caddy, 4 vCPU / 8 GB each | separate host, 3-node replica set, 8 GB each | NVMe, 200 GB+ |

One app process uses one CPU core. Scale by adding replicas, not bigger boxes.
Move uploads to S3 (see `.env.example`) before the uploads volume gets large.

Requirements on the host: Docker 24+ with compose v2, ports 80/443 open, a DNS record for `DOMAIN`.

## First deploy

```bash
git clone -b technotribes https://github.com/khalidkhnz/Rocket.Chat.git && cd Rocket.Chat/deploy/prod
cp .env.example .env            # set DOMAIN, ROOT_URL, ADMIN_PASS
./build.sh                      # bundles with local Node 24 + Meteor 3.5.2, packages as linux/amd64 image (~20-30 min)
docker compose up -d
docker compose logs -f rocketchat   # wait for "SERVER RUNNING"
```

Open `https://$DOMAIN`, log in with `ADMIN_USERNAME` / `ADMIN_PASS`. The setup wizard and
Rocket.Chat cloud registration are skipped by the `OVERWRITE_SETTING_*` vars.

`build.sh` has two modes. `MODE=host` (default) needs Node 24, Yarn 4 and Meteor 3.5.2 on the
machine running it (any OS/arch; it cross-bundles for linux x64) and only uses Docker for the final
packaging step. `MODE=docker` builds everything inside Docker from `deploy/prod/Dockerfile` and
needs an amd64 Docker host with 10 GB+ RAM (CI runners, Linux servers) — it does not fit Docker
Desktop on a 16 GB Mac.

Building elsewhere: `PUSH=true IMAGE=ghcr.io/khalidkhnz/technotribes-chat ./build.sh`, then on the
server set `TAG=<sha>` in `.env` and `docker compose pull && docker compose up -d`.

## Upgrade

```bash
git pull
./build.sh                      # or: docker compose pull (if built elsewhere)
docker compose up -d rocketchat
```

Database migrations run automatically on boot. Back up first.

## Backup

```bash
docker compose exec mongo mongodump --archive --gzip --db technotribes > backup-$(date +%F).archive.gz
docker run --rm -v prod_uploads:/u -v "$PWD":/b alpine tar czf /b/uploads-$(date +%F).tgz -C /u .
```

Restore: `mongorestore --archive --gzip --drop < backup.archive.gz` inside the mongo container.

## Keeping up with upstream

```bash
git fetch upstream
git checkout develop && git merge --ff-only upstream/develop && git push
git checkout technotribes && git rebase develop
node scripts/brand/rebrand-i18n.mjs      # re-apply i18n brand strings after conflicts
node scripts/brand/generate-assets.mjs   # only if upstream touched public/images/logo
```

Brand edits live in: `scripts/brand/`, `packages/logo/src`, `apps/meteor/server/settings/{general,email,layout,omnichannel,setup-wizard}.ts`,
`apps/meteor/server/lib/ui-master/index.ts`, `apps/meteor/client/{sidebar,views/root,views/home}`, `packages/web-ui-registration/src/components`.

## Licensing note

`ee/` and `apps/meteor/ee/` remain under Rocket.Chat's Enterprise license (see root `LICENSE`).
Running them for internal use without a license key is how upstream's community edition works;
do not redistribute the built image publicly.
