"""Project management service."""

from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId

from app.database import get_database
from app.models.project import Project, Visibility, SiteCredentials
from app.services.encryption_service import encryption_service


CREDENTIAL_FIELDS = ["username", "password"]


class ProjectService:
    """Service for managing projects."""

    def __init__(self):
        self.collection_name = "projects"

    @property
    def collection(self):
        return get_database()[self.collection_name]

    async def create_project(
        self,
        organization_id: str,
        owner_id: str,
        name: str,
        description: Optional[str] = None,
        visibility: Visibility = Visibility.PRIVATE,
        site_url: Optional[str] = None,
    ) -> Project:
        """Create a new project."""
        project = Project(
            organization_id=organization_id,
            owner_id=owner_id,
            name=name,
            description=description,
            visibility=visibility,
            site_url=site_url,
        )

        result = await self.collection.insert_one(project.to_mongo())
        project.id = result.inserted_id
        return project

    async def get_project(
        self,
        project_id: ObjectId,
        include_deleted: bool = False,
    ) -> Optional[Project]:
        """Get a project by ID."""
        query = {"_id": project_id}
        if not include_deleted:
            query["deleted_at"] = None

        data = await self.collection.find_one(query)
        return Project.from_mongo(data) if data else None

    async def list_projects(
        self,
        organization_id: str,
        user_id: Optional[str] = None,
        visibility: Optional[Visibility] = None,
        include_deleted: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Project]:
        """List projects with access control."""
        query = {"organization_id": organization_id}

        if not include_deleted:
            query["deleted_at"] = None

        # Build visibility query
        if user_id:
            visibility_query = {
                "$or": [
                    {"visibility": Visibility.COMPANYWIDE.value},
                    {"visibility": Visibility.TEAM.value},
                    {"owner_id": user_id},
                ]
            }
            query.update(visibility_query)

        if visibility:
            query["visibility"] = visibility.value

        cursor = (
            self.collection.find(query)
            .sort("updated_at", -1)
            .skip(offset)
            .limit(limit)
        )

        return [Project.from_mongo(doc) async for doc in cursor]

    async def update_project(
        self,
        project_id: ObjectId,
        **updates,
    ) -> Optional[Project]:
        """Update a project."""
        updates["updated_at"] = datetime.now(timezone.utc)

        result = await self.collection.find_one_and_update(
            {"_id": project_id, "deleted_at": None},
            {"$set": updates},
            return_document=True,
        )

        return Project.from_mongo(result) if result else None

    async def update_site_credentials(
        self,
        project_id: ObjectId,
        credentials: SiteCredentials,
    ) -> Optional[Project]:
        """Update project site credentials (encrypts sensitive fields)."""
        creds_dict = credentials.model_dump(exclude_none=True)

        # Encrypt username and password
        if "username" in creds_dict and creds_dict["username"]:
            creds_dict["username"] = encryption_service.encrypt(creds_dict["username"])
        if "password" in creds_dict and creds_dict["password"]:
            creds_dict["password"] = encryption_service.encrypt(creds_dict["password"])

        return await self.update_project(project_id, site_credentials=creds_dict)

    async def get_decrypted_credentials(
        self,
        project_id: ObjectId,
    ) -> Optional[SiteCredentials]:
        """Get project credentials with decrypted values."""
        project = await self.get_project(project_id)
        if not project or not project.site_credentials:
            return None

        creds_dict = project.site_credentials.model_dump()

        # Decrypt username and password
        if creds_dict.get("username"):
            creds_dict["username"] = encryption_service.decrypt(creds_dict["username"])
        if creds_dict.get("password"):
            creds_dict["password"] = encryption_service.decrypt(creds_dict["password"])

        return SiteCredentials(**creds_dict)

    async def soft_delete(self, project_id: ObjectId) -> bool:
        """Soft-delete a project."""
        result = await self.collection.update_one(
            {"_id": project_id},
            {"$set": {"deleted_at": datetime.now(timezone.utc)}},
        )
        return result.modified_count > 0

    async def restore(self, project_id: ObjectId) -> bool:
        """Restore a soft-deleted project."""
        result = await self.collection.update_one(
            {"_id": project_id},
            {"$set": {"deleted_at": None}},
        )
        return result.modified_count > 0

    async def count_projects(
        self,
        organization_id: str,
        include_deleted: bool = False,
    ) -> int:
        """Count projects for a tenant."""
        query = {"organization_id": organization_id}
        if not include_deleted:
            query["deleted_at"] = None
        return await self.collection.count_documents(query)


# Singleton instance
project_service = ProjectService()
