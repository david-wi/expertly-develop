# Artifacts MongoDB Package

Shared MongoDB-based artifacts management for Expertly applications.

## Features

- File and link artifact support
- Versioned document storage with GridFS
- Automatic markdown conversion (PDF, Word, Excel, images)
- Flexible context-based entity association
- Background task processing for conversions

## Installation

```bash
pip install ./packages/artifacts-mongo
```

## Usage

### Backend Integration

```python
from motor.motor_asyncio import AsyncIOMotorClient
from artifacts_mongo import create_artifacts_router, ArtifactRouterConfig, UserContext

# Database setup
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client["myapp"]

# User context dependency
async def get_user_context():
    return UserContext(
        user_id="user-123",
        organization_id="org-456",
        name="Test User"
    )

# Optional: Context validator
async def validate_project(project_id: str, org_id: str, db):
    doc = await db.projects.find_one({"_id": ObjectId(project_id), "organization_id": org_id})
    return doc is not None

# Create router
config = ArtifactRouterConfig(
    get_db=lambda: db,
    get_user_context=get_user_context,
    context_key="project_id",  # or "task_id", "walkthrough_id", etc.
    context_validator=validate_project,
    context_collection="projects",  # For name lookup
    context_name_field="name",
)

router = create_artifacts_router(config)

# Include in FastAPI app
app.include_router(router, prefix="/api/v1/artifacts", tags=["artifacts"])
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List artifacts with filters |
| GET | `/{id}` | Get artifact with versions |
| POST | `/` | Upload file artifact |
| POST | `/link` | Create link artifact |
| PATCH | `/{id}` | Update artifact metadata |
| DELETE | `/{id}` | Soft delete artifact |
| GET | `/{id}/download` | Download file |
| GET | `/{id}/markdown` | Get markdown conversion |
| POST | `/{id}/versions` | Upload new version |

### Context Flexibility

The package uses a flexible `context` field for entity association:

```python
# Associate with project
artifact.context = {"project_id": "..."}

# Associate with task
artifact.context = {"task_id": "..."}

# Associate with multiple entities
artifact.context = {"project_id": "...", "task_id": "..."}
```

Configure the router's `context_key` to match your primary association:

```python
# For project-based artifacts
config = ArtifactRouterConfig(context_key="project_id", ...)

# For task-based artifacts
config = ArtifactRouterConfig(context_key="task_id", ...)
```

## Models

### Artifact

```python
class Artifact:
    id: ObjectId
    organization_id: str
    context: Dict[str, Any]  # Flexible associations
    name: str
    description: Optional[str]
    artifact_type: str  # "file" or "link"
    url: Optional[str]  # For links
    document_id: Optional[ObjectId]  # For files
    original_filename: Optional[str]
    mime_type: Optional[str]
    format: Optional[str]
    current_version: int
    status: str  # active, archived, deleted
    created_at: datetime
    updated_at: datetime
```

### Document

Versioned file storage with GridFS support:

```python
class Document:
    id: ObjectId
    document_key: str  # Groups versions
    version: int
    is_current: bool
    name: str
    content_type: str
    storage_type: str  # "gridfs" or "inline"
    file_id: Optional[ObjectId]  # GridFS reference
    inline_content: Optional[str]  # Small text files
    file_size: int
    markdown_content: Optional[str]
    conversion_status: Optional[str]
```

## Conversion Service

The package integrates with the `artifacts` package's conversion service:

```python
from artifacts import ArtifactConversionService

# With AI completion for images
async def ai_complete(use_case, system_prompt, user_content, images):
    # Your AI client implementation
    pass

config = ArtifactRouterConfig(
    ai_complete=ai_complete,  # Enable AI-powered conversion
    ...
)
```

Supported conversions:
- PDF → Markdown
- Word (.docx) → Markdown
- Excel (.xlsx) → Markdown tables
- PowerPoint (.pptx) → Markdown
- Images → AI-described markdown
- Text/code files → Markdown with syntax highlighting
