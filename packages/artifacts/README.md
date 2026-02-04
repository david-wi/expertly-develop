# @expertly/artifacts

Shared artifacts management package for Expertly applications.

## Features

- File artifact upload with automatic conversion to markdown
- Link artifact support for external URLs
- Version history tracking
- Flexible context-based association (works with any entity type)
- Background conversion processing

## Installation

```bash
pip install /path/to/packages/artifacts
```

## Usage

### Backend Integration

```python
from artifacts import create_artifacts_router, ArtifactRouterConfig

# Configure the router with your app's dependencies
config = ArtifactRouterConfig(
    uploads_dir=settings.uploads_dir,
    database_url=settings.database_url,
    get_db=get_db,
    get_current_user=get_current_user,
    context_validator=validate_my_context,  # Optional: validate context keys
)

# Create and include the router
router = create_artifacts_router(config)
app.include_router(router, prefix="/api/v1/artifacts")
```

### Context-based Association

Instead of a fixed `product_id` foreign key, artifacts use a flexible `context` JSON column:

```python
# Define app uses: {"product_id": "uuid"}
artifact.context = {"product_id": "abc-123"}

# Develop app could use: {"walkthrough_id": "uuid"}
artifact.context = {"walkthrough_id": "xyz-456"}

# Query by context
artifacts = await service.list_artifacts(context={"product_id": "abc-123"})
```

## Supported File Types

- **Images** (JPEG, PNG, GIF, WebP) - AI vision analysis
- **PDFs** - Text extraction with intelligent reflow
- **Word Documents** (.docx, .doc)
- **Excel Spreadsheets** (.xlsx, .xls)
- **PowerPoint** (.pptx, .ppt)
- **Text/Code files** - Language detection for syntax highlighting

## Database Migration

When integrating with an existing app that has `product_id`:

```sql
-- Add context column
ALTER TABLE artifacts ADD COLUMN context JSON DEFAULT '{}';

-- Populate from product_id
UPDATE artifacts SET context = json_object('product_id', product_id);

-- Create index for queries
CREATE INDEX ix_artifacts_context ON artifacts ((context->>'product_id'));
```
