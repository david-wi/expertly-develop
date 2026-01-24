"""Health check endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db

router = APIRouter()


@router.get("/health")
def health_check():
    """Liveness check - is the service running?"""
    return {"status": "healthy", "service": "vibe-qa"}


@router.get("/ready")
def readiness_check(db: Session = Depends(get_db)):
    """Readiness check - is the service ready to handle requests?"""
    try:
        # Check database connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "ready" if db_status == "connected" else "not_ready",
        "database": db_status,
    }
