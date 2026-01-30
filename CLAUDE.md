# CLAUDE.md - Expertly Develop Monorepo

Please review general instructions at `/Users/david/Code/_common/CLAUDE.md`.

For the full list of Expertly products and deployment URLs, see `/Users/david/CLAUDE.md`.

## .claude/ Directory

This project uses the standard `.claude/` directory structure for docs, planning, request-history, performance, skills, and gitignore (for credentials). See `_common/CLAUDE.md` for details.

## This Monorepo

**Expertly Platform Monorepo** - Contains all Expertly applications

- **GitHub**: https://github.com/david-wi/expertly-develop
- **Deployment**: GitHub Actions (auto-deploys on push to main)
- **Server Path**: /opt/expertly-develop

## Git Workflow - REQUIRED

**Direct pushes to main are blocked.** All changes must go through PRs with passing checks.

### Standard Workflow for Code Changes

```bash
# 1. Create branch and commit
git checkout -b feature/description
git add <files>
git commit -m "Description"

# 2. Push and create PR with automerge
git push -u origin HEAD
gh pr create --fill
gh pr merge --auto --squash

# 3. Wait for checks to pass (REQUIRED - do not skip)
gh pr checks --watch

# 4. If checks fail, fix and push again
# 5. Once merged, clean up
git checkout main && git pull && git branch -d feature/description
```

### Why Wait for Checks?
- 9 typecheck jobs must pass before merge
- If you don't wait, failed PRs sit unnoticed
- Always verify the PR actually merged before moving on

## Deployed Services Checklist

**IMPORTANT: After any deployment, verify ALL services are working:**

```bash
# Quick health check for all services
curl -s -o /dev/null -w "define: %{http_code}\n" https://define.ai.devintensive.com/
curl -s -o /dev/null -w "develop: %{http_code}\n" https://develop.ai.devintensive.com/
curl -s -o /dev/null -w "identity: %{http_code}\n" https://identity.ai.devintensive.com/
curl -s -o /dev/null -w "admin: %{http_code}\n" https://admin.ai.devintensive.com/
curl -s -o /dev/null -w "manage: %{http_code}\n" https://manage.ai.devintensive.com/
curl -s -o /dev/null -w "salon: %{http_code}\n" https://salon.ai.devintensive.com/
curl -s -o /dev/null -w "today: %{http_code}\n" https://today.ai.devintensive.com/
curl -s -o /dev/null -w "vibetest: %{http_code}\n" https://vibetest.ai.devintensive.com/
curl -s -o /dev/null -w "vibecode: %{http_code}\n" https://vibecode.ai.devintensive.com/
curl -s -o /dev/null -w "vibetest: %{http_code}\n" https://vibetest.ai.devintensive.com/
curl -s -o /dev/null -w "chem: %{http_code}\n" https://chem.ai.devintensive.com/
curl -s -o /dev/null -w "demos: %{http_code}\n" https://demos.ai.devintensive.com/
```

## Apps in This Monorepo

| App | Directory | URL | Description |
|-----|-----------|-----|-------------|
| Define | `apps/define` | https://define.ai.devintensive.com | AI-powered Requirements Management |
| Develop | `apps/develop` | https://develop.ai.devintensive.com | Automated visual walkthroughs |
| Identity | `apps/identity` | https://identity.ai.devintensive.com | Identity/Auth service |
| Admin | `apps/admin` | https://admin.ai.devintensive.com | Theme management admin |
| Manage | `apps/manage` | https://manage.ai.devintensive.com | Queue-driven task management |
| Salon | `apps/salon` | https://salon.ai.devintensive.com | Salon management |
| Today | `apps/today` | https://today.ai.devintensive.com | Task/workflow management |
| Vibetest | `apps/vibetest` | https://vibetest.ai.devintensive.com | Vibe testing platform |
| Vibecode | `apps/vibecode` | https://vibecode.ai.devintensive.com | Vibe coding platform |

## Adding New Apps - CHECKLIST

**When adding a new app to the monorepo, update these files:**

1. **`docker-compose.prod.yml`** - Add frontend, backend, and database services with Traefik labels
2. **`config/monitored-services.json`** - Add frontend and API entries for admin monitoring page
3. **`.github/workflows/typecheck.yml`** - Add typecheck job for the new frontend (if applicable)
4. **This file (`CLAUDE.md`)** - Add to "Apps in This Monorepo" table and health check curl commands
5. **`/Users/david/CLAUDE.md`** - Add to "Deployed Apps" list

## Other Deployed Services (Not in Monorepo)

| Service | URL | Notes |
|---------|-----|-------|
| Chem | https://chem.ai.devintensive.com | Separate deployment |
| Demos | https://demos.ai.devintensive.com | FastAPI static file server |

## Future/Planned Services

See `apps/future/` directory for planned services that are not yet implemented:
- design.ai.devintensive.com
- hospitality.ai.devintensive.com
- logistics.ai.devintensive.com
- partnerships.ai.devintensive.com
- simulate.ai.devintensive.com

