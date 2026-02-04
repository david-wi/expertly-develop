# Expertly TMS

AI-first Transportation Management System for 3PL freight brokers.

## Features

- **Smart Quote Requests** - AI extracts shipment details from emails and forms
- **Quote Builder** - Build and send quotes with margin tracking
- **Dispatch Board** - Kanban-style carrier assignment with AI suggestions
- **Shipment Tracking** - Real-time status updates and exception alerts
- **Unified Inbox** - All work items in one prioritized queue
- **Invoice Management** - Generate invoices from completed shipments

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- MongoDB

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed technical documentation.

## License

Proprietary - Expertly
