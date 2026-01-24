"""Health check endpoint."""

from fastapi import APIRouter

from app.database import db

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    # Check MongoDB connection
    mongo_status = "healthy"
    try:
        if db.client:
            await db.client.admin.command("ping")
    except Exception as e:
        mongo_status = f"unhealthy: {str(e)}"

    return {
        "status": "healthy" if mongo_status == "healthy" else "degraded",
        "services": {
            "mongodb": mongo_status,
        },
    }