## Shared Packages

| Package | Directory | Description |
|---------|-----------|-------------|
| @expertly/ui | `packages/ui` | Shared UI components and styles |

## Deployment Notes

- **GitHub Actions** deploys automatically on push to main branch using **blue-green deployment**
- Workflow: `.github/workflows/deploy.yml`
- Traefik routes traffic via Docker labels in `docker-compose.prod.yml`
- Container naming: `expertly-{blue|green}-{service}-1` (NOT `expertly-develop-*`)
- Server path: `/opt/expertly-develop`
- Deployment state: `/opt/deployment-state.json` (shows `{"active": "blue"}` or `{"active": "green"}`)

## Manual Docker Operations - CRITICAL

**The deployment uses blue-green deployment. Manual commands MUST use the correct project name.**

### Why This Matters

The CI/CD creates containers named `expertly-green-*` or `expertly-blue-*`. If you run manual commands without specifying the project name, Docker Compose creates competing `expertly-develop-*` containers. The next CI/CD deployment will stop these "legacy" containers, causing unexpected outages.

### Check Current Active Deployment
```bash
ssh -i ~/.ssh/do_droplet root@152.42.152.243 "cat /opt/deployment-state.json"
```
This shows `{"active": "blue"}` or `{"active": "green"}`.

### Correct Manual Commands

**ALWAYS use the active color from deployment-state.json:**

```bash
# For green deployment (if active is "green"):
ssh -i ~/.ssh/do_droplet root@152.42.152.243 \
  "cd /opt/expertly-develop && COMPOSE_PROJECT_NAME=expertly-green docker compose -f docker-compose.prod.yml up -d"

# For blue deployment (if active is "blue"):
ssh -i ~/.ssh/do_droplet root@152.42.152.243 \
  "cd /opt/expertly-develop && COMPOSE_PROJECT_NAME=expertly-blue docker compose -f docker-compose.prod.yml up -d"
```

### One-Liner to Auto-Detect Active Color
```bash
ssh -i ~/.ssh/do_droplet root@152.42.152.243 'cd /opt/expertly-develop && COMPOSE_PROJECT_NAME="expertly-$(cat /opt/deployment-state.json | python3 -c "import sys,json; print(json.load(sys.stdin)[\"active\"])")" docker compose -f docker-compose.prod.yml up -d'
```

### To Rebuild a Specific Service
```bash
# Replace COLOR with the active color (green or blue)
ssh -i ~/.ssh/do_droplet root@152.42.152.243 \
  "cd /opt/expertly-develop && COMPOSE_PROJECT_NAME=expertly-COLOR docker compose -f docker-compose.prod.yml up -d --build service-name"
```

### NEVER DO THIS
```bash
# WRONG - Creates competing "expertly-develop-*" containers that get killed by CI/CD:
docker compose -f docker-compose.prod.yml up -d

# WRONG - Same problem without project name:
ssh root@152.42.152.243 "cd /opt/expertly-develop && docker compose -f docker-compose.prod.yml up -d --build"
```

### Troubleshooting Container Conflicts

If you see both `expertly-develop-*` AND `expertly-{blue|green}-*` containers:
```bash
# 1. Check what containers exist
ssh -i ~/.ssh/do_droplet root@152.42.152.243 "docker ps --format '{{.Names}}' | grep expertly | sort"

# 2. Remove the legacy expertly-develop-* containers
ssh -i ~/.ssh/do_droplet root@152.42.152.243 "cd /opt/expertly-develop && docker compose -f docker-compose.prod.yml down --remove-orphans"

# 3. Verify only blue/green containers remain and services work
```

### After ANY manual docker operation:
1. Run the health check for ALL services (see checklist above)
2. If any service returns 404, check which containers are running and ensure correct project name is used

## Docker Disk Space Management

**IMPORTANT: Clean up Docker resources periodically to prevent disk space issues.**

The server has 77GB disk. Without cleanup, Docker build cache and unused images accumulate and can fill the disk, causing build failures.

### Quick Disk Check
```bash
ssh -i ~/.ssh/do_droplet root@152.42.152.243 'df -h / && docker system df'
```

### Cleanup When Disk is Low (< 20GB free)
```bash
# Remove unused images, containers, and volumes
ssh -i ~/.ssh/do_droplet root@152.42.152.243 'docker system prune -af --volumes'

# Remove build cache (can be 10-20GB)
ssh -i ~/.ssh/do_droplet root@152.42.152.243 'docker builder prune -af'
```

### When to Clean Up
- Before manual rebuilds if disk is low
- After failed builds (partial images accumulate)
- Weekly as routine maintenance
- If you see "no space left on device" errors

### Signs of Disk Space Issues
- Build errors mentioning `ENOSPC`
- `npm ci` failing with tar extraction errors
- Docker commands hanging unexpectedly

## Environment Variables

Define requires:
- `NEXTAUTH_URL` - e.g., https://define.ai.devintensive.com
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `ANTHROPIC_API_KEY` - For AI features
