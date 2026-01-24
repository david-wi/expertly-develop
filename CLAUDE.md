# CLAUDE.md - Expertly Monorepo

Please review additional general instructions at /Users/david/Code/_common/CLAUDE.md, requesting access if needed.

## Monorepo Structure

This is the unified Expertly product suite monorepo.

```
expertly/
├── apps/
│   ├── develop/     Visual walkthroughs (React + FastAPI + MongoDB)
│   ├── define/      Requirements management (Next.js + SQLite)
│   ├── manage/      Task management (React + FastAPI + MongoDB)
│   ├── qa/          Quality assurance (React + FastAPI + PostgreSQL)
│   ├── salon/       Booking platform (React + FastAPI + MongoDB)
│   └── today/       Daily workflow (React + FastAPI + PostgreSQL)
├── packages/
│   └── ui/          Shared UI components (Sidebar, etc.)
├── gateway/         Nginx routing config
├── docker-compose.prod.yml   All services orchestration
└── package.json     Workspace root
```

## Development

Each app can be run independently:
```bash
cd apps/develop && docker-compose up
cd apps/manage && docker-compose up
# etc.
```

## Production Deployment

Uses unified gateway for routing:
- `/develop` → Expertly Develop
- `/define` → Expertly Define
- `/manage` → Expertly Manage
- `/qa` → Expertly QA
- `/salon` → Expertly Salon
- `/today` → Expertly Today

Main URL: http://expertly.152.42.152.243.sslip.io

## Shared Components

The sidebar includes a product switcher dropdown allowing users to navigate between all Expertly products. Each app should use the consistent sidebar styling from `packages/ui/`.
