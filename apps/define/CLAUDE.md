# CLAUDE.md - Expertly Define

Please review general instructions at `/Users/david/Code/_common/CLAUDE.md`.

For the full list of Expertly products and deployment URLs, see `/Users/david/CLAUDE.md`.

## This Project

**Expertly Define** - AI-powered Requirements Management tool

- **URL**: https://define.ai.devintensive.com/
- **Stack**: Next.js 16 + SQLite + Drizzle ORM + NextAuth

## Key Features

- Product and requirements management with hierarchical tree structure
- Version history and change tracking
- NextAuth authentication (credentials provider)
- AI-powered bulk requirements import (supports text, PDF, images)
- Jira integration for drafting and sending stories
- Release snapshots with verification stats

## Development

```bash
# From monorepo root
npm run dev:define

# Or from this directory
npm run dev
```

## Environment Variables

Required for production (set in Coolify):
- `NEXTAUTH_URL` - e.g., https://define.ai.devintensive.com
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `ANTHROPIC_API_KEY` - For AI features

## Test Credentials

- Email: `david@example.com`
- Password: `expertly123`

## Database

Uses SQLite stored in `./data/expertly-define.db`. Tables are auto-created on startup.
