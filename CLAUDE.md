# CLAUDE.md - Expertly Develop Monorepo

Please review general instructions at `/Users/david/Code/_common/CLAUDE.md`.

For the full list of Expertly products and deployment URLs, see `/Users/david/CLAUDE.md`.

## This Monorepo

**Expertly Platform Monorepo** - Contains all Expertly applications

- **Coolify Service**: expertlydevelopsvc00000
- **GitHub**: https://github.com/david-wi/expertly-develop

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
curl -s -o /dev/null -w "qa: %{http_code}\n" https://qa.ai.devintensive.com/
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
| QA / Vibetest | `apps/qa` | https://qa.ai.devintensive.com / https://vibetest.ai.devintensive.com | Vibe testing platform |
| Vibecode | `apps/vibecode` | https://vibecode.ai.devintensive.com | Vibe coding platform |

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

- Coolify manages deployments via `docker-compose.prod.yml`
- Traefik routes traffic based on `/traefik/dynamic/expertly-apps.yaml`
- Container naming: `{service}-expertlydevelopsvc00000`
- After Coolify deployments, verify traefik config points to correct container names

## Environment Variables

Define requires:
- `NEXTAUTH_URL` - e.g., https://define.ai.devintensive.com
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `ANTHROPIC_API_KEY` - For AI features
