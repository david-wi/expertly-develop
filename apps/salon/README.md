# Salon Appointment Booking System

A high-quality, professional salon booking and scheduling system built with React + Vite + TypeScript frontend, FastAPI backend, and MongoDB database.

## Features

- **Multi-tenant SaaS**: One deployment serves multiple salons, each with isolated data
- **Staff-first Calendar**: Visual calendar with staff columns, drag-and-drop support
- **Smart Booking Flow**: Multi-step booking with service selection, staff preference, time slots
- **Client Management**: Client profiles with visit history and statistics
- **Appointment State Machine**: Full lifecycle from booking to completion
- **Slot Locking**: Prevents double-booking during checkout process
- **Cancellation Policies**: Configurable policies with automatic fee calculation

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Zustand + React Query
- **Backend**: Python 3.12 + FastAPI + Motor (async MongoDB) + Pydantic
- **Database**: MongoDB
- **Payments**: Stripe Connect (planned)

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+
- MongoDB 7+ (or Docker)

### Development Setup

1. **Start MongoDB** (via Docker):
   ```bash
   docker compose -f docker-compose.dev.yml up mongodb -d
   ```

2. **Backend**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   uvicorn app.main:app --reload
   ```

3. **Frontend**:
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

### Creating Initial Data

Use the API to create a salon and user:

```bash
# Create salon
curl -X POST http://localhost:8000/api/v1/salons \
  -H "Content-Type: application/json" \
  -d '{"name": "Demo Salon", "slug": "demo-salon"}'

# Note the salon ID from the response, then create a user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo.com", "password": "password123", "first_name": "Admin", "last_name": "User", "salon_id": "SALON_ID_HERE"}'
```

## Project Structure

```
appointments/
├── backend/
│   ├── app/
│   │   ├── api/v1/         # API routes
│   │   ├── models/         # Pydantic + MongoDB models
│   │   ├── schemas/        # Request/response schemas
│   │   ├── services/       # Business logic
│   │   ├── core/           # Security, DB, config
│   │   └── main.py         # FastAPI app
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── stores/         # Zustand stores
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript types
│   └── package.json
└── docker-compose.yml
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Current user

### Calendar & Booking
- `GET /api/v1/calendar` - Calendar view
- `GET /api/v1/calendar/availability` - Available slots
- `POST /api/v1/appointments/lock` - Lock slot
- `POST /api/v1/appointments` - Create booking

### Staff & Services
- `GET/POST/PUT/DELETE /api/v1/staff`
- `GET/POST/PUT/DELETE /api/v1/services`

### Clients
- `GET/POST/PUT/DELETE /api/v1/clients`
- `GET /api/v1/clients/search`

## Design System

The UI uses a warm, salon-appropriate color palette:

- **Primary**: Warm rose/blush tones
- **Accent**: Soft gold/champagne
- **Background**: Warm off-white
- **Success**: Soft sage green
- **Warning**: Warm amber
- **Error**: Muted coral

## Deployment

### Docker Compose (Production)

```bash
# Set environment variables
export JWT_SECRET_KEY="your-secure-secret"
export STRIPE_SECRET_KEY="sk_live_..."

# Build and run
docker compose up -d
```

### Coolify Deployment

1. Create new project in Coolify
2. Add service from GitHub repository
3. Configure environment variables
4. Deploy

## License

MIT
