"""Tests for artifacts API endpoints."""

import pytest
from unittest.mock import patch, AsyncMock
from io import BytesIO


class TestArtifactsAPI:
    """Test cases for artifacts API."""

    @patch("app.api.deps.get_current_user")
    def test_upload_artifact(self, mock_get_user, client):
        """Test uploading a new artifact."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product first
        product_response = client.post("/api/v1/products", json={
            "name": "Test Product",
            "description": "For testing artifacts"
        })
        assert product_response.status_code == 201
        product_id = product_response.json()["id"]

        # Upload an artifact
        files = {
            "file": ("test.txt", BytesIO(b"Hello, world!"), "text/plain")
        }
        data = {
            "product_id": product_id,
            "name": "Test Artifact",
            "description": "A test artifact"
        }

        response = client.post("/api/v1/artifacts", files=files, data=data)
        assert response.status_code == 201

        artifact = response.json()
        assert artifact["name"] == "Test Artifact"
        assert artifact["description"] == "A test artifact"
        assert artifact["original_filename"] == "test.txt"
        assert artifact["mime_type"] == "text/plain"
        assert artifact["current_version"] == 1
        assert artifact["status"] == "active"
        assert "id" in artifact
        # Verify context is populated for shared package compatibility
        assert artifact["context"] == {"product_id": product_id}

    @patch("app.api.deps.get_current_user")
    def test_list_artifacts_empty(self, mock_get_user, client):
        """Test listing artifacts when none exist."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product first
        product_response = client.post("/api/v1/products", json={
            "name": "Test Product",
        })
        product_id = product_response.json()["id"]

        response = client.get(f"/api/v1/artifacts?product_id={product_id}")
        assert response.status_code == 200
        assert response.json() == []

    @patch("app.api.deps.get_current_user")
    def test_list_artifacts(self, mock_get_user, client):
        """Test listing artifacts for a product."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product
        product_response = client.post("/api/v1/products", json={
            "name": "Test Product",
        })
        product_id = product_response.json()["id"]

        # Upload two artifacts
        for i in range(2):
            files = {
                "file": (f"test{i}.txt", BytesIO(f"Content {i}".encode()), "text/plain")
            }
            data = {
                "product_id": product_id,
                "name": f"Artifact {i}",
            }
            client.post("/api/v1/artifacts", files=files, data=data)

        response = client.get(f"/api/v1/artifacts?product_id={product_id}")
        assert response.status_code == 200
        artifacts = response.json()
        assert len(artifacts) == 2

    @patch("app.api.deps.get_current_user")
    def test_get_artifact_with_versions(self, mock_get_user, client):
        """Test getting an artifact with its versions."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product
        product_response = client.post("/api/v1/products", json={
            "name": "Test Product",
        })
        product_id = product_response.json()["id"]

        # Upload an artifact
        files = {"file": ("test.txt", BytesIO(b"Hello"), "text/plain")}
        data = {"product_id": product_id, "name": "Test Artifact"}
        create_response = client.post("/api/v1/artifacts", files=files, data=data)
        artifact_id = create_response.json()["id"]

        # Get the artifact
        response = client.get(f"/api/v1/artifacts/{artifact_id}")
        assert response.status_code == 200

        artifact = response.json()
        assert artifact["id"] == artifact_id
        assert "versions" in artifact
        assert len(artifact["versions"]) == 1
        assert artifact["versions"][0]["version_number"] == 1

    @patch("app.api.deps.get_current_user")
    def test_get_artifact_not_found(self, mock_get_user, client):
        """Test getting a non-existent artifact."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        response = client.get("/api/v1/artifacts/nonexistent-id")
        assert response.status_code == 404

    @patch("app.api.deps.get_current_user")
    def test_update_artifact(self, mock_get_user, client):
        """Test updating artifact metadata."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product and artifact
        product_response = client.post("/api/v1/products", json={
            "name": "Test Product",
        })
        product_id = product_response.json()["id"]

        files = {"file": ("test.txt", BytesIO(b"Hello"), "text/plain")}
        data = {"product_id": product_id, "name": "Original Name"}
        create_response = client.post("/api/v1/artifacts", files=files, data=data)
        artifact_id = create_response.json()["id"]

        # Update the artifact
        update_data = {
            "name": "Updated Name",
            "description": "New description",
            "status": "archived"
        }
        response = client.patch(f"/api/v1/artifacts/{artifact_id}", json=update_data)
        assert response.status_code == 200

        artifact = response.json()
        assert artifact["name"] == "Updated Name"
        assert artifact["description"] == "New description"
        assert artifact["status"] == "archived"

    @patch("app.api.deps.get_current_user")
    def test_update_artifact_invalid_status(self, mock_get_user, client):
        """Test updating artifact with invalid status."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product and artifact
        product_response = client.post("/api/v1/products", json={
            "name": "Test Product",
        })
        product_id = product_response.json()["id"]

        files = {"file": ("test.txt", BytesIO(b"Hello"), "text/plain")}
        data = {"product_id": product_id, "name": "Test"}
        create_response = client.post("/api/v1/artifacts", files=files, data=data)
        artifact_id = create_response.json()["id"]

        # Try invalid status
        response = client.patch(
            f"/api/v1/artifacts/{artifact_id}",
            json={"status": "invalid"}
        )
        assert response.status_code == 400

    @patch("app.api.deps.get_current_user")
    def test_delete_artifact(self, mock_get_user, client):
        """Test deleting an artifact."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product and artifact
        product_response = client.post("/api/v1/products", json={
            "name": "Test Product",
        })
        product_id = product_response.json()["id"]

        files = {"file": ("test.txt", BytesIO(b"Hello"), "text/plain")}
        data = {"product_id": product_id, "name": "Test"}
        create_response = client.post("/api/v1/artifacts", files=files, data=data)
        artifact_id = create_response.json()["id"]

        # Delete the artifact
        response = client.delete(f"/api/v1/artifacts/{artifact_id}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/v1/artifacts/{artifact_id}")
        assert get_response.status_code == 404

    @patch("app.api.deps.get_current_user")
    def test_upload_new_version(self, mock_get_user, client):
        """Test uploading a new version of an artifact."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product and artifact
        product_response = client.post("/api/v1/products", json={
            "name": "Test Product",
        })
        product_id = product_response.json()["id"]

        files = {"file": ("test.txt", BytesIO(b"Version 1"), "text/plain")}
        data = {"product_id": product_id, "name": "Test"}
        create_response = client.post("/api/v1/artifacts", files=files, data=data)
        artifact_id = create_response.json()["id"]

        # Upload a new version
        new_files = {"file": ("test_v2.txt", BytesIO(b"Version 2"), "text/plain")}
        new_data = {"change_summary": "Updated content"}
        response = client.post(
            f"/api/v1/artifacts/{artifact_id}/versions",
            files=new_files,
            data=new_data
        )
        assert response.status_code == 201

        version = response.json()
        assert version["version_number"] == 2
        assert version["change_summary"] == "Updated content"

        # Verify artifact current_version was updated
        artifact_response = client.get(f"/api/v1/artifacts/{artifact_id}")
        assert artifact_response.json()["current_version"] == 2

    @patch("app.api.deps.get_current_user")
    def test_download_original_file(self, mock_get_user, client):
        """Test downloading the original file."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product and artifact
        product_response = client.post("/api/v1/products", json={
            "name": "Test Product",
        })
        product_id = product_response.json()["id"]

        file_content = b"Hello, this is test content!"
        files = {"file": ("test.txt", BytesIO(file_content), "text/plain")}
        data = {"product_id": product_id, "name": "Test"}
        create_response = client.post("/api/v1/artifacts", files=files, data=data)
        artifact_id = create_response.json()["id"]

        # Get artifact to find version ID
        artifact_response = client.get(f"/api/v1/artifacts/{artifact_id}")
        version_id = artifact_response.json()["versions"][0]["id"]

        # Download original
        response = client.get(
            f"/api/v1/artifacts/{artifact_id}/versions/{version_id}/original"
        )
        assert response.status_code == 200
        assert response.content == file_content

    @patch("app.api.deps.get_current_user")
    def test_upload_artifact_product_not_found(self, mock_get_user, client):
        """Test uploading artifact to non-existent product."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        files = {"file": ("test.txt", BytesIO(b"Hello"), "text/plain")}
        data = {"product_id": "nonexistent-id", "name": "Test"}
        response = client.post("/api/v1/artifacts", files=files, data=data)
        assert response.status_code == 404

    @patch("app.api.deps.get_current_user")
    def test_cascade_delete_with_product(self, mock_get_user, client):
        """Test that artifacts are deleted when product is deleted."""
        from app.api.deps import CurrentUser
        mock_get_user.return_value = CurrentUser(
            id="user-1",
            name="Test User",
            email="test@example.com"
        )

        # Create a product and artifact
        product_response = client.post("/api/v1/products", json={
            "name": "Test Product",
        })
        product_id = product_response.json()["id"]

        files = {"file": ("test.txt", BytesIO(b"Hello"), "text/plain")}
        data = {"product_id": product_id, "name": "Test"}
        create_response = client.post("/api/v1/artifacts", files=files, data=data)
        artifact_id = create_response.json()["id"]

        # Delete the product
        client.delete(f"/api/v1/products/{product_id}")

        # Verify artifact is also gone
        response = client.get(f"/api/v1/artifacts/{artifact_id}")
        assert response.status_code == 404


class TestArtifactConversionService:
    """Test cases for artifact conversion service."""

    @pytest.mark.asyncio
    async def test_convert_text_file(self):
        """Test converting a plain text file."""
        # Use shared artifacts package
        from artifacts import ArtifactConversionService

        service = ArtifactConversionService()
        content = b"Hello, this is a test file."

        markdown, success = await service._convert_text(content, "test.txt", "text/plain")

        assert success
        assert "test.txt" in markdown
        assert "Hello, this is a test file." in markdown

    @pytest.mark.asyncio
    async def test_convert_python_file(self):
        """Test converting a Python file."""
        # Use shared artifacts package
        from artifacts import ArtifactConversionService

        service = ArtifactConversionService()
        content = b"def hello():\n    print('Hello!')"

        markdown, success = await service._convert_text(content, "test.py", "text/plain")

        assert success
        assert "```python" in markdown
        assert "def hello():" in markdown

    @pytest.mark.asyncio
    async def test_convert_unknown_file(self):
        """Test converting an unknown file type."""
        # Use shared artifacts package
        from artifacts import ArtifactConversionService

        service = ArtifactConversionService()
        content = b"\x00\x01\x02\x03"  # Binary content

        markdown, success = await service._convert_unknown(
            content, "binary.dat", "application/octet-stream"
        )

        assert not success
        assert "binary.dat" in markdown
        assert "application/octet-stream" in markdown
        assert "cannot be converted" in markdown
