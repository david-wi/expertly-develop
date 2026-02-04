# Expertly TMS - CLAUDE.md

## Overview

AI-first Transportation Management System for 3PL brokers. Transforms messy inbound emails into structured quotes and shipments with minimal manual input.

**URLs:**
- Frontend: https://tms.ai.devintensive.com
- API: https://tms-api.ai.devintensive.com

## Key Features

1. **AI Email Extraction** - Parse rate requests with evidence-based field extraction
2. **Smart Carrier Matching** - Suggest carriers based on lane history and performance
3. **One-Click Responses** - AI-drafted communications ready for approval
4. **Proactive Exception Detection** - Flag risks before they become problems

## Tech Stack

- **Backend**: Python/FastAPI with MongoDB (via Motor async driver)
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS
- **AI**: Anthropic Claude API for extraction and drafts
- **State Management**: Zustand
- **UI Components**: @expertly/ui shared package

## Directory Structure

```
apps/tms/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # API endpoints
│   │   ├── models/          # MongoDB models with state machines
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # AI extraction, carrier matching
│   │   └── utils/           # Helpers, seed data
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Route pages
│   │   ├── services/        # API client
│   │   ├── stores/          # Zustand stores
│   │   └── types/           # TypeScript interfaces
```

## Core Data Models

| Model | Purpose | State Machine |
|-------|---------|---------------|
| Customer | Shipper companies | active → inactive → credit_hold |
| Carrier | Trucking companies | active → pending → suspended → do_not_use |
| QuoteRequest | Inbound rate requests | new → in_progress → quoted/declined |
| Quote | Price quotes to customers | draft → sent → accepted/declined |
| Shipment | Booked loads | booked → pending_pickup → in_transit → delivered |
| Tender | Carrier offers | draft → sent → accepted/declined |
| Invoice | Customer billing | draft → sent → paid |
| WorkItem | Unified inbox items | open → in_progress → done |

## AI Services

### Email Extraction (`ai_extraction.py`)
- Extracts shipment fields from raw email text
- Returns `ExtractedField` with value, confidence, and evidence_text
- Identifies missing/unclear fields

### Carrier Matching (`carrier_matching.py`)
- Scores carriers by lane history, on-time performance
- Flags compliance issues (expiring insurance)
- Returns ranked suggestions with estimated costs

## Development

### Local Development
```bash
# Backend
cd apps/tms/backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd apps/tms/frontend
npm install
npm run dev
```

### Running Tests
```bash
# Backend
cd apps/tms/backend
pytest

# Frontend
cd apps/tms/frontend
npm run test:run
```

## API Patterns

All API endpoints follow RESTful conventions:
- `GET /api/v1/{resource}` - List with filters
- `POST /api/v1/{resource}` - Create
- `GET /api/v1/{resource}/{id}` - Get single
- `PATCH /api/v1/{resource}/{id}` - Update
- `POST /api/v1/{resource}/{id}/{action}` - State transitions

## Common Workflows

### Quote Request → Invoice Flow
1. Create/receive quote request
2. AI extracts shipment details
3. Create quote from request
4. Send quote to customer
5. Customer accepts → book shipment
6. Assign carrier via dispatch board
7. Track shipment through delivery
8. Generate and send invoice

## Environment Variables

Backend:
- `MONGODB_URL` - MongoDB connection string
- `MONGODB_DATABASE` - Database name (expertly_tms)
- `ANTHROPIC_API_KEY` - For AI features

Frontend:
- `VITE_API_URL` - Backend API URL
