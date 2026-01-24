"""GridFS storage service for file management."""

from io import BytesIO
from typing import AsyncGenerator, Optional, Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from app.database import get_gridfs


class StorageService:
    """Service for storing and retrieving files using GridFS."""

    async def store_file(
        self,
        content: bytes,
        filename: str,
        content_type: str,
        metadata: Optional[dict] = None,
    ) -> ObjectId:
        """Store a file in GridFS and return its ID."""
        fs = get_gridfs()
        file_id = await fs.upload_from_stream(
            filename,
            BytesIO(content),
            metadata={
                "content_type": content_type,
                **(metadata or {}),
            },
        )
        return file_id

    async def get_file(self, file_id: ObjectId) -> Tuple[bytes, str, str]:
        """
        Retrieve a file from GridFS.

        Returns:
            Tuple of (content, filename, content_type)
        """
        fs = get_gridfs()
        grid_out = await fs.open_download_stream(file_id)

        content = await grid_out.read()
        filename = grid_out.filename
        content_type = grid_out.metadata.get("content_type", "application/octet-stream")

        return content, filename, content_type

    async def stream_file(
        self, file_id: ObjectId, chunk_size: int = 262144
    ) -> AsyncGenerator[bytes, None]:
        """Stream a file from GridFS in chunks."""
        fs = get_gridfs()
        grid_out = await fs.open_download_stream(file_id)

        while True:
            chunk = await grid_out.read(chunk_size)
            if not chunk:
                break
            yield chunk

    async def delete_file(self, file_id: ObjectId) -> None:
        """Delete a file from GridFS."""
        fs = get_gridfs()
        await fs.delete(file_id)

    async def file_exists(self, file_id: ObjectId) -> bool:
        """Check if a file exists in GridFS."""
        fs = get_gridfs()
        try:
            await fs.open_download_stream(file_id)
            return True
        except Exception:
            return False

    async def get_file_info(self, file_id: ObjectId) -> Optional[dict]:
        """Get file metadata without downloading content."""
        fs = get_gridfs()
        try:
            grid_out = await fs.open_download_stream(file_id)
            return {
                "filename": grid_out.filename,
                "length": grid_out.length,
                "upload_date": grid_out.upload_date,
                "content_type": grid_out.metadata.get(
                    "content_type", "application/octet-stream"
                ),
                "metadata": grid_out.metadata,
            }
        except Exception:
            return None


# Singleton instance
storage_service = StorageService()
