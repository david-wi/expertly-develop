# Expertly Develop

A multitenant development tools platform providing automated visual walkthroughs and more.

## Tech Stack

- **Backend**: Python 3.12, FastAPI, Motor (async MongoDB)
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS
- **Database**: MongoDB 7
- **Browser Automation**: Playwright
- **PDF Generation**: ReportLab
- **Deployment**: Docker, Coolify

## Features

- **Multitenancy**: Companies with multiple users
- **Projects**: CRUD with visibility controls and encrypted credentials
- **Visual Walkthrough Generator**: Automated browser screenshots with PDF reports
- **Job Queue**: Real-time status tracking for async operations
- **Versioned Document Storage**: GridFS-based storage with version history

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- Python 3.12+ (for local development)

### Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/expertly-develop.git
   cd expertly-develop
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Start with Docker Compose:
   ```bash
   docker-compose up -d
   ```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Local Development

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

### Projects
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/{id}` - Get project
- `PUT /api/v1/projects/{id}` - Update project
- `DELETE /api/v1/projects/{id}` - Delete project

### Jobs
- `GET /api/v1/jobs` - List jobs (queue view)
- `GET /api/v1/jobs/{id}` - Get job status
- `DELETE /api/v1/jobs/{id}` - Cancel job

### Walkthroughs
- `POST /api/v1/walkthroughs` - Create walkthrough job
- `GET /api/v1/scenarios` - List preconfigured scenarios

### Documents
- `POST /api/v1/documents` - Upload document
- `GET /api/v1/documents/{key}` - Get current version
- `GET /api/v1/documents/{key}/versions` - List versions

### Artifacts
- `GET /api/v1/artifacts` - List artifacts
- `GET /api/v1/artifacts/{id}/download` - Download artifact

## Deployment

### Coolify

1. Create a new project in Coolify
2. Connect to your GitHub repository
3. Set environment variables:
   - `ENCRYPTION_KEY` - Secure encryption key
4. Deploy using `docker-compose.prod.yml`

### URLs
- Frontend: http://expertly-develop.152.42.152.243.sslip.io
- API: http://expertly-develop-api.152.42.152.243.sslip.io

## Project Structure

```
expertly-develop/
├── backend/
│   ├── app/
│   │   ├── api/v1/        # API endpoints
│   │   ├── models/        # MongoDB models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   └── workers/       # Background workers
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # React components
│   │   └── pages/         # Page components
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── docker-compose.prod.yml
```

## License

MIT
