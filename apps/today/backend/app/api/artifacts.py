"""Artifacts API - view seeds, docs, and work plans."""

import os
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app.api.deps import get_context, CurrentContext

router = APIRouter()

# Base paths - /app in Docker container, or project root in dev
APP_DIR = Path(__file__).parent.parent.parent  # /app or backend/
# Check if running in Docker (seeds directly under APP_DIR) or dev (seeds under backend/)
if (APP_DIR / "seeds").exists():
    # Docker or running from backend directory
    SEEDS_PATH = APP_DIR / "seeds"
    DOCS_PATH = APP_DIR / "docs"
    SPECIAL_PATH = APP_DIR / "__SPECIAL"
else:
    # Development - paths relative to project root
    PROJECT_ROOT = APP_DIR.parent
    SEEDS_PATH = PROJECT_ROOT / "backend" / "seeds"
    DOCS_PATH = PROJECT_ROOT / "docs"
    SPECIAL_PATH = PROJECT_ROOT / "__SPECIAL"

ARTIFACTS_CONFIG = {
    "seeds": {
        "path": SEEDS_PATH,
        "extensions": [".json", ".py"],
        "description": "Database seeds and restore scripts"
    },
    "docs": {
        "path": DOCS_PATH,
        "extensions": [".md"],
        "description": "Documentation and walkthroughs"
    },
    "work-plans": {
        "path": SPECIAL_PATH,
        "extensions": [".md"],
        "description": "Work plans and session notes"
    }
}


class ArtifactFile(BaseModel):
    """Single artifact file."""
    name: str
    path: str
    size: int
    modified_at: str
    category: str


class ArtifactCategory(BaseModel):
    """Category of artifacts."""
    name: str
    description: str
    files: List[ArtifactFile]


class ArtifactsResponse(BaseModel):
    """All artifacts response."""
    categories: List[ArtifactCategory]


@router.get("", response_model=ArtifactsResponse)
async def list_artifacts(
    ctx: CurrentContext = Depends(get_context),
):
    """List all available artifacts."""
    categories = []

    for category_name, config in ARTIFACTS_CONFIG.items():
        files = []
        dir_path = config["path"]

        if dir_path.exists() and dir_path.is_dir():
            for file_path in dir_path.iterdir():
                if file_path.is_file() and file_path.suffix in config["extensions"]:
                    stat = file_path.stat()
                    files.append(ArtifactFile(
                        name=file_path.name,
                        path=f"{category_name}/{file_path.name}",
                        size=stat.st_size,
                        modified_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        category=category_name
                    ))

        # Sort by modified date, newest first
        files.sort(key=lambda x: x.modified_at, reverse=True)

        categories.append(ArtifactCategory(
            name=category_name,
            description=config["description"],
            files=files
        ))

    return ArtifactsResponse(categories=categories)


@router.get("/{category}/{filename}")
async def get_artifact(
    category: str,
    filename: str,
    ctx: CurrentContext = Depends(get_context),
):
    """Get contents of a specific artifact."""
    if category not in ARTIFACTS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Category '{category}' not found")

    config = ARTIFACTS_CONFIG[category]
    file_path = config["path"] / filename

    # Security check - prevent path traversal
    try:
        file_path = file_path.resolve()
        config_path = config["path"].resolve()
        if not str(file_path).startswith(str(config_path)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found")

    if file_path.suffix not in config["extensions"]:
        raise HTTPException(status_code=403, detail="File type not allowed")

    try:
        content = file_path.read_text()

        # Return as plain text with appropriate content type
        media_type = "application/json" if file_path.suffix == ".json" else "text/plain"
        return PlainTextResponse(content=content, media_type=media_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")
