"""Document service for versioned file storage with GridFS support."""

from datetime import datetime
from typing import Optional, Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket
import logging

from artifacts_mongo.models import Document, DocumentMetadata
from artifacts_mongo.base import PyObjectId

logger = logging.getLogger(__name__)

# Threshold for inline storage vs GridFS (100KB)
INLINE_THRESHOLD = 100 * 1024


class DocumentService:
    """
    Service for managing versioned document storage.

    Supports both inline storage (for small text files) and GridFS (for large/binary files).
    Provides version management with document_key grouping.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        """
        Initialize document service.

        Args:
            db: Motor async MongoDB database instance
        """
        self.db = db
        self._fs: Optional[AsyncIOMotorGridFSBucket] = None

    @property
    def fs(self) -> AsyncIOMotorGridFSBucket:
        """Get GridFS bucket, creating if needed."""
        if self._fs is None:
            self._fs = AsyncIOMotorGridFSBucket(self.db)
        return self._fs

    async def create(
        self,
        organization_id: str,
        name: str,
        content: bytes,
        content_type: str,
        created_by: Optional[str] = None,
        metadata: Optional[DocumentMetadata] = None,
        document_key: Optional[str] = None,
    ) -> Document:
        """
        Create a new document with automatic storage type selection.

        Args:
            organization_id: Organization UUID
            name: Document filename
            content: File content as bytes
            content_type: MIME type
            created_by: User UUID who created this
            metadata: Optional document metadata
            document_key: Optional key to link versions (auto-generated if not provided)

        Returns:
            Created Document instance
        """
        # Determine storage type
        is_text = content_type.startswith("text/") or content_type in (
            "application/json",
            "application/xml",
        )
        use_inline = is_text and len(content) < INLINE_THRESHOLD

        doc = Document(
            organization_id=organization_id,
            name=name,
            content_type=content_type,
            storage_type="inline" if use_inline else "gridfs",
            file_size=len(content),
            created_by=created_by,
            metadata=metadata or DocumentMetadata(),
        )

        if document_key:
            doc.document_key = document_key

        if use_inline:
            doc.inline_content = content.decode("utf-8", errors="replace")
        else:
            # Store in GridFS
            file_id = await self.fs.upload_from_stream(
                name,
                content,
                metadata={
                    "organization_id": organization_id,
                    "content_type": content_type,
                },
            )
            doc.file_id = PyObjectId(file_id)

        # Insert document
        result = await self.db.documents.insert_one(doc.to_mongo())
        doc.id = PyObjectId(result.inserted_id)

        return doc

    async def create_version(
        self,
        document_key: str,
        organization_id: str,
        name: str,
        content: bytes,
        content_type: str,
        created_by: Optional[str] = None,
        metadata: Optional[DocumentMetadata] = None,
    ) -> Document:
        """
        Create a new version of an existing document.

        Args:
            document_key: Key linking document versions
            organization_id: Organization UUID
            name: Document filename
            content: File content as bytes
            content_type: MIME type
            created_by: User UUID who created this version
            metadata: Optional document metadata

        Returns:
            New Document version instance
        """
        # Get current version
        current = await self.db.documents.find_one({
            "document_key": document_key,
            "is_current": True,
            "deleted_at": None,
        })

        if not current:
            # No existing document, create first version
            return await self.create(
                organization_id=organization_id,
                name=name,
                content=content,
                content_type=content_type,
                created_by=created_by,
                metadata=metadata,
                document_key=document_key,
            )

        # Mark current as not current
        await self.db.documents.update_one(
            {"_id": current["_id"]},
            {"$set": {"is_current": False}},
        )

        # Determine storage type
        is_text = content_type.startswith("text/") or content_type in (
            "application/json",
            "application/xml",
        )
        use_inline = is_text and len(content) < INLINE_THRESHOLD

        doc = Document(
            organization_id=organization_id,
            document_key=document_key,
            version=current["version"] + 1,
            is_current=True,
            previous_version_id=PyObjectId(current["_id"]),
            name=name,
            content_type=content_type,
            storage_type="inline" if use_inline else "gridfs",
            file_size=len(content),
            created_by=created_by,
            metadata=metadata or DocumentMetadata(),
        )

        if use_inline:
            doc.inline_content = content.decode("utf-8", errors="replace")
        else:
            file_id = await self.fs.upload_from_stream(
                name,
                content,
                metadata={
                    "organization_id": organization_id,
                    "content_type": content_type,
                },
            )
            doc.file_id = PyObjectId(file_id)

        result = await self.db.documents.insert_one(doc.to_mongo())
        doc.id = PyObjectId(result.inserted_id)

        return doc

    async def get_by_id(self, document_id: str | ObjectId) -> Optional[Document]:
        """Get document by ID."""
        if isinstance(document_id, str):
            document_id = ObjectId(document_id)

        doc = await self.db.documents.find_one({
            "_id": document_id,
            "deleted_at": None,
        })

        return Document.from_mongo(doc) if doc else None

    async def get_current(self, document_key: str) -> Optional[Document]:
        """Get the current version of a document by key."""
        doc = await self.db.documents.find_one({
            "document_key": document_key,
            "is_current": True,
            "deleted_at": None,
        })

        return Document.from_mongo(doc) if doc else None

    async def get_versions(self, document_key: str) -> list[Document]:
        """Get all versions of a document."""
        cursor = self.db.documents.find({
            "document_key": document_key,
            "deleted_at": None,
        }).sort("version", -1)

        return [Document.from_mongo(doc) async for doc in cursor]

    async def get_content(self, document: Document) -> bytes:
        """
        Get the file content for a document.

        Args:
            document: Document instance

        Returns:
            File content as bytes
        """
        if document.storage_type == "inline":
            return document.inline_content.encode("utf-8") if document.inline_content else b""

        if document.file_id:
            stream = await self.fs.open_download_stream(ObjectId(document.file_id))
            return await stream.read()

        return b""

    async def update_conversion_status(
        self,
        document_id: str | ObjectId,
        status: str,
        markdown_content: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        """Update document conversion status."""
        if isinstance(document_id, str):
            document_id = ObjectId(document_id)

        update = {
            "conversion_status": status,
            "conversion_error": error,
        }
        if markdown_content:
            update["markdown_content"] = markdown_content

        await self.db.documents.update_one(
            {"_id": document_id},
            {"$set": update},
        )

    async def soft_delete(self, document_id: str | ObjectId) -> bool:
        """Soft delete a document."""
        if isinstance(document_id, str):
            document_id = ObjectId(document_id)

        result = await self.db.documents.update_one(
            {"_id": document_id},
            {"$set": {"deleted_at": datetime.now()}},
        )

        return result.modified_count > 0

    async def hard_delete(self, document_id: str | ObjectId) -> bool:
        """
        Permanently delete a document and its GridFS content.

        Args:
            document_id: Document ID to delete

        Returns:
            True if deleted
        """
        if isinstance(document_id, str):
            document_id = ObjectId(document_id)

        doc = await self.db.documents.find_one({"_id": document_id})
        if not doc:
            return False

        # Delete GridFS file if exists
        if doc.get("file_id"):
            try:
                await self.fs.delete(ObjectId(doc["file_id"]))
            except Exception as e:
                logger.warning(f"Failed to delete GridFS file: {e}")

        await self.db.documents.delete_one({"_id": document_id})
        return True


def create_document_service(db: AsyncIOMotorDatabase) -> DocumentService:
    """Factory function to create a document service instance."""
    return DocumentService(db)
