"""Versioned document storage service."""

from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
import uuid

from app.database import get_database
from app.models.document import Document, DocumentMetadata
from app.services.storage_service import storage_service
from app.config import get_settings


class DocumentService:
    """Service for managing versioned documents."""

    def __init__(self):
        self.collection_name = "documents"

    @property
    def collection(self):
        return get_database()[self.collection_name]

    async def create_document(
        self,
        tenant_id: ObjectId,
        name: str,
        content: bytes,
        content_type: str,
        created_by: Optional[ObjectId] = None,
        metadata: Optional[DocumentMetadata] = None,
    ) -> Document:
        """Create a new document (first version)."""
        settings = get_settings()
        file_size = len(content)

        # Determine storage type based on size and content type
        if file_size <= settings.max_inline_size and content_type.startswith("text/"):
            storage_type = "inline"
            inline_content = content.decode("utf-8")
            file_id = None
        else:
            storage_type = "gridfs"
            inline_content = None
            file_id = await storage_service.store_file(
                content, name, content_type, {"tenant_id": str(tenant_id)}
            )

        doc = Document(
            tenant_id=tenant_id,
            document_key=str(uuid.uuid4()),
            version=1,
            is_current=True,
            name=name,
            content_type=content_type,
            storage_type=storage_type,
            file_id=file_id,
            inline_content=inline_content,
            file_size=file_size,
            metadata=metadata or DocumentMetadata(),
            created_by=created_by,
            created_at=datetime.now(timezone.utc),
        )

        result = await self.collection.insert_one(doc.to_mongo())
        doc.id = result.inserted_id
        return doc

    async def create_version(
        self,
        document_key: str,
        content: bytes,
        content_type: str,
        created_by: Optional[ObjectId] = None,
        name: Optional[str] = None,
    ) -> Document:
        """Create a new version of an existing document."""
        # Get current version
        current = await self.get_current(document_key)
        if not current:
            raise ValueError(f"Document with key {document_key} not found")

        settings = get_settings()
        file_size = len(content)

        # Mark current version as not current
        await self.collection.update_one(
            {"_id": current.id},
            {"$set": {"is_current": False}},
        )

        # Determine storage type
        if file_size <= settings.max_inline_size and content_type.startswith("text/"):
            storage_type = "inline"
            inline_content = content.decode("utf-8")
            file_id = None
        else:
            storage_type = "gridfs"
            inline_content = None
            file_id = await storage_service.store_file(
                content,
                name or current.name,
                content_type,
                {"tenant_id": str(current.tenant_id)},
            )

        new_doc = Document(
            tenant_id=current.tenant_id,
            document_key=document_key,
            version=current.version + 1,
            is_current=True,
            previous_version_id=current.id,
            name=name or current.name,
            content_type=content_type,
            storage_type=storage_type,
            file_id=file_id,
            inline_content=inline_content,
            file_size=file_size,
            metadata=current.metadata,
            created_by=created_by,
            created_at=datetime.now(timezone.utc),
        )

        result = await self.collection.insert_one(new_doc.to_mongo())
        new_doc.id = result.inserted_id
        return new_doc

    async def get_current(self, document_key: str) -> Optional[Document]:
        """Get the current version of a document."""
        data = await self.collection.find_one(
            {"document_key": document_key, "is_current": True, "deleted_at": None}
        )
        return Document.from_mongo(data) if data else None

    async def get_by_id(self, document_id: ObjectId) -> Optional[Document]:
        """Get a document by its ObjectId."""
        data = await self.collection.find_one({"_id": document_id, "deleted_at": None})
        return Document.from_mongo(data) if data else None

    async def get_version(self, document_key: str, version: int) -> Optional[Document]:
        """Get a specific version of a document."""
        data = await self.collection.find_one(
            {"document_key": document_key, "version": version}
        )
        return Document.from_mongo(data) if data else None

    async def get_versions(self, document_key: str) -> List[Document]:
        """Get all versions of a document."""
        cursor = self.collection.find(
            {"document_key": document_key, "deleted_at": None}
        ).sort("version", -1)
        return [Document.from_mongo(doc) async for doc in cursor]

    async def get_content(self, document: Document) -> bytes:
        """Get the content of a document."""
        if document.storage_type == "inline":
            return document.inline_content.encode("utf-8")
        else:
            content, _, _ = await storage_service.get_file(document.file_id)
            return content

    async def soft_delete(self, document_key: str) -> bool:
        """Soft-delete all versions of a document."""
        result = await self.collection.update_many(
            {"document_key": document_key},
            {"$set": {"deleted_at": datetime.now(timezone.utc)}},
        )
        return result.modified_count > 0

    async def restore(self, document_key: str) -> bool:
        """Restore a soft-deleted document."""
        result = await self.collection.update_many(
            {"document_key": document_key},
            {"$set": {"deleted_at": None}},
        )
        return result.modified_count > 0

    async def list_by_project(
        self,
        tenant_id: ObjectId,
        project_id: ObjectId,
        current_only: bool = True,
    ) -> List[Document]:
        """List documents for a project."""
        query = {
            "tenant_id": tenant_id,
            "metadata.project_id": project_id,
            "deleted_at": None,
        }
        if current_only:
            query["is_current"] = True

        cursor = self.collection.find(query).sort("created_at", -1)
        return [Document.from_mongo(doc) async for doc in cursor]

    async def list_by_tenant(
        self,
        tenant_id: ObjectId,
        category: Optional[str] = None,
        current_only: bool = True,
    ) -> List[Document]:
        """List documents for a tenant."""
        query = {
            "tenant_id": tenant_id,
            "deleted_at": None,
        }
        if current_only:
            query["is_current"] = True
        if category:
            query["metadata.category"] = category

        cursor = self.collection.find(query).sort("created_at", -1)
        return [Document.from_mongo(doc) async for doc in cursor]


# Singleton instance
document_service = DocumentService()
