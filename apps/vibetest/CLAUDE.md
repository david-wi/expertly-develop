# CLAUDE.md - Vibetest (Vibe Testing Platform)

## Deployment

This app is part of the expertly-develop monorepo and deploys automatically via GitHub Actions when pushing to main.

- **Deployment URL**: https://vibetest.ai.devintensive.com
- **Backend API**: https://vibetest.ai.devintensive.com/api/v1

### Manual Deployment (if needed)

```bash
# SSH to server
ssh -i ~/.ssh/do_droplet root@152.42.152.243

# Deploy from monorepo
cd /opt/expertly-develop && git pull && docker compose -f docker-compose.prod.yml up -d vibetest-backend vibetest-frontend vibetest-db --build

# Run migrations if needed
docker exec expertly-develop-vibetest-backend-1 alembic upgrade head
```

### Architecture
- Part of expertly-develop monorepo
- Uses docker-compose.prod.yml for production
- Frontend nginx proxies /api to vibetest-backend
- Traefik handles HTTPS and routing

## Default User
- Email: david@bodnick.com
- Password: david123

## Tech Stack
- Backend: FastAPI, SQLAlchemy, PostgreSQL, Alembic
- Frontend: React, TypeScript, Vite
- Auth: JWT with bcrypt password hashing
