"""File storage abstraction for artifacts."""

import os
import aiofiles
from typing import Optional


class ArtifactStorage:
    """
    Handles file storage for artifacts.

    Provides a consistent interface for storing and retrieving artifact files.
    """

    def __init__(self, uploads_dir: str):
        """
        Initialize storage with base uploads directory.

        Args:
            uploads_dir: Base directory for all artifact uploads
        """
        self.uploads_dir = uploads_dir

    def get_artifact_dir(self, artifact_id: str, version_number: int) -> str:
        """
        Get the storage directory for an artifact version.

        Args:
            artifact_id: The artifact ID
            version_number: The version number

        Returns:
            Absolute path to the version's storage directory
        """
        return os.path.join(
            self.uploads_dir, "artifacts", artifact_id, f"v{version_number}"
        )

    def get_relative_path(self, artifact_id: str, version_number: int, filename: str) -> str:
        """
        Get the relative storage path for a file.

        Args:
            artifact_id: The artifact ID
            version_number: The version number
            filename: The filename

        Returns:
            Relative path from uploads_dir
        """
        return os.path.join("artifacts", artifact_id, f"v{version_number}", filename)

    def get_full_path(self, relative_path: str) -> str:
        """
        Get the full path from a relative path.

        Args:
            relative_path: Path relative to uploads_dir

        Returns:
            Absolute path
        """
        return os.path.join(self.uploads_dir, relative_path)

    async def save_file(
        self,
        artifact_id: str,
        version_number: int,
        filename: str,
        content: bytes,
    ) -> str:
        """
        Save a file to storage.

        Args:
            artifact_id: The artifact ID
            version_number: The version number
            filename: The filename to save as
            content: The file content

        Returns:
            Relative path to the saved file
        """
        storage_dir = self.get_artifact_dir(artifact_id, version_number)
        os.makedirs(storage_dir, exist_ok=True)

        file_path = os.path.join(storage_dir, filename)
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        return self.get_relative_path(artifact_id, version_number, filename)

    async def save_text_file(
        self,
        artifact_id: str,
        version_number: int,
        filename: str,
        content: str,
    ) -> str:
        """
        Save a text file to storage.

        Args:
            artifact_id: The artifact ID
            version_number: The version number
            filename: The filename to save as
            content: The text content

        Returns:
            Relative path to the saved file
        """
        storage_dir = self.get_artifact_dir(artifact_id, version_number)
        os.makedirs(storage_dir, exist_ok=True)

        file_path = os.path.join(storage_dir, filename)
        async with aiofiles.open(file_path, "w") as f:
            await f.write(content)

        return self.get_relative_path(artifact_id, version_number, filename)

    async def read_file(self, relative_path: str) -> Optional[bytes]:
        """
        Read a file from storage.

        Args:
            relative_path: Path relative to uploads_dir

        Returns:
            File content or None if not found
        """
        full_path = self.get_full_path(relative_path)
        if not os.path.exists(full_path):
            return None

        async with aiofiles.open(full_path, "rb") as f:
            return await f.read()

    async def read_text_file(self, relative_path: str) -> Optional[str]:
        """
        Read a text file from storage.

        Args:
            relative_path: Path relative to uploads_dir

        Returns:
            File content or None if not found
        """
        full_path = self.get_full_path(relative_path)
        if not os.path.exists(full_path):
            return None

        async with aiofiles.open(full_path, "r") as f:
            return await f.read()

    def file_exists(self, relative_path: str) -> bool:
        """
        Check if a file exists in storage.

        Args:
            relative_path: Path relative to uploads_dir

        Returns:
            True if file exists
        """
        return os.path.exists(self.get_full_path(relative_path))

    def delete_artifact(self, artifact_id: str) -> None:
        """
        Delete all files for an artifact.

        Args:
            artifact_id: The artifact ID to delete
        """
        import shutil

        artifact_dir = os.path.join(self.uploads_dir, "artifacts", artifact_id)
        if os.path.exists(artifact_dir):
            shutil.rmtree(artifact_dir)
