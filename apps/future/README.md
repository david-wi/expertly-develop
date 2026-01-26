# Future/Planned Expertly Services

This directory contains placeholders for planned services that are not yet implemented.

## Planned Services

| Service | Planned URL | Description | Status |
|---------|-------------|-------------|--------|
| Design System | https://design.ai.devintensive.com | Shared design system and component library | Not started |
| Hospitality | https://hospitality.ai.devintensive.com | Hospitality management platform | Not started |
| Logistics | https://logistics.ai.devintensive.com | Logistics management platform | Not started |
| Partnerships | https://partnerships.ai.devintensive.com | Partnership management platform | Not started |
| Simulate | https://simulate.ai.devintensive.com | Simulation platform | Not started |

## Notes

- These URLs are reserved but not yet deployed
- When implementing, move the app directory from `future/` to `apps/`
- Update `docker-compose.prod.yml` and Coolify service configuration
- Add to the deployment checklist in `/CLAUDE.md`

## Vibetest Note

**vibetest.ai.devintensive.com** is intended to be served by the `apps/qa` app (Vibe QA).
If this URL needs to work, add a traefik route pointing to the qa-frontend container.
