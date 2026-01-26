# CLAUDE.md - Vibe QA Project Instructions

## Deployment

**ALWAYS deploy to Digital Ocean after making changes.**

- After commits, push to GitHub and deploy to the DO droplet
- Deployment URL: **https://qa.ai.devintensive.com**
- Backend API: https://qa.ai.devintensive.com/api/v1

### Deployment Commands

```bash
# SSH to server
ssh -i ~/.ssh/do_droplet root@152.42.152.243

# Deploy latest (uses Traefik for routing)
cd /root/vibe-qa && git pull && docker compose -f docker-compose.prod.yml up -d --build

# Run migrations if needed
docker exec vibe-qa-backend-1 alembic upgrade head

# Create default user if needed
docker exec vibe-qa-backend-1 python3 -c "
import bcrypt, psycopg
conn = psycopg.connect('postgresql://vibeqa:vibeqa@db:5432/vibeqa')
cur = conn.cursor()
cur.execute(\"INSERT INTO organizations (id, name, slug, is_active, created_at, updated_at) VALUES ('00000000-0000-0000-0000-000000000001', 'David Organization', 'david', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING\")
pw = bcrypt.hashpw(b'david123', bcrypt.gensalt()).decode()
cur.execute(\"INSERT INTO users (id, organization_id, email, password_hash, full_name, role, is_active, is_verified, created_at, updated_at) VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'david@bodnick.com', %s, 'David', 'owner', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING\", (pw,))
conn.commit()
"
```

### Architecture
- Uses docker-compose.prod.yml for production
- Deployed via Coolify with custom domain
- Frontend nginx proxies /api to backend

## Default User
- Email: david@bodnick.com
- Password: david123

## Tech Stack
- Backend: FastAPI, SQLAlchemy, PostgreSQL, Alembic
- Frontend: React, TypeScript, Vite
- Auth: JWT with bcrypt password hashing
